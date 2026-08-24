import {
  ancestorDirectories,
  pathDirname,
} from "../domain/repository-path.js";
import { makeObservation, type TargetObservation } from "./observation.js";
import { fileAt, type IndexedFile } from "./observe-vendor.js";

const GEMINI_DEFAULT = "GEMINI.md";

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function findCodeRegions(content: string): ReadonlyArray<readonly [number, number]> {
  const regions: Array<readonly [number, number]> = [];
  const regex = /(`+)([\s\S]*?)\1/gu;
  let match = regex.exec(content);
  while (match !== null) {
    regions.push([match.index, match.index + match[0].length]);
    match = regex.exec(content);
  }
  return regions;
}

/** Pinned Gemini `findImports`: `@` after whitespace, path until whitespace. */
function findImports(content: string): ReadonlyArray<{
  readonly start: number;
  readonly end: number;
  readonly path: string;
}> {
  const imports: Array<{ start: number; end: number; path: string }> = [];
  let index = 0;
  while (index < content.length) {
    const at = content.indexOf("@", index);
    if (at === -1) break;
    if (at > 0 && !isWhitespace(content[at - 1] ?? "")) {
      index = at + 1;
      continue;
    }
    let end = at + 1;
    while (end < content.length && !isWhitespace(content[end] ?? "") &&
      content[end] !== "\n" && content[end] !== "\r") {
      end += 1;
    }
    const importPath = content.slice(at + 1, end);
    const first = importPath[0];
    if (importPath.length > 0 && (first === "." || first === "/" ||
      (first !== undefined && /[A-Za-z]/u.test(first)))) {
      imports.push({ start: at, end, path: importPath });
    }
    index = end + 1;
  }
  return imports;
}

function resolveRepoPath(baseDirectory: string, importPath: string): string | null {
  if (importPath.startsWith("/") || /^[A-Za-z]:/u.test(importPath) ||
    /^(file|https?):\/\//u.test(importPath)) {
    return null;
  }
  const base = baseDirectory === "." ? [] : baseDirectory.split("/");
  const parts = [...base];
  for (const part of importPath.replaceAll("\\", "/").split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

/** Pinned Gemini `processImports` tree format against a snapshot, not the live CLI. */
function processGeminiImports(
  content: string,
  filePath: string,
  files: ReadonlyMap<string, IndexedFile>,
  processed: ReadonlySet<string>,
  depth: number,
): string {
  if (depth >= 5) return content;
  const codeRegions = findCodeRegions(content);
  let result = "";
  let last = 0;
  const chain = new Set(processed);
  chain.add(filePath);
  for (const item of findImports(content)) {
    result += content.slice(last, item.start);
    last = item.end;
    if (codeRegions.some(([start, end]) => item.start >= start && item.start < end)) {
      result += `@${item.path}`;
      continue;
    }
    const resolved = resolveRepoPath(pathDirname(filePath), item.path);
    if (resolved === null) {
      result += `<!-- Import failed: ${item.path} - Path traversal attempt -->`;
      continue;
    }
    if (chain.has(resolved)) {
      result += `<!-- File already processed: ${item.path} -->`;
      continue;
    }
    const imported = files.get(resolved);
    if (imported === undefined || imported.kind !== "file") {
      result += `<!-- Import failed: ${item.path} - missing -->`;
      continue;
    }
    const nested = processGeminiImports(
      imported.text, resolved, files, chain, depth + 1,
    );
    result += `<!-- Imported from: ${item.path} -->\n${nested}\n<!-- End of import from: ${item.path} -->`;
  }
  return result + content.slice(last);
}

function geminiNames(files: ReadonlyMap<string, IndexedFile>): readonly string[] {
  const names: string[] = [];
  const settings = files.get(".gemini/settings.json");
  if (settings !== undefined && settings.kind === "file") {
    try {
      const parsed = JSON.parse(settings.text) as unknown;
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const context = (parsed as { context?: unknown }).context;
        if (typeof context === "object" && context !== null && !Array.isArray(context)) {
          const value = (context as { fileName?: unknown }).fileName;
          const raw = typeof value === "string" ? [value] : value;
          if (Array.isArray(raw)) {
            for (const item of raw) {
              if (typeof item !== "string") continue;
              const name = item.trim().replaceAll("\\", "/");
              if (name === "" || name.includes("/") || name === "." || name === "..") continue;
              if (!names.includes(name)) names.push(name);
            }
          }
        }
      }
    } catch {
      // fall through to default
    }
  }
  if (!names.includes(GEMINI_DEFAULT)) names.push(GEMINI_DEFAULT);
  return names;
}

export function observeGemini(
  files: ReadonlyMap<string, IndexedFile>,
  targetPath: string,
): TargetObservation {
  const names = geminiNames(files);
  const loaded: Array<{ path: string; text: string }> = [];
  for (const directory of ancestorDirectories(targetPath)) {
    for (const name of names) {
      const found = fileAt(files, directory, name);
      if (found === undefined || found.kind !== "file") continue;
      const processed = processGeminiImports(found.text, found.path, files, new Set(), 0);
      if (processed.trim() === "") continue;
      loaded.push({ path: found.path, text: processed });
    }
  }
  return makeObservation("google/gemini-cli@1", loaded, false);
}
