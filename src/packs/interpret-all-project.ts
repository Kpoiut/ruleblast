import { Minimatch } from "minimatch";
import { canonicalJson, sha256, sha256MovingTarget } from "../canonical.js";
import { compareCodePoints, pathBasename, pathDirname } from "../domain/repository-path.js";
import type { Projection, ResolvedSource } from "../model.js";
import type { SnapshotEntry } from "../snapshot.js";
import {
  digestNormalizedPayload,
  unitizePayloadContributions,
} from "../profiles/profile.js";
import {
  decideClaudeRule,
  type ClaudeProjectSettings,
  type ParsedClaudeRule,
} from "./ops-glob.js";
import {
  expandClaudeDocument,
  type CapturedClaudeFile,
  type PreparedClaudeDocument,
} from "./ops-markdown.js";
import type { CompiledPack, DiscoverOrigin, FrontmatterApply } from "./schema.js";

const FILE_REFERENCE = /(?:^|\s)@([A-Za-z0-9_./-]+)/u;
const AT_REFERENCE_EVIDENCE =
  "Documented @ file references are visible but not expanded in this revision.";

export interface Captured {
  readonly path: string;
  readonly kind: SnapshotEntry["kind"];
  readonly digest: string;
  readonly text: string;
  readonly bytes: Uint8Array;
  readonly origin: DiscoverOrigin;
  readonly discovered: boolean;
  readonly applyPatterns: readonly string[] | null;
  readonly content: string;
}

function isAncestor(scope: string, targetPath: string): boolean {
  return scope === "." || targetPath === scope || targetPath.startsWith(`${scope}/`);
}

function scopeOf(path: string, origin: DiscoverOrigin): string {
  const anchor = origin.kind === "ancestors" ? undefined : origin.scopeAnchor;
  if (anchor === undefined) return pathDirname(path);
  const token = `/${anchor}/`;
  const index = path.indexOf(token);
  if (index > 0) return path.slice(0, index);
  if (path.startsWith(`${anchor}/`)) return ".";
  return pathDirname(path);
}

function matchesApplyTo(patterns: readonly string[], targetPath: string): boolean {
  return patterns.some((pattern) =>
    new Minimatch(pattern, { dot: true, nobrace: false }).match(targetPath)
  );
}

function applyOf(origin: DiscoverOrigin): FrontmatterApply | undefined {
  return origin.kind === "glob" ? origin.apply : undefined;
}

export function projectCopilot(
  pack: CompiledPack,
  resolver: CompiledPack["resolver"],
  claims: readonly string[],
  atPartial: boolean,
  ordered: readonly Captured[],
  targetPath: string,
): Projection {
  const sources: ResolvedSource[] = [];
  const contributions: string[] = [];
  let partial = false;
  for (const document of ordered) {
    if (!isAncestor(scopeOf(document.path, document.origin), targetPath)) continue;
    const apply = applyOf(document.origin);
    if (apply !== undefined) {
      const patterns = document.applyPatterns;
      if (patterns === null && apply.ifAbsent === "exclude") {
        sources.push({
          path: document.path,
          disposition: "EXCLUDED",
          digest: document.digest,
          bytesUsed: 0,
          truncated: false,
        });
        continue;
      }
      if (patterns !== null && !matchesApplyTo(patterns, targetPath)) {
        sources.push({
          path: document.path,
          disposition: "EXCLUDED",
          digest: document.digest,
          bytesUsed: 0,
          truncated: false,
        });
        continue;
      }
    }
    const empty = document.text.trim() === "";
    sources.push({
      path: document.path,
      disposition: empty ? "SELECTED_EMPTY" : "SELECTED",
      digest: document.digest,
      bytesUsed: empty ? 0 : Buffer.byteLength(document.text),
      truncated: false,
    });
    if (!empty) contributions.push(document.text);
    if (atPartial && apply === undefined && FILE_REFERENCE.test(document.text)) {
      partial = true;
    }
  }
  const units = unitizePayloadContributions(contributions);
  const context = {
    cwd: resolver.context.cwd === "repository-root" ? "." : pathDirname(targetPath),
    trigger: resolver.context.trigger,
    targetPath,
    repositoryOnly: true as const,
  };
  const evidence = [...claims];
  if (partial) evidence.push(AT_REFERENCE_EVIDENCE);
  const status = partial ? "PARTIAL" : "COMPLETE";
  return {
    profile: pack.pack.id,
    context,
    status,
    composition: "UNSPECIFIED",
    sources,
    normalizedPayloadUnits: units,
    projectionDigest: sha256(canonicalJson({
      profile: pack.pack.id,
      context,
      sources: sources.map((source) => ({
        path: source.path,
        disposition: source.disposition,
        digest: source.digest,
      })),
    })),
    normalizedPayloadDigest: digestNormalizedPayload(units, "UNSPECIFIED"),
    evidence,
  };
}

