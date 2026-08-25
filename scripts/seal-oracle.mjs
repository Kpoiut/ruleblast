import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { digestProjectionIdentity } from "../dist/domain/projection-seal.js";
import { interpretCompiledPack } from "../dist/packs/interpret.js";
import { loadBundledPack } from "../dist/packs/load.js";
import { ManifestSnapshot } from "../dist/snapshot.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packs = [
  ["openai-codex-cli@1", "test/fixtures/codex"],
  ["anthropic-claude-code-cli@1", "test/fixtures/claude"],
  ["google-gemini-cli@1", "test/fixtures/gemini"],
  ["github-copilot-cli@1", "test/fixtures/copilot"],
];

for (const [directory, fixtureRelative] of packs) {
  const packRoot = join(repositoryRoot, "packs/bundled", directory);
  const pack = loadBundledPack(directory);
  const profile = interpretCompiledPack(pack);
  const oraclePath = join(packRoot, "oracle.json");
  const oracle = JSON.parse(readFileSync(oraclePath, "utf8"));
  const files = readdirSync(join(repositoryRoot, fixtureRelative))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const probes = [];
  for (const file of files) {
    const snapshotJson = JSON.parse(
      readFileSync(join(repositoryRoot, fixtureRelative, file), "utf8"),
    );
    const snapshot = new ManifestSnapshot(snapshotJson);
    const prepared = await profile.prepare(snapshot);
    const paths = await snapshot.listPaths();
    const targets = paths.length === 0 ? ["file.ts"] : paths;
    const projectionDigests = {};
    for (const target of targets) {
      const projection = prepared.project(target);
      projectionDigests[target] = digestProjectionIdentity(projection);
    }
    probes.push({
      snapshot: snapshotJson,
      sourceDependencyPaths: [...prepared.sourceDependencyPaths],
      projectionDigests,
    });
  }
  const next = oracle.kind === "uninterpretable"
    ? { ...oracle, probes }
    : { schema: oracle.schema, kind: oracle.kind, packId: oracle.packId, probes };
  writeFileSync(oraclePath, `${JSON.stringify(next, null, 2)}\n`);
}
