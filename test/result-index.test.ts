import { describe, expect, it } from "vitest";
import { renderResultIndex } from "../src/application/result-index.js";
import {
  digestNormalizedPayload,
  digestProjectionIdentity,
} from "../src/domain/payload-relation.js";
import { adjunctRenderContext } from "../src/application/overlay-tree.js";
import type {
  CurrentPathProjection,
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
  PathTransition,
  Projection,
} from "../src/model.js";
import type { BlastOverlayView } from "../src/application/blast-overlay.js";

function projection(path: string, profile: string, payload: string): Projection {
  const units = [[payload]];
  const base: Projection = {
    profile,
    context: { cwd: ".", trigger: "READ_TARGET", targetPath: path, repositoryOnly: true },
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

function transition(
  path: string,
  extras: {
    readonly changed?: boolean;
    readonly causes?: readonly string[];
    readonly isSplit?: boolean | null;
  } = {},
): PathTransition {
  const after = extras.changed === true ? "b" : "a";
  return {
    path,
    before: [projection(path, "openai/codex-cli@1", "a")],
    after: [projection(path, "openai/codex-cli@1", after)],
    changedProfiles: extras.changed === true ? ["openai/codex-cli@1"] : [],
    beforePayloadRelation: "SAME",
    afterPayloadRelation: extras.isSplit === true ? "DIFFERENT" : "SAME",
    wasSplit: false,
    isSplit: extras.isSplit ?? false,
    causes: [...(extras.causes ?? [])],
  };
}

function diffResult(paths: readonly PathTransition[]): DiffRuleBlastResult {
  const sources = [...new Set(paths.flatMap((row) => row.causes))];
  return {
    mode: "diff",
    schemaVersion: 1,
    resolverRevision: 1,
    before: { kind: "git", label: "HEAD~1", oid: "a".repeat(40) },
    after: { kind: "worktree", label: "WORKTREE", oid: null },
    diffStats: {
      addedLineCount: 0,
      deletedLineCount: 2,
      editedLineCount: 2,
      binaryChangedSourceCount: 0,
    },
    changedInstructionSources: sources.map((path) => ({
      kind: "MODIFY",
      beforePath: path,
      afterPath: path,
      beforeDigest: "1",
      afterDigest: "2",
      stats: {
        addedLineCount: 0,
        deletedLineCount: 2,
        editedLineCount: 2,
        binaryChangedSourceCount: 0,
      },
    })),
    counts: {
      candidatePathCount: paths.length,
      changedStackPathCount: paths.filter((row) => row.changedProfiles.length > 0).length,
      newlySplitPathCount: paths.filter((row) => row.isSplit === true).length,
      convergedPathCount: 0,
      currentSplitPathCount: 0,
      partialPathCount: 0,
      unknownPathCount: 0,
      indeterminatePathCount: 0,
      byProfile: [],
    },
    groups: [],
    paths: [...paths],
    findings: [],
  };
}

describe("result index", () => {
  it("lists every SOURCE, CONTINUE, REJECT, and UNRESOLVED row without the overlay sample cap", () => {
    const result = diffResult([
      transition("src/keep.ts", { changed: true, causes: ["AGENTS.md"] }),
      transition("src/also.ts", { changed: true, causes: ["AGENTS.md"] }),
      transition("README.md"),
    ]);
    const overlay: BlastOverlayView = {
      observedPathCount: 10,
      inBlastCount: 1,
      outsideBlastCount: 8,
      unresolvedCount: 1,
      splitObservedPathCount: 0,
      observedPaths: [
        { path: "src/keep.ts", kind: "MODIFY", relation: "IN_BLAST" },
        ...Array.from({ length: 8 }, (_, index) => ({
          path: `other/${String(index)}.md`,
          kind: "MODIFY" as const,
          relation: "OUTSIDE_BLAST" as const,
        })),
        { path: "tmp.bin", kind: "MODIFY", relation: "UNRESOLVED" },
      ],
    };
    const text = renderResultIndex(result, {
      overlay,
      from: "HEAD~1",
      to: "WORKTREE",
    });
    expect(text.startsWith("# ruleblast.index v1\n")).toBe(true);
    expect(text).toContain("MODE\tdiff\n");
    expect(text).toContain("FROM\tHEAD~1\n");
    expect(text).toContain("TO\tWORKTREE\n");
    expect(text).toContain("ALIGN\tUNRESOLVED\n");
    expect(text).toContain("SOURCE\tAGENTS.md\n");
    expect(text).toContain("CONTINUE\tsrc/also.ts\n");
    expect(text).toContain("CONTINUE\tsrc/keep.ts\n");
    expect(text).toContain("UNRESOLVED\ttmp.bin\n");
    expect(text.match(/^REJECT\t/gmu)).toHaveLength(8);
    expect(text).not.toContain("… +");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("derives FROM, TO, LAW, and STACK from snapshot identity when callers omit them", () => {
    const result = diffResult([
      transition("src/keep.ts", { changed: true, causes: ["AGENTS.md"] }),
    ]);
    const text = renderResultIndex(result, {
      overlay: {
        observedPathCount: 0,
        inBlastCount: 0,
        outsideBlastCount: 0,
        unresolvedCount: 0,
        splitObservedPathCount: 0,
        observedPaths: [],
      },
    });
    expect(text).toContain("FROM\tHEAD~1\n");
    expect(text).toContain("TO\tWORKTREE\n");
    expect(text).toContain("LAW\tworktree-captured\n");
    expect(text).toContain("STACK\t1\n");
    expect(text).toContain("SOURCE\tAGENTS.md\n");
    expect(text).toContain("CONTINUE\tsrc/keep.ts\n");
    expect(adjunctRenderContext(result)).toMatchObject({
      from: "HEAD~1",
      to: "WORKTREE",
      identityLaw: "worktree-captured",
      changedStackPathCount: 1,
    });
  });

  it("indexes current splits for scan without inventing overlay membership", () => {
    const paths: CurrentPathProjection[] = [
      {
        path: "src/split.ts",
        projections: [
          projection("src/split.ts", "openai/codex-cli@1", "a"),
          projection("src/split.ts", "anthropic/claude-code-cli@1", "b"),
        ],
        payloadRelation: "DIFFERENT",
        isSplit: true,
      },
      {
        path: "src/same.ts",
        projections: [projection("src/same.ts", "openai/codex-cli@1", "a")],
        payloadRelation: "SAME",
        isSplit: false,
      },
    ];
    const result: CurrentRuleBlastResult = {
      mode: "current",
      schemaVersion: 1,
      resolverRevision: 1,
      snapshot: { kind: "worktree", label: "WORKTREE", oid: null },
      counts: {
        candidatePathCount: 2,
        currentSplitPathCount: 1,
        partialPathCount: 0,
        unknownPathCount: 0,
        indeterminatePathCount: 0,
        byProfile: [],
      },
      paths,
      findings: [],
    };
    const text = renderResultIndex(result);
    expect(text).toContain("MODE\tscan\n");
    expect(text).toContain("PAIR\tanthropic/claude-code-cli@1\t");
    expect(text).toContain("openai/codex-cli@1\t1\n");
    expect(text).toContain(
      "PAIRPATH\tanthropic/claude-code-cli@1\topenai/codex-cli@1\tsrc/split.ts\n",
    );
    expect(text).not.toContain("src/same.ts");
    expect(text).toContain("SPLIT\tsrc/split.ts\n");
    assertPairCountsEqualPathRows(text);
  });

  it("indexes newly split pairs on diff without collapsing them into STACK", () => {
    const path = "src/split.ts";
    const result = diffResult([{
      path,
      before: [
        projection(path, "openai/codex-cli@1", "same"),
        projection(path, "anthropic/claude-code-cli@1", "same"),
      ],
      after: [
        projection(path, "openai/codex-cli@1", "codex"),
        projection(path, "anthropic/claude-code-cli@1", "claude"),
      ],
      changedProfiles: ["openai/codex-cli@1"],
      beforePayloadRelation: "SAME",
      afterPayloadRelation: "DIFFERENT",
      wasSplit: false,
      isSplit: true,
      causes: ["AGENTS.md"],
    }]);
    const text = renderResultIndex(result);
    expect(text).toContain("MODE\tdiff\n");
    expect(text).toContain("PAIR\tanthropic/claude-code-cli@1\topenai/codex-cli@1\t1\n");
    expect(text).toContain("NEWPAIR\tanthropic/claude-code-cli@1\topenai/codex-cli@1\t1\n");
    expect(text).toContain(
      "PAIRPATH\tanthropic/claude-code-cli@1\topenai/codex-cli@1\tsrc/split.ts\n",
    );
    expect(text).toContain(
      "NEWPAIRPATH\tanthropic/claude-code-cli@1\topenai/codex-cli@1\tsrc/split.ts\n",
    );
    expect(text).not.toContain("CONVPAIR\t");
    expect(text).not.toContain("CONVPAIRPATH\t");
    assertPairCountsEqualPathRows(text);
  });

  it("indexes every pair count from the same path rows, including CONVPAIRPATH", () => {
    const result = diffResult([
      {
        path: "src/still.ts",
        before: [
          projection("src/still.ts", "openai/codex-cli@1", "codex"),
          projection("src/still.ts", "anthropic/claude-code-cli@1", "claude"),
        ],
        after: [
          projection("src/still.ts", "openai/codex-cli@1", "codex-2"),
          projection("src/still.ts", "anthropic/claude-code-cli@1", "claude-2"),
        ],
        changedProfiles: ["openai/codex-cli@1", "anthropic/claude-code-cli@1"],
        beforePayloadRelation: "DIFFERENT",
        afterPayloadRelation: "DIFFERENT",
        wasSplit: true,
        isSplit: true,
        causes: ["AGENTS.md"],
      },
      {
        path: "src/new.ts",
        before: [
          projection("src/new.ts", "openai/codex-cli@1", "same"),
          projection("src/new.ts", "anthropic/claude-code-cli@1", "same"),
        ],
        after: [
          projection("src/new.ts", "openai/codex-cli@1", "codex"),
          projection("src/new.ts", "anthropic/claude-code-cli@1", "claude"),
        ],
        changedProfiles: ["openai/codex-cli@1"],
        beforePayloadRelation: "SAME",
        afterPayloadRelation: "DIFFERENT",
        wasSplit: false,
        isSplit: true,
        causes: ["AGENTS.md"],
      },
      {
        path: "src/converged.ts",
        before: [
          projection("src/converged.ts", "openai/codex-cli@1", "codex"),
          projection("src/converged.ts", "anthropic/claude-code-cli@1", "claude"),
        ],
        after: [
          projection("src/converged.ts", "openai/codex-cli@1", "same"),
          projection("src/converged.ts", "anthropic/claude-code-cli@1", "same"),
        ],
        changedProfiles: ["openai/codex-cli@1", "anthropic/claude-code-cli@1"],
        beforePayloadRelation: "DIFFERENT",
        afterPayloadRelation: "SAME",
        wasSplit: true,
        isSplit: false,
        causes: ["AGENTS.md"],
      },
      {
        path: "src/partial.ts",
        before: [
          incomplete("src/partial.ts", "openai/codex-cli@1"),
          projection("src/partial.ts", "anthropic/claude-code-cli@1", "claude"),
        ],
        after: [
          incomplete("src/partial.ts", "openai/codex-cli@1"),
          projection("src/partial.ts", "anthropic/claude-code-cli@1", "claude"),
        ],
        changedProfiles: [],
        beforePayloadRelation: "INDETERMINATE",
        afterPayloadRelation: "INDETERMINATE",
        wasSplit: null,
        isSplit: null,
        causes: [],
      },
    ]);
    const text = renderResultIndex(result);
    expect(text).toContain(
      "PAIR\tanthropic/claude-code-cli@1\topenai/codex-cli@1\t2\n",
    );
    expect(text).toContain(
      "NEWPAIR\tanthropic/claude-code-cli@1\topenai/codex-cli@1\t1\n",
    );
    expect(text).toContain(
      "CONVPAIR\tanthropic/claude-code-cli@1\topenai/codex-cli@1\t1\n",
    );
    expect(text).toContain(
      "INDPAIR\tanthropic/claude-code-cli@1\topenai/codex-cli@1\t1\n",
    );
    expect(text).toContain(
      "PAIRPATH\tanthropic/claude-code-cli@1\topenai/codex-cli@1\tsrc/new.ts\n",
    );
    expect(text).toContain(
      "PAIRPATH\tanthropic/claude-code-cli@1\topenai/codex-cli@1\tsrc/still.ts\n",
    );
    expect(text).toContain(
      "NEWPAIRPATH\tanthropic/claude-code-cli@1\topenai/codex-cli@1\tsrc/new.ts\n",
    );
    expect(text).toContain(
      "CONVPAIRPATH\tanthropic/claude-code-cli@1\topenai/codex-cli@1\tsrc/converged.ts\n",
    );
    expect(text).toContain(
      "INDPAIRPATH\tanthropic/claude-code-cli@1\topenai/codex-cli@1\tsrc/partial.ts\n",
    );
    assertPairCountsEqualPathRows(text);
  });
});

function incomplete(path: string, profile: string): Projection {
  return {
    ...projection(path, profile, "partial"),
    status: "PARTIAL",
    projectionDigest: null,
    normalizedPayloadDigest: null,
  };
}

function indexKindRows(text: string, kind: string): readonly string[] {
  return text.split("\n").filter((line) => line.startsWith(`${kind}\t`));
}

function assertPairCountsEqualPathRows(text: string): void {
  const kinds = [
    ["PAIR", "PAIRPATH"],
    ["NEWPAIR", "NEWPAIRPATH"],
    ["CONVPAIR", "CONVPAIRPATH"],
    ["INDPAIR", "INDPAIRPATH"],
  ] as const;
  for (const [countKind, pathKind] of kinds) {
    const counts = indexKindRows(text, countKind);
    const paths = indexKindRows(text, pathKind);
    if (counts.length === 0) {
      expect(paths).toEqual([]);
      continue;
    }
    for (const line of counts) {
      const [, left, right, n] = line.split("\t");
      const matching = paths.filter((row) => {
        const parts = row.split("\t");
        return parts[1] === left && parts[2] === right;
      });
      expect(matching, `${countKind} ${left} ${right}`).toHaveLength(Number(n));
    }
    expect(paths.length, `${pathKind} orphan rows`).toBe(
      counts.reduce((sum, line) => sum + Number(line.split("\t")[3]), 0),
    );
  }
}
