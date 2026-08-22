import { canonicalJson, sha256 } from "../canonical.js";
import {
  ancestorDirectories,
  compareCodePoints,
  joinRepositoryPath,
} from "../domain/repository-path.js";
import {
  GOOGLE_GEMINI_CLI_PROFILE_ID,
  type Projection,
  type ResolvedSource,
} from "../model.js";
import type { RepositorySnapshot, SnapshotEntry } from "../snapshot.js";
import {
  digestNormalizedPayload,
  unitizePayloadContributions,
  type EvidenceRef,
  type PreparedProfile,
  type ProfileDefinition,
} from "./profile.js";
import { GEMINI_EVIDENCE } from "./gemini-evidence.js";
import {
  GEMINI_IMPORT_DEPTH,
  expandGeminiDocument,
  listGeminiImportReferences,
  resolveGeminiImportPath,
  type GeminiFile,
} from "./gemini-imports.js";

export { GOOGLE_GEMINI_CLI_PROFILE_ID } from "../model.js";
export const GEMINI_REALITY = GOOGLE_GEMINI_CLI_PROFILE_ID;
export const DEFAULT_GEMINI_FILENAME = "GEMINI.md";
export const GEMINI_SETTINGS_PATH = ".gemini/settings.json";

const SETTINGS_BOUNDARY =
  "User, system, and runtime context.fileName settings are outside repository-only analysis.";
const IGNORE_BOUNDARY =
  "GEMINIIGNORE_MEMORY_EFFECT is UNSPECIFIED: .geminiignore is not modeled as a hierarchical-memory filter.";
const DOCS_DRIFT =
  "Configuration prose still describes downward discovery; v0.55.1 implementation is JIT/upward.";

interface CapturedNode {
  readonly path: string;
  readonly kind: SnapshotEntry["kind"];
  readonly text: string;
}



function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function normalizeFileName(value: string): string | null {
  const trimmed = value.trim().replace(/\\/g, "/");
  if (trimmed === "" || trimmed.startsWith("/") || trimmed.includes("\0")) {
    return null;
  }
  const parts = trimmed.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    return null;
  }
  return parts.join("/");
}

function unionFileNames(configured: readonly string[]): readonly string[] {
  const names: string[] = [];
  for (const name of [...configured, DEFAULT_GEMINI_FILENAME]) {
    if (!names.includes(name)) names.push(name);
  }
  return Object.freeze(names);
}

export function parseGeminiFileNames(settingsText: string): {
  readonly names: readonly string[];
  readonly status: Projection["status"];
  readonly evidence: readonly string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(settingsText);
  } catch {
    return {
      names: [DEFAULT_GEMINI_FILENAME],
      status: "PARTIAL",
      evidence: ["Tracked .gemini/settings.json is not strict JSON; context.fileName was not applied."],
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      names: [DEFAULT_GEMINI_FILENAME],
      status: "PARTIAL",
      evidence: ["Tracked .gemini/settings.json is not an object; context.fileName was not applied."],
    };
  }
  const context = (parsed as { readonly context?: unknown }).context;
  if (context === undefined) {
    return { names: [DEFAULT_GEMINI_FILENAME], status: "COMPLETE", evidence: [] };
  }
  if (typeof context !== "object" || context === null || Array.isArray(context)) {
    return {
      names: [DEFAULT_GEMINI_FILENAME],
      status: "PARTIAL",
      evidence: ["Tracked context is not an object; context.fileName was not applied."],
    };
  }
  const fileName = (context as { readonly fileName?: unknown }).fileName;
  if (fileName === undefined) {
    return { names: [DEFAULT_GEMINI_FILENAME], status: "COMPLETE", evidence: [] };
  }
  const raw = typeof fileName === "string" ? [fileName] : fileName;
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    return {
      names: [DEFAULT_GEMINI_FILENAME],
      status: "PARTIAL",
      evidence: ["Tracked context.fileName is not a string or string array."],
    };
  }
  const configured = raw
    .map((item) => normalizeFileName(item))
    .filter((item): item is string => item !== null);
  return {
    names: unionFileNames(configured),
    status: "COMPLETE",
    evidence: [
      "Tracked project context.fileName is unioned with default GEMINI.md, matching setGeminiMdFilename.",
    ],
  };
}

function matchesFileName(path: string, fileName: string): boolean {
  return path === fileName || path.endsWith(`/${fileName}`);
}

function isGeminiInstructionPath(path: string, fileNames: readonly string[]): boolean {
  if (path === GEMINI_SETTINGS_PATH) return true;
  return fileNames.some((name) => matchesFileName(path, name));
}

