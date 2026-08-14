import { describe, expect, it } from "vitest";
import { scanRepository } from "../../../src/application/authority.js";
import { companionSucceed, initialCompanionState } from "../../../src/application/host-session.js";
import { canonicalJson } from "../../../src/canonical.js";
import { analyzeCurrent } from "../../../src/impact.js";
import { claudeProfile } from "../../../src/profiles/claude.js";
import { codexProfile } from "../../../src/profiles/codex.js";
import { ManifestSnapshot } from "../../../src/snapshot.js";

function snapshot(): ManifestSnapshot {
  return new ManifestSnapshot({
    schemaVersion: 1,
    label: "cross-host",
    entries: [
      {
        path: "AGENTS.md",
        kind: "file",
        executable: false,
        base64: Buffer.from("root", "utf8").toString("base64"),
      },
      {
        path: "src/app.ts",
        kind: "file",
        executable: false,
        base64: Buffer.from("code", "utf8").toString("base64"),
      },
    ],
  });
}

describe("cross-host semantic equivalence", () => {
  it("makes CLI engine, facade, and companion session share canonical bytes", async () => {
    const input = snapshot();
    const engine = await analyzeCurrent({
      snapshot: input,
      profiles: [claudeProfile, codexProfile],
    });
    const facade = await scanRepository({ snapshot: input, reality: null });
    const hosted = companionSucceed(initialCompanionState(), facade);
    expect(canonicalJson(facade)).toBe(canonicalJson(engine));
    expect(hosted.canonicalJson).toBe(canonicalJson(engine));
  });
});
