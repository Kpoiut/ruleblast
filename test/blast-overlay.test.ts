import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classifyObserved,
  OVERLAY_SAMPLE_CAP,
  OVERLAY_UNAVAILABLE,
  renderBlastOverlay,
} from "../src/application/blast-overlay.js";
import type { PathTransition, Projection } from "../src/model.js";

function projection(
  profile: string,
  status: Projection["status"],
  digest: string | null,
): Projection {
  return {
    profile,
    context: {
      cwd: ".",
      trigger: "READ_TARGET",
      targetPath: "src/app.ts",
      repositoryOnly: true,
    },
    status,
    composition: "ORDERED",
    sources: [],
    normalizedPayloadUnits: [],
    projectionDigest: digest,
    normalizedPayloadDigest: digest,
    evidence: [],
  };
}

function transition(
  changedProfiles: string[],
  before: Projection[],
  after: Projection[],
): PathTransition {
  return {
    path: "src/app.ts",
    before,
    after,
    changedProfiles,
    beforePayloadRelation: "SAME",
    afterPayloadRelation: "INDETERMINATE",
    wasSplit: false,
    isSplit: false,
    causes: [],
  };
}

describe("blast overlay classifier", () => {
  it("locks the presentation sample cap before any renderer exists", () => {
    expect(OVERLAY_SAMPLE_CAP).toBe(8);
  });

  it("forbids overlay from reading snapshot bytes", () => {
    const source = readFileSync(new URL("../src/application/blast-overlay.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/\.read\s*\(/u);
  });

  it("admits the Git pair overlay only on human text", () => {
    const source = readFileSync(new URL("../src/cli-actions.ts", import.meta.url), "utf8");
    const admit = source.indexOf("const admitP1");
    expect(admit).toBeGreaterThan(-1);
    expect(source.slice(admit, admit + 240)).toContain('args.output.kind !== "json"');
    expect(source.indexOf("probeGitStorageFormat", admit)).toBeGreaterThan(admit);
    expect(source).not.toContain("buildOverlayP2");
  });

  it("classifies DELETE as unresolved", () => {
    expect(classifyObserved("DELETE", transition(["p"], [], []))).toBe("UNRESOLVED");
    expect(classifyObserved("MODIFY", undefined)).toBe("UNRESOLVED");
  });

  it("lets a changed COMPLETE profile dominate UNKNOWN", () => {
    const row = transition(
      ["openai/codex-cli@1"],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "UNKNOWN", null),
      ],
      [
        projection("openai/codex-cli@1", "COMPLETE", "b"),
        projection("anthropic/claude-code-cli@1", "UNKNOWN", null),
      ],
    );
    expect(classifyObserved("MODIFY", row)).toBe("IN_BLAST");
  });

  it("is unresolved when no change witness exists and a pair is incomplete", () => {
    const row = transition(
      [],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "UNKNOWN", null),
      ],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "UNKNOWN", null),
      ],
    );
    expect(classifyObserved("MODIFY", row)).toBe("UNRESOLVED");
  });

  it("is outside when every selected pair is complete and unchanged", () => {
    const row = transition(
      [],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "COMPLETE", "c"),
      ],
      [
        projection("anthropic/claude-code-cli@1", "COMPLETE", "c"),
        projection("openai/codex-cli@1", "COMPLETE", "a"),
      ],
    );
    expect(classifyObserved("MODIFY", row)).toBe("OUTSIDE_BLAST");
    expect(row.afterPayloadRelation).toBe("INDETERMINATE");
  });

  it("renders scoped facts without verdict language", () => {
    const text = renderBlastOverlay({
      observedPathCount: 2,
      inBlastCount: 1,
      outsideBlastCount: 1,
      unresolvedCount: 0,
      splitObservedPathCount: 0,
      observedPaths: [
        { path: "src/in.ts", kind: "MODIFY", relation: "IN_BLAST" },
        { path: "docs/out.md", kind: "MODIFY", relation: "OUTSIDE_BLAST" },
      ],
    });
    expect(text).toContain("OTHER TRACKED CHANGES (selected realities)");
    expect(text).toContain("src/in.ts");
    expect(text).toContain("docs/out.md");
    expect(text).not.toMatch(/aligned|review first|effectiveness|Codex changed/iu);
    expect(OVERLAY_UNAVAILABLE).toMatch(/unavailable/iu);
    expect(OVERLAY_UNAVAILABLE).not.toMatch(/aligned/iu);
  });
});
