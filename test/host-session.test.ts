import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical.js";
import {
  companionBegin,
  companionExplain,
  companionExplainFromResult,
  companionFail,
  companionMarkStale,
  companionNoteDirty,
  companionSetRealities,
  companionSetReality,
  companionStatusLine,
  companionSucceed,
  companionTree,
  gateWorkspace,
  initialCompanionState,
  toRepositoryRelativePath,
} from "../src/application/host-session.js";
import { diffRepository, scanRepository } from "../src/application/authority.js";
import { GOOGLE_GEMINI_CLI_PROFILE_ID } from "../src/model.js";
import { scoreboardView } from "../src/application/scoreboard-view.js";
import { claudeProfile } from "../src/profiles/claude.js";
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

describe("workspace gate", () => {
  it("refuses untrusted and multi-root workspaces", () => {
    expect(gateWorkspace({ trusted: false, folders: ["D:/repo"] })).toMatchObject({
      ok: false,
      code: "UNTRUSTED",
    });
    expect(gateWorkspace({ trusted: true, folders: [] })).toMatchObject({
      ok: false,
      code: "NO_FOLDER",
    });
    expect(gateWorkspace({
      trusted: true,
      folders: ["D:/one", "D:/two"],
    })).toMatchObject({ ok: false, code: "MULTI_ROOT" });
    expect(gateWorkspace({
      trusted: true,
      folders: ["D:/one", "D:/two"],
      selectedFolder: "D:/one",
    }).ok).toBe(true);
  });

  it("maps an active file to a repository-relative path and rejects escapes", () => {
    expect(toRepositoryRelativePath("D:/repo", "D:/repo/src/a.ts")).toBe("src/a.ts");
    expect(toRepositoryRelativePath("D:/repo", "D:/other/a.ts")).toBeNull();
  });
});

