import { describe, expect, it } from "vitest";
import { explainViewFromResult } from "../src/application/explain-view.js";
import { explainExistingResult, presentExplain } from "../src/application/authority.js";
import { currentExplain, diffExplain } from "../src/cli-output.js";
import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
  type CurrentRuleBlastResult,
  type DiffRuleBlastResult,
  type Projection,
} from "../src/model.js";
import { renderExplain } from "../src/render-explain.js";

function projection(
  profile: string,
  targetPath: string,
  overrides: Partial<Projection> = {},
): Projection {
  return {
    profile,
    context: {
      cwd: ".",
      trigger: "READ_TARGET",
      targetPath,
      repositoryOnly: true,
    },
    status: "COMPLETE",
    composition: "ORDERED",
    sources: [{
      path: profile.startsWith("openai/") ? "AGENTS.md" : "CLAUDE.md",
      disposition: "SELECTED",
      digest: "secret-digest",
      bytesUsed: 10,
      truncated: false,
    }],
    normalizedPayloadUnits: [["payload"]],
    projectionDigest: "projection-digest",
    normalizedPayloadDigest: "payload-digest",
    evidence: ["vendor:test"],
    ...overrides,
  };
}

function currentResult(): CurrentRuleBlastResult {
  const path = "src/a.ts";
  return {
    mode: "current",
    schemaVersion: 1,
    resolverRevision: 1,
    snapshot: { kind: "worktree", label: "WORKTREE", oid: null },
    counts: {
      candidatePathCount: 1,
      currentSplitPathCount: 0,
      partialPathCount: 0,
      unknownPathCount: 0,
      indeterminatePathCount: 0,
      byProfile: [],
    },
    paths: [{
      path,
      projections: [
        projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, path),
        projection(OPENAI_CODEX_CLI_PROFILE_ID, path, {
          context: {
            cwd: "src",
            trigger: "STARTUP",
            targetPath: path,
            repositoryOnly: true,
          },
        }),
      ],
      payloadRelation: "SAME",
      isSplit: false,
    }],
    findings: [],
  };
}

function diffResult(): DiffRuleBlastResult {
  const path = "packages/api/internal/refund.ts";
  const claude = projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, path);
  const codexBefore = projection(OPENAI_CODEX_CLI_PROFILE_ID, path, {
    context: {
      cwd: "packages/api/internal",
      trigger: "STARTUP",
      targetPath: path,
      repositoryOnly: true,
    },
  });
  const codexAfter = {
    ...codexBefore,
    sources: [
      ...codexBefore.sources,
      {
        path: "packages/api/AGENTS.md",
        disposition: "SELECTED" as const,
        digest: "api-digest",
        bytesUsed: 21,
        truncated: true,
      },
    ],
  };
  return {
    mode: "diff",
    schemaVersion: 1,
    resolverRevision: 1,
    before: { kind: "git", label: "HEAD", oid: "a".repeat(40) },
    after: { kind: "worktree", label: "WORKTREE", oid: null },
    diffStats: {
      addedLineCount: 0,
      deletedLineCount: 0,
      editedLineCount: 9,
      binaryChangedSourceCount: 0,
    },
    changedInstructionSources: [{
      kind: "ADD",
      beforePath: null,
      afterPath: "packages/api/AGENTS.md",
      beforeDigest: null,
      afterDigest: "api-digest",
      stats: {
        addedLineCount: 1,
        deletedLineCount: 0,
        editedLineCount: 0,
        binaryChangedSourceCount: 0,
      },
    }],
    counts: {
      candidatePathCount: 1,
      currentSplitPathCount: 1,
      partialPathCount: 0,
      unknownPathCount: 0,
      indeterminatePathCount: 0,
      changedStackPathCount: 1,
      newlySplitPathCount: 1,
      convergedPathCount: 0,
      byProfile: [],
    },
    groups: [],
    paths: [{
      path,
      before: [claude, codexBefore],
      after: [claude, codexAfter],
      changedProfiles: [OPENAI_CODEX_CLI_PROFILE_ID],
      beforePayloadRelation: "SAME",
      afterPayloadRelation: "DIFFERENT",
      wasSplit: false,
      isSplit: true,
      causes: ["packages/api/AGENTS.md"],
    }],
    findings: [],
  };
}

