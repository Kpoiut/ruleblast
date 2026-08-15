import { describe, expect, it } from "vitest";
import {
  defaultProfileDefinitions,
  isOptInReality,
  optInRealityIds,
  presentationFor,
  presentationLabel,
  profilesForReality,
  profilesForRealities,
} from "../src/application/profile-catalog.js";
import { explainViewFromCurrent } from "../src/application/explain-view.js";
import { analysisState, formatAnalysisState } from "../src/application/analysis-state.js";
import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  GOOGLE_GEMINI_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
} from "../src/model.js";

describe("profile catalog", () => {
  it("keeps default analysis on Codex and Claude only", () => {
    expect(defaultProfileDefinitions().map((profile) => profile.id).sort()).toEqual([
      ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
      OPENAI_CODEX_CLI_PROFILE_ID,
    ].sort());
    expect(profilesForReality(null)).toHaveLength(2);
    expect(optInRealityIds()).toEqual([
      "github/copilot-cli@1",
      "google/gemini-cli@1",
    ]);
    expect(isOptInReality("google/gemini-cli@1")).toBe(true);
    expect(isOptInReality("cursor/editor@1")).toBe(false);
  });

  it("adds exactly one opt-in reality without inventing a generic plugin API", () => {
    const withGemini = profilesForReality("google/gemini-cli@1");
    expect(withGemini.map((profile) => profile.id)).toContain(GOOGLE_GEMINI_CLI_PROFILE_ID);
    expect(withGemini).toHaveLength(3);
    expect(() => profilesForReality("cursor/editor@1")).toThrow(/Unknown opt-in reality/);
  });

  it("admits both bundled opt-ins for an N-way comparison", () => {
    const all = profilesForRealities(["google/gemini-cli@1", "github/copilot-cli@1"]);
    expect(all.map((profile) => profile.id)).toEqual([
      "anthropic/claude-code-cli@1",
      "github/copilot-cli@1",
      "google/gemini-cli@1",
      "openai/codex-cli@1",
    ]);
  });

  it("exposes presentation metadata so hosts do not hard-code vendor names", () => {
    expect(presentationFor(OPENAI_CODEX_CLI_PROFILE_ID)).toMatchObject({
      shortLabel: "Codex",
      badge: "CX",
      admission: "default",
    });
    expect(presentationFor(GOOGLE_GEMINI_CLI_PROFILE_ID).badge).toBe("GM");
    expect(presentationLabel(OPENAI_CODEX_CLI_PROFILE_ID)).toBe("CX Codex");
  });
});

describe("analysis state", () => {
  it("keeps lifecycle and completeness on separate axes", () => {
    expect(formatAnalysisState(analysisState("CURRENT", "PARTIAL"))).toBe("CURRENT · PARTIAL");
    expect(formatAnalysisState(analysisState("STALE", "UNKNOWN"))).toBe("STALE · UNKNOWN");
    expect(formatAnalysisState(analysisState("READY", "COMPLETE"))).toBe("READY");
  });
});

describe("explain presentation model", () => {
  it("does not infer new semantics beyond the projection", () => {
    const view = explainViewFromCurrent({
      path: "src/a.ts",
      payloadRelation: "DIFFERENT",
      isSplit: true,
      projections: [{
        profile: OPENAI_CODEX_CLI_PROFILE_ID,
        context: {
          cwd: "src",
          trigger: "STARTUP",
          targetPath: "src/a.ts",
          repositoryOnly: true,
        },
        status: "COMPLETE",
        composition: "ORDERED",
        sources: [{
          path: "AGENTS.md",
          disposition: "SELECTED",
          digest: "abc",
          bytesUsed: 3,
          truncated: false,
        }],
        normalizedPayloadUnits: [],
        projectionDigest: "p",
        normalizedPayloadDigest: "n",
        evidence: ["vendor"],
      }],
    });
    expect(view.profiles[0]?.label).toBe("Codex CLI");
    expect(view.profiles[0]?.affected).toBeNull();
    expect(view.profiles[0]?.sources[0]?.path).toBe("AGENTS.md");
    expect(view.relation).toBe("DIFFERENT");
    expect(view.why).toBeNull();
  });
});
