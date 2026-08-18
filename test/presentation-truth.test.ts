import { describe, expect, it } from "vitest";
import {
  PresentationSession,
  derivePresentationTruth,
  uncertainPathCount,
} from "../src/application/presentation-truth.js";
import {
  companionBegin,
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

describe("Presentation Truth Reducer", () => {
  it("starts READY with no badge and no decorations", () => {
    const snap = derivePresentationTruth(initialCompanionState());
    expect(snap.workspaceTruth.phase).toBe("ready");
    expect(snap.workspaceTruth.glance.treeViewBadge).toBeUndefined();
    expect(snap.workspaceTruth.glance.statusLineText).toBe("RB · READY");
    expect(snap.resourceIndex.size).toBe(0);
  });

  it("uses ANALYZING glance without numeric badge", () => {
    const snap = derivePresentationTruth(
      companionBegin(initialCompanionState(), "diff"),
      null,
      false,
      2,
    );
    expect(snap.generation).toBe(2);
    expect(snap.workspaceTruth.phase).toBe("analyzing");
    expect(snap.workspaceTruth.glance.statusLineText).toBe("RB · $(sync~spin)");
    expect(snap.workspaceTruth.glance.treeViewBadge).toBeUndefined();
  });

  it("shows Δ only on a current diff with changed stacks", async () => {
    const diff = await diffRepository({
      before: snapshot({ "AGENTS.md": "Rule A", "src/a.ts": "code a" }),
      after: snapshot({ "AGENTS.md": "Rule B edited", "src/a.ts": "code a" }),
    });
    const snap = derivePresentationTruth(
      companionSucceed(initialCompanionState(), diff),
    );
    expect(snap.workspaceTruth.phase).toBe("current");
    if (snap.workspaceTruth.phase !== "current") return;
    expect(snap.workspaceTruth.mode).toBe("diff");
    expect(snap.workspaceTruth.changedCount).toBeGreaterThan(0);
    expect(snap.workspaceTruth.glance.statusLineText).toMatch(/^RB · Δ\d+$/u);
    expect(snap.workspaceTruth.glance.treeViewBadge).toBe(snap.workspaceTruth.changedCount);
    expect(snap.workspaceTruth.glance.accessibleStatusText)
      .toContain("paths have changed instruction stacks");
    expect(snap.resourceIndex.get("src/a.ts")?.decoration?.badge).toBe("Δ");
    expect(snap.resourceIndex.get("AGENTS.md")?.lens?.isInstructionSource).toBe(true);
  });

  it("never borrows Δ or ≠ on a current scan even when profiles already disagree", async () => {
    const scan = await scanRepository({
      snapshot: snapshot({
        "AGENTS.md": "codex only rule\n",
        "CLAUDE.md": "claude only rule\n",
        "src/a.ts": "code",
      }),
    });
    const snap = derivePresentationTruth(companionSucceed(initialCompanionState(), scan));
    expect(snap.workspaceTruth.phase).toBe("current");
    if (snap.workspaceTruth.phase !== "current") return;
    expect(snap.workspaceTruth.mode).toBe("scan");
    expect(snap.workspaceTruth.changedCount).toBeNull();
    expect(snap.workspaceTruth.newlySplitCount).toBeNull();
    expect(snap.workspaceTruth.glance.statusLineText).not.toMatch(/[Δ≠]/u);
    expect(snap.workspaceTruth.glance.treeViewBadge).toBeUndefined();
    for (const resource of snap.resourceIndex.values()) {
      expect(resource.decoration?.badge === "Δ" || resource.decoration?.badge === "≠")
        .toBe(false);
    }
  });

  it("counts uncertain paths as distinct paths, not summed counters", async () => {
    const scan = await scanRepository({
      snapshot: snapshot({ "file.ts": "content" }),
    });
    const expected = uncertainPathCount(scan);
    const snap = derivePresentationTruth(companionSucceed(initialCompanionState(), scan));
    expect(snap.workspaceTruth.phase).toBe("current");
    if (snap.workspaceTruth.phase !== "current") return;
    expect(snap.workspaceTruth.uncertainPathCount).toBe(expected);
    if (expected > 0) {
      expect(snap.workspaceTruth.glance.statusLineText).toBe(`RB · ?${expected}`);
    }
  });

  it("lets uncertainty outrank Δ on a current diff", async () => {
    const diff = await diffRepository({
      before: snapshot({ "AGENTS.md": "Rule A", "src/a.ts": "code" }),
      after: snapshot({ "AGENTS.md": "Rule B", "src/a.ts": "code" }),
    });
    const first = diff.paths[0];
    if (first === undefined) throw new Error("expected a path");
    const partial = {
      ...diff,
      paths: [
        {
          ...first,
          after: first.after.map((row) => ({ ...row, status: "PARTIAL" as const })),
        },
        ...diff.paths.slice(1),
      ],
    };
    const snap = derivePresentationTruth(companionSucceed(initialCompanionState(), partial));
    expect(uncertainPathCount(partial)).toBeGreaterThan(0);
    expect(snap.workspaceTruth.phase).toBe("current");
    if (snap.workspaceTruth.phase !== "current") return;
    expect(snap.workspaceTruth.glance.statusLineText).toMatch(/^RB · \?/u);
    expect(snap.resourceIndex.get(first.path)?.decoration?.badge).toBe("?");
  });

  it("clears live numbers on STALE (GATE 7)", async () => {
    const diff = await diffRepository({
      before: snapshot({ "AGENTS.md": "Rule A", "src/a.ts": "code" }),
      after: snapshot({ "AGENTS.md": "Rule B", "src/a.ts": "code" }),
    });
    const snap = derivePresentationTruth(
      companionMarkStale(companionSucceed(initialCompanionState(), diff)),
    );
    expect(snap.workspaceTruth.phase).toBe("stale");
    expect(snap.workspaceTruth.glance.statusLineText).toBe("RB · STALE");
    expect(snap.workspaceTruth.glance.treeViewBadge).toBeUndefined();
    expect(snap.workspaceTruth.glance.treeViewDescription).toBe("STALE");
    expect(snap.explainPolicy.freshness).toBe("stale");
    expect(snap.explainPolicy.banner).toContain("RULEBLAST · STALE");
    expect(snap.resourceIndex.get("src/a.ts")?.decoration).toBeNull();
    expect(snap.resourceIndex.get("AGENTS.md")?.lens?.staleTitle).toContain("STALE");
  });

  it("keeps an atomic snapshot: later generation ignores the older commit", () => {
    const session = new PresentationSession();
    const first = session.begin();
    const second = session.begin();
    expect(session.commit(initialCompanionState(), first)).toBeNull();
    const accepted = session.commit(companionBegin(initialCompanionState(), "scan"), second);
    expect(accepted?.generation).toBe(second);
    expect(session.snapshot?.workspaceTruth.phase).toBe("analyzing");
  });

  it("morphs the status line to the active file without changing the badge", async () => {
    const diff = await diffRepository({
      before: snapshot({ "AGENTS.md": "Rule A", "src/a.ts": "code a" }),
      after: snapshot({ "AGENTS.md": "Rule B edited", "src/a.ts": "code a" }),
    });
    const snap = derivePresentationTruth(
      companionSucceed(initialCompanionState(), diff),
      "src/a.ts",
    );
    expect(snap.workspaceTruth.phase).toBe("current");
    if (snap.workspaceTruth.phase !== "current") return;
    expect(snap.workspaceTruth.glance.statusLineText).toMatch(/^RB · Δ · AGENTS\.md$/u);
    expect(snap.workspaceTruth.glance.accessibleStatusText).toContain("AGENTS.md");
    expect(snap.workspaceTruth.glance.treeViewBadge).toBe(snap.workspaceTruth.changedCount);
  });

  it("names the governing source when the active file is aligned, not split", async () => {
    const scan = await scanRepository({
      snapshot: snapshot({
        "AGENTS.md": "shared rule\n",
        "CLAUDE.md": "shared rule\n",
        "src/a.ts": "code",
      }),
    });
    const row = scan.paths.find((path) => path.path === "src/a.ts");
    expect(row?.isSplit).toBe(false);
    const snap = derivePresentationTruth(
      companionSucceed(initialCompanionState(), scan),
      "src/a.ts",
    );
    expect(snap.workspaceTruth.phase).toBe("current");
    expect(snap.workspaceTruth.glance.statusLineText).toMatch(/^RB · (AGENTS|CLAUDE)\.md$/u);
    expect(snap.resourceIndex.get("src/a.ts")?.canCompare).toBe(false);
  });

  it("offers compare only when selected realities disagree", async () => {
    const scan = await scanRepository({
      snapshot: snapshot({
        "AGENTS.md": "codex only rule\n",
        "CLAUDE.md": "claude only rule\n",
        "src/a.ts": "code",
      }),
    });
    const row = scan.paths.find((path) => path.path === "src/a.ts");
    expect(row?.isSplit).toBe(true);
    const snap = derivePresentationTruth(companionSucceed(initialCompanionState(), scan));
    expect(snap.resourceIndex.get("src/a.ts")?.canCompare).toBe(true);
  });

  it("indexes every changed instruction source, not the CLI sample cap", async () => {
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
    expect(diff.changedInstructionSources.length).toBe(4);
    const snap = derivePresentationTruth(companionSucceed(initialCompanionState(), diff));
    const lenses = [...snap.resourceIndex.values()].filter((row) => row.lens !== null);
    expect(lenses.length).toBe(4);
  });
});
