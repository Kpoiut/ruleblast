import { describe, expect, it } from "vitest";
import {
  currentPairEvents,
  digestNormalizedPayload,
  digestProjectionIdentity,
  diffPairEvents,
  pathPayloadRelation,
  runtimePairDeltas,
  runtimePairSplits,
  splitState,
} from "../src/domain/payload-relation.js";
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
  const base: Projection = {
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
    projectionDigest: null,
    normalizedPayloadDigest: digestNormalizedPayload(units, "ORDERED"),
    evidence: [],
  };
  return { ...base, projectionDigest: digestProjectionIdentity(base) };
}

describe("runtime pair splits", () => {
  it("keeps two-profile disagreement as one pair equal to the aggregate split", () => {
    const rows = [
      {
        path: "src/split.ts",
        projections: [
          projection(OPENAI_CODEX_CLI_PROFILE_ID, "codex"),
          projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, "claude"),
        ],
      },
      {
        path: "src/same.ts",
        projections: [
          projection(OPENAI_CODEX_CLI_PROFILE_ID, "same"),
          projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, "same"),
        ],
      },
    ];
    const events = currentPairEvents(rows);
    const pairs = runtimePairSplits(rows);
    expect(events).toEqual([
      {
        left: ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
        right: OPENAI_CODEX_CLI_PROFILE_ID,
        path: "src/split.ts",
        after: "DIFFERENT",
        before: null,
        different: true,
        newlyDifferent: false,
        converged: false,
        indeterminate: false,
      },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.differentPathCount).toBe(
      events.filter((event) => event.different).length,
    );
    expect(pairs[0]?.left).toBe(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID);
    expect(pairs[0]?.right).toBe(OPENAI_CODEX_CLI_PROFILE_ID);
  });

  it("counts which catalog runtimes disagree when four are selected", () => {
    const rows = [{
      path: "src/file.ts",
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
        path: "src/new.ts",
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
        path: "src/converged.ts",
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
    const events = diffPairEvents(rows);
    const pairs = runtimePairDeltas(rows);
    expect(events.map((event) => event.path)).toEqual(["src/new.ts", "src/converged.ts"]);
    expect(events[0]).toMatchObject({
      after: "DIFFERENT",
      before: "SAME",
      different: true,
      newlyDifferent: true,
      converged: false,
    });
    expect(events[1]).toMatchObject({
      after: "SAME",
      before: "DIFFERENT",
      different: false,
      newlyDifferent: false,
      converged: true,
    });
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.differentPathCount).toBe(
      events.filter((event) => event.different).length,
    );
    expect(pairs[0]?.newlyDifferentPathCount).toBe(
      events.filter((event) => event.newlyDifferent).length,
    );
    expect(pairs[0]?.convergedPathCount).toBe(
      events.filter((event) => event.converged).length,
    );
  });

  it("stamps a path split from the same events that name PAIRPATH, not a second aggregate", () => {
    const split = {
      path: "src/split.ts",
      projections: [
        projection(OPENAI_CODEX_CLI_PROFILE_ID, "codex"),
        projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, "claude"),
      ],
    };
    const same = {
      path: "src/same.ts",
      projections: [
        projection(OPENAI_CODEX_CLI_PROFILE_ID, "same"),
        projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, "same"),
      ],
    };
    const events = currentPairEvents([split, same]);
    const splitRelation = pathPayloadRelation(
      split.projections,
      events.filter((event) => event.path === split.path),
    );
    const sameRelation = pathPayloadRelation(
      same.projections,
      events.filter((event) => event.path === same.path),
    );
    expect(splitRelation.relation).toBe("DIFFERENT");
    expect(sameRelation.relation).toBe("SAME");
    expect(events.filter((event) => event.different).map((event) => event.path))
      .toEqual(["src/split.ts"]);
    expect(splitState(splitRelation.relation)).toBe(true);
    expect(splitState(sameRelation.relation)).toBe(false);
  });

  it("counts indeterminate pair coverage instead of dropping it", () => {
    const incomplete = {
      ...projection(OPENAI_CODEX_CLI_PROFILE_ID, "codex"),
      status: "PARTIAL" as const,
      projectionDigest: null,
      normalizedPayloadDigest: null,
    };
    const pairs = runtimePairSplits([{
      path: "src/partial.ts",
      projections: [
        incomplete,
        projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, "claude"),
      ],
    }]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.differentPathCount).toBe(0);
    expect(pairs[0]?.indeterminatePathCount).toBe(1);
  });
});
