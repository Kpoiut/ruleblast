import { sha256 } from "../canonical.js";
import { pathDirname } from "../domain/repository-path.js";
import type { Projection, ResolvedSource } from "../model.js";
import type { SnapshotEntry } from "../snapshot.js";

const MAX_IMPORT_EDGES = 4;
const IMPORT_CHARACTER = /[A-Za-z0-9._~+\-/\\:]/;
const DRIVE_OR_UNC = /^(?:[A-Za-z]:[\\/]|\\\\|\/\/)/;

export interface CapturedClaudeFile {
  readonly path: string;
  readonly kind: SnapshotEntry["kind"];
  readonly bytes: Uint8Array;
}

export interface ClaudeImportEnvironment {
  readonly documents: ReadonlyMap<string, PreparedClaudeDocument>;
  exclusion(path: string): {
    readonly applies: boolean | null;
    readonly status: Projection["status"];
    readonly evidence: readonly string[];
  };
}

export interface PreparedClaudeDocument {
  readonly file: CapturedClaudeFile;
  readonly tokens: readonly MarkdownToken[];
}

export interface ClaudeDocumentExpansion {
  readonly status: Projection["status"];
  readonly sources: readonly ResolvedSource[];
  readonly contributions: readonly string[];
  readonly evidence: readonly string[];
}

type MarkdownToken =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "import"; readonly value: string };

interface ExpansionState {
  status: Projection["status"];
  readonly sources: ResolvedSource[];
  readonly contributions: string[];
  readonly evidence: string[];
}

function resolvedSource(
  file: CapturedClaudeFile,
  disposition: ResolvedSource["disposition"],
  contributes: boolean,
): ResolvedSource {
  return {
    path: file.path,
    disposition,
    digest: sha256(file.bytes),
    bytesUsed: contributes ? file.bytes.length : 0,
    truncated: false,
  };
}

function unresolvedSource(path: string): ResolvedSource {
  return {
    path,
    disposition: "UNRESOLVED_IMPORT",
    digest: sha256(""),
    bytesUsed: 0,
    truncated: false,
  };
}

