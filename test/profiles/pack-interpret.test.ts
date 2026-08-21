import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../../src/canonical.js";
import { loadBundledPack } from "../../src/packs/load.js";
import { interpretCompiledPack } from "../../src/packs/interpret.js";
import { profileFromCompiledPack } from "../../src/packs/profile.js";
import { createCodexProfile, codexProfile } from "../../src/profiles/codex.js";
import { ManifestSnapshot } from "../../src/snapshot.js";

const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const fixtureRoot = join(repositoryRoot, "test/fixtures/codex");

describe("spec-driven pack interpreter", () => {
  it("does not import vendor Codex adapter code", () => {
    const interpret = readFileSync(join(repositoryRoot, "src/packs/interpret.ts"), "utf8");
    const profile = readFileSync(join(repositoryRoot, "src/packs/profile.ts"), "utf8");
    expect(interpret).not.toContain("profiles/codex");
    expect(interpret).not.toContain("createCodexProfile");
    expect(profile).not.toContain("createCodexProfile");
    expect(profile).toContain("interpretCompiledPack");
  });

  it("interprets the bundled Codex pack onto the adapter oracle", async () => {
    const pack = loadBundledPack("openai-codex-cli@1");
    const interpreted = interpretCompiledPack(pack);
    const catalog = profileFromCompiledPack(pack);
    expect(interpreted.id).toBe(codexProfile.id);
    expect(catalog.id).toBe(codexProfile.id);
    const files = readdirSync(fixtureRoot).filter((name) => name.endsWith(".json")).sort();
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const snapshot = new ManifestSnapshot(
        JSON.parse(readFileSync(join(fixtureRoot, file), "utf8")),
      );
      const adapter = await createCodexProfile({
        id: pack.pack.id,
        evidence: catalog.evidence,
        overrideName: "AGENTS.override.md",
        agentsName: "AGENTS.md",
        byteLimit: 32768,
      }).prepare(snapshot);
      const engine = await interpreted.prepare(snapshot);
      expect([...engine.sourceDependencyPaths].sort()).toEqual(
        [...adapter.sourceDependencyPaths].sort(),
      );
      const paths = await snapshot.listPaths();
      const targets = paths.length === 0 ? ["file.ts"] : paths;
      for (const target of targets) {
        expect(canonicalJson(engine.project(target))).toBe(canonicalJson(adapter.project(target)));
      }
    }
  });
});
