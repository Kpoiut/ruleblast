import { sha256, sha256MovingTarget } from "../canonical.js";
import {
  ancestorDirectories,
  compareCodePoints,
  joinRepositoryPath,
  pathBasename,
  pathDirname,
} from "../domain/repository-path.js";
import {
  OPENAI_CODEX_CLI_PROFILE_ID,
  type Projection,
  type ResolvedSource,
} from "../model.js";
import type { RepositorySnapshot, SnapshotEntry } from "../snapshot.js";
import {
  defineEvidenceRef,
  digestNormalizedPayload,
  unitizePayloadContributions,
  type EvidenceRef,
  type PreparedProfile,
  type ProfileDefinition,
} from "./profile.js";

const OVERRIDE_NAME = "AGENTS.override.md";
const AGENTS_NAME = "AGENTS.md";
const BYTE_LIMIT = 32 * 1024;
const BOUNDARY_EVIDENCE = "UNSUPPORTED_BOUNDARY: named Codex instruction symlink was not followed";

interface Candidate {
  readonly path: string;
  readonly kind: SnapshotEntry["kind"];
  readonly executable: boolean;
  readonly bytes: Uint8Array;
}

const CANDIDATE_ENTRY_FIELDS = ["path", "kind", "executable"] as const;

function captureCandidateEntry(
  value: unknown,
  expectedPath: string,
): Omit<Candidate, "bytes"> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Codex candidate entry must be an object: ${expectedPath}`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(value).length !== CANDIDATE_ENTRY_FIELDS.length ||
    CANDIDATE_ENTRY_FIELDS.some((field) => {
      const descriptor = descriptors[field];
      return descriptor === undefined || !("value" in descriptor);
    })
  ) {
    throw new TypeError(
      `Codex candidate entry must contain only own data fields: ${expectedPath}`,
    );
  }
  const path = descriptors.path?.value;
  const kind = descriptors.kind?.value;
  const executable = descriptors.executable?.value;
  if (
    path !== expectedPath ||
    (kind !== "file" && kind !== "symlink") ||
    typeof executable !== "boolean"
  ) {
    throw new TypeError(`Invalid Codex candidate entry: ${expectedPath}`);
  }
  return Object.freeze({ path, kind, executable });
}

interface Resolution {
  readonly status: Projection["status"];
  readonly sources: readonly ResolvedSource[];
  readonly contributions: readonly string[];
  readonly evidence: readonly string[];
}

interface ProjectionMaterial {
  readonly status: Projection["status"];
  readonly sources: readonly ResolvedSource[];
  readonly units: readonly (readonly string[])[];
  readonly normalizedPayloadDigest: string;
  readonly evidence: readonly string[];
  readonly assembledPayload: string;
  readonly effectiveSources: readonly {
    path: string; disposition: ResolvedSource["disposition"];
    bytesUsed: number; truncated: boolean;
  }[];
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

function resolveDirectory(
  directory: string,
  candidates: ReadonlyMap<string, Candidate>,
  remaining: number,
  overrideName: string,
  agentsName: string,
): { readonly resolution: Resolution; readonly consumed: number } {
  const override = candidates.get(joinRepositoryPath(directory, overrideName));
  const agents = candidates.get(joinRepositoryPath(directory, agentsName));
  const selected = override ?? agents;
  if (selected === undefined) {
    return {
      resolution: { status: "COMPLETE", sources: [], contributions: [], evidence: [] },
      consumed: 0,
    };
  }

  const sources: ResolvedSource[] = [];
  const evidence: string[] = [];
  if (selected.kind === "symlink") {
    sources.push(source(selected.path, "SELECTED", selected.bytes, 0, false));
    evidence.push(`${BOUNDARY_EVIDENCE}: ${selected.path}`);
    if (override !== undefined && agents !== undefined) {
      sources.push(source(agents.path, "SHADOWED", agents.bytes, 0, false));
    }
    return { resolution: { status: "UNKNOWN", sources, contributions: [], evidence }, consumed: 0 };
  }

  const raw = selected.bytes;
  const included = raw.slice(0, remaining);
  const truncated = included.length < raw.length;
  const text = new TextDecoder().decode(included);
  const isEmpty = text.trim() === "";
  sources.push(
    source(
      selected.path,
      isEmpty ? "SELECTED_EMPTY" : "SELECTED",
      raw,
      isEmpty ? 0 : included.length,
      truncated,
    ),
  );
  if (override !== undefined && agents !== undefined) {
    sources.push(source(agents.path, "SHADOWED", agents.bytes, 0, false));
  }
  return {
    resolution: { status: "COMPLETE", sources, contributions: isEmpty ? [] : [text], evidence },
    consumed: isEmpty ? 0 : included.length,
  };
}

function resolve(
  directory: string,
  candidates: ReadonlyMap<string, Candidate>,
  byteLimit: number,
  overrideName: string,
  agentsName: string,
): Resolution {
  let remaining = byteLimit;
  const sources: ResolvedSource[] = [];
  const contributions: string[] = [];
  const evidence: string[] = [];
  let status: Projection["status"] = "COMPLETE";
  for (const ancestor of ancestorDirectories(
    directory === "." ? "target" : `${directory}/target`,
  )) {
    const result = resolveDirectory(
      ancestor, candidates, remaining, overrideName, agentsName,
    );
    remaining -= result.consumed;
    sources.push(...result.resolution.sources);
    contributions.push(...result.resolution.contributions);
    evidence.push(...result.resolution.evidence);
    if (result.resolution.status === "UNKNOWN") {
      status = "UNKNOWN";
    }
  }
  return { status, sources, contributions, evidence };
}

/** Codex adds only its repository instruction separator in this v1 projection. */
export function assembleCodexProjectInstructions(
  contributions: readonly string[],
): string {
  return contributions.filter((contribution) => contribution !== "").join("\n\n");
}

function projectionMaterial(resolution: Resolution): ProjectionMaterial {
  const units = unitizePayloadContributions(resolution.contributions);
  return {
    status: resolution.status,
    sources: resolution.sources,
    units,
    normalizedPayloadDigest: digestNormalizedPayload(units, "ORDERED"),
    evidence: resolution.evidence,
    assembledPayload: assembleCodexProjectInstructions(resolution.contributions),
    effectiveSources: resolution.sources
      .filter((source) => source.disposition === "SELECTED" ||
        source.disposition === "SELECTED_EMPTY")
      .map(({ path, disposition, bytesUsed, truncated }) =>
        ({ path, disposition, bytesUsed, truncated })),
  };
}

function makeProjection(
  material: ProjectionMaterial,
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
  const projectionDigest = digestFor(targetPath);
  return {
    profile: profileId,
    context,
    status: material.status,
    composition: "ORDERED",
    sources: material.sources.map((item) => ({ ...item })),
    normalizedPayloadUnits: material.units.map((unit) => [...unit]),
    projectionDigest,
    normalizedPayloadDigest: material.normalizedPayloadDigest,
    evidence: [...material.evidence],
  };
}

const CODEX_EVIDENCE = Object.freeze([
    defineEvidenceRef({
      url: "https://learn.chatgpt.com/docs/agent-configuration/agents-md",
      retrievedAt: "2026-08-12",
      revision: "2026-08-12",
      claim: "Codex discovers AGENTS.md instructions through the repository hierarchy.",
    }),
    defineEvidenceRef({
      url: "https://github.com/openai/codex/commit/4ef836f883c38ba6d39e6920f335ce6452b7de33",
      retrievedAt: "2026-08-12",
      revision: "4ef836f883c38ba6d39e6920f335ce6452b7de33",
      claim: "The pinned Codex implementation establishes the 32 KiB instruction byte budget and truncation behavior.",
    }),
]);

export function createCodexProfile(config: {
  readonly id: string;
  readonly evidence: readonly EvidenceRef[];
  readonly overrideName: string;
  readonly agentsName: string;
  readonly byteLimit: number;
}): ProfileDefinition {
  const names = Object.freeze([config.overrideName, config.agentsName]);
  const revisions = Object.freeze(config.evidence.map((item) => item.revision));
  return Object.freeze({
    id: config.id,
    evidence: config.evidence,
    isInstructionPath(path: string): boolean {
      const name = pathBasename(path);
      return names.includes(name);
    },
    async prepare(snapshot: RepositorySnapshot): Promise<PreparedProfile> {
      const paths = await snapshot.listPaths();
      const candidatePaths = [
        ...new Set(paths.filter((path) => this.isInstructionPath(path))),
      ].sort(compareCodePoints);
      const candidates = new Map<string, Candidate>();
      for (const path of candidatePaths) {
        const entry = await snapshot.entry(path);
        if (entry === null) {
          throw new Error(`Missing Codex candidate entry during preparation: ${path}`);
        }
        const capturedEntry = captureCandidateEntry(entry, path);
        const bytes = await snapshot.read(path);
        if (bytes === null) {
          throw new Error(`Missing Codex candidate bytes during preparation: ${path}`);
        }
        candidates.set(
          path,
          Object.freeze({ ...capturedEntry, bytes: new Uint8Array(bytes) }),
        );
      }
      const cachedMaterials = new Map<string, {
        readonly material: ProjectionMaterial;
        readonly digestFor: (targetPath: string) => string;
      }>();
      return Object.freeze({
        id: config.id,
        sourceDependencyPaths: Object.freeze([...candidates.keys()].sort(compareCodePoints)),
        project(targetPath: string): Projection {
          const directory = pathDirname(targetPath);
          let cached = cachedMaterials.get(directory);
          if (cached === undefined) {
            const material = projectionMaterial(resolve(
              directory,
              candidates,
              config.byteLimit,
              config.overrideName,
              config.agentsName,
            ));
            cached = {
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
                profile: config.id,
                status: material.status,
              })),
            };
            cachedMaterials.set(directory, cached);
          }
          return makeProjection(cached.material, targetPath, config.id, cached.digestFor);
        },
      });
    },
  });
}

export const codexProfile: ProfileDefinition = createCodexProfile({
  id: OPENAI_CODEX_CLI_PROFILE_ID,
  evidence: CODEX_EVIDENCE,
  overrideName: OVERRIDE_NAME,
  agentsName: AGENTS_NAME,
  byteLimit: BYTE_LIMIT,
});
