import { sha256, sha256MovingTarget } from "../canonical.js";
import {
  compareCodePoints,
  joinRepositoryPath,
  pathBasename,
  pathDirname,
} from "../domain/repository-path.js";
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
import { interpretSelectAllPack } from "./interpret-all.js";
import type { CompiledPack, DiscoverOrigin, ResolverSpec } from "./schema.js";

const BOUNDARY_EVIDENCE =
  "UNSUPPORTED_BOUNDARY: named Codex instruction symlink was not followed";
const ENTRY_FIELDS = ["path", "kind", "executable"] as const;

interface Candidate {
  readonly path: string;
  readonly kind: SnapshotEntry["kind"];
  readonly executable: boolean;
  readonly bytes: Uint8Array;
  readonly digest: string;
}

interface Resolution {
  readonly status: Projection["status"];
  readonly sources: readonly ResolvedSource[];
  readonly contributions: readonly string[];
  readonly evidence: readonly string[];
}

interface DirectoryState extends Resolution {
  readonly remaining: number;
}

function source(
  path: string,
  disposition: ResolvedSource["disposition"],
  digest: string,
  bytesUsed: number,
  truncated: boolean,
): ResolvedSource {
  return { path, disposition, digest, bytesUsed, truncated };
}

function originExecutable(origin: DiscoverOrigin, reasons: string[]): void {
  if (origin.kind === "ancestors") {
    if (origin.from !== "repositoryRoot" || origin.inclusive !== true) {
      reasons.push("discover.range");
    }
    if (origin.to !== "cwd" && origin.to !== "dirname-target") reasons.push("discover.range");
    if (origin.names.length === 0) reasons.push("discover.names");
    return;
  }
  if (origin.kind === "fixed" || origin.kind === "glob") return;
  reasons.push("discover.origin");
}

function orderedBudgetFamily(resolver: ResolverSpec): boolean {
  return resolver.select.mode === "first-per-directory" &&
    resolver.assemble.mode === "ordered" &&
    resolver.transform[0]?.kind === "byte-budget";
}

function selectAllFamily(resolver: ResolverSpec): boolean {
  return resolver.select.mode === "all" && resolver.assemble.mode === "unspecified";
}

export function uninterpretableReasons(resolver: ResolverSpec): readonly string[] {
  const reasons: string[] = [];
  if (resolver.onSymlink !== "unknown-unfollowed") reasons.push("onSymlink");
  if (resolver.discover.origins.length === 0) reasons.push("discover.origins");
  for (const origin of resolver.discover.origins) originExecutable(origin, reasons);
  for (const transform of resolver.transform) {
    if (transform.kind === "byte-budget" && typeof transform.bytes === "number" && transform.bytes > 0) {
      continue;
    }
    if (transform.kind === "strip-html-comments") continue;
    if (
      transform.kind === "at-path-import" &&
      typeof transform.maxDepth === "number" &&
      transform.maxDepth > 0 &&
      (transform.lexer === "claude-markdown-v1" || transform.lexer === "gemini-markdown-v1")
    ) {
      continue;
    }
    if (
      transform.kind === "json-exclude-globs" &&
      typeof transform.path === "string" &&
      typeof transform.field === "string"
    ) {
      continue;
    }
    reasons.push("transform");
    break;
  }
  if (
    resolver.onAtReference !== undefined &&
    resolver.onAtReference !== "ignore" &&
    resolver.onAtReference !== "partial-unexpanded"
  ) {
    reasons.push("onAtReference");
  }
  if (!orderedBudgetFamily(resolver) && !selectAllFamily(resolver)) {
    reasons.push(resolver.select.mode === "all" ? "assemble" : "select");
  }
  return Object.freeze([...new Set(reasons)]);
}

export function canInterpretResolver(resolver: ResolverSpec): boolean {
  return uninterpretableReasons(resolver).length === 0;
}