describe("shared explain view", () => {
  it("keeps current analysis without a why block", () => {
    const view = explainViewFromResult(currentExplain(currentResult(), "src/a.ts"));
    expect(view.why).toBeNull();
    expect(view.profiles.map((profile) => profile.badge)).toEqual(["CC", "CX"]);
    expect(view.profiles[1]?.cwd).toBe("src");
  });

  it("carries why-this-path from a transition without re-analyzing", () => {
    const { explain, view } = explainExistingResult(diffResult(), "packages/api/internal/refund.ts");
    expect(explain.analysisMode).toBe("diff");
    expect(view.why).toMatchObject({
      counts: true,
      causes: ["packages/api/AGENTS.md"],
      newlySplit: true,
      beforeRelation: "SAME",
      afterRelation: "DIFFERENT",
    });
    expect(view.why?.changedProfiles.map((profile) => profile.badge)).toEqual(["CX"]);
    expect(view.profiles.find((profile) => profile.badge === "CX")?.affected).toBe(true);
    expect(
      view.profiles.find((profile) => profile.badge === "CX")?.sources
        .some((source) => source.path === "packages/api/AGENTS.md" && source.changed),
    ).toBe(true);
  });

  it("refuses to invent a path that the last result does not contain", () => {
    expect(() => explainExistingResult(currentResult(), "missing.ts")).toThrow(/omitted/i);
  });
});

describe("visual explain text", () => {
  it("prints the source tree and omits digest dumps from default text", () => {
    const text = renderExplain(
      currentExplain(currentResult(), "src/a.ts"),
      { currentLabel: "WORKTREE", caseLabel: null, shellDialect: "posix" },
      false,
    );
    expect(text).toContain("RULEBLAST EXPLAIN · WORKTREE");
    expect(text).toContain("CC Claude Code CLI");
    expect(text).toContain("CX Codex CLI");
    expect(text).toContain("└ SELECTED CLAUDE.md");
    expect(text).toContain("STARTUP · cwd=src");
    expect(text).not.toContain("digest=");
    expect(text).not.toContain("secret-digest");
    expect(text).not.toContain("projection-digest");
    expect(text).toContain("WHY THIS PATH NOW");
    expect(text).toContain("KEEP");
    expect(text).toMatch(/rbctx RBCTX1:[0-9a-f]{12}/u);
    expect(text).toContain("next agent: reuse this explanation unless rbctx moves");
  });

  it("prints why-this-path with catalog badges for a split", () => {
    const text = renderExplain(
      diffExplain(diffResult(), "packages/api/internal/refund.ts"),
      {
        beforeLabel: "HEAD",
        afterLabel: "WORKTREE",
        caseLabel: null,
        shellDialect: "posix",
      },
      false,
    );
    expect(text).toContain("WHY THIS PATH COUNTS");
    expect(text).toContain("+ packages/api/AGENTS.md");
    expect(text).toContain("changed profiles: CX Codex");
    expect(text).toContain("← changed");
    expect(text).toContain("RELATION · DIFFERENT");
    expect(text).not.toContain("digest=");
    expect(text).toContain("KEEP");
    expect(text).toContain("WHY THIS PATH COUNTS");
    expect(text).not.toContain("WHY THIS PATH NOW");
  });

  it("keeps CLI and companion explain text on the same visual model", () => {
    const explain = currentExplain(currentResult(), "src/a.ts");
    const presented = presentExplain(explain);
    const rendered = renderExplain(
      explain,
      { currentLabel: "WORKTREE", caseLabel: null, shellDialect: "posix" },
      false,
    );
    expect(presented).toBe(rendered);
    expect(presented).toContain("CC Claude Code CLI");
  });
});
