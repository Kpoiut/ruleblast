import { describe, expect, it } from "vitest";
import { PROFILE_CATALOG } from "../../../src/application/profile-catalog.js";
import { runtimePairSplits } from "../../../src/domain/payload-relation.js";
import { analyzeCurrent } from "../../../src/impact.js";
import { ManifestSnapshot } from "../../../src/snapshot.js";

function file(path: string, text: string) {
  return {
    path,
    kind: "file" as const,
    executable: false,
    base64: Buffer.from(text, "utf8").toString("base64"),
  };
}

describe("four-runtime measurement matrix", () => {
  it("projects all four catalog runtimes on one snapshot and counts every disagreeing pair", async () => {
    const snapshot = new ManifestSnapshot({
      schemaVersion: 1,
      label: "four-runtime-matrix",
      entries: [
        file("AGENTS.md", "codex-root\n"),
        file("CLAUDE.md", "claude-root\n"),
        file("GEMINI.md", "gemini-root\n"),
        file(".github/copilot-instructions.md", "copilot-root\n"),
        file("src/file.ts", ""),
      ],
    });
    const result = await analyzeCurrent({
      snapshot,
      profiles: PROFILE_CATALOG.map((entry) => entry.definition),
    });
    expect(result.counts.byProfile.map((row) => row.profile).sort()).toEqual([
      "anthropic/claude-code-cli@1",
      "github/copilot-cli@1",
      "google/gemini-cli@1",
      "openai/codex-cli@1",
    ]);
    expect(result.counts.candidatePathCount).toBe(5);
    const pairs = runtimePairSplits(result.paths);
    expect(pairs).toHaveLength(6);
    expect(pairs.every((pair) => pair.differentPathCount >= 1)).toBe(true);
    expect(result.counts.currentSplitPathCount).toBeGreaterThan(0);
  });
});
