import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compilePack, decodePackBundle } from "./compile.js";
import type { CompiledPack } from "./schema.js";

const bundledRoot = join(dirname(fileURLToPath(import.meta.url)), "../../packs/bundled");

export function bundledPacksRoot(): string {
  return bundledRoot;
}

export function loadBundledPack(directoryName: string): CompiledPack {
  const directory = join(bundledRoot, directoryName);
  const bundle = {
    pack: JSON.parse(readFileSync(join(directory, "pack.json"), "utf8")),
    evidence: JSON.parse(readFileSync(join(directory, "evidence.json"), "utf8")),
    resolver: JSON.parse(readFileSync(join(directory, "resolver.json"), "utf8")),
  };
  return compilePack(decodePackBundle(bundle));
}
