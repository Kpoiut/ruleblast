import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  currentExplain,
  diffExplain,
  present,
  type OutputIo,
} from "../src/cli-output.js";
import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
  type CurrentRuleBlastResult,
  type DiffRuleBlastResult,
  type Finding,
  type Projection,
  type ResolvedSource,
  type SnapshotRef,
} from "../src/model.js";
import {
  renderText,
  type ShellDialect,
} from "../src/render-text.js";

function golden(name: string): string {
  return readFileSync(new URL(`./golden/${name}.txt`, import.meta.url), "utf8");
}

const gitRef = (character: string): SnapshotRef => ({
  kind: "git",
  label: character.repeat(40),
  oid: character.repeat(40),
});
const worktreeRef: SnapshotRef = {
  kind: "worktree",
  label: "worktree",
  oid: null,
};

function source(
  path: string,
  disposition: ResolvedSource["disposition"] = "SELECTED",
  overrides: Partial<ResolvedSource> = {},
): ResolvedSource {
  return {
    path,
    disposition,
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

function currentResult(overrides: {
  readonly splitCount?: number;
  readonly sources?: boolean;
  readonly pathOverrides?: Readonly<Record<string, Partial<Projection>>>;
  readonly findings?: Finding[];
} = {}): CurrentRuleBlastResult {
    const paths = ["src/z.ts", "src/a.ts", "src/b.ts", "src/c.ts"].map((path) => {
      const selectedSources = overrides.sources === false ? [] : undefined;
      const claude = projection(
        ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
        path,
        {
          ...(selectedSources === undefined ? {} : { sources: selectedSources }),
          ...overrides.pathOverrides?.[path],
        },
      );
      const codex = projection(
        OPENAI_CODEX_CLI_PROFILE_ID,
        path,
        selectedSources === undefined ? {} : { sources: selectedSources },
    );
    const isSplit = path === "src/a.ts" || path === "src/b.ts";
    return {
      path,
      projections: [claude, codex],
      payloadRelation: isSplit ? "DIFFERENT" as const : "SAME" as const,
      isSplit,
    };
  });
  const splitCount = overrides.splitCount ?? 2;
  if (splitCount === 0) {
    for (const path of paths) {
      path.payloadRelation = "SAME";
      path.isSplit = false;
    }
  }
  return {
    mode: "current",
    schemaVersion: 1,
    resolverRevision: 1,
    snapshot: worktreeRef,
    counts: {
      candidatePathCount: 4,
      currentSplitPathCount: splitCount,
      partialPathCount: 0,
      unknownPathCount: 0,
      indeterminatePathCount: 0,
      byProfile: [],
    },
    paths,
    findings: overrides.findings ?? [],
  };
}

function diffResult(overrides: Partial<DiffRuleBlastResult> = {}): DiffRuleBlastResult {
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
    before: gitRef("a"),
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
      beforeDigest: "before",
      afterDigest: "after",
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
      byProfile: [],
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
    ...overrides,
  };
}

function diffContext() {
  return {
    beforeLabel: "HEAD",
    afterLabel: "WORKTREE",
    caseLabel: null,
    shellDialect: "posix",
  } as const;
}

function currentContext() {
  return {
    currentLabel: "WORKTREE",
    caseLabel: null,
    shellDialect: "posix",
  } as const;
}

function explainCta(text: string): string {
  const line = text.split("\n").find((candidate) =>
    candidate.startsWith("  ruleblast explain ")
  );
  if (line === undefined) throw new Error("Rendered result omitted its explain CTA");
  return line.trimStart();
}

function discoverExecutable(
  candidates: readonly string[],
  probeArguments: readonly string[],
): string | null {
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, probeArguments, {
      stdio: "ignore",
      windowsHide: true,
    });
    if (probe.error === undefined) {
      if (probe.status !== 0) {
        throw new Error(
          `${candidate} was found but its shell probe exited with ${String(probe.status)}`,
        );
      }
      return candidate;
    }
    if ((probe.error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw probe.error;
    }
  }
  return null;
}

const shellExecutables: Readonly<Record<ShellDialect, string | null>> =
  Object.freeze({
    posix: discoverExecutable(["sh"], ["-c", ":"]),
    powershell: discoverExecutable(
      ["pwsh", "powershell"],
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "exit 0"],
    ),
  });
