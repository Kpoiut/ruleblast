import { describe, expect, it } from "vitest";
import { attentionPaths } from "../src/domain/attention-paths.js";
import { comparePathStacks, formatProjectionCompare } from "../src/application/projection-compare.js";
import { diffRepository, scanRepository } from "../src/application/authority.js";
import { GITHUB_COPILOT_CLI_PROFILE_ID } from "../src/model.js";
import { ManifestSnapshot } from "../src/snapshot.js";

function snapshot(files: Readonly<Record<string, string>>): ManifestSnapshot {
  return new ManifestSnapshot({
    schemaVersion: 1,
    label: "host",
    entries: Object.entries(files).map(([path, contents]) => ({
      path,
      kind: "file" as const,
      executable: false,
      base64: Buffer.from(contents, "utf8").toString("base64"),
    })),
  });
}

describe("attention paths", () => {
  it("lists only changed-stack paths on a diff, sorted", async () => {
    const result = await diffRepository({
      before: snapshot({
        "AGENTS.md": "root\n",
        "src/in.ts": "in\n",
        "docs/out.md": "out\n",
      }),
      after: snapshot({
        "AGENTS.md": "root changed\n",
        "src/in.ts": "in\n",
        "docs/out.md": "out changed\n",
      }),
    });
    const paths = attentionPaths(result);
    expect(paths.every((path) =>
      result.paths.find((row) => row.path === path)?.changedProfiles.length,
    )).toBe(true);
    expect(paths).toEqual([...paths].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    ));
    expect(paths.length).toBeGreaterThan(0);
  });

  it("lists currently split paths on a scan, never invented Δ paths", async () => {
    const result = await scanRepository({
      snapshot: snapshot({
        "AGENTS.md": "codex rule\n",
        "CLAUDE.md": "claude rule\n",
        "src/a.ts": "code",
      }),
    });
    const paths = attentionPaths(result);
    for (const path of paths) {
      expect(result.paths.find((row) => row.path === path)?.isSplit).toBe(true);
    }
  });
});

describe("projection stack compare", () => {
  it("renders two after-stacks as a perceptual compare, not a new analysis", async () => {
    const result = await scanRepository({
      snapshot: snapshot({
        "AGENTS.md": "codex rule\n",
        "CLAUDE.md": "claude rule\n",
        "src/a.ts": "code",
      }),
    });
    const row = result.paths.find((path) => path.path === "src/a.ts");
    expect(row).toBeDefined();
    const compare = comparePathStacks(row!);
    const text = formatProjectionCompare(compare);
    expect(text).toContain("RULEBLAST COMPARE · src/a.ts");
    expect(text).toContain(compare.left.label);
    expect(text).toContain(compare.right.label);
    expect(text).toMatch(/AGENTS\.md|CLAUDE\.md/u);
  });

  it("compares a proven DIFFERENT pair instead of projections[0] and [1]", async () => {
    const result = await scanRepository({
      snapshot: snapshot({
        "AGENTS.md": "codex rule\n",
        "CLAUDE.md": "claude rule\n",
        "src/a.ts": "code",
      }),
      realities: [GITHUB_COPILOT_CLI_PROFILE_ID],
    });
    const row = result.paths.find((path) => path.path === "src/a.ts");
    expect(row).toBeDefined();
    expect(row!.projections.map((projection) => projection.profile)).toEqual([
      "anthropic/claude-code-cli@1",
      "github/copilot-cli@1",
      "openai/codex-cli@1",
    ]);
    const compare = comparePathStacks(row!);
    expect(compare.left.label).toMatch(/Claude/u);
    expect(compare.right.label).toMatch(/Codex/u);
    expect(compare.left.label).not.toMatch(/Copilot/u);
    expect(compare.right.label).not.toMatch(/Copilot/u);
  });
});
