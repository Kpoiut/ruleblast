import { describe, expect, it } from "vitest";
import { summarizeSourceBlasts } from "../src/domain/source-blast.js";
import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
  type DiffRuleBlastResult,
  type PathTransition,
} from "../src/model.js";

function pathTransition(
  path: string,
  causes: string[],
  changedProfiles: string[],
): PathTransition {
  return {
    path,
    before: [],
    after: [],
    changedProfiles,
    beforePayloadRelation: "SAME",
    afterPayloadRelation: "SAME",
    wasSplit: false,
    isSplit: false,
    causes,
  };
}

function result(paths: PathTransition[]): DiffRuleBlastResult {
  return {
    mode: "diff",
    schemaVersion: 1,
    resolverRevision: 1,
    before: { kind: "git", label: "HEAD", oid: "a" },
    after: { kind: "worktree", label: "WORKTREE", oid: null },
    diffStats: {
      addedLineCount: 0,
      deletedLineCount: 2,
      editedLineCount: 2,
      binaryChangedSourceCount: 0,
    },
    changedInstructionSources: [
      {
        kind: "MODIFY",
        beforePath: "AGENTS.md",
        afterPath: "AGENTS.md",
        beforeDigest: "b",
        afterDigest: "a",
        stats: {
          addedLineCount: 0,
          deletedLineCount: 2,
          editedLineCount: 2,
          binaryChangedSourceCount: 0,
        },
      },
      {
        kind: "MODIFY",
        beforePath: "packages/api/AGENTS.md",
        afterPath: "packages/api/AGENTS.md",
        beforeDigest: "c",
        afterDigest: "d",
        stats: {
          addedLineCount: 0,
          deletedLineCount: 0,
          editedLineCount: 1,
          binaryChangedSourceCount: 0,
        },
      },
    ],
    counts: {
      candidatePathCount: 10,
      currentSplitPathCount: 0,
      partialPathCount: 0,
      unknownPathCount: 0,
      indeterminatePathCount: 0,
      changedStackPathCount: 3,
      newlySplitPathCount: 0,
      convergedPathCount: 0,
      byProfile: [],
    },
    groups: [],
    paths,
    findings: [],
  };
}

describe("source-centric blast attribution", () => {
  it("groups affected paths by changed instruction source and profile", () => {
    const summaries = summarizeSourceBlasts(result([
      pathTransition("src/a.ts", ["AGENTS.md"], [OPENAI_CODEX_CLI_PROFILE_ID]),
      pathTransition("src/b.ts", ["AGENTS.md"], [OPENAI_CODEX_CLI_PROFILE_ID]),
      pathTransition("packages/api/c.ts", ["packages/api/AGENTS.md"], [
        OPENAI_CODEX_CLI_PROFILE_ID,
      ]),
      pathTransition("README.md", [], []),
    ]));
    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      sourcePath: "AGENTS.md",
      kind: "MODIFY",
      changedStackPathCount: 2,
    });
    expect(summaries[0]?.byProfile).toEqual([
      { profile: OPENAI_CODEX_CLI_PROFILE_ID, affectedPathCount: 2 },
    ]);
    expect(summaries[0]?.examplePaths).toEqual(["src/a.ts", "src/b.ts"]);
    expect(summaries[1]?.sourcePath).toBe("packages/api/AGENTS.md");
    expect(summaries[1]?.changedStackPathCount).toBe(1);
  });

  it("keeps a profile with zero affected paths when it did not change", () => {
    const summaries = summarizeSourceBlasts(result([
      pathTransition("src/a.ts", ["AGENTS.md"], [OPENAI_CODEX_CLI_PROFILE_ID]),
    ]), [OPENAI_CODEX_CLI_PROFILE_ID, ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID]);
    expect(summaries[0]?.byProfile).toEqual([
      { profile: ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, affectedPathCount: 0 },
      { profile: OPENAI_CODEX_CLI_PROFILE_ID, affectedPathCount: 1 },
    ]);
  });

  it("caps rendered sources at three, largest first", () => {
    const extra: PathTransition[] = [];
    const sources = ["AGENTS.md", "packages/api/AGENTS.md", "z.md", "a.md"];
    for (const [index, source] of sources.entries()) {
      extra.push(pathTransition(`f${index}.ts`, [source], [OPENAI_CODEX_CLI_PROFILE_ID]));
    }
    const full = result(extra);
    full.changedInstructionSources = sources.map((sourcePath) => ({
      kind: "MODIFY" as const,
      beforePath: sourcePath,
      afterPath: sourcePath,
      beforeDigest: "b",
      afterDigest: "a",
      stats: {
        addedLineCount: 0,
        deletedLineCount: 0,
        editedLineCount: 1,
        binaryChangedSourceCount: 0,
      },
    }));
    const summaries = summarizeSourceBlasts(full);
    expect(summaries).toHaveLength(3);
    expect(summaries.map((item) => item.sourcePath)).toEqual([
      "AGENTS.md",
      "a.md",
      "packages/api/AGENTS.md",
    ]);
  });
});
