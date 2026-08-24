import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { digestProjectionIdentity } from "../dist/domain/projection-seal.js";
import { interpretCompiledPack } from "../dist/packs/interpret.js";
import { loadBundledPack } from "../dist/packs/load.js";
import { ManifestSnapshot } from "../dist/snapshot.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packs = [
  "openai-codex-cli@1",
  "anthropic-claude-code-cli@1",
  "google-gemini-cli@1",
  "github-copilot-cli@1",
];

for (const directory of packs) {
  const packRoot = join(repositoryRoot, "packs/bundled", directory);
  const pack = loadBundledPack(directory);
  const profile = interpretCompiledPack(pack);
  const oraclePath = join(packRoot, "oracle.json");
  const oracle = JSON.parse(await (await import("node:fs/promises")).readFile(oraclePath, "utf8"));
  const probes = [];
  for (const probe of oracle.probes) {
    const snapshot = new ManifestSnapshot(probe.snapshot);
    const prepared = await profile.prepare(snapshot);
    const paths = await snapshot.listPaths();
    const targets = paths.length === 0 ? ["file.ts"] : paths;
    const projectionDigests = {};
    for (const target of targets) {
      const projection = prepared.project(target);
      projectionDigests[target] = digestProjectionIdentity(projection);
    }
    probes.push({
      snapshot: probe.snapshot,
      sourceDependencyPaths: [...prepared.sourceDependencyPaths],
      projectionDigests,
    });
  }
  const next = oracle.kind === "uninterpretable"
    ? { ...oracle, probes }
    : { schema: oracle.schema, kind: oracle.kind, packId: oracle.packId, probes };
  writeFileSync(oraclePath, `${JSON.stringify(next, null, 2)}\n`);
}
