import { canonicalJson, sha256 } from "../canonical.js";
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

function basename(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

function compareCodePoints(left: string, right: string): number {
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftPoint = left.codePointAt(leftIndex);
    const rightPoint = right.codePointAt(rightIndex);
    if (leftPoint === undefined || rightPoint === undefined) {
      throw new Error("Unable to compare Codex candidate paths");
    }
    if (leftPoint !== rightPoint) {
      return leftPoint < rightPoint ? -1 : 1;
    }
    leftIndex += leftPoint > 0xffff ? 2 : 1;
    rightIndex += rightPoint > 0xffff ? 2 : 1;
  }
  return leftIndex === left.length && rightIndex === right.length
    ? 0
    : leftIndex === left.length
      ? -1
      : 1;
}

function dirname(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "." : path.slice(0, slash);
}

function ancestorDirectories(targetPath: string): string[] {
  const targetDirectory = dirname(targetPath);
  if (targetDirectory === ".") {
    return ["."];
  }
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

function resolveDirectory(
  directory: string,
  candidates: ReadonlyMap<string, Candidate>,
  remaining: number,
): { readonly resolution: Resolution; readonly consumed: number } {
  const override = candidates.get(candidatePath(directory, OVERRIDE_NAME));
  const agents = candidates.get(candidatePath(directory, AGENTS_NAME));
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
): Resolution {
  let remaining = BYTE_LIMIT;
  const sources: ResolvedSource[] = [];
  const contributions: string[] = [];
  const evidence: string[] = [];
  let status: Projection["status"] = "COMPLETE";
  for (const ancestor of ancestorDirectories(
    directory === "." ? "target" : `${directory}/target`,
  )) {
    const result = resolveDirectory(ancestor, candidates, remaining);
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

function directoryFromTarget(targetPath: string): string {
  return dirname(targetPath);
}

/** Codex adds only its repository instruction separator in this v1 projection. */
export function assembleCodexProjectInstructions(
  contributions: readonly string[],
): string {
  return contributions.filter((contribution) => contribution !== "").join("\n\n");
}

function makeProjection(resolution: Resolution, targetPath: string): Projection {
  const units = unitizePayloadContributions(resolution.contributions);
  const normalizedPayloadDigest = digestNormalizedPayload(units, "ORDERED");
  const assembledPayload = assembleCodexProjectInstructions(resolution.contributions);
  const context = {
    cwd: directoryFromTarget(targetPath),
    trigger: "STARTUP" as const,
    targetPath,
    repositoryOnly: true as const,
  };
  const projectionDigest = sha256(canonicalJson({
    profile: OPENAI_CODEX_CLI_PROFILE_ID,
    context,
    status: resolution.status,
    composition: "ORDERED",
    assembledPayload,
    evidenceRevisions: CODEX_EVIDENCE.map((evidence) => evidence.revision),
    effectiveSources: resolution.sources
      .filter(
        (source) =>
          source.disposition === "SELECTED" || source.disposition === "SELECTED_EMPTY",
      )
      .map(({ path, disposition, bytesUsed, truncated }) => ({
        path,
        disposition,
        bytesUsed,
        truncated,
      })),
    normalizedPayloadUnits: units,
  }));
  return {
    profile: OPENAI_CODEX_CLI_PROFILE_ID,
    context,
    status: resolution.status,
    composition: "ORDERED",
    sources: resolution.sources.map((item) => ({ ...item })),
    normalizedPayloadUnits: units.map((unit) => [...unit]),
    projectionDigest,
    normalizedPayloadDigest,
    evidence: [...resolution.evidence],
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

export const codexProfile: ProfileDefinition = Object.freeze({
  id: OPENAI_CODEX_CLI_PROFILE_ID,
  evidence: CODEX_EVIDENCE,
  isInstructionPath(path: string): boolean {
    const name = basename(path);
    return name === OVERRIDE_NAME || name === AGENTS_NAME;
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
    const cachedResolutions = new Map<string, Resolution>();
    return Object.freeze({
      id: OPENAI_CODEX_CLI_PROFILE_ID,
      sourceDependencyPaths: Object.freeze([...candidates.keys()].sort(compareCodePoints)),
      project(targetPath: string): Projection {
        const directory = directoryFromTarget(targetPath);
        let resolution = cachedResolutions.get(directory);
        if (resolution === undefined) {
          resolution = resolve(directory, candidates);
          cachedResolutions.set(directory, resolution);
        }
        return makeProjection(resolution, targetPath);
      },
    });
  },
});
