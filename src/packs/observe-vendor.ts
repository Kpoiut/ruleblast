import { parse as parseYaml } from "yaml";
import { Minimatch } from "minimatch";
import {
  ancestorDirectories,
  joinRepositoryPath,
} from "../domain/repository-path.js";
import {
  makeObservation,
  type CalibrationPackId,
  type LoadedFile,
  type TargetObservation,
} from "./observation.js";

export type { CalibrationPackId, TargetObservation };

export interface IndexedFile {
  readonly path: string;
  readonly kind: "file" | "symlink";
  readonly bytes: Uint8Array;
  readonly text: string;
}

const CODEX_BUDGET = 32 * 1024;
const CODEX_NAMES = Object.freeze(["AGENTS.override.md", "AGENTS.md"]);
const CLAUDE_NAMES = Object.freeze(["CLAUDE.md", "CLAUDE.local.md"]);
const COPILOT_AGENT_NAMES = Object.freeze(["AGENTS.md", "CLAUDE.md", "GEMINI.md"]);

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function fileAt(
  files: ReadonlyMap<string, IndexedFile>,
  directory: string,
  name: string,
): IndexedFile | undefined {
  return files.get(joinRepositoryPath(directory, name));
}

function globMatch(pattern: string, path: string): boolean {
  return new Minimatch(pattern, { dot: true }).match(path);
}

/** Vendor docs: strip block HTML comments; keep fenced and inline code. */
export function stripHtmlComments(value: string): string {
  const chunks: string[] = [];
  let fence: string | null = null;
  let inlineTicks = 0;
  let inComment = false;
  for (const lineWithEnding of value.match(/.*(?:\n|$)/g) ?? []) {
    if (lineWithEnding === "") continue;
    const hasNewline = lineWithEnding.endsWith("\n");
    const line = hasNewline ? lineWithEnding.slice(0, -1) : lineWithEnding;
    if (!inComment && inlineTicks === 0) {
      const opening = line.match(/^(`{3,}|~{3,})/u)?.[1];
      if (fence !== null) {
        chunks.push(lineWithEnding);
        if (opening === fence) fence = null;
        continue;
      }
      if (opening !== undefined && line.slice(opening.length).trim() === "") {
        fence = opening;
        chunks.push(lineWithEnding);
        continue;
      }
    }
    let index = 0;
    while (index < line.length) {
      if (inComment) {
        const close = line.indexOf("-->", index);
        if (close === -1) {
          index = line.length;
          continue;
        }
        inComment = false;
        index = close + 3;
        continue;
      }
      if (inlineTicks === 0 && line.startsWith("<!--", index)) {
        inComment = true;
        index += 4;
        continue;
      }
      if (line[index] === "`") {
        let end = index + 1;
        while (line[end] === "`") end += 1;
        const run = end - index;
        inlineTicks = inlineTicks === 0 ? run : run === inlineTicks ? 0 : inlineTicks;
        chunks.push(line.slice(index, end));
        index = end;
        continue;
      }
      chunks.push(line[index] ?? "");
      index += 1;
    }
    if (hasNewline && !inComment) chunks.push("\n");
  }
  return chunks.join("");
}

export function observeCodex(
  files: ReadonlyMap<string, IndexedFile>,
  targetPath: string,
): TargetObservation {
  const loaded: LoadedFile[] = [];
  let remaining = CODEX_BUDGET;
  let truncated = false;
  for (const directory of ancestorDirectories(targetPath)) {
    if (remaining === 0) break;
    let selected: IndexedFile | undefined;
    for (const name of CODEX_NAMES) {
      const found = fileAt(files, directory, name);
      if (found !== undefined) {
        selected = found;
        break;
      }
    }
    if (selected === undefined) continue;
    if (selected.kind === "symlink") continue;
    const included = selected.bytes.slice(0, remaining);
    const text = decodeText(included);
    const cut = included.length < selected.bytes.length;
    if (cut) truncated = true;
    if (text.trim() === "") continue;
    loaded.push({ path: selected.path, text });
    remaining -= included.length;
  }
  return makeObservation("openai/codex-cli@1", loaded, truncated);
}

function parseFrontmatterField(text: string, field: string): readonly string[] | null {
  if (!text.startsWith("---")) return null;
  const close = text.indexOf("\n---", 3);
  if (close === -1) return null;
  let parsed: unknown;
  try {
    parsed = parseYaml(text.slice(4, close));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const value = (parsed as Record<string, unknown>)[field];
  if (value === undefined) return null;
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter((item) => item !== "");
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  return null;
}

function bodyAfterFrontmatter(text: string): string {
  if (!text.startsWith("---")) return text;
  const close = text.indexOf("\n---", 3);
  if (close === -1) return text;
  const rest = text.slice(close + 4);
  return rest.startsWith("\n") ? rest.slice(1) : rest;
}

export function observeClaude(
  files: ReadonlyMap<string, IndexedFile>,
  targetPath: string,
): TargetObservation {
  const loaded: LoadedFile[] = [];
  const dot = files.get(".claude/CLAUDE.md");
  if (dot !== undefined && dot.kind === "file" && dot.text.trim() !== "") {
    loaded.push({ path: dot.path, text: stripHtmlComments(dot.text) });
  }
  for (const path of [...files.keys()].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0
  )) {
    if (!path.startsWith(".claude/rules/") || !path.endsWith(".md")) continue;
    const rule = files.get(path);
    if (rule === undefined || rule.kind !== "file") continue;
    const patterns = parseFrontmatterField(rule.text, "paths");
    if (patterns !== null && !patterns.some((pattern) => globMatch(pattern, targetPath))) {
      continue;
    }
    const body = stripHtmlComments(bodyAfterFrontmatter(rule.text));
    if (body.trim() === "") continue;
    loaded.push({ path, text: body });
  }
  for (const directory of ancestorDirectories(targetPath)) {
    for (const name of CLAUDE_NAMES) {
      const found = fileAt(files, directory, name);
      if (found === undefined || found.kind !== "file") continue;
      if (found.text.trim() === "") continue;
      loaded.push({ path: found.path, text: stripHtmlComments(found.text) });
    }
  }
  return makeObservation("anthropic/claude-code-cli@1", loaded, false);
}

export function observeCopilot(
  files: ReadonlyMap<string, IndexedFile>,
  targetPath: string,
): TargetObservation {
  const loaded: LoadedFile[] = [];
  const repo = files.get(".github/copilot-instructions.md");
  if (repo !== undefined && repo.kind === "file" && repo.text.trim() !== "") {
    loaded.push({ path: repo.path, text: repo.text });
  }
  for (const path of [...files.keys()].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0
  )) {
    if (!path.startsWith(".github/instructions/") || !path.endsWith(".instructions.md")) {
      continue;
    }
    const instruction = files.get(path);
    if (instruction === undefined || instruction.kind !== "file") continue;
    const patterns = parseFrontmatterField(instruction.text, "applyTo");
    if (patterns === null) continue;
    if (!patterns.some((pattern) => globMatch(pattern, targetPath))) continue;
    if (instruction.text.trim() === "") continue;
    loaded.push({ path, text: instruction.text });
  }
  for (const directory of ancestorDirectories(targetPath)) {
    for (const name of COPILOT_AGENT_NAMES) {
      const found = fileAt(files, directory, name);
      if (found === undefined || found.kind !== "file") continue;
      if (found.text.trim() === "") continue;
      loaded.push({ path: found.path, text: found.text });
    }
  }
  return makeObservation("github/copilot-cli@1", loaded, false);
}
