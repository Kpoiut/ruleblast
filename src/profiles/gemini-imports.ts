import { sha256 } from "../canonical.js";
import type { Projection, ResolvedSource } from "../model.js";
import {
  listClaudeImportReferences,
  resolveClaudeImportPath,
  tokenizeMarkdown,
} from "../packs/ops-markdown.js";
import type { SnapshotEntry } from "../snapshot.js";

export const GEMINI_IMPORT_DEPTH = 5;

export interface GeminiFile {
  readonly path: string;
  readonly kind: SnapshotEntry["kind"];
  readonly text: string;
}

export interface GeminiExpansion {
  readonly status: Projection["status"];
  readonly sources: readonly ResolvedSource[];
  readonly contributions: readonly string[];
  readonly evidence: readonly string[];
}

export function listGeminiImportReferences(value: string): readonly string[] {
  return listClaudeImportReferences(value, false);
}

export const resolveGeminiImportPath = resolveClaudeImportPath;

function source(
  path: string,
  disposition: ResolvedSource["disposition"],
  text: string,
  contributes: boolean,
): ResolvedSource {
  return {
    path,
    disposition,
    digest: sha256(text),
    bytesUsed: contributes ? Buffer.byteLength(text) : 0,
    truncated: false,
  };
}

export function expandGeminiDocument(
  file: GeminiFile,
  documents: ReadonlyMap<string, GeminiFile>,
): GeminiExpansion {
  const sources: ResolvedSource[] = [];
  const contributions: string[] = [];
  const evidence: string[] = [];
  let status: Projection["status"] = "COMPLETE";

  function visit(current: GeminiFile, disposition: ResolvedSource["disposition"], stack: readonly string[], depth: number): void {
    if (current.kind === "symlink") {
      sources.push(source(current.path, "UNRESOLVED_IMPORT", current.text, false));
      evidence.push(`UNSUPPORTED_BOUNDARY: Gemini instruction symlink was not followed: ${current.path}`);
      status = status === "UNKNOWN" ? "UNKNOWN" : "PARTIAL";
      return;
    }
    sources.push(source(current.path, disposition, current.text, current.text.trim() !== ""));
    if (current.text.trim() === "") return;
    for (const token of tokenizeMarkdown(current.text, false)) {
      if (token.kind === "text") {
        if (token.value !== "") contributions.push(token.value);
        continue;
      }
      const resolved = resolveGeminiImportPath(current.path, token.value);
      if (resolved === null) {
        sources.push(source(token.value, "UNRESOLVED_IMPORT", "", false));
        evidence.push(`UNRESOLVED_IMPORT: ${token.value} from ${current.path} leaves the repository`);
        status = "PARTIAL";
        continue;
      }
      if (depth >= GEMINI_IMPORT_DEPTH) {
        sources.push(source(resolved, "UNRESOLVED_IMPORT", "", false));
        evidence.push(`IMPORT_DEPTH_EXCEEDED: import from ${current.path} exceeds ${GEMINI_IMPORT_DEPTH}: ${resolved}`);
        status = "PARTIAL";
        continue;
      }
      if (stack.includes(resolved)) {
        sources.push(source(resolved, "UNRESOLVED_IMPORT", "", false));
        evidence.push(`IMPORT_CYCLE: ${[...stack, resolved].join(" -> ")}`);
        status = "PARTIAL";
        continue;
      }
      const imported = documents.get(resolved);
      if (imported === undefined) {
        sources.push(source(resolved, "UNRESOLVED_IMPORT", "", false));
        evidence.push(`UNRESOLVED_IMPORT: missing ${resolved} from ${current.path}`);
        status = "PARTIAL";
        continue;
      }
      visit(imported, "IMPORTED", [...stack, current.path], depth + 1);
    }
  }

  visit(file, "SELECTED", [], 0);
  return { status, sources, contributions, evidence };
}
