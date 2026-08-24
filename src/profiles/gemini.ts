import { digestProjectionIdentity } from "../domain/projection-seal.js";
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
import { parseJsonUnionNames } from "../packs/ops-json.js";
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

interface CapturedNode {
  readonly path: string;
  readonly kind: SnapshotEntry["kind"];
  readonly text: string;
}



function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function parseGeminiFileNames(settingsText: string): {
  readonly names: readonly string[];
  readonly status: Projection["status"];
  readonly evidence: readonly string[];
} {
  return parseJsonUnionNames(
    settingsText,
    GEMINI_SETTINGS_PATH,
    "context.fileName",
    [DEFAULT_GEMINI_FILENAME],
  );
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
          ...config.evidence.map((item) => item.claim),
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
          projectionDigest: digestProjectionIdentity({
            profile: config.id,
            context,
            status,
            composition: "ORDERED",
            sources,
            normalizedPayloadUnits: units,
            evidence,
            projectionDigest: null,
            normalizedPayloadDigest: null,
          }),
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
