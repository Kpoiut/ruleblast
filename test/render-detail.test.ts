import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { ensureConformanceLab } from "../src/application/conformance-lab.js";
import { currentExplain, diffExplain } from "../src/cli-output.js";
import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
  type CurrentRuleBlastResult,
  type DiffRuleBlastResult,
  type Projection,
  type ResolvedSource,
  type SnapshotRef,
} from "../src/model.js";
import { renderDetail } from "../src/render-detail.js";
import { renderText } from "../src/render-text.js";

function golden(name: string): string {
  return readFileSync(new URL(`./golden/${name}.txt`, import.meta.url), "utf8");
}

const worktreeRef: SnapshotRef = {
  kind: "worktree",
  label: "worktree",
  oid: null,
};

function source(
  path: string,
  overrides: Partial<ResolvedSource> = {},
): ResolvedSource {
  return {
    path,
    disposition: "SELECTED",
    digest: `${path}-digest`,
    bytesUsed: 10,
    truncated: false,
    ...overrides,
  };
}

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
    sources: [source(profile.startsWith("openai/") ? "AGENTS.md" : "CLAUDE.md")],
    normalizedPayloadUnits: [["payload"]],
    projectionDigest: `${profile}-projection`,
    normalizedPayloadDigest: "shared-payload",
    evidence: [],
    ...overrides,
  };
}

function currentResult(): CurrentRuleBlastResult {
  const paths = ["src/z.ts", "src/a.ts", "src/b.ts", "src/c.ts"].map((path) => {
    const isSplit = path === "src/a.ts" || path === "src/b.ts";
    return {
      path,
      projections: [
        projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, path),
        projection(OPENAI_CODEX_CLI_PROFILE_ID, path),
      ],
      payloadRelation: isSplit ? "DIFFERENT" as const : "SAME" as const,
      isSplit,
    };
  });
  return {
    mode: "current",
    schemaVersion: 1,
    resolverRevision: 1,
    snapshot: worktreeRef,
    counts: {
      candidatePathCount: 4,
      currentSplitPathCount: 2,
      partialPathCount: 0,
      unknownPathCount: 0,
      indeterminatePathCount: 0,
      byProfile: [
        {
          profile: ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
          completePathCount: 4,
          partialPathCount: 0,
          unknownPathCount: 0,
        },
        {
          profile: OPENAI_CODEX_CLI_PROFILE_ID,
          completePathCount: 4,
          partialPathCount: 0,
          unknownPathCount: 0,
        },
      ],
    },
    paths,
    findings: [{
      code: "UNSPECIFIED_COMPOSITION",
      profile: ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
      path: "src/a.ts",
      detail: "composition is unspecified",
    }],
  };
}

