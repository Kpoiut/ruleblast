import { Minimatch } from "minimatch";
import { canonicalJson, sha256 } from "../canonical.js";
import { compareCodePoints, pathDirname } from "../domain/repository-path.js";
import type { Projection, ResolvedSource } from "../model.js";
import type { RepositorySnapshot, SnapshotEntry } from "../snapshot.js";
import {
  defineEvidenceRef,
  digestNormalizedPayload,
  unitizePayloadContributions,
  type PreparedProfile,
  type ProfileDefinition,
} from "../profiles/profile.js";
import { InvalidPackError } from "./compile.js";
import type { CompiledPack, DiscoverOrigin, FrontmatterApply } from "./schema.js";

const FILE_REFERENCE = /(?:^|\s)@([A-Za-z0-9_./-]+)/u;
const ENTRY_FIELDS = ["path", "kind", "executable"] as const;
const AT_REFERENCE_EVIDENCE =
  "Documented @ file references are visible but not expanded in this revision.";

interface Captured {
  readonly path: string;
  readonly kind: SnapshotEntry["kind"];
  readonly digest: string;
  readonly text: string;
  readonly origin: DiscoverOrigin;
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

function parseApplyTo(text: string, field: string): readonly string[] | null {
  if (!text.startsWith("---")) return null;
  const close = text.indexOf("\n---", 3);
  if (close === -1) return null;
  const match = new RegExp(`(?:^|\\n)${field}:\\s*(.+)\\s*`, "u").exec(text.slice(3, close));
  if (match === null) return null;
  const raw = match[1]!.trim().replace(/^["']|["']$/gu, "");
  if (raw === "") return [];
  return Object.freeze(raw.split(",").map((part) => part.trim()).filter(Boolean));
}

function matchesApplyTo(patterns: readonly string[], targetPath: string): boolean {
  return patterns.some((pattern) =>
    new Minimatch(pattern, { dot: true, nobrace: false }).match(targetPath)
  );
}

function applyOf(origin: DiscoverOrigin): FrontmatterApply | undefined {
  return origin.kind === "glob" ? origin.apply : undefined;
}

function globMatch(pattern: string, path: string): boolean {
  return new Minimatch(pattern, { dot: true }).match(path);
}

function originHits(origin: DiscoverOrigin, path: string): boolean {
  if (origin.kind === "fixed") return origin.paths.includes(path);
  if (origin.kind === "glob") return globMatch(origin.pattern, path);
  const slash = path.lastIndexOf("/");
  const name = slash === -1 ? path : path.slice(slash + 1);
  return origin.names.includes(name);
}

export function interpretSelectAllPack(pack: CompiledPack): ProfileDefinition {
  const resolver = pack.resolver;
  if (resolver.assemble.mode !== "unspecified" || resolver.select.mode !== "all") {
    throw new InvalidPackError(`select-all interpreter rejected ${pack.pack.id}`);
  }
  const origins = resolver.discover.origins;
  const claims = Object.freeze(pack.evidence.map((item) => item.claim));
  const atPartial = resolver.onAtReference === "partial-unexpanded";
  return Object.freeze({
    id: pack.pack.id,
    evidence: Object.freeze(pack.evidence.map((item) => defineEvidenceRef({
      url: item.sourceUrl,
      retrievedAt: item.retrievedAt,
      revision: item.sourceRevision,
      claim: item.claim,
    }))),
    isInstructionPath(path: string): boolean {
      return origins.some((origin) => originHits(origin, path));
    },
    async prepare(snapshot: RepositorySnapshot): Promise<PreparedProfile> {
      const paths = await snapshot.listPaths();
      const captured: Captured[] = [];
      for (const path of paths) {
        const origin = origins.find((item) => originHits(item, path));
        if (origin === undefined) continue;
        const entry = await snapshot.entry(path);
        if (entry === null) continue;
        const descriptors = Object.getOwnPropertyDescriptors(entry);
        if (
          Reflect.ownKeys(entry).length !== ENTRY_FIELDS.length ||
          ENTRY_FIELDS.some((field) => {
            const descriptor = descriptors[field];
            return descriptor === undefined || !("value" in descriptor);
          })
        ) {
          throw new TypeError(`Pack candidate entry must contain only own data fields: ${path}`);
        }
        const kind = descriptors.kind?.value;
        const executable = descriptors.executable?.value;
        if (
          descriptors.path?.value !== path ||
          (kind !== "file" && kind !== "symlink") ||
          typeof executable !== "boolean"
        ) {
          throw new TypeError(`Invalid pack candidate entry: ${path}`);
        }
        const bytes = await snapshot.read(path);
        if (bytes === null) continue;
        const text = new TextDecoder().decode(bytes);
        captured.push(Object.freeze({
          path,
          kind,
          text,
          digest: sha256(text),
          origin,
        }));
      }
      const ordered = [...captured].sort((left, right) => compareCodePoints(left.path, right.path));
      return Object.freeze({
        id: pack.pack.id,
        sourceDependencyPaths: Object.freeze(ordered.map((item) => item.path)),
        project(targetPath: string): Projection {
          const sources: ResolvedSource[] = [];
          const contributions: string[] = [];
          let partial = false;
          for (const document of ordered) {
            if (!isAncestor(scopeOf(document.path, document.origin), targetPath)) continue;
            const apply = applyOf(document.origin);
            if (apply !== undefined) {
              const patterns = parseApplyTo(document.text, apply.field);
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
        },
      });
    },
  });
}