function resolveDirectory(
  directory: string,
  candidates: ReadonlyMap<string, Candidate>,
  remaining: number,
  names: readonly string[],
  shadows: Readonly<Record<string, readonly string[]>>,
): { readonly resolution: Resolution; readonly consumed: number } {
  let selected: Candidate | undefined;
  let selectedName: string | undefined;
  for (const name of names) {
    const found = candidates.get(joinRepositoryPath(directory, name));
    if (found !== undefined) {
      selected = found;
      selectedName = name;
      break;
    }
  }
  if (selected === undefined || selectedName === undefined) {
    return {
      resolution: { status: "COMPLETE", sources: [], contributions: [], evidence: [] },
      consumed: 0,
    };
  }
  const sources: ResolvedSource[] = [];
  const evidence: string[] = [];
  const shadowedNames = shadows[selectedName] ?? [];
  if (selected.kind === "symlink") {
    sources.push(source(selected.path, "SELECTED", selected.digest, 0, false));
    evidence.push(`${BOUNDARY_EVIDENCE}: ${selected.path}`);
    for (const name of shadowedNames) {
      const shadowed = candidates.get(joinRepositoryPath(directory, name));
      if (shadowed !== undefined) {
        sources.push(source(shadowed.path, "SHADOWED", shadowed.digest, 0, false));
      }
    }
    return { resolution: { status: "UNKNOWN", sources, contributions: [], evidence }, consumed: 0 };
  }
  const raw = selected.bytes;
  const included = raw.slice(0, remaining);
  const truncated = included.length < raw.length;
  const text = new TextDecoder().decode(included);
  const isEmpty = text.trim() === "";
  sources.push(source(
    selected.path,
    isEmpty ? "SELECTED_EMPTY" : "SELECTED",
    selected.digest,
    isEmpty ? 0 : included.length,
    truncated,
  ));
  for (const name of shadowedNames) {
    const shadowed = candidates.get(joinRepositoryPath(directory, name));
    if (shadowed !== undefined) {
      sources.push(source(shadowed.path, "SHADOWED", shadowed.digest, 0, false));
    }
  }
  return {
    resolution: {
      status: "COMPLETE",
      sources,
      contributions: isEmpty ? [] : [text],
      evidence,
    },
    consumed: isEmpty ? 0 : included.length,
  };
}

function emptyDirectoryState(byteLimit: number): DirectoryState {
  return {
    status: "COMPLETE",
    sources: [],
    contributions: [],
    evidence: [],
    remaining: byteLimit,
  };
}

function advanceDirectory(
  parent: DirectoryState,
  directory: string,
  candidates: ReadonlyMap<string, Candidate>,
  names: readonly string[],
  shadows: Readonly<Record<string, readonly string[]>>,
): DirectoryState {
  const step = resolveDirectory(directory, candidates, parent.remaining, names, shadows);
  return {
    status: parent.status === "UNKNOWN" || step.resolution.status === "UNKNOWN"
      ? "UNKNOWN"
      : "COMPLETE",
    sources: [...parent.sources, ...step.resolution.sources],
    contributions: [...parent.contributions, ...step.resolution.contributions],
    evidence: [...parent.evidence, ...step.resolution.evidence],
    remaining: parent.remaining - step.consumed,
  };
}

function assembleOrdered(contributions: readonly string[]): string {
  return contributions.filter((contribution) => contribution !== "").join("\n\n");
}