describe("companion session", () => {
  it("marks a current result stale without rerunning analysis", async () => {
    const result = await scanRepository({
      snapshot: snapshot({ "AGENTS.md": "root", "src/a.ts": "code" }),
      reality: null,
    });
    let state = initialCompanionState();
    state = companionBegin(state, "scan");
    expect(state.lifecycle).toBe("ANALYZING");
    state = companionSucceed(state, result);
    expect(state.lifecycle).toBe("CURRENT");
    expect(state.canonicalJson).toBe(canonicalJson(result));
    const frozen = state.canonicalJson;
    state = companionMarkStale(state);
    expect(state.lifecycle).toBe("STALE");
    expect(state.canonicalJson).toBe(frozen);
  });

  it("keeps unsaved buffers out of the snapshot claim", () => {
    const dirty = companionNoteDirty(initialCompanionState(), true);
    expect(companionStatusLine(dirty)).toContain("unsaved");
    expect(dirty.lifecycle).toBe("READY");
  });

  it("records explain from the shared view instead of parsing terminal text", () => {
    const view = {
      path: "src/a.ts",
      profiles: [],
      relation: "SAME" as const,
      completeness: "COMPLETE" as const,
      findings: [],
      why: null,
    };
    const state = companionExplain(initialCompanionState(), view, "src/a.ts\n");
    expect(state.explainView).toBe(view);
    expect(state.explainText).toBe("src/a.ts\n");
  });

  it("explains from the last canonical result and keeps STALE", async () => {
    const result = await scanRepository({
      snapshot: snapshot({ "AGENTS.md": "root", "src/a.ts": "code" }),
      reality: null,
    });
    let state = companionSucceed(companionBegin(initialCompanionState(), "scan"), result);
    state = companionMarkStale(state);
    state = companionExplainFromResult(state, "src/a.ts", (explain) => explain.path.path);
    expect(state.lifecycle).toBe("STALE");
    expect(state.explainView?.path).toBe("src/a.ts");
    expect(state.result).toBe(result);
    expect(state.canonicalJson).toBe(canonicalJson(result));
  });

  it("does not recapture when the last result omits the path", async () => {
    const result = await scanRepository({
      snapshot: snapshot({ "AGENTS.md": "root", "src/a.ts": "code" }),
      reality: null,
    });
    const state = companionExplainFromResult(
      companionSucceed(initialCompanionState(), result),
      "missing.ts",
      () => {
        throw new Error("presenter must not run for a missing path");
      },
    );
    expect(state.lifecycle).toBe("ERROR");
    expect(state.error?.code).toBe("PATH_NOT_IN_RESULT");
    expect(state.result).toBe(result);
  });

  it("marks an existing result stale when the session reality changes", async () => {
    const result = await scanRepository({
      snapshot: snapshot({ "AGENTS.md": "root", "src/a.ts": "code" }),
      reality: null,
    });
    let state = companionSucceed(initialCompanionState(), result);
    state = companionSetReality(state, GOOGLE_GEMINI_CLI_PROFILE_ID);
    expect(state.realities).toEqual([GOOGLE_GEMINI_CLI_PROFILE_ID]);
    expect(state.lifecycle).toBe("STALE");
    expect(state.result).toBe(result);
    expect(() => companionSetReality(state, "cursor/editor@1")).toThrow(/opt-in reality/i);
    const both = companionSetRealities(state, [
      GOOGLE_GEMINI_CLI_PROFILE_ID,
      "github/copilot-cli@1",
    ]);
    expect(both.realities).toEqual(["github/copilot-cli@1", GOOGLE_GEMINI_CLI_PROFILE_ID]);
  });

  it("puts last explain and source blast on the scoreboard tree", async () => {
    const before = snapshot({ "AGENTS.md": "root", "src/a.ts": "code" });
    const after = snapshot({
      "AGENTS.md": "root",
      "packages/api/AGENTS.md": "nested",
      "src/a.ts": "code",
    });
    const result = await diffRepository({ before, after, reality: null });
    let state = companionSucceed(companionBegin(initialCompanionState(), "diff"), result);
    state = companionExplainFromResult(state, "src/a.ts", (explain) => explain.path.path);
    const ids = companionTree(state).map((node) => node.id);
    expect(ids).toContain("explain");
    expect(ids).toContain("blast");
    expect(ids).toContain("reality");
    expect(companionTree(state).find((node) => node.id === "explain")?.label)
      .toContain("src/a.ts");
  });

  it("renders a prepared overlay adjunct without deriving it", async () => {
    const result = await scanRepository({
      snapshot: snapshot({ "AGENTS.md": "root", "src/a.ts": "code" }),
      reality: null,
    });
    const overlay = {
      observedPathCount: 2,
      inBlastCount: 1,
      outsideBlastCount: 1,
      unresolvedCount: 0,
      splitObservedPathCount: 0,
      observedPaths: [
        { path: "src/in.ts", kind: "MODIFY" as const, relation: "IN_BLAST" as const },
        { path: "docs/out.md", kind: "MODIFY" as const, relation: "OUTSIDE_BLAST" as const },
      ],
    };
    const state = companionSucceed(initialCompanionState(), result, { overlay });
    const tree = companionTree(state);
    const node = tree.find((item) => item.id === "overlay");
    expect(node?.description).toBe("MIXED · 2 paths");
    expect(node?.children?.find((item) => item.id === "overlay:alignment")).toMatchObject({
      label: "Change alignment",
      description: "MIXED",
    });
    expect(
      node?.children?.find((item) => item.id === "overlay:alignment")?.children?.[0]?.label,
    ).toBe("other tracked motion is not one inherited class");
    expect(node?.children?.find((item) => item.id === "overlay:kinds")?.label)
      .toBe("0 added · 2 modified · 0 deleted");
    expect(node?.children?.find((item) => item.id === "overlay:work-map")?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "overlay:work-map:inherited-stack",
          label: "Inherited stack",
          description: "1",
          path: "src/in.ts",
          intent: "EXPLAIN_PATH",
          mark: "inherited",
        }),
        expect.objectContaining({
          id: "overlay:work-map:independent-git",
          label: "Independent Git work",
          description: "1",
          path: "docs/out.md",
          intent: "EXPLAIN_PATH",
          mark: "independent",
        }),
      ]),
    );
    const inherited = node?.children?.find((item) => item.id === "overlay:in");
    expect(inherited?.children?.[0]).toMatchObject({
      path: "src/in.ts",
      intent: "EXPLAIN_PATH",
      kind: "observation",
      mark: "inherited",
    });
    const unavailable = companionSucceed(initialCompanionState(), result, {
      overlayUnavailable: true,
    });
    expect(companionTree(unavailable).find((item) => item.id === "overlay")?.description)
      .toBe("unavailable");
  });

  it("restates instruction-line edits from the prepared diff result", async () => {
    const before = snapshot({
      "AGENTS.md": "root\n",
      "src/in.ts": "in\n",
      "docs/out.md": "out\n",
    });
    const after = snapshot({
      "AGENTS.md": "root changed\n",
      "src/in.ts": "in changed\n",
      "docs/out.md": "out changed\n",
    });
    const result = await diffRepository({ before, after, reality: null });
    const overlay = {
      observedPathCount: 2,
      inBlastCount: 1,
      outsideBlastCount: 1,
      unresolvedCount: 0,
      splitObservedPathCount: 0,
      observedPaths: [
        { path: "src/in.ts", kind: "MODIFY" as const, relation: "IN_BLAST" as const },
        { path: "docs/out.md", kind: "MODIFY" as const, relation: "OUTSIDE_BLAST" as const },
      ],
    };
    const tree = companionTree(companionSucceed(initialCompanionState(), result, { overlay }));
    const node = tree.find((item) => item.id === "overlay");
    const edits = result.diffStats.addedLineCount +
      result.diffStats.deletedLineCount +
      result.diffStats.editedLineCount;
    expect(node?.children?.find((item) => item.id === "overlay:edits")).toMatchObject({
      label: `${edits} instruction-line edits`,
      description: `${result.counts.changedStackPathCount} changed stacks · 1 inherited other paths`,
    });
    expect(node?.children?.some((item) => item.id === "overlay:law")).toBe(false);
  });

  it("leaves the empty scoreboard to the host welcome surface", () => {
    expect(companionTree(initialCompanionState())).toEqual([]);
    const analyzing = companionBegin(initialCompanionState(), "scan");
    expect(companionTree(analyzing).map((node) => node.id)).toEqual(["status"]);
  });

  it("orders a current scoreboard as status, control, then facts", async () => {
    const result = await scanRepository({
      snapshot: snapshot({ "AGENTS.md": "root", "src/a.ts": "code" }),
      reality: null,
    });
    const tree = companionTree(companionSucceed(initialCompanionState(), result));
    expect(tree.slice(0, 3).map((node) => node.id)).toEqual([
      "status", "control", "reality",
    ]);
    expect(tree.every((node) => typeof node.kind === "string")).toBe(true);
    const controls = tree.find((node) => node.id === "control")?.children ?? [];
    expect(controls.map((node) => node.description)).toEqual(["S", "D", "E", "C"]);
    expect(controls.every((node) => node.intent === undefined)).toBe(true);
  });

  it("keeps errors on the lifecycle axis", () => {
    const state = companionFail(initialCompanionState(), "UNTRUSTED", "no");
    expect(state.lifecycle).toBe("ERROR");
    expect(state.error?.code).toBe("UNTRUSTED");
    expect(companionTree(state).map((node) => node.id)).toEqual(["status", "error"]);
  });
});

describe("scoreboard view", () => {
  it("derives profile badges from the catalog", async () => {
    const result = await scanRepository({
      snapshot: snapshot({ "CLAUDE.md": "root", "src/a.ts": "code" }),
      reality: null,
    });
    const view = scoreboardView(result);
    expect(view.profiles.some((profile) => profile.badge === "CX")).toBe(true);
    expect(view.profiles.some((profile) => profile.shortLabel === "Claude Code")).toBe(true);
    expect(result.paths[0]?.projections.some((item) => item.profile === claudeProfile.id)).toBe(true);
  });
});
