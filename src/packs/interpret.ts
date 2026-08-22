import { sha256, sha256MovingTarget } from "../canonical.js";
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
import type { CompiledPack, ResolverSpec } from "./schema.js";

const BOUNDARY_EVIDENCE =
  "UNSUPPORTED_BOUNDARY: named Codex instruction symlink was not followed";
const ENTRY_FIELDS = ["path", "kind", "executable"] as const;

interface Candidate {
  readonly path: string;
  readonly kind: SnapshotEntry["kind"];
  readonly executable: boolean;
  readonly bytes: Uint8Array;
}

interface Resolution {
  readonly status: Projection["status"];
  readonly sources: readonly ResolvedSource[];
  readonly contributions: readonly string[];
  readonly evidence: readonly string[];
}

function compareCodePoints(left: string, right: string): number {
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftPoint = left.codePointAt(leftIndex);
    const rightPoint = right.codePointAt(rightIndex);
    if (leftPoint === undefined || rightPoint === undefined) {
      throw new Error("Unable to compare pack interpreter paths");
    }
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
    leftIndex += leftPoint > 0xffff ? 2 : 1;
    rightIndex += rightPoint > 0xffff ? 2 : 1;
  }
  return leftIndex === left.length ? (rightIndex === right.length ? 0 : -1) : 1;
}

function basename(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

function dirname(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "." : path.slice(0, slash);
}

function ancestorDirectories(targetPath: string): string[] {
  const targetDirectory = dirname(targetPath);
  if (targetDirectory === ".") return ["."];
  const segments = targetDirectory.split("/");
  return [".", ...segments.map((_, index) => segments.slice(0, index + 1).join("/"))];
}

function candidatePath(directory: string, name: string): string {
  return directory === "." ? name : `${directory}/${name}`;
}

function source(
  path: string,
  disposition: ResolvedSource["disposition"],
  digestBytes: Uint8Array,
  bytesUsed: number,
  truncated: boolean,
): ResolvedSource {
  return { path, disposition, digest: sha256(digestBytes), bytesUsed, truncated };
}

export function uninterpretableReasons(resolver: ResolverSpec): readonly string[] {
  const reasons: string[] = [];
  if (resolver.context.cwd !== "dirname-target") reasons.push("context.cwd");
  if (resolver.context.trigger !== "STARTUP") reasons.push("context.trigger");
  if (resolver.assemble.mode !== "ordered") reasons.push("assemble.mode");
  if (resolver.onSymlink !== "unknown-unfollowed") reasons.push("onSymlink");
  if (resolver.select.mode !== "first-per-directory") reasons.push("select.mode");
  if (resolver.discover.origins.length !== 1) reasons.push("discover.origins");
  const origin = resolver.discover.origins[0];
  if (origin === undefined || origin.kind !== "ancestors") {
    reasons.push("discover.origin");
  } else {
    if (origin.from !== "repositoryRoot" || origin.to !== "cwd" || origin.inclusive !== true) {
      reasons.push("discover.range");
    }
    if (origin.names.length === 0) reasons.push("discover.names");
    if (
      resolver.select.names.length !== origin.names.length ||
      origin.names.some((name, index) => name !== resolver.select.names[index])
    ) {
      reasons.push("select.names");
    }
  }
  const transform = resolver.transform[0];
  if (
    resolver.transform.length !== 1 ||
    transform === undefined ||
    transform.kind !== "byte-budget" ||
    typeof transform.bytes !== "number" ||
    transform.bytes <= 0
  ) {
    reasons.push("transform");
  }
  return Object.freeze(reasons);
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
    const found = candidates.get(candidatePath(directory, name));
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
    sources.push(source(selected.path, "SELECTED", selected.bytes, 0, false));
    evidence.push(`${BOUNDARY_EVIDENCE}: ${selected.path}`);
    for (const name of shadowedNames) {
      const shadowed = candidates.get(candidatePath(directory, name));
      if (shadowed !== undefined) {
        sources.push(source(shadowed.path, "SHADOWED", shadowed.bytes, 0, false));
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
    raw,
    isEmpty ? 0 : included.length,
    truncated,
  ));
  for (const name of shadowedNames) {
    const shadowed = candidates.get(candidatePath(directory, name));
    if (shadowed !== undefined) {
      sources.push(source(shadowed.path, "SHADOWED", shadowed.bytes, 0, false));
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

function resolveTree(
  directory: string,
  candidates: ReadonlyMap<string, Candidate>,
  byteLimit: number,
  names: readonly string[],
  shadows: Readonly<Record<string, readonly string[]>>,
): Resolution {
  let remaining = byteLimit;
  const sources: ResolvedSource[] = [];
  const contributions: string[] = [];
  const evidence: string[] = [];
  let status: Projection["status"] = "COMPLETE";
  for (const ancestor of ancestorDirectories(
    directory === "." ? "target" : `${directory}/target`,
  )) {
    const result = resolveDirectory(ancestor, candidates, remaining, names, shadows);
    remaining -= result.consumed;
    sources.push(...result.resolution.sources);
    contributions.push(...result.resolution.contributions);
    evidence.push(...result.resolution.evidence);
    if (result.resolution.status === "UNKNOWN") status = "UNKNOWN";
  }
  return { status, sources, contributions, evidence };
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
      return nameSet.has(basename(path));
    },
    async prepare(snapshot: RepositorySnapshot): Promise<PreparedProfile> {
      const paths = await snapshot.listPaths();
      const candidatePaths = [
        ...new Set(paths.filter((path) => nameSet.has(basename(path)))),
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
        candidates.set(path, Object.freeze({
          path,
          kind,
          executable,
          bytes: new Uint8Array(bytes),
        }));
      }
      const cached = new Map<string, Projection>();
      const materials = new Map<string, {
        readonly material: ReturnType<typeof projectMaterial>;
        readonly digestFor: (targetPath: string) => string;
      }>();
      return Object.freeze({
        id: pack.pack.id,
        sourceDependencyPaths: Object.freeze([...candidates.keys()].sort(compareCodePoints)),
        project(targetPath: string): Projection {
          const directory = dirname(targetPath);
          let cachedMaterial = materials.get(directory);
          if (cachedMaterial === undefined) {
            const material = projectMaterial(resolveTree(
              directory, candidates, byteLimit, names, shadows,
            ));
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
    cwd: dirname(targetPath),
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