function combineStatus(
  left: Projection["status"], right: Projection["status"],
): Projection["status"] {
  if (left === "UNKNOWN" || right === "UNKNOWN") return "UNKNOWN";
  return left === "PARTIAL" || right === "PARTIAL" ? "PARTIAL" : "COMPLETE";
}

export function projectMarkdown(
  pack: CompiledPack,
  resolver: CompiledPack["resolver"],
  revisions: readonly string[],
  ordered: readonly Captured[],
  files: ReadonlyMap<string, CapturedClaudeFile>,
  documents: ReadonlyMap<string, PreparedClaudeDocument>,
  settings: ClaudeProjectSettings,
  rules: ReadonlyMap<string, ParsedClaudeRule>,
  excludePath: string | undefined,
  maxDepth: number,
  targetPath: string,
): Projection {
  const environment = { documents, exclusion: (path: string) => settings.exclusion(path) };
  const state = {
    status: settings.status,
    sources: [] as ResolvedSource[],
    contributions: [] as string[],
    evidence: [...settings.evidence],
  };
  const collision = resolver.select.onSameBasename === "partial-no-payload";
  const byBasename = new Map<string, Captured[]>();
  const instruction = ordered.filter((row) => excludePath === undefined || row.path !== excludePath);
  for (const row of instruction) {
    const scope = scopeOf(row.path, row.origin);
    if (!isAncestor(scope, targetPath)) continue;
    const name = pathBasename(row.path);
    const group = byBasename.get(`${scope}\0${name}`) ?? [];
    group.push(row);
    byBasename.set(`${scope}\0${name}`, group);
  }
  const collided = new Set<string>();
  if (collision) {
    for (const [key, group] of byBasename) {
      if (group.length > 1 && key.endsWith(`\0${group[0] ? pathBasename(group[0].path) : ""}`)) {
        const names = new Set(group.map((item) => item.path));
        if (names.size > 1) {
          for (const item of group) collided.add(item.path);
        }
      }
    }
  }
  let selectedMemoryCount = 0;
  let applicableRules = 0;
  const globRows = instruction.filter((row) => row.discovered && row.origin.kind === "glob");
  const memoryRows = instruction.filter((row) => row.discovered && row.origin.kind !== "glob");
  const merge = (
    row: Captured,
    disposition: "SELECTED" | "APPLIED_RULE",
    collidedRow: boolean,
  ): void => {
    const file = files.get(row.path)!;
    const exclusion = settings.exclusion(row.path);
    state.status = combineStatus(state.status, exclusion.status);
    state.evidence.push(...exclusion.evidence);
    if (exclusion.applies === true) {
      state.sources.push({
        path: row.path, disposition: "EXCLUDED", digest: row.digest, bytesUsed: 0, truncated: false,
      });
      return;
    }
    if (file.kind === "symlink") {
      state.sources.push({
        path: row.path, disposition: "SELECTED", digest: row.digest, bytesUsed: 0, truncated: false,
      });
      state.evidence.push(
        `UNSUPPORTED_BOUNDARY: instruction symlink was not followed: ${row.path}`,
      );
      state.status = "UNKNOWN";
      return;
    }
    if (collidedRow) {
      state.sources.push({
        path: row.path, disposition: "SELECTED", digest: row.digest, bytesUsed: 0, truncated: false,
      });
      return;
    }
    const document = documents.get(row.path);
    if (document === undefined) return;
    const expansion = expandClaudeDocument(document, disposition, environment, maxDepth);
    state.status = combineStatus(state.status, expansion.status);
    state.sources.push(...expansion.sources);
    state.contributions.push(...expansion.contributions);
    state.evidence.push(...expansion.evidence);
    if (disposition === "SELECTED") selectedMemoryCount += 1;
    if (disposition === "APPLIED_RULE") applicableRules += 1;
  };
  if (collision) {
    const collidedGroup = memoryRows.filter((row) => collided.has(row.path));
    if (collidedGroup.length > 1) {
      state.status = combineStatus(state.status, "PARTIAL");
      state.evidence.push(
        "AMBIGUOUS_ROOT_MEMORY: both CLAUDE.md and .claude/CLAUDE.md are tracked; order is not pinned",
      );
    }
  }
  const memoryOrder = [...memoryRows].sort((left, right) => {
    const rank = (path: string): number => {
      if (path === "CLAUDE.md") return 0;
      if (path === ".claude/CLAUDE.md") return 1;
      return 2;
    };
    const delta = rank(left.path) - rank(right.path);
    return delta !== 0 ? delta : compareCodePoints(left.path, right.path);
  });
  for (const row of memoryOrder) {
    if (!isAncestor(scopeOf(row.path, row.origin), targetPath)) continue;
    merge(row, "SELECTED", collided.has(row.path));
    if (pathBasename(row.path) === "CLAUDE.local.md" && !collided.has(row.path)) {
      const exclusion = settings.exclusion(row.path);
      if (exclusion.applies !== true && files.get(row.path)?.kind === "file") {
        state.evidence.push(
          "LOCAL_PROJECT_MEMORY: tracked CLAUDE.local.md included in repository-only projection",
        );
      }
    }
  }
  for (const row of globRows) {
    const file = files.get(row.path)!;
    const rule = rules.get(row.path);
    if (rule === undefined) continue;
    const exclusion = settings.exclusion(row.path);
    state.status = combineStatus(state.status, exclusion.status);
    state.evidence.push(...exclusion.evidence);
    if (exclusion.applies === true) {
      state.sources.push({
        path: row.path, disposition: "EXCLUDED", digest: row.digest, bytesUsed: 0, truncated: false,
      });
      continue;
    }
    const decision = decideClaudeRule(rule, targetPath);
    state.status = combineStatus(state.status, decision.status);
    state.evidence.push(...decision.evidence);
    if (decision.applies === true) {
      merge(row, "APPLIED_RULE", false);
    } else if (file.kind === "symlink" || rule.malformed) {
      state.sources.push({
        path: row.path, disposition: "SELECTED", digest: row.digest, bytesUsed: 0, truncated: false,
      });
    }
  }
  const composition = applicableRules > 1 || (applicableRules > 0 && selectedMemoryCount > 0)
    ? "UNSPECIFIED" as const
    : "ORDERED" as const;
  const units = unitizePayloadContributions(state.contributions);
  const context = {
    cwd: ".",
    trigger: resolver.context.trigger,
    targetPath,
    repositoryOnly: true as const,
  };
  const effectiveSources = state.sources.map(({ path, disposition, truncated }) => ({
    path, disposition, truncated,
  }));
  const digestFor = sha256MovingTarget((path) => ({
    composition,
    context: {
      cwd: ".",
      repositoryOnly: true,
      targetPath: path,
      trigger: "READ_TARGET",
    },
    effectiveSources,
    evidence: state.evidence,
    evidenceRevisions: revisions,
    normalizedPayloadUnits: units,
    profile: pack.pack.id,
    status: state.status,
  }));
  return {
    profile: pack.pack.id,
    context,
    status: state.status,
    composition,
    sources: state.sources,
    normalizedPayloadUnits: units,
    projectionDigest: digestFor(targetPath),
    normalizedPayloadDigest: digestNormalizedPayload(units, composition),
    evidence: state.evidence,
  };
}
