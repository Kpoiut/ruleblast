import { sha256, sha256MovingTarget } from "../canonical.js";
import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  type Projection,
  type ResolvedSource,
} from "../model.js";
import type { RepositorySnapshot } from "../snapshot.js";
import {
  expandClaudeDocument,
  listClaudeImportReferences,
  prepareClaudeDocument,
  resolveClaudeImportPath,
  type CapturedClaudeFile,
  type ClaudeDocumentExpansion,
  type ClaudeImportEnvironment,
  type PreparedClaudeDocument,
} from "./claude-imports.js";
import {
  decideClaudeRule,
  isClaudeRulePath,
  parseClaudeProjectSettings,
  parseClaudeRule,
  type ClaudeProjectSettings,
  type ParsedClaudeRule,
} from "./claude-rules.js";
import { compareCodePoints } from "../domain/repository-path.js";
import {
  defineEvidenceRef,
  digestNormalizedPayload,
  unitizePayloadContributions,
  type EvidenceRef,
  type PreparedProfile,
  type ProfileDefinition,
} from "./profile.js";

const ROOT_MEMORY = "CLAUDE.md";
const DOT_ROOT_MEMORY = ".claude/CLAUDE.md";
const SETTINGS_PATH = ".claude/settings.json";
const MEMORY_NAMES = new Set(["CLAUDE.md", "CLAUDE.local.md"]);
const ENTRY_FIELDS = ["path", "kind", "executable"] as const;

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function dirname(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "." : path.slice(0, slash);
}

/** Rules match full paths; without rules, resolution changes only by directory. */
function claudeResolutionCacheKey(targetPath: string, hasRules: boolean): string {
  return hasRules ? targetPath : dirname(targetPath);
}

function ancestorDirectories(path: string): readonly string[] {
  const directory = dirname(path);
  if (directory === ".") return ["."];
  const parts = directory.split("/");
  return [".", ...parts.map((_, index) => parts.slice(0, index + 1).join("/"))];
}

function candidatePath(directory: string, name: string): string {
  return directory === "." ? name : `${directory}/${name}`;
}

function isMemoryPath(path: string): boolean {
  return MEMORY_NAMES.has(basename(path)) && !isClaudeRulePath(path);
}

function isDirectCandidate(path: string): boolean {
  return isMemoryPath(path) || isClaudeRulePath(path) || path === SETTINGS_PATH;
}

