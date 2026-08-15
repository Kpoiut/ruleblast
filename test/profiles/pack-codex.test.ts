import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../../src/canonical.js";
import { loadBundledPack } from "../../src/packs/load.js";
import { profileFromCompiledPack } from "../../src/packs/profile.js";
import { codexProfile } from "../../src/profiles/codex.js";
import { ManifestSnapshot } from "../../src/snapshot.js";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/codex");

function assertProjectionEquivalent(left: unknown, right: unknown): void {
  expect(canonicalJson(left)).toBe(canonicalJson(right));
}

describe("increment 2 Codex pack", () => {
  const packProfile = profileFromCompiledPack(loadBundledPack("openai-codex-cli@1"));

  it("loads the bundled Codex pack id", () => {
    expect(packProfile.id).toBe(codexProfile.id);
  });

  it("matches the adapter on every Codex fixture path", async () => {
    const files = readdirSync(fixtureRoot).filter((name) => name.endsWith(".json")).sort();
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const snapshot = new ManifestSnapshot(
        JSON.parse(readFileSync(join(fixtureRoot, file), "utf8")),
      );
      const adapter = await codexProfile.prepare(snapshot);
      const pack = await packProfile.prepare(snapshot);
      expect([...pack.sourceDependencyPaths].sort()).toEqual(
        [...adapter.sourceDependencyPaths].sort(),
      );
      const paths = await snapshot.listPaths();
      const targets = paths.length === 0 ? ["file.ts"] : paths;
      for (const target of targets) {
        assertProjectionEquivalent(pack.project(target), adapter.project(target));
      }
    }
  });
});