export function interpretCompiledPack(pack: CompiledPack): ProfileDefinition {
  if (!canInterpretResolver(pack.resolver)) {
    throw new InvalidPackError(
      `resolver spec is not data-interpretable: ${pack.pack.id}`,
    );
  }
  if (
    pack.resolver.select.mode !== "first-per-directory" ||
    pack.resolver.assemble.mode !== "ordered" ||
    pack.resolver.transform[0]?.kind !== "byte-budget"
  ) {
    return interpretSelectAllPack(pack);
  }
  const names = pack.resolver.select.names;
  const shadows = pack.resolver.select.shadows;
  const byteLimit = pack.resolver.transform[0]?.bytes;
  if (byteLimit === undefined) {
    throw new InvalidPackError(`byte-budget missing for ${pack.pack.id}`);
  }
  const nameSet = new Set(names);
  const revisions = Object.freeze(pack.evidence.map((item) => item.sourceRevision));
  return Object.freeze({
    id: pack.pack.id,
    evidence: Object.freeze(pack.evidence.map((item) => defineEvidenceRef({
      url: item.sourceUrl,
      retrievedAt: item.retrievedAt,
      revision: item.sourceRevision,
      claim: item.claim,
    }))),
    isInstructionPath(path: string): boolean {
      return nameSet.has(pathBasename(path));
    },
    async prepare(snapshot: RepositorySnapshot): Promise<PreparedProfile> {
      const paths = await snapshot.listPaths();
      const candidatePaths = [
        ...new Set(paths.filter((path) => nameSet.has(pathBasename(path)))),
      ].sort(compareCodePoints);
      const candidates = new Map<string, Candidate>();
      for (const path of candidatePaths) {
        const entry = await snapshot.entry(path);
        if (entry === null) {
          throw new Error(`Missing pack candidate entry during preparation: ${path}`);
        }
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
        if (bytes === null) {
          throw new Error(`Missing pack candidate bytes during preparation: ${path}`);
        }
        const copy = new Uint8Array(bytes);
        candidates.set(path, Object.freeze({
          path,
          kind,
          executable,
          bytes: copy,
          digest: sha256(copy),
        }));
      }
      const cached = new Map<string, Projection>();
      const materials = new Map<string, {
        readonly material: ReturnType<typeof projectMaterial>;
        readonly digestFor: (targetPath: string) => string;
      }>();
      const directoryState = new Map<string, DirectoryState>();
      const stateFor = (directory: string): DirectoryState => {
        const hit = directoryState.get(directory);
        if (hit !== undefined) return hit;
        const parent = directory === "."
          ? emptyDirectoryState(byteLimit)
          : stateFor(pathDirname(directory));
        const state = advanceDirectory(parent, directory, candidates, names, shadows);
        directoryState.set(directory, state);
        return state;
      };
      return Object.freeze({
        id: pack.pack.id,
        sourceDependencyPaths: Object.freeze([...candidates.keys()].sort(compareCodePoints)),
        project(targetPath: string): Projection {
          const directory = pathDirname(targetPath);
          let cachedMaterial = materials.get(directory);
          if (cachedMaterial === undefined) {
            const material = projectMaterial(stateFor(directory));
            cachedMaterial = {
              material,
              digestFor: sha256MovingTarget((path) => ({
                assembledPayload: material.assembledPayload,
                composition: "ORDERED",
                context: {
                  cwd: directory,
                  repositoryOnly: true,
                  targetPath: path,
                  trigger: "STARTUP",
                },
                effectiveSources: material.effectiveSources,
                evidenceRevisions: revisions,
                normalizedPayloadUnits: material.units,
                profile: pack.pack.id,
                status: material.status,
              })),
            };
            materials.set(directory, cachedMaterial);
          }
          const existing = cached.get(targetPath);
          if (existing !== undefined) return existing;
          const projection = makeProjection(
            cachedMaterial.material, targetPath, pack.pack.id, cachedMaterial.digestFor,
          );
          cached.set(targetPath, projection);
          return projection;
        },
      });
    },
  });
}

function projectMaterial(resolution: Resolution) {
  const units = unitizePayloadContributions(resolution.contributions);
  return {
    status: resolution.status,
    sources: resolution.sources,
    units,
    normalizedPayloadDigest: digestNormalizedPayload(units, "ORDERED"),
    evidence: resolution.evidence,
    assembledPayload: assembleOrdered(resolution.contributions),
    effectiveSources: resolution.sources
      .filter((item) => item.disposition === "SELECTED" || item.disposition === "SELECTED_EMPTY")
      .map(({ path, disposition, bytesUsed, truncated }) =>
        ({ path, disposition, bytesUsed, truncated })),
  };
}

function makeProjection(
  material: ReturnType<typeof projectMaterial>,
  targetPath: string,
  profileId: string,
  digestFor: (targetPath: string) => string,
): Projection {
  const context = {
    cwd: pathDirname(targetPath),
    trigger: "STARTUP" as const,
    targetPath,
    repositoryOnly: true as const,
  };
  return {
    profile: profileId,
    context,
    status: material.status,
    composition: "ORDERED",
    sources: material.sources.map((item) => ({ ...item })),
    normalizedPayloadUnits: material.units.map((unit) => [...unit]),
    projectionDigest: digestFor(targetPath),
    normalizedPayloadDigest: material.normalizedPayloadDigest,
    evidence: [...material.evidence],
  };
}
