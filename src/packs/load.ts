import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { InvalidPackError, compilePack, decodePackBundle } from "./compile.js";
import type { CompiledPack } from "./schema.js";

const bundledRoot = join(dirname(fileURLToPath(import.meta.url)), "../../packs/bundled");
const candidateRoot = join(dirname(fileURLToPath(import.meta.url)), "../../packs/candidate");
const UNSAFE_DIRECTORY = /[<>:"/\\|?*\u0000-\u001f]/u;

export function bundledPacksRoot(): string {
  return bundledRoot;
}

export function candidatePacksRoot(): string {
  return candidateRoot;
}

export function bundledDirectoryForPackId(id: string): string {
  return id.replaceAll("/", "-");
}

export function assertSafeDirectoryName(name: string): string {
  if (
    name === "" ||
    name === "." ||
    name === ".." ||
    name.includes("..") ||
    UNSAFE_DIRECTORY.test(name)
  ) {
    throw new InvalidPackError(`unsafe pack directory: ${JSON.stringify(name)}`);
  }
  return name;
}

function resolveContainedDirectory(root: string, name: string): string {
  const safe = assertSafeDirectoryName(name);
  const resolvedRoot = resolve(root);
  const candidate = resolve(resolvedRoot, safe);
  const rel = relative(resolvedRoot, candidate);
  if (rel === "" || rel.startsWith("..") || rel.includes(`..${sep}`) || isAbsolute(rel)) {
    throw new InvalidPackError(`unsafe pack directory: ${JSON.stringify(name)}`);
  }
  return candidate;
}

function readJson(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new InvalidPackError(`unreadable JSON ${path}: ${String(error)}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new InvalidPackError(`malformed JSON ${path}: ${String(error)}`);
  }
}

export function readPackDirectory(directory: string): CompiledPack {
  try {
    return compilePack(decodePackBundle({
      pack: readJson(join(directory, "pack.json")),
      evidence: readJson(join(directory, "evidence.json")),
      resolver: readJson(join(directory, "resolver.json")),
    }));
  } catch (error) {
    if (error instanceof InvalidPackError) throw error;
    throw new InvalidPackError(`unreadable pack directory: ${String(error)}`);
  }
}

export function loadBundledPack(directoryName: string): CompiledPack {
  return readPackDirectory(resolveContainedDirectory(bundledRoot, directoryName));
}