const executableShellDialects = (["posix", "powershell"] as const).filter(
  (shellDialect) => shellExecutables[shellDialect] !== null,
);
const SHELL_ROUND_TRIP_TIMEOUT_MS = 15_000;

function executeCta(
  shellDialect: ShellDialect,
  command: string,
): string[] {
  const executable = shellExecutables[shellDialect];
  if (executable === null) {
    throw new Error(`No ${shellDialect} executable is available on this host`);
  }
  if (shellDialect === "posix") {
    const output = execFileSync(executable, [
      "-c",
      `ruleblast() { printf '%s\\n' "$@"; }\n${command}`,
    ], { encoding: "utf8" });
    return output.trimEnd().split("\n");
  }
  const output = execFileSync(executable, [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `function ruleblast { ConvertTo-Json -Compress -InputObject @($args) }\n${command}`,
  ], { encoding: "utf8" });
  return JSON.parse(output) as string[];
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

describe("renderText", () => {
  it("treats an absent optional shell as unavailable", () => {
    expect(discoverExecutable(
      ["ruleblast-shell-that-does-not-exist"],
      ["--version"],
    )).toBeNull();
  });

  it("reveals a diff in the locked curiosity order", () => {
    expect(renderText(diffResult(), diffContext())).toBe(golden("diff-blast"));
  });

  it("locks current split, aligned, and no-source views", () => {
    expect(renderText(currentResult(), currentContext())).toBe(golden("current-split"));
    expect(renderText(currentResult({ splitCount: 0 }), currentContext()))
      .toBe(golden("current-aligned"));
    expect(renderText(currentResult({ splitCount: 0, sources: false }), currentContext()))
      .toBe(golden("current-no-sources"));
  });

  it("detects instruction presence from sources, not the candidate count", () => {
    const withNoCandidates = currentResult({ splitCount: 0 });
    withNoCandidates.counts.candidatePathCount = 0;
    expect(renderText(withNoCandidates, currentContext())).toContain("One documented reality");
    expect(renderText(withNoCandidates, currentContext())).not.toContain("No repo instructions");
  });

  it("locks no-source-change and overlapping unresolved views", () => {
    const noChanges = diffResult({
      changedInstructionSources: [],
      diffStats: {
        addedLineCount: 0,
        deletedLineCount: 0,
        editedLineCount: 0,
        binaryChangedSourceCount: 0,
      },
      counts: {
        ...diffResult().counts,
        candidatePathCount: 4,
        changedStackPathCount: 0,
        newlySplitPathCount: 0,
        currentSplitPathCount: 0,
      },
      groups: [],
      paths: diffResult().paths.map((path) => ({
        ...path,
        changedProfiles: [],
        beforePayloadRelation: "SAME",
        afterPayloadRelation: "SAME",
        wasSplit: false,
        isSplit: false,
        causes: [],
      })),
    });
    expect(renderText(noChanges, diffContext())).toBe(golden("diff-no-changes"));

    const binaryOnly = diffResult({
      diffStats: {
        addedLineCount: 0,
        deletedLineCount: 0,
        editedLineCount: 0,
        binaryChangedSourceCount: 1,
      },
      counts: {
        ...diffResult().counts,
        changedStackPathCount: 0,
        newlySplitPathCount: 0,
      },
      groups: [],
    });
    expect(renderText(binaryOnly, diffContext()))
      .toContain("0 instruction-line edits.");
    expect(renderText(binaryOnly, diffContext()))
      .not.toContain("No tracked instruction sources changed.");

    const unresolved = diffResult({
      diffStats: {
        addedLineCount: 1,
        deletedLineCount: 0,
        editedLineCount: 1,
        binaryChangedSourceCount: 0,
      },
      counts: {
        ...diffResult().counts,
        candidatePathCount: 5,
        changedStackPathCount: 1,
        newlySplitPathCount: 0,
        currentSplitPathCount: 0,
        partialPathCount: 2,
        unknownPathCount: 3,
        indeterminatePathCount: 4,
      },
      groups: [],
      paths: [],
    });
    expect(renderText(unresolved, diffContext())).toBe(golden("diff-unresolved"));
  });

  it("renders detailed before/after sources, context, digests, and uncertainty", () => {
    const base = diffResult();
    const transition = base.paths[0]!;
    const claude = projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, transition.path, {
      sources: [source("CLAUDE.md", "SELECTED", {
        digest: "claude-source",
        bytesUsed: 12,
      })],
      projectionDigest: "claude-projection",
      normalizedPayloadDigest: "shared-payload",
      evidence: ["vendor:claude"],
    });
    const codexBefore = projection(OPENAI_CODEX_CLI_PROFILE_ID, transition.path, {
      context: {
        cwd: "packages/api/internal",
        trigger: "STARTUP",
        targetPath: transition.path,
        repositoryOnly: true,
      },
      sources: [source("AGENTS.md", "SELECTED", {
        digest: "root-source",
        bytesUsed: 10,
      })],
      projectionDigest: "codex-before-projection",
      normalizedPayloadDigest: "shared-payload",
      evidence: ["vendor:codex"],
    });
    const codexAfter = projection(OPENAI_CODEX_CLI_PROFILE_ID, transition.path, {
      context: codexBefore.context,
      sources: [
        ...codexBefore.sources,
        source("packages/api/AGENTS.md", "SELECTED", {
          digest: "api-source",
          bytesUsed: 21,
          truncated: true,
        }),
      ],
      projectionDigest: "codex-after-projection",
      normalizedPayloadDigest: "codex-after-payload",
      evidence: ["vendor:codex"],
    });
    const explained = diffExplain({
      ...base,
      paths: [{
        ...transition,
        before: [claude, codexBefore],
        after: [claude, codexAfter],
      }],
      findings: [],
    }, transition.path);
    expect(renderText(explained, diffContext())).toBe(golden("explain-diff"));
  });

  it("renders a current explain view with unknown evidence", () => {
    const target = "src/a.ts";
    const unknown = projection(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, target, {
      status: "UNKNOWN",
      composition: "UNSPECIFIED",
      sources: [
        source("CLAUDE.md", "SELECTED", {
          digest: "claude-source",
          bytesUsed: 14,
        }),
        source("<external-import>", "UNRESOLVED_IMPORT", {
          digest: "unknown-source",
          bytesUsed: 0,
        }),
      ],
      projectionDigest: null,
      normalizedPayloadDigest: null,
      evidence: ["external import"],
    });
    const base = currentResult({ splitCount: 0 });
    const codex = projection(OPENAI_CODEX_CLI_PROFILE_ID, target, {
      context: {
        cwd: "src",
        trigger: "STARTUP",
        targetPath: target,
        repositoryOnly: true,
      },
      sources: [source("AGENTS.md", "SELECTED", {
        digest: "agents-source",
        bytesUsed: 8,
      })],
      projectionDigest: "codex-current-projection",
      normalizedPayloadDigest: "codex-current-payload",
      evidence: ["vendor:codex"],
    });
    const explained = currentExplain({
      ...base,
      paths: [{
        path: target,
        projections: [unknown, codex],
        payloadRelation: "INDETERMINATE",
        isSplit: null,
      }],
      findings: [{
        code: "UNKNOWN_PROJECTION",
        profile: ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
        path: target,
        detail: "projection is unknown",
      }],
    }, target);
    expect(renderText(explained, currentContext())).toBe(golden("explain-current"));
  });

  it("uses a case CTA when presenting verified-case context", () => {
    const text = renderText(diffResult(), {
      beforeLabel: "BEFORE",
      afterLabel: "AFTER",
      caseLabel: "test-only/verified-case",
      shellDialect: "posix",
    });
    expect(text).toContain("RULEBLAST · VERIFIED CASE · test-only/verified-case · BEFORE → AFTER");
    expect(text).toContain("ruleblast case --explain packages/api/internal/refund.ts");
    expect(text.indexOf("VERIFIED CASE")).toBeLessThan(text.search(/\d/));
  });

  it("calls a zero-split impact a blast rather than a fracture", () => {
    const result = diffResult();
    result.counts.newlySplitPathCount = 0;
    result.groups[0]!.newlySplitPathCount = 0;
    const text = renderText(result, diffContext());
    expect(text).toContain("The largest blast starts at packages/api/internal/.");
    expect(text).not.toContain("largest fracture");
  });

  it("renders arbitrary result counts instead of independent marketing literals", () => {
    const base = diffResult();
    const arbitrary = diffResult({
      diffStats: { ...base.diffStats, editedLineCount: 17 },
      counts: {
        ...base.counts,
        candidatePathCount: 47,
        changedStackPathCount: 23,
        newlySplitPathCount: 11,
        currentSplitPathCount: 37,
      },
    });
    const text = renderText(arbitrary, diffContext());
    expect(text).toContain("17 instruction-line edits");
    expect(text).toContain("23\ntracked paths changed stack");
    expect(text).toContain("11 paths now live in two AI realities");
    expect(text).toContain("Scope: 47 tracked paths");
    const sourceText = readFileSync(
      new URL("../src/render-text.ts", import.meta.url),
      "utf8",
    );
    expect(sourceText).not.toMatch(/\b(?:3906|1842|1229)\b/);
  });

  it("reports nonzero convergence separately from newly split paths", () => {
    const base = diffResult();
    const text = renderText(diffResult({
      counts: {
        ...base.counts,
        convergedPathCount: 7,
      },
    }), diffContext());
    expect(text).toContain("7 paths converged into one documented reality.");

    const singular = renderText(diffResult({
      counts: {
        ...base.counts,
        convergedPathCount: 1,
      },
    }), diffContext());
    expect(singular).toContain("1 path converged into one documented reality.");
  });

  it("does not call unresolved current coverage one documented reality", () => {
    const unresolved = currentResult({ splitCount: 0 });
    unresolved.counts.partialPathCount = 1;
    unresolved.counts.unknownPathCount = 2;
    unresolved.counts.indeterminatePathCount = 3;
    const text = renderText(unresolved, currentContext());
    expect(text).toContain("No proven cross-profile split");
    expect(text).not.toContain("One documented reality");
    expect(text).toContain("1 path has a partial projection");
    expect(text).toContain("2 paths have unknown projections");
    expect(text).toContain("3 paths have indeterminate profile relations");
  });

  it("is deterministic, leaves frozen input unchanged, and chooses stable maxima/samples", () => {
    const value = deepFreeze(diffResult({
      groups: [
        { root: "z", changedStackPathCount: 50, newlySplitPathCount: 20,
          samplePaths: ["z/z.ts", "z/a.ts"] },
        { root: "a", changedStackPathCount: 50, newlySplitPathCount: 20,
          samplePaths: ["a/z.ts", "a/a.ts"] },
      ],
    }));
    const first = renderText(value, diffContext());
    const second = renderText(value, diffContext());
    expect(second).toBe(first);
    expect(first).toContain("The largest fracture starts at a/.");
    expect(first).toContain("ruleblast explain a/a.ts --from HEAD");
  });

  it("defines the largest fracture by changed-stack impact before split count", () => {
    const text = renderText(diffResult({
      groups: [
        { root: "many", changedStackPathCount: 100, newlySplitPathCount: 0,
          samplePaths: ["many/a.ts"] },
        { root: "split", changedStackPathCount: 1, newlySplitPathCount: 1,
          samplePaths: ["split/a.ts"] },
      ],
    }), diffContext());
    expect(text).toContain("The largest fracture starts at many/.");
    expect(text).toContain("ruleblast explain many/a.ts");
  });

  it("prefers an affected consumer over the instruction source that caused it", () => {
    const base = diffResult();
    const consumer = base.paths[0]!;
    const instructionPath = "packages/api/AGENTS.md";
    const instruction = {
      ...consumer,
      path: instructionPath,
      causes: [instructionPath],
    };
    const result = diffResult({
      groups: [{
        root: "packages/api",
        changedStackPathCount: 2,
        newlySplitPathCount: 2,
        samplePaths: [instructionPath, consumer.path],
      }],
      paths: [instruction, consumer],
    });
    expect(renderText(result, diffContext()))
      .toContain(`ruleblast explain ${consumer.path} --from HEAD`);

    const secondInstruction = {
      ...instruction,
      path: "packages/api/ZAGENTS.md",
      causes: ["packages/api/ZAGENTS.md"],
    };
    const onlySources = diffResult({
      groups: [{
        root: "packages/api",
        changedStackPathCount: 2,
        newlySplitPathCount: 2,
        samplePaths: [secondInstruction.path, instruction.path],
      }],
      paths: [secondInstruction, instruction],
    });
    expect(renderText(onlySources, diffContext()))
      .toContain(`ruleblast explain ${instruction.path} --from HEAD`);
  });

  it("uses singular grammar and reserves the AI-realities metaphor for newly split paths", () => {
    const one = diffResult({
      diffStats: {
        ...diffResult().diffStats,
        addedLineCount: 1,
        deletedLineCount: 0,
        editedLineCount: 1,
      },
      counts: {
        ...diffResult().counts,
        candidatePathCount: 1,
        changedStackPathCount: 1,
        newlySplitPathCount: 1,
        currentSplitPathCount: 999,
      },
    });
    const text = renderText(one, diffContext());
    expect(text).toContain("1 instruction-line edit.");
    expect(text).toContain("tracked path changed stack.");
    expect(text).toContain("1 path now lives in two AI realities.");

    const zeroNew = diffResult({
      counts: { ...one.counts, newlySplitPathCount: 0 },
    });
    expect(renderText(zeroNew, diffContext())).not.toContain("two AI realities");
    expect(renderText(currentResult(), currentContext())).not.toContain("two AI realities");
  });

  it("escapes dynamic paths and ref labels, and derives safe immutable defaults", () => {
    const control = "HEAD\n\u001b[31m\u202e";
    const value = diffResult();
    value.groups[0]!.root = "packages/\u001b[31m";
    value.groups[0]!.samplePaths = ["src/line\n.ts"];
    const text = renderText(value, {
      beforeLabel: control,
      afterLabel: "WORKTREE",
      caseLabel: null,
      shellDialect: "posix",
    });
    for (const character of ["\n\u001b", "\u001b", "\u202e"]) {
      expect(text).not.toContain(character);
    }
    expect(text).toContain("\\n\\u001b[31m\\u202e");
    expect(renderText(diffResult())).toContain("aaaaaaaaaaaa → WORKTREE");

    const shellText = renderText(value, {
      beforeLabel: "$(touch ref)",
      afterLabel: "`touch target`",
      caseLabel: null,
      shellDialect: "posix",
    });
    expect(shellText).toContain("--from '$(touch ref)' --to '`touch target`'");
    expect(shellText).not.toContain('--from "$(touch ref)"');
  });

  it("renders repository paths as option-safe, non-expanding CLI tokens", () => {
    const base = diffResult();
    const leadingOption = diffResult({
      groups: [{
        root: ".",
        changedStackPathCount: 1,
        newlySplitPathCount: 1,
        samplePaths: ["-odd.ts"],
      }],
    });
    expect(renderText(leadingOption, diffContext()))
      .toContain("ruleblast explain ./-odd.ts --from HEAD");

    const homeLike = diffResult({
      groups: [{
        root: ".",
        changedStackPathCount: 1,
        newlySplitPathCount: 1,
        samplePaths: ["~odd.ts"],
      }],
    });
    expect(renderText(homeLike, diffContext()))
      .toContain("ruleblast explain '~odd.ts' --from HEAD");

    expect(renderText(base, {
      beforeLabel: "HEAD~1",
      afterLabel: "WORKTREE",
      caseLabel: null,
      shellDialect: "posix",
    })).toContain("--from HEAD~1");
  });

  it.each([
    ["-$(touch marker).ts", "'./-$(touch marker).ts'"],
    ["-`touch marker`.ts", "'./-`touch marker`.ts'"],
    ["-odd file.ts", "'./-odd file.ts'"],
    ["-it's.ts", "'./-it'\"'\"'s.ts'"],
  ])("shell-quotes hostile leading-option path %s", (path, token) => {
    const result = diffResult({
      groups: [{
        root: ".",
        changedStackPathCount: 1,
        newlySplitPathCount: 1,
        samplePaths: [path],
      }],
    });
    expect(renderText(result, diffContext()))
      .toContain(`ruleblast explain ${token} --from HEAD`);
  });

  it.each(executableShellDialects)(
    "round-trips hostile explain CTA arguments through %s",
    (shellDialect) => {
      const path = "-it's $(not-run) `tick` file.ts";
      const beforeLabel = "base it's $(not-run) `tick` ref";
      const afterLabel = "target it's $(not-run) `tick` ref";
      const result = diffResult({
        groups: [{
          root: ".",
          changedStackPathCount: 1,
          newlySplitPathCount: 1,
          samplePaths: [path],
        }],
      });
      const command = explainCta(renderText(result, {
        beforeLabel,
        afterLabel,
        caseLabel: null,
        shellDialect,
      }));

      expect(executeCta(shellDialect, command)).toEqual([
        "explain",
        `./${path}`,
        "--from",
        beforeLabel,
        "--to",
        afterLabel,
      ]);
    },
    SHELL_ROUND_TRIP_TIMEOUT_MS,
  );

  const leadingAtCases = [
    ["posix", "ruleblast explain @foo --from @base --to @target"],
    [
      "powershell",
      "ruleblast explain '@foo' --from '@base' --to '@target'",
    ],
  ] as const;
  it.each(leadingAtCases.filter(
    ([shellDialect]) => shellExecutables[shellDialect] !== null,
  ))(
    "round-trips leading-at CTA arguments through %s",
    (shellDialect, expectedCommand) => {
      const result = diffResult({
        groups: [{
          root: ".",
          changedStackPathCount: 1,
          newlySplitPathCount: 1,
          samplePaths: ["@foo"],
        }],
      });
      const command = explainCta(renderText(result, {
        beforeLabel: "@base",
        afterLabel: "@target",
        caseLabel: null,
        shellDialect,
      }));

      expect(command).toBe(expectedCommand);
      expect(executeCta(shellDialect, command)).toEqual([
        "explain",
        "@foo",
        "--from",
        "@base",
        "--to",
        "@target",
      ]);
    },
    SHELL_ROUND_TRIP_TIMEOUT_MS,
  );

  it("explains an unchanged selected path without claiming it counted", () => {
    const base = diffResult();
    const transition = base.paths[0]!;
    const unchanged = diffExplain({
      ...base,
      paths: [{
        ...transition,
        changedProfiles: [],
        beforePayloadRelation: "SAME",
        afterPayloadRelation: "SAME",
        wasSplit: false,
        isSplit: false,
        causes: [],
      }],
    }, transition.path);
    const text = renderText(unchanged, diffContext());
    expect(text).toContain("WHY THIS PATH DID NOT CHANGE");
    expect(text).not.toContain("WHY THIS PATH COUNTS");
    expect(text).not.toContain("+ no instruction source was attributed");
    expect(text).toContain("= changed profiles: none");
    expect(text).toContain("= profile relation: SAME → SAME");
  });

  it("captures a closed presentation context without invoking getters", () => {
    let calls = 0;
    const hostile = Object.defineProperty({
      afterLabel: "WORKTREE",
      caseLabel: null,
      shellDialect: "posix",
    }, "beforeLabel", {
      enumerable: true,
      get() { calls += 1; return "HEAD"; },
    });
    expect(() => renderText(diffResult(), hostile as never)).toThrow(TypeError);
    expect(calls).toBe(0);
    expect(() => renderText(diffResult(), {
      ...diffContext(),
      extra: true,
    } as never)).toThrow(TypeError);
    expect(() => renderText(diffResult(), {
      ...diffContext(),
      shellDialect: "cmd",
    } as never)).toThrow(TypeError);
  });

  it("lets the caller control ANSI and never requires it for meaning", () => {
    const plain = renderText(diffResult(), diffContext(), false);
    const colored = renderText(diffResult(), diffContext(), true);
    expect(plain).not.toContain("\u001b[");
    expect(colored).toContain("\u001b[36mRULEBLAST");
    expect(colored.replace(/\u001b\[[0-9;]*m/g, "")).toBe(plain);
  });

  it("delegates text presentation and leaves canonical JSON byte-identical", () => {
    const value = diffResult();
    const writes: string[] = [];
    const io: OutputIo = {
      stdout: (text) => writes.push(text),
      stderr: () => {},
      env: {},
      stdoutIsTTY: false,
    };
    present(value, { kind: "text", color: "never" }, io, diffContext());
    expect(writes).toEqual([golden("diff-blast")]);

    const firstJson: string[] = [];
    const secondJson: string[] = [];
    present(value, { kind: "json", color: "never" }, {
      ...io, stdout: (text) => firstJson.push(text),
    }, diffContext());
    present(value, { kind: "json", color: "never" }, {
      ...io, stdout: (text) => secondJson.push(text),
    }, {
      beforeLabel: "IGNORED",
      afterLabel: "IGNORED",
      caseLabel: "ignored/case",
      shellDialect: "powershell",
    });
    expect(secondJson).toEqual(firstJson);
    expect(JSON.parse(firstJson[0]!)).toEqual(value);
  });
});
