import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../../src/canonical.js";
import { loadBundledPack } from "../../src/packs/load.js";
import { profileFromCompiledPack } from "../../src/packs/profile.js";
import { claudeProfile } from "../../src/profiles/claude.js";
import { copilotProfile } from "../../src/profiles/copilot.js";
import { geminiProfile } from "../../src/profiles/gemini.js";
import type { ProfileDefinition } from "../../src/profiles/profile.js";
import { ManifestSnapshot } from "../../src/snapshot.js";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

function assertProjectionEquivalent(left: unknown, right: unknown): void {
  expect(canonicalJson(left)).toBe(canonicalJson(right));
}

async function compareOnFixtures(
  adapter: ProfileDefinition,
  pack: ProfileDefinition,
  family: string,
): Promise<void> {
  const directory = join(fixtureRoot, family);
  const files = readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const snapshot = new ManifestSnapshot(
      JSON.parse(readFileSync(join(directory, file), "utf8")),
    );
    const preparedAdapter = await adapter.prepare(snapshot);
    const preparedPack = await pack.prepare(snapshot);
    expect([...preparedPack.sourceDependencyPaths].sort()).toEqual(
      [...preparedAdapter.sourceDependencyPaths].sort(),
    );
    const paths = await snapshot.listPaths();
    const targets = paths.length === 0 ? ["file.ts"] : paths;
    for (const target of targets) {
      assertProjectionEquivalent(preparedPack.project(target), preparedAdapter.project(target));
    }
  }
}

describe("increments 3-5 pack equivalence", () => {
  it("matches Claude adapter on Claude fixtures", async () => {
    const pack = profileFromCompiledPack(loadBundledPack("anthropic-claude-code-cli@1"));
    expect(pack.id).toBe(claudeProfile.id);
    await compareOnFixtures(claudeProfile, pack, "claude");
  });

  it("matches Gemini adapter on Gemini probe fixtures", async () => {
    const pack = profileFromCompiledPack(loadBundledPack("google-gemini-cli@1"));
    expect(pack.id).toBe(geminiProfile.id);
    await compareOnFixtures(geminiProfile, pack, "gemini");
  });

  it("matches Copilot adapter on a scoped applyTo snapshot", async () => {
    const pack = profileFromCompiledPack(loadBundledPack("github-copilot-cli@1"));
    expect(pack.id).toBe(copilotProfile.id);
    const snapshot = new ManifestSnapshot({
      schemaVersion: 1,
      label: "copilot-apply",
      entries: [
        {
          path: ".github/copilot-instructions.md",
          kind: "file",
          executable: false,
          base64: Buffer.from("repo\n", "utf8").toString("base64"),
        },
        {
          path: ".github/instructions/ts.instructions.md",
          kind: "file",
          executable: false,
          base64: Buffer.from("---\napplyTo: \"**/*.ts\"\n---\nscoped\n", "utf8").toString("base64"),
        },
        {
          path: "src/file.ts",
          kind: "file",
          executable: false,
          base64: Buffer.from("code\n", "utf8").toString("base64"),
        },
        {
          path: "README.md",
          kind: "file",
          executable: false,
          base64: Buffer.from("doc\n", "utf8").toString("base64"),
        },
      ],
    });
    const adapter = await copilotProfile.prepare(snapshot);
    const packed = await pack.prepare(snapshot);
    expect([...packed.sourceDependencyPaths].sort()).toEqual(
      [...adapter.sourceDependencyPaths].sort(),
    );
    assertProjectionEquivalent(packed.project("src/file.ts"), adapter.project("src/file.ts"));
    assertProjectionEquivalent(packed.project("README.md"), adapter.project("README.md"));
  });
});
