import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../../src/canonical.js";
import { analyzeCurrent, analyzeDiff } from "../../src/impact.js";
import { PROFILE_CATALOG, profilesForReality } from "../../src/application/profile-catalog.js";
import { claudeProfile } from "../../src/profiles/claude.js";
import { codexProfile } from "../../src/profiles/codex.js";
import { copilotProfile } from "../../src/profiles/copilot.js";
import { geminiProfile } from "../../src/profiles/gemini.js";
import { ManifestSnapshot } from "../../src/snapshot.js";

const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const bundledPackIds = [
  "anthropic-claude-code-cli@1",
  "github-copilot-cli@1",
  "google-gemini-cli@1",
  "openai-codex-cli@1",
] as const;

function load(family: string, name: string): ManifestSnapshot {
  return new ManifestSnapshot(
    JSON.parse(readFileSync(new URL(`../fixtures/${family}/${name}`, import.meta.url), "utf8")),
  );
}

describe("increment 6 catalog packs vs adapter engines", () => {
  it("admits exactly the four locked bundled pack ids", () => {
    expect(PROFILE_CATALOG.map((entry) => entry.id).sort()).toEqual([
      "anthropic/claude-code-cli@1",
      "github/copilot-cli@1",
      "google/gemini-cli@1",
      "openai/codex-cli@1",
    ]);
    for (const id of bundledPackIds) {
      for (const name of ["pack.json", "evidence.json", "resolver.json"] as const) {
        expect(existsSync(join(repositoryRoot, "packs", "bundled", id, name))).toBe(true);
      }
    }
  });

  it("scan/diff default pair matches adapter engines", async () => {
    const snapshot = load("codex", "override.json");
    const catalog = await analyzeCurrent({
      snapshot,
      profiles: profilesForReality(null),
    });
    const adapters = await analyzeCurrent({
      snapshot,
      profiles: [claudeProfile, codexProfile],
    });
    expect(canonicalJson(catalog)).toBe(canonicalJson(adapters));
  });

  it("diff Codex override, Claude nested, Gemini two-hop, Copilot applyTo", async () => {
    const cases = [
      { before: load("codex", "override.json"), after: load("codex", "empty-override.json"), reality: null },
      { before: load("claude", "nested.json"), after: load("claude", "root.json"), reality: null },
      {
        before: load("gemini", "probe-two-hop-before.json"),
        after: load("gemini", "probe-two-hop-after.json"),
        reality: "google/gemini-cli@1",
      },
    ] as const;
    for (const item of cases) {
      const catalog = await analyzeDiff({
        before: item.before,
        after: item.after,
        profiles: profilesForReality(item.reality),
      });
      const extra = item.reality === "google/gemini-cli@1" ? [geminiProfile] : [];
      const adapters = await analyzeDiff({
        before: item.before,
        after: item.after,
        profiles: [claudeProfile, codexProfile, ...extra],
      });
      expect(canonicalJson(catalog)).toBe(canonicalJson(adapters));
    }
    const copilotSnap = new ManifestSnapshot({
      schemaVersion: 1,
      label: "copilot-e2e",
      entries: [
        {
          path: ".github/copilot-instructions.md",
          kind: "file",
          executable: false,
          base64: Buffer.from("repo\n", "utf8").toString("base64"),
        },
        {
          path: "src/file.ts",
          kind: "file",
          executable: false,
          base64: Buffer.from("x\n", "utf8").toString("base64"),
        },
      ],
    });
    const catalog = await analyzeCurrent({
      snapshot: copilotSnap,
      profiles: profilesForReality("github/copilot-cli@1"),
    });
    const adapters = await analyzeCurrent({
      snapshot: copilotSnap,
      profiles: [claudeProfile, codexProfile, copilotProfile],
    });
    expect(canonicalJson(catalog)).toBe(canonicalJson(adapters));
  });
});
