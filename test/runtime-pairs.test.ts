import { describe, expect, it } from "vitest";
import { runtimePairDeltas, runtimePairSplits } from "../src/domain/payload-relation.js";
import { sha256 } from "../src/canonical.js";
import type { Projection } from "../src/model.js";
import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  GITHUB_COPILOT_CLI_PROFILE_ID,
  GOOGLE_GEMINI_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
} from "../src/model.js";

function projection(profile: string, payload: string): Projection {
  const units = [[sha256(`ruleblast-payload-line-v1\0${payload}`)]];
  return {
    profile,
    context: {
      cwd: ".",
      trigger: "STARTUP",
      targetPath: "src/file.ts",
      repositoryOnly: true,
    },
    status: "COMPLETE",
    composition: "ORDERED",
    sources: [],
    normalizedPayloadUnits: units,
    projectionDigest: sha256(payload),
    normalizedPayloadDigest: sha256(payload),
    evidence: [],
  };
}

describe("runtime pair splits", () => {
  it("keeps two-profile disagreement as one pair equal to the aggregate split", () => {
    const rows = [
      {
        projections: [
          projection(OPENAI_CODEX_CLI_PROFILE_ID, "codex"),
          projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, "claude"),
        ],
      },
      {
        projections: [
          projection(OPENAI_CODEX_CLI_PROFILE_ID, "same"),
          projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, "same"),
        ],
      },
    ];
    const pairs = runtimePairSplits(rows);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.differentPathCount).toBe(1);
    expect(pairs[0]?.left).toBe(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID);
    expect(pairs[0]?.right).toBe(OPENAI_CODEX_CLI_PROFILE_ID);
  });

  it("counts which catalog runtimes disagree when four are selected", () => {
    const rows = [{
      projections: [
        projection(OPENAI_CODEX_CLI_PROFILE_ID, "a"),
        projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, "a"),
        projection(GITHUB_COPILOT_CLI_PROFILE_ID, "b"),
        projection(GOOGLE_GEMINI_CLI_PROFILE_ID, "b"),
      ],
    }];
    const pairs = runtimePairSplits(rows);
    expect(pairs).toHaveLength(6);
    const count = (left: string, right: string): number =>
      pairs.find((pair) => pair.left === left && pair.right === right)?.differentPathCount ?? -1;
    expect(count(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, OPENAI_CODEX_CLI_PROFILE_ID)).toBe(0);
    expect(count(GITHUB_COPILOT_CLI_PROFILE_ID, GOOGLE_GEMINI_CLI_PROFILE_ID)).toBe(0);
    expect(count(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, GITHUB_COPILOT_CLI_PROFILE_ID)).toBe(1);
    expect(count(GOOGLE_GEMINI_CLI_PROFILE_ID, OPENAI_CODEX_CLI_PROFILE_ID)).toBe(1);
  });

  it("counts newly split and converged pairs on a two-profile diff", () => {
    const rows = [
      {
        before: [
          projection(OPENAI_CODEX_CLI_PROFILE_ID, "same"),
          projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, "same"),
        ],
        after: [
          projection(OPENAI_CODEX_CLI_PROFILE_ID, "codex"),
          projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, "claude"),
        ],
      },
      {
        before: [
          projection(OPENAI_CODEX_CLI_PROFILE_ID, "codex"),
          projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, "claude"),
        ],
        after: [
          projection(OPENAI_CODEX_CLI_PROFILE_ID, "same"),
          projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, "same"),
        ],
      },
    ];
    const pairs = runtimePairDeltas(rows);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.differentPathCount).toBe(1);
    expect(pairs[0]?.newlyDifferentPathCount).toBe(1);
    expect(pairs[0]?.convergedPathCount).toBe(1);
  });
});
