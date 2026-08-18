import { describe, expect, it } from "vitest";
import { companionTree } from "../src/application/scoreboard-tree.js";
import {
  companionMarkStale,
  companionSucceed,
  initialCompanionState,
} from "../src/application/host-session.js";
import { diffRepository, scanRepository } from "../src/application/authority.js";
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

describe("Scoreboard IA", () => {
  it("returns no nodes when READY so Welcome can show (GATE 17)", () => {
    expect(companionTree(initialCompanionState())).toEqual([]);
  });

  it("shows Δ ≠ ? leaves, expands changed sources, and hides Status/Control", async () => {
    const diff = await diffRepository({
      before: snapshot({ "AGENTS.md": "Rule A", "src/a.ts": "code a" }),
      after: snapshot({ "AGENTS.md": "Rule B edited", "src/a.ts": "code a" }),
    });
    const nodes = companionTree(companionSucceed(initialCompanionState(), diff));
    expect(nodes.some((node) => node.id === "status" || node.id === "control")).toBe(false);
    expect(nodes.find((node) => node.id === "metric-changed")?.label).toMatch(/^Δ /u);
    expect(nodes.find((node) => node.id === "metric-split")?.label).toMatch(/^≠ /u);
    expect(nodes.find((node) => node.id === "metric-uncertain")?.label).toMatch(/^\? /u);
    expect(nodes.find((node) => node.id === "metric-changed")?.accessibleLabel)
      .toContain("paths have changed instruction stacks");
    const blast = nodes.find((node) => node.id === "blast");
    expect(blast?.collapsed).toBe(false);
    expect(nodes.find((node) => node.id === "profiles")?.collapsed).toBe(true);
    expect(blast?.children?.[0]?.intent).toBe("OPEN_INSTRUCTION_SOURCE");
  });

  it("does not present live Δ leaves when STALE", async () => {
    const diff = await diffRepository({
      before: snapshot({ "AGENTS.md": "Rule A", "src/a.ts": "code a" }),
      after: snapshot({ "AGENTS.md": "Rule B edited", "src/a.ts": "code a" }),
    });
    const nodes = companionTree(
      companionMarkStale(companionSucceed(initialCompanionState(), diff)),
    );
    expect(nodes.some((node) => node.id === "metric-changed")).toBe(false);
    expect(nodes.some((node) => node.id === "stale")).toBe(true);
    expect(nodes.some((node) => node.id === "blast")).toBe(true);
  });

  it("lists every changed instruction source on the tree (GATE 18)", async () => {
    const files: Record<string, string> = { "src/app.ts": "app" };
    for (let index = 0; index < 4; index += 1) {
      files[`nest${index}/AGENTS.md`] = `before ${index}`;
    }
    const after = { ...files };
    for (let index = 0; index < 4; index += 1) {
      after[`nest${index}/AGENTS.md`] = `after ${index}`;
    }
    const diff = await diffRepository({
      before: snapshot(files),
      after: snapshot(after),
    });
    const blast = companionTree(companionSucceed(initialCompanionState(), diff))
      .find((node) => node.id === "blast");
    expect(blast?.children).toHaveLength(4);
  });

  it("does not use ≠ on a scan tree", async () => {
    const scan = await scanRepository({
      snapshot: snapshot({
        "AGENTS.md": "codex",
        "CLAUDE.md": "claude",
        "src/a.ts": "code",
      }),
    });
    const labels = companionTree(companionSucceed(initialCompanionState(), scan))
      .map((node) => node.label)
      .join("\n");
    expect(labels).not.toContain("≠");
    expect(labels).not.toContain("Δ");
  });
});