export function createGeminiProfile(config: {
  readonly id: string;
  readonly evidence: readonly EvidenceRef[];
}): ProfileDefinition {
  const revisions = Object.freeze(config.evidence.map((item) => item.revision));
  return {
  id: config.id,
  evidence: config.evidence,
  isInstructionPath(path: string): boolean {
    return path === GEMINI_SETTINGS_PATH ||
      path === DEFAULT_GEMINI_FILENAME ||
      path.endsWith(`/${DEFAULT_GEMINI_FILENAME}`) ||
      path.endsWith("/AGENTS.md") ||
      path === "AGENTS.md" ||
      path.endsWith("/CONTEXT.md") ||
      path === "CONTEXT.md";
  },
  async prepare(snapshot: RepositorySnapshot): Promise<PreparedProfile> {
    const inventory = new Set(await snapshot.listPaths());
    const nodes = new Map<string, CapturedNode>();
    const capture = async (path: string): Promise<CapturedNode | null> => {
      const existing = nodes.get(path);
      if (existing !== undefined) return existing;
      if (!inventory.has(path)) return null;
      const entry = await snapshot.entry(path);
      if (entry === null) return null;
      const bytes = await snapshot.read(path);
      if (bytes === null) return null;
      const node = { path, kind: entry.kind, text: decode(bytes) };
      nodes.set(path, node);
      return node;
    };
    await capture(GEMINI_SETTINGS_PATH);
    const settings = nodes.get(GEMINI_SETTINGS_PATH);
    const parsedNames = settings === undefined
      ? { names: [DEFAULT_GEMINI_FILENAME] as const, status: "COMPLETE" as const, evidence: [] }
      : parseGeminiFileNames(settings.text);
    const fileNames = parsedNames.names;
    for (const path of inventory) {
      if (isGeminiInstructionPath(path, fileNames)) await capture(path);
    }
    const documents = new Map<string, GeminiFile>();
    for (const node of nodes.values()) {
      documents.set(node.path, node);
    }
    const sourceDependencyPaths = new Set(
      [...nodes.keys()].filter((path) => isGeminiInstructionPath(path, fileNames)),
    );
    const pending = [...sourceDependencyPaths].map((path) => ({ path, depth: 0 }));
    const queued = new Set(sourceDependencyPaths);
    while (pending.length > 0) {
      const current = pending.shift();
      if (current === undefined || current.depth >= GEMINI_IMPORT_DEPTH) continue;
      const node = nodes.get(current.path);
      if (node === undefined) continue;
      for (const reference of listGeminiImportReferences(node.text)) {
        const resolved = resolveGeminiImportPath(current.path, reference);
        if (resolved === null || !inventory.has(resolved) || queued.has(resolved)) continue;
        queued.add(resolved);
        sourceDependencyPaths.add(resolved);
        await capture(resolved);
        const imported = nodes.get(resolved);
        if (imported !== undefined) documents.set(imported.path, imported);
        pending.push({ path: resolved, depth: current.depth + 1 });
      }
    }
    return {
      id: config.id,
      sourceDependencyPaths: Object.freeze([...sourceDependencyPaths].sort(compareCodePoints)),
      project(targetPath: string): Projection {
        const sources: ResolvedSource[] = [];
        const contributions: string[] = [];
        const evidence = [
          ...GEMINI_EVIDENCE.map((item) => item.claim),
          SETTINGS_BOUNDARY,
          IGNORE_BOUNDARY,
          DOCS_DRIFT,
          ...parsedNames.evidence,
        ];
        let status: Projection["status"] = parsedNames.status;
        const chain: GeminiFile[] = [];
        for (const directory of ancestorDirectories(targetPath)) {
          for (const fileName of fileNames) {
            const path = joinRepositoryPath(directory, fileName);
            const node = nodes.get(path);
            if (node === undefined) continue;
            chain.push(node);
          }
        }
        for (const file of chain) {
          const expansion = expandGeminiDocument(file, documents);
          if (expansion.status === "UNKNOWN") status = "UNKNOWN";
          else if (expansion.status === "PARTIAL" && status === "COMPLETE") {
            status = "PARTIAL";
          }
          const [head, ...imported] = expansion.sources;
          if (head !== undefined) {
            const empty = file.text.trim() === "";
            sources.push({
              ...head,
              disposition: empty ? "SELECTED_EMPTY" : "SELECTED",
              bytesUsed: empty ? 0 : head.bytesUsed,
            });
          }
          sources.push(...imported);
          contributions.push(...expansion.contributions);
          evidence.push(...expansion.evidence);
        }
        const units = unitizePayloadContributions(contributions);
        const context = {
          cwd: ".",
          trigger: "READ_TARGET" as const,
          targetPath,
          repositoryOnly: true as const,
        };
        return {
          profile: config.id,
          context,
          status,
          composition: "ORDERED",
          sources,
          normalizedPayloadUnits: units,
          projectionDigest: sha256(canonicalJson({
            profile: config.id,
            context,
            status,
            composition: "ORDERED",
            sources: sources.map((item) => ({
              path: item.path,
              disposition: item.disposition,
              digest: item.digest,
              bytesUsed: item.bytesUsed,
              truncated: item.truncated,
            })),
            evidenceRevision: revisions,
          })),
          normalizedPayloadDigest: digestNormalizedPayload(units, "ORDERED"),
          evidence,
        };
      },
    };
  },
};
}

export const geminiProfile: ProfileDefinition = createGeminiProfile({
  id: GOOGLE_GEMINI_CLI_PROFILE_ID,
  evidence: GEMINI_EVIDENCE,
});