function pushText(tokens: MarkdownToken[], value: string): void {
  if (value === "") return;
  const previous = tokens.at(-1);
  if (previous?.kind === "text") {
    tokens[tokens.length - 1] = { kind: "text", value: previous.value + value };
  } else {
    tokens.push({ kind: "text", value });
  }
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

/** Recognizes @path imports in normal Markdown. HTML comments strip only when requested. */
export function tokenizeMarkdown(
  value: string,
  stripHtmlComments = true,
): readonly MarkdownToken[] {
  const tokens: MarkdownToken[] = [];
  let fence: string | null = null;
  let inlineTicks = 0;
  let inComment = false;
  for (const lineWithEnding of value.match(/.*(?:\n|$)/g) ?? []) {
    if (lineWithEnding === "") continue;
    const hasNewline = lineWithEnding.endsWith("\n");
    const line = hasNewline ? lineWithEnding.slice(0, -1) : lineWithEnding;
    if (!inComment && inlineTicks === 0) {
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
      if (stripHtmlComments && inComment) {
        const close = line.indexOf("-->", index);
        if (close === -1) {
          index = line.length;
          continue;
        }
        inComment = false;
        index = close + 3;
        continue;
      }
      if (stripHtmlComments && inlineTicks === 0 && line.startsWith("<!--", index)) {
        inComment = true;
        index += 4;
        continue;
      }
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
    if (hasNewline && !(stripHtmlComments && inComment)) pushText(tokens, "\n");
  }
  return tokens;
}

export function prepareClaudeDocument(
  file: CapturedClaudeFile,
  content = new TextDecoder().decode(file.bytes),
  stripHtmlComments = true,
): PreparedClaudeDocument {
  return Object.freeze({
    file,
    tokens: Object.freeze([...tokenizeMarkdown(content, stripHtmlComments)]),
  });
}

export function listClaudeImportReferences(
  value: string | PreparedClaudeDocument,
  stripHtmlComments = true,
): readonly string[] {
  const tokens = typeof value === "string"
    ? tokenizeMarkdown(value, stripHtmlComments)
    : value.tokens;
  return tokens
    .filter((token): token is Extract<MarkdownToken, { kind: "import" }> =>
      token.kind === "import")
    .map((token) => token.value);
}

export function resolveClaudeImportPath(
  containingPath: string,
  importedPath: string,
): string | null {
  const slashed = importedPath.replace(/\\/g, "/");
  if (slashed.startsWith("/") || slashed.startsWith("~/") ||
      DRIVE_OR_UNC.test(importedPath)) return null;
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

function markUnresolved(state: ExpansionState, mode: "UNKNOWN" | "PARTIAL"): void {
  if (mode === "UNKNOWN") state.status = "UNKNOWN";
  else if (state.status === "COMPLETE") state.status = "PARTIAL";
}

function expandFile(
  document: PreparedClaudeDocument,
  disposition: ResolvedSource["disposition"],
  environment: ClaudeImportEnvironment,
  state: ExpansionState,
  stack: readonly string[],
  depth: number,
  maxDepth: number,
  unresolved: "UNKNOWN" | "PARTIAL",
): void {
  const { file, tokens } = document;
  const exclusion = environment.exclusion(file.path);
  state.evidence.push(...exclusion.evidence);
  if (exclusion.status === "UNKNOWN") state.status = "UNKNOWN";
  else if (exclusion.status === "PARTIAL" && state.status === "COMPLETE") {
    state.status = "PARTIAL";
  }
  if (exclusion.applies === true) {
    state.sources.push(resolvedSource(file, "EXCLUDED", false));
    return;
  }
  if (file.kind === "symlink") {
    state.sources.push(resolvedSource(file, "UNRESOLVED_IMPORT", false));
    state.evidence.push(
      `UNSUPPORTED_BOUNDARY: instruction symlink was not followed: ${file.path}`,
    );
    markUnresolved(state, unresolved);
    return;
  }

  state.sources.push(resolvedSource(file, disposition, true));
  for (const token of tokens) {
    if (token.kind === "text") {
      if (token.value !== "") state.contributions.push(token.value);
      continue;
    }
    const path = resolveClaudeImportPath(file.path, token.value);
    if (path === null) {
      if (unresolved === "PARTIAL") {
        state.sources.push(unresolvedSource(token.value));
        state.evidence.push(
          `UNRESOLVED_IMPORT: ${token.value} from ${file.path} leaves the repository`,
        );
      } else {
        state.sources.push(unresolvedSource("<external-import>"));
        state.evidence.push(`EXTERNAL_IMPORT: import from ${file.path} leaves the repository`);
      }
      markUnresolved(state, unresolved);
    } else if (depth >= maxDepth) {
      state.sources.push(unresolvedSource(path));
      state.evidence.push(
        unresolved === "PARTIAL"
          ? `IMPORT_DEPTH_EXCEEDED: import from ${file.path} exceeds ${maxDepth}: ${path}`
          : `IMPORT_DEPTH_EXCEEDED: import from ${file.path} exceeds ${maxDepth === 4 ? "four" : String(maxDepth)} edges: ${path}`,
      );
      markUnresolved(state, unresolved);
    } else if (stack.includes(path)) {
      state.sources.push(unresolvedSource(path));
      state.evidence.push(`IMPORT_CYCLE: ${[...stack, path].join(" -> ")}`);
      markUnresolved(state, unresolved);
    } else {
      const imported = environment.documents.get(path);
      if (imported === undefined) {
        state.sources.push(unresolvedSource(path));
        state.evidence.push(
          unresolved === "PARTIAL"
            ? `UNRESOLVED_IMPORT: missing ${path} from ${file.path}`
            : `MISSING_IMPORT: tracked snapshot does not contain ${path}`,
        );
        markUnresolved(state, unresolved);
      } else {
        expandFile(
          imported, "IMPORTED", environment, state, [...stack, path], depth + 1, maxDepth, unresolved,
        );
      }
    }
  }
}

export function expandClaudeDocument(
  document: PreparedClaudeDocument,
  disposition: Exclude<ResolvedSource["disposition"], "IMPORTED" | "EXCLUDED" | "UNRESOLVED_IMPORT">,
  environment: ClaudeImportEnvironment,
  maxDepth = MAX_IMPORT_EDGES,
  unresolved: "UNKNOWN" | "PARTIAL" = "UNKNOWN",
): ClaudeDocumentExpansion {
  const state: ExpansionState = {
    status: "COMPLETE", sources: [], contributions: [], evidence: [],
  };
  expandFile(
    document, disposition, environment, state, [document.file.path], 0, maxDepth, unresolved,
  );
  return state;
}

export interface ImportedMarkdownFile {
  readonly path: string;
  readonly kind: SnapshotEntry["kind"];
  readonly text: string;
}

function noopExclusion(): {
  readonly applies: boolean | null;
  readonly status: Projection["status"];
  readonly evidence: readonly string[];
} {
  return { applies: false, status: "COMPLETE", evidence: [] };
}

/** Same expander as Claude; PARTIAL records documented unfollowed imports. */
export function expandImportedMarkdown(
  file: ImportedMarkdownFile,
  documents: ReadonlyMap<string, ImportedMarkdownFile>,
  maxDepth: number,
  unresolved: "UNKNOWN" | "PARTIAL" = "PARTIAL",
): ClaudeDocumentExpansion {
  const encoder = new TextEncoder();
  const prepared = new Map<string, PreparedClaudeDocument>();
  for (const doc of documents.values()) {
    prepared.set(doc.path, prepareClaudeDocument(
      { path: doc.path, kind: doc.kind, bytes: encoder.encode(doc.text) },
      doc.text,
      false,
    ));
  }
  const document = prepared.get(file.path);
  if (document === undefined) {
    return { status: "COMPLETE", sources: [], contributions: [], evidence: [] };
  }
  return expandClaudeDocument(
    document,
    "SELECTED",
    { documents: prepared, exclusion: noopExclusion },
    maxDepth,
    unresolved,
  );
}