function diffResult(): DiffRuleBlastResult {
  const targetPath = "packages/api/internal/refund.ts";
  const claude = projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, targetPath);
  const codexBefore = projection(OPENAI_CODEX_CLI_PROFILE_ID, targetPath);
  const codexAfter = projection(OPENAI_CODEX_CLI_PROFILE_ID, targetPath, {
    normalizedPayloadDigest: "codex-after-payload",
    projectionDigest: "codex-after-projection",
  });
  return {
    mode: "diff",
    schemaVersion: 1,
    resolverRevision: 1,
    before: { kind: "git", label: "a".repeat(40), oid: "a".repeat(40) },
    after: worktreeRef,
    diffStats: {
      addedLineCount: 5,
      deletedLineCount: 4,
      editedLineCount: 9,
      binaryChangedSourceCount: 0,
    },
    changedInstructionSources: [{
      kind: "MODIFY",
      beforePath: "packages/api/AGENTS.md",
      afterPath: "packages/api/AGENTS.md",
      beforeDigest: "before-digest",
      afterDigest: "after-digest",
      stats: {
        addedLineCount: 5,
        deletedLineCount: 4,
        editedLineCount: 9,
        binaryChangedSourceCount: 0,
      },
    }],
    counts: {
      candidatePathCount: 3906,
      changedStackPathCount: 1842,
      newlySplitPathCount: 1229,
      convergedPathCount: 0,
      currentSplitPathCount: 1229,
      partialPathCount: 0,
      unknownPathCount: 0,
      indeterminatePathCount: 0,
      byProfile: [{
        profile: OPENAI_CODEX_CLI_PROFILE_ID,
        completePathCount: 1842,
        partialPathCount: 0,
        unknownPathCount: 0,
        changedStackPathCount: 1842,
      }],
    },
    groups: [{
      root: "packages/api/internal",
      changedStackPathCount: 1229,
      newlySplitPathCount: 1229,
      samplePaths: [targetPath],
    }],
    paths: [{
      path: targetPath,
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

const currentContext = {
  currentLabel: "WORKTREE",
  caseLabel: null,
  shellDialect: "posix",
} as const;

const diffContext = {
  beforeLabel: "HEAD",
  afterLabel: "WORKTREE",
  caseLabel: null,
  shellDialect: "posix",
} as const;

describe("detailed human text", () => {
  beforeAll(async () => {
    await ensureConformanceLab();
  });
  it("keeps default summary goldens and appends canonical fields the summary omits", async () => {
    const current = currentResult();
    const summary = renderText(current, currentContext, false);
    expect(summary).toBe(golden("current-split"));
    const detailed = await renderDetail(current, currentContext, false);
    expect(detailed.startsWith(summary.trimEnd())).toBe(true);
    expect(detailed).toContain("DETAIL");
    expect(detailed).toContain("SNAPSHOT");
    expect(detailed).toContain("worktree");
    expect(detailed).toContain("BY PROFILE");
    expect(detailed).toContain("src/a.ts");
    expect(detailed).toContain("src/b.ts");
    expect(detailed).toContain("DIFFERENT");
    expect(detailed).toContain("[UNSPECIFIED_COMPOSITION]");
    expect(detailed).not.toMatch(/\b[A-Z]:\\/u);
  });

  it("prints added/deleted lines, source digests, groups, and every changed path", async () => {
    const result = diffResult();
    const summary = renderText(result, diffContext, false);
    expect(summary).toBe(golden("diff-blast"));
    const detailed = await renderDetail(result, diffContext, false);
    expect(detailed).toContain("DETAIL");
    expect(detailed).toContain("added 5");
    expect(detailed).toContain("deleted 4");
    expect(detailed).toContain("before-digest");
    expect(detailed).toContain("after-digest");
    expect(detailed).toContain("CHANGED PATHS");
    expect(detailed).toContain("packages/api/internal/refund.ts");
    expect(detailed).toContain("packages/api/AGENTS.md");
    expect(detailed).toContain("GROUPS");
  });

  it("prints source digest, bytes used, composition, and evidence on explain", async () => {
    const result = currentResult();
    result.paths[1]!.projections[1] = projection(
      OPENAI_CODEX_CLI_PROFILE_ID,
      "src/a.ts",
      {
        evidence: ["vendor:codex", "UNSPECIFIED composition"],
        sources: [source("AGENTS.md", { digest: "abc123", bytesUsed: 32 })],
      },
    );
    const explained = currentExplain(result, "src/a.ts");
    const detailed = await renderDetail(explained, currentContext, false);
    expect(detailed).toContain("DETAIL");
    expect(detailed).toContain("abc123");
    expect(detailed).toContain("32 bytes");
    expect(detailed).toContain("ORDERED");
    expect(detailed).toContain("vendor:codex");
  });

  it("prints the before source tree on a diff explain", async () => {
    const explained = diffExplain(diffResult(), "packages/api/internal/refund.ts");
    const detailed = await renderDetail(explained, diffContext, false);
    expect(detailed).toContain("BEFORE");
    expect(detailed).toContain("AFTER");
  });
});
