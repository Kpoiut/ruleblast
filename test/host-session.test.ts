import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical.js";
import {
  companionBegin,
  companionExplain,
  companionFail,
  companionMarkStale,
  companionNoteDirty,
  companionStatusLine,
  companionSucceed,
  gateWorkspace,
  initialCompanionState,
  toRepositoryRelativePath,
} from "../src/application/host-session.js";
import { scanRepository } from "../src/application/authority.js";
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
    };
    const state = companionExplain(initialCompanionState(), view, "src/a.ts\n");
    expect(state.explainView).toBe(view);
    expect(state.explainText).toBe("src/a.ts\n");
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
