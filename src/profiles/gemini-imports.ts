import { sha256 } from "../canonical.js";
import { pathDirname } from "../domain/repository-path.js";
import type { Projection, ResolvedSource } from "../model.js";
import type { SnapshotEntry } from "../snapshot.js";

export const GEMINI_IMPORT_DEPTH = 5;

const IMPORT_CHARACTER = /[A-Za-z0-9._~+\-/\\:]/;
const DRIVE_OR_UNC = /^(?:[A-Za-z]:[\\/]|\\\\|\/\/)/;

export interface GeminiFile {
  readonly path: string;
  readonly kind: SnapshotEntry["kind"];
  readonly text: string;
}

type Token =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "import"; readonly value: string };

export interface GeminiExpansion {
  readonly status: Projection["status"];
  readonly sources: readonly ResolvedSource[];
  readonly contributions: readonly string[];
  readonly evidence: readonly string[];
}

function fenceRun(line: string): string | null {
  return /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1] ?? null;
}

function closesFence(line: string, opening: string): boolean {
  const marker = opening[0];
  if (marker === undefined) return false;
  const run = fenceRun(line);
  return run !== null && run[0] === marker && run.length >= opening.length &&
    line.slice(line.indexOf(run) + run.length).trim() === "";
}

function importEnd(line: string, start: number): number {
  let end = start + 1;
  while (end < line.length && IMPORT_CHARACTER.test(line[end] ?? "")) end += 1;
  while (end > start + 1 && /[.,;!?)]/.test(line[end - 1] ?? "")) end -= 1;
  return end;
}

function pushText(tokens: Token[], value: string): void {
  if (value === "") return;
  const previous = tokens.at(-1);
  if (previous?.kind === "text") {
    tokens[tokens.length - 1] = { kind: "text", value: previous.value + value };
  } else {
    tokens.push({ kind: "text", value });
  }
}

function tokenize(value: string): readonly Token[] {
  const tokens: Token[] = [];
  let fence: string | null = null;
  let inlineTicks = 0;
  for (const lineWithEnding of value.match(/.*(?:\n|$)/g) ?? []) {
    if (lineWithEnding === "") continue;
    const hasNewline = lineWithEnding.endsWith("\n");
    const line = hasNewline ? lineWithEnding.slice(0, -1) : lineWithEnding;
    if (inlineTicks === 0) {
      if (fence !== null) {
        pushText(tokens, lineWithEnding);
        if (closesFence(line, fence)) fence = null;
        continue;
      }
      const opening = fenceRun(line);
      if (opening !== null) {
        fence = opening;
        pushText(tokens, lineWithEnding);
        continue;
      }
    }
    let index = 0;
    while (index < line.length) {
      if (line[index] === "`") {
        let end = index + 1;
        while (line[end] === "`") end += 1;
        const run = end - index;
        inlineTicks = inlineTicks === 0 ? run : run === inlineTicks ? 0 : inlineTicks;
        pushText(tokens, line.slice(index, end));
        index = end;
        continue;
      }
      if (inlineTicks === 0 && line[index] === "@" &&
          (index === 0 || /\s/.test(line[index - 1] ?? ""))) {
        const end = importEnd(line, index);
        if (end > index + 1) {
          tokens.push({ kind: "import", value: line.slice(index + 1, end) });
          index = end;
          continue;
        }
      }
      pushText(tokens, line[index] ?? "");
      index += 1;
    }
    if (hasNewline) pushText(tokens, "\n");
  }
  return tokens;
}

export function listGeminiImportReferences(value: string): readonly string[] {
  return tokenize(value)
    .filter((token): token is Extract<Token, { kind: "import" }> => token.kind === "import")
    .map((token) => token.value);
}

export function resolveGeminiImportPath(
  containingPath: string,
  importedPath: string,
): string | null {
  const slashed = importedPath.replace(/\\/g, "/");
  if (slashed.startsWith("/") || slashed.startsWith("~/") ||
      DRIVE_OR_UNC.test(importedPath)) {
    return null;
  }
  const base = pathDirname(containingPath);
  const parts = base === "." ? [] : base.split("/");
  for (const part of slashed.split("/")) {
    if (part === "" || part === ".") continue;
    if (part !== "..") {
      parts.push(part);
    } else if (parts.pop() === undefined) {
      return null;
    }
  }
  return parts.length === 0 ? null : parts.join("/");
}

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
    for (const token of tokenize(current.text)) {
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