function captureEntry(value: unknown, expectedPath: string): Omit<CapturedClaudeFile, "bytes"> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Claude candidate entry must be an object: ${expectedPath}`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== ENTRY_FIELDS.length ||
      ENTRY_FIELDS.some((field) => !Object.hasOwn(descriptors, field) ||
        !("value" in descriptors[field]!))) {
    throw new TypeError(`Claude candidate entry must contain only own data fields: ${expectedPath}`);
  }
  const path = descriptors.path?.value;
  const kind = descriptors.kind?.value;
  if (path !== expectedPath || (kind !== "file" && kind !== "symlink") ||
      typeof descriptors.executable?.value !== "boolean") {
    throw new TypeError(`Invalid Claude candidate entry: ${expectedPath}`);
  }
  return Object.freeze({ path, kind });
}

function combineStatus(
  left: Projection["status"], right: Projection["status"],
): Projection["status"] {
  if (left === "UNKNOWN" || right === "UNKNOWN") return "UNKNOWN";
  return left === "PARTIAL" || right === "PARTIAL" ? "PARTIAL" : "COMPLETE";
}

interface Resolution {
  readonly status: Projection["status"];
  readonly composition: Projection["composition"];
  readonly sources: readonly ResolvedSource[];
  readonly contributions: readonly string[];
  readonly evidence: readonly string[];
}

interface ProjectionMaterial {
  readonly status: Projection["status"];
  readonly composition: Projection["composition"];
  readonly sources: readonly ResolvedSource[];
  readonly units: readonly (readonly string[])[];
  readonly normalizedPayloadDigest: string;
  readonly evidence: readonly string[];
  readonly effectiveSources: readonly {
    path: string; disposition: ResolvedSource["disposition"]; truncated: boolean;
  }[];
}

function boundarySource(
  file: CapturedClaudeFile, disposition: ResolvedSource["disposition"],
): ResolvedSource {
  return {
    path: file.path, disposition, digest: sha256(file.bytes),
    bytesUsed: 0, truncated: false,
  };
}

function mergeExpansion(
  state: { status: Projection["status"]; sources: ResolvedSource[];
    contributions: string[]; evidence: string[] },
  expansion: ClaudeDocumentExpansion,
): void {
  state.status = combineStatus(state.status, expansion.status);
  state.sources.push(...expansion.sources);
  state.contributions.push(...expansion.contributions);
  state.evidence.push(...expansion.evidence);
}

function projectionMaterial(resolution: Resolution): ProjectionMaterial {
  const units = unitizePayloadContributions(resolution.contributions);
  return {
    status: resolution.status,
    composition: resolution.composition,
    sources: resolution.sources,
    units,
    normalizedPayloadDigest: digestNormalizedPayload(units, resolution.composition),
    evidence: resolution.evidence,
    effectiveSources: resolution.sources.map(({ path, disposition, truncated }) =>
      ({ path, disposition, truncated })),
  };
}

function makeProjection(
  material: ProjectionMaterial,
  targetPath: string,
  profileId: string,
  digestFor: (targetPath: string) => string,
): Projection {
  const context = {
    cwd: ".", trigger: "READ_TARGET" as const, targetPath, repositoryOnly: true as const,
  };
  const projectionDigest = digestFor(targetPath);
  return {
    profile: profileId,
    context,
    status: material.status,
    composition: material.composition,
    sources: material.sources.map((item) => ({ ...item })),
    normalizedPayloadUnits: material.units.map((unit) => [...unit]),
    projectionDigest,
    normalizedPayloadDigest: material.normalizedPayloadDigest,
    evidence: [...material.evidence],
  };
}

function resolveTarget(
  targetPath: string,
  files: ReadonlyMap<string, CapturedClaudeFile>,
  rules: readonly ParsedClaudeRule[],
  documents: ReadonlyMap<string, PreparedClaudeDocument>,
  settings: ClaudeProjectSettings,
): Resolution {
  const state = {
    status: settings.status,
    sources: [] as ResolvedSource[],
    contributions: [] as string[],
    evidence: [...settings.evidence],
  };
  const environment: ClaudeImportEnvironment = {
    documents, exclusion: (path) => settings.exclusion(path),
  };
  let selectedMemoryCount = 0;
  const roots = [ROOT_MEMORY, DOT_ROOT_MEMORY].flatMap((path) => {
    const file = files.get(path);
    if (file === undefined) return [];
    const exclusion = settings.exclusion(path);
    state.status = combineStatus(state.status, exclusion.status);
    state.evidence.push(...exclusion.evidence);
    return [{ file, excluded: exclusion.applies === true }];
  });
  const liveRootCount = roots.filter(
    ({ file, excluded }) => !excluded && file.kind === "file",
  ).length;
  if (liveRootCount === 2) {
    state.status = combineStatus(state.status, "PARTIAL");
    state.evidence.push(
      "AMBIGUOUS_ROOT_MEMORY: both CLAUDE.md and .claude/CLAUDE.md are tracked; order is not pinned");
  }
  for (const { file, excluded } of roots) {
    if (excluded) state.sources.push(boundarySource(file, "EXCLUDED"));
    else if (file.kind === "symlink") {
      state.sources.push(boundarySource(file, "SELECTED"));
      state.evidence.push(
        `UNSUPPORTED_BOUNDARY: Claude instruction symlink was not followed: ${file.path}`);
      state.status = "UNKNOWN";
    } else if (liveRootCount === 2) {
      state.sources.push(boundarySource(file, "SELECTED"));
    } else {
      selectedMemoryCount += 1;
      mergeExpansion(state,
        expandClaudeDocument(documents.get(file.path)!, "SELECTED", environment));
    }
  }
  for (const directory of ancestorDirectories(targetPath)) {
    const paths = directory === "."
      ? ["CLAUDE.local.md"]
      : [candidatePath(directory, "CLAUDE.md"), candidatePath(directory, "CLAUDE.local.md")];
    for (const path of paths) {
      if (path === DOT_ROOT_MEMORY) continue;
      const memory = files.get(path);
      if (memory === undefined) continue;
      const exclusion = settings.exclusion(path);
      state.status = combineStatus(state.status, exclusion.status);
      state.evidence.push(...exclusion.evidence);
      if (exclusion.applies === true) {
        state.sources.push(boundarySource(memory, "EXCLUDED"));
      } else if (memory.kind === "symlink") {
        state.sources.push(boundarySource(memory, "SELECTED"));
        state.evidence.push(
          `UNSUPPORTED_BOUNDARY: Claude instruction symlink was not followed: ${path}`);
        state.status = "UNKNOWN";
      } else {
        selectedMemoryCount += 1;
        mergeExpansion(state, expandClaudeDocument(documents.get(path)!, "SELECTED", environment));
        if (basename(path) === "CLAUDE.local.md") {
          state.evidence.push(
            "LOCAL_PROJECT_MEMORY: tracked CLAUDE.local.md included in repository-only projection");
        }
      }
    }
  }

  let applicableRules = 0;
  for (const rule of rules) {
    const exclusion = settings.exclusion(rule.file.path);
    state.status = combineStatus(state.status, exclusion.status);
    state.evidence.push(...exclusion.evidence);
    if (exclusion.applies === true) {
      state.sources.push(boundarySource(rule.file, "EXCLUDED"));
      continue;
    }
    const decision = decideClaudeRule(rule, targetPath);
    state.status = combineStatus(state.status, decision.status);
    state.evidence.push(...decision.evidence);
    if (decision.applies === true) {
      applicableRules += 1;
      mergeExpansion(state,
        expandClaudeDocument(documents.get(rule.file.path)!, "APPLIED_RULE", environment));
    } else if (rule.file.kind === "symlink" || rule.malformed) {
      state.sources.push(boundarySource(rule.file, "SELECTED"));
    }
  }
  return {
    status: state.status,
    composition: applicableRules > 1 || (applicableRules > 0 && selectedMemoryCount > 0)
      ? "UNSPECIFIED" : "ORDERED",
    sources: state.sources,
    contributions: state.contributions,
    evidence: state.evidence,
  };
}

interface CapturedState {
  readonly files: ReadonlyMap<string, CapturedClaudeFile>;
  readonly documents: ReadonlyMap<string, PreparedClaudeDocument>;
  readonly rules: readonly ParsedClaudeRule[];
}

async function captureDependencies(
  snapshot: RepositorySnapshot,
): Promise<CapturedState> {
  const inventory = new Set(await snapshot.listPaths());
  const direct = [...inventory].filter(isDirectCandidate).sort(compareCodePoints);
  const pending = direct.map((path) => ({ path, depth: 0 }));
  const queued = new Map(direct.map((path) => [path, 0]));
  const files = new Map<string, CapturedClaudeFile>();
  const documents = new Map<string, PreparedClaudeDocument>();
  const rules: ParsedClaudeRule[] = [];
  while (pending.length > 0) {
    const { path, depth } = pending.shift()!;
    const entry = await snapshot.entry(path);
    if (entry === null) throw new Error(`Missing Claude snapshot entry during preparation: ${path}`);
    const captured = captureEntry(entry, path);
    const bytes = await snapshot.read(path);
    if (bytes === null) throw new Error(`Missing Claude snapshot bytes during preparation: ${path}`);
    const file = Object.freeze({ ...captured, bytes: new Uint8Array(bytes) });
    files.set(path, file);
    if (file.kind === "symlink" || path === SETTINGS_PATH || depth >= 4) continue;
    const rule = isClaudeRulePath(path) ? parseClaudeRule(file) : null;
    if (rule !== null) rules.push(rule);
    const document = prepareClaudeDocument(file,
      rule?.body ?? new TextDecoder().decode(file.bytes));
    documents.set(path, document);
    for (const imported of listClaudeImportReferences(document)) {
      const dependency = resolveClaudeImportPath(path, imported);
      const nextDepth = depth + 1;
      if (dependency !== null && inventory.has(dependency) &&
          (queued.get(dependency) ?? Number.POSITIVE_INFINITY) > nextDepth) {
        queued.set(dependency, nextDepth);
        pending.push({ path: dependency, depth: nextDepth });
        pending.sort((left, right) =>
          left.depth - right.depth || compareCodePoints(left.path, right.path));
      }
    }
  }
  for (const file of files.values()) {
    if (!documents.has(file.path)) documents.set(file.path, prepareClaudeDocument(file));
    if (isClaudeRulePath(file.path) && !rules.some((rule) => rule.file.path === file.path)) {
      rules.push(parseClaudeRule(file));
    }
  }
  rules.sort((left, right) => compareCodePoints(left.file.path, right.file.path));
  return { files, documents, rules };
}

const EVIDENCE_CLAIMS = [
  ["memory-locations", "Claude Code documents project and local memory locations."],
  ["ancestor-loading", "Claude Code documents ancestor and nested on-demand memory loading."],
  ["imports", "Claude Code documents relative recursive @path imports and their bounded depth."],
  ["rules", "Claude Code documents recursively discovered project rules."],
  ["path-globs", "Claude Code documents path glob and brace patterns for conditional rules."],
  ["excludes", "Claude Code documents claudeMdExcludes matched against absolute paths."],
  ["comments", "Claude Code documents HTML comment stripping with fenced-code preservation."],
] as const;

const CLAUDE_EVIDENCE = Object.freeze(EVIDENCE_CLAIMS.map(([revision, claim]) =>
  defineEvidenceRef({
    url: "https://code.claude.com/docs/en/memory",
    retrievedAt: "2026-08-12",
    revision: `anthropic/claude-code-cli@1:${revision}`,
    claim,
  })));

export function createClaudeProfile(config: {
  readonly id: string;
  readonly evidence: readonly EvidenceRef[];
}): ProfileDefinition {
  const revisions = Object.freeze(config.evidence.map((item) => item.revision));
  return Object.freeze({
    id: config.id,
    evidence: config.evidence,
    isInstructionPath: isDirectCandidate,
    async prepare(snapshot: RepositorySnapshot): Promise<PreparedProfile> {
      const { files, documents, rules } = await captureDependencies(snapshot);
      const settings = parseClaudeProjectSettings(files.get(SETTINGS_PATH));
      const sourceDependencyPaths = Object.freeze([...files.keys()].sort(compareCodePoints));
      const cache = new Map<string, {
        readonly material: ProjectionMaterial;
        readonly digestFor: (targetPath: string) => string;
      }>();
      return Object.freeze({
        id: config.id,
        sourceDependencyPaths,
        project(targetPath: string): Projection {
          const cacheKey = claudeResolutionCacheKey(targetPath, rules.length > 0);
          let cached = cache.get(cacheKey);
          if (cached === undefined) {
            const material = projectionMaterial(
              resolveTarget(targetPath, files, rules, documents, settings),
            );
            cached = {
              material,
              digestFor: sha256MovingTarget((path) => ({
                composition: material.composition,
                context: {
                  cwd: ".",
                  repositoryOnly: true,
                  targetPath: path,
                  trigger: "READ_TARGET",
                },
                effectiveSources: material.effectiveSources,
                evidence: material.evidence,
                evidenceRevisions: revisions,
                normalizedPayloadUnits: material.units,
                profile: config.id,
                status: material.status,
              })),
            };
            cache.set(cacheKey, cached);
          }
          return makeProjection(cached.material, targetPath, config.id, cached.digestFor);
        },
      });
    },
  });
}

export const claudeProfile: ProfileDefinition = createClaudeProfile({
  id: ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  evidence: CLAUDE_EVIDENCE,
});
