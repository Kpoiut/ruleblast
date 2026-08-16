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

  it("keeps errors on the lifecycle axis", () => {
    const state = companionFail(initialCompanionState(), "UNTRUSTED", "no");
    expect(state.lifecycle).toBe("ERROR");
    expect(state.error?.code).toBe("UNTRUSTED");
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
