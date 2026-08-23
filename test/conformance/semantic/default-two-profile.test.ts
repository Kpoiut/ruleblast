import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../../../src/canonical.js";
import { defaultProfileDefinitions } from "../../../src/application/profile-catalog.js";
import { analyzeCurrent } from "../../../src/impact.js";
import { ManifestSnapshot } from "../../../src/snapshot.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "../../fixtures");
const digestPath = join(here, "default-two-profile.digests.json");

const DEFAULT_PROFILES = defaultProfileDefinitions();

function fixtureFiles(): readonly string[] {
  const files: string[] = [];
  for (const family of ["codex", "claude", "snapshot"] as const) {
    const directory = join(fixtureRoot, family);
    for (const name of readdirSync(directory).sort()) {
      if (name.endsWith(".json")) files.push(`${family}/${name}`);
    }
  }
  return files;
}

async function digestFor(relativePath: string): Promise<string> {
  const snapshot = new ManifestSnapshot(
    JSON.parse(readFileSync(join(fixtureRoot, relativePath), "utf8")),
  );
  const result = await analyzeCurrent({
    snapshot,
    profiles: DEFAULT_PROFILES,
  });
  return sha256(canonicalJson(result));
}

describe("semantic conformance: default Codex + Claude", () => {
  const expected = JSON.parse(readFileSync(digestPath, "utf8")) as Readonly<
    Record<string, string>
  >;

  it("freezes one digest per existing fixture under the default two profiles", async () => {
    const files = fixtureFiles();
    expect(files.length).toBeGreaterThan(20);
    expect(Object.keys(expected).sort()).toEqual([...files].sort());
    for (const file of files) {
      expect(await digestFor(file), file).toBe(expected[file]);
    }
  });
});
