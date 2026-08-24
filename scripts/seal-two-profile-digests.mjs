import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../dist/canonical.js";
import { defaultProfileDefinitions } from "../dist/application/profile-catalog.js";
import { analyzeCurrent } from "../dist/impact.js";
import { ManifestSnapshot } from "../dist/snapshot.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtureRoot = join(repositoryRoot, "test/fixtures");
const digestPath = join(repositoryRoot, "test/conformance/semantic/default-two-profile.digests.json");
const profiles = defaultProfileDefinitions();
const expected = {};

for (const family of ["codex", "claude", "snapshot"]) {
  const directory = join(fixtureRoot, family);
  for (const name of readdirSync(directory).sort()) {
    if (!name.endsWith(".json")) continue;
    const relativePath = `${family}/${name}`;
    const snapshot = new ManifestSnapshot(
      JSON.parse(readFileSync(join(fixtureRoot, relativePath), "utf8")),
    );
    const result = await analyzeCurrent({ snapshot, profiles });
    expected[relativePath] = sha256(canonicalJson(result));
  }
}

writeFileSync(digestPath, `${JSON.stringify(expected, null, 2)}\n`);
