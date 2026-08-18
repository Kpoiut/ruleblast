import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
  SnapshotRef,
} from "../src/model.js";
import type { GitObjectSnapshot, RepositorySnapshot } from "../src/snapshot.js";
import {
  CliRuntimeError,
  isDirectEntry,
  runCli,
  type CliDependencies,
  type CliIo,
} from "../src/cli.js";
import { openPackagedCase } from "../src/case.js";
import { analyzeCurrent, analyzeDiff } from "../src/impact.js";
import {
  findRepositoryRoot,
  GitSnapshotError,
  openGitSnapshot,
  openTrackedWorktree,
  probeGitStorageFormat,
} from "../src/git.js";
import { claudeProfile } from "../src/profiles/claude.js";
import { codexProfile } from "../src/profiles/codex.js";

const gitRef = (oid: string): SnapshotRef => ({ kind: "git", label: oid, oid });
const worktreeRef: SnapshotRef = { kind: "worktree", label: "worktree", oid: null };

function currentResult(
  snapshot: SnapshotRef = worktreeRef,
  status: "COMPLETE" | "UNKNOWN" = "COMPLETE",
): CurrentRuleBlastResult {
  const projection = {
    profile: "anthropic/claude-code-cli@1",
    context: {
      cwd: ".", trigger: "READ_TARGET", targetPath: "src/index.ts", repositoryOnly: true,
    } as const,
    status,
    composition: "ORDERED" as const,
    sources: [],
    normalizedPayloadUnits: [],
    projectionDigest: status === "COMPLETE" ? "projection" : null,
    normalizedPayloadDigest: status === "COMPLETE" ? "payload" : null,
    evidence: [],
  };
  return {
    mode: "current", schemaVersion: 1, resolverRevision: 1, snapshot,
    counts: {
      candidatePathCount: 1, currentSplitPathCount: 0,
      partialPathCount: 0, unknownPathCount: status === "UNKNOWN" ? 1 : 0,
      indeterminatePathCount: status === "UNKNOWN" ? 1 : 0,
      byProfile: [
        { profile: "anthropic/claude-code-cli@1", completePathCount: status === "COMPLETE" ? 1 : 0,
          partialPathCount: 0, unknownPathCount: status === "UNKNOWN" ? 1 : 0 },
      ],
    },
    paths: [{ path: "src/index.ts", projections: [projection], payloadRelation: "SAME", isSplit: false }],
    findings: status === "UNKNOWN" ? [{
      code: "UNKNOWN_PROJECTION", profile: projection.profile,
      path: "src/index.ts", detail: "projection is unknown",
    }] : [],
  };
}

function diffResult(
  before: SnapshotRef = gitRef("a".repeat(40)),
  after: SnapshotRef = gitRef("b".repeat(40)),
  status: "COMPLETE" | "UNKNOWN" = "COMPLETE",
): DiffRuleBlastResult {
  const current = currentResult(after, status).paths[0]!;
  return {
    mode: "diff", schemaVersion: 1, resolverRevision: 1, before, after,
    diffStats: { addedLineCount: 0, deletedLineCount: 0, editedLineCount: 0, binaryChangedSourceCount: 0 },
    changedInstructionSources: [],
    counts: {
      candidatePathCount: 1, changedStackPathCount: 0, newlySplitPathCount: 0,
      convergedPathCount: 0, currentSplitPathCount: 0, partialPathCount: 0,
      unknownPathCount: status === "UNKNOWN" ? 1 : 0,
      indeterminatePathCount: status === "UNKNOWN" ? 1 : 0,
      byProfile: [{
        profile: "anthropic/claude-code-cli@1", completePathCount: status === "COMPLETE" ? 1 : 0,
        partialPathCount: 0, unknownPathCount: status === "UNKNOWN" ? 1 : 0,
        changedStackPathCount: 0,
      }],
    },
    groups: [],
    paths: [{
      path: current.path, before: current.projections, after: current.projections,
      changedProfiles: [], beforePayloadRelation: "SAME", afterPayloadRelation: "SAME",
      wasSplit: false, isSplit: false, causes: [],
    }],
    findings: currentResult(after, status).findings,
  };
}

function addCompleteUnrelatedCurrent(
  result: CurrentRuleBlastResult,
): CurrentRuleBlastResult {
  const complete = currentResult().paths[0]!;
  complete.path = "src/complete.ts";
  complete.projections[0]!.context.targetPath = complete.path;
  result.paths.push(complete);
  return result;
}

function addCompleteUnrelatedDiff(
  result: DiffRuleBlastResult,
): DiffRuleBlastResult {
  const complete = diffResult().paths[0]!;
  complete.path = "src/complete.ts";
  complete.before[0]!.context.targetPath = complete.path;
  complete.after[0]!.context.targetPath = complete.path;
  result.paths.push(complete);
  return result;
}

function fileAccess() {
  return {
    async listPaths() { return ["src/index.ts"]; },
    async entry(path: string) {
      return path === "src/index.ts"
        ? { path, kind: "file" as const, executable: false }
        : null;
    },
    async read(path: string) {
      return path === "src/index.ts" ? new Uint8Array() : null;
    },
  };
}

function snapshot(ref: SnapshotRef): GitObjectSnapshot {
  return {
    ref,
    ...fileAccess(),
    blobOid() { return null; },
  };
}

function worktreeSnapshot(): RepositorySnapshot {
  return {
    ref: worktreeRef,
    ...fileAccess(),
  };
}

function harness(overrides: Partial<CliDependencies> = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: CliIo = {
    stdout: (value) => { stdout.push(value); },
    stderr: (value) => { stderr.push(value); },
    cwd: () => "C:\\workspace",
    env: {},
    stdoutIsTTY: true,
    stderrIsTTY: true,
  };
  const worktree = worktreeSnapshot();
  const before = snapshot(gitRef("a".repeat(40)));
  const after = snapshot(gitRef("b".repeat(40)));
  const dependencies: CliDependencies = {
    version: "1.2.3",
    shellDialect: "posix",
    profiles: [],
    resolvePath: (...parts) => parts.join("/"),
    findRepositoryRoot: vi.fn(async () => "C:\\workspace"),
    openGitSnapshot: vi.fn(async (_root, ref) => ref === "BASE" ? before : after),
    probeGitStorageFormat: vi.fn(async () => null),
    openTrackedWorktree: vi.fn(async () => worktree),
    analyzeCurrent: vi.fn(async ({ snapshot: selected }) => currentResult(selected.ref)),
    analyzeDiff: vi.fn(async ({ before: left, after: right }) => diffResult(left.ref, right.ref)),
    openCase: vi.fn(openPackagedCase),
    ...overrides,
  };
  return { io, dependencies, stdout, stderr };
}

describe("runCli", () => {
  const temporaryDirectories: string[] = [];
  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("emits nothing when --paths-only has no attention paths", async () => {
    const h = harness();
    expect(await runCli([".", "--paths-only"], h.io, h.dependencies)).toBe(0);
    expect(h.stdout).toEqual([]);
  });

  it("prints one attention path per line for --paths-only and skips scoreboard text", async () => {
    const result = diffResult();
    result.paths[0]!.changedProfiles = ["openai/codex-cli@1"];
    const h = harness({ analyzeDiff: vi.fn(async () => result) });
    expect(await runCli(["diff", "--paths-only"], h.io, h.dependencies)).toBe(0);
    expect(h.stdout.join("")).toBe("src/index.ts\n");
    expect(h.stdout.join("")).not.toContain("RULEBLAST");
    expect(h.stdout.join("")).not.toContain("{");
  });

  it("prints two selected stacks for explain --compare without JSON", async () => {
    const result = currentResult();
    const first = result.paths[0]!.projections[0]!;
    const source = (
      path: string,
    ): (typeof first)["sources"][number] => ({
      path,
      disposition: "SELECTED",
      digest: path,
      bytesUsed: 1,
      truncated: false,
    });
    result.paths[0]!.projections = [
      { ...first, profile: "openai/codex-cli@1", sources: [source("AGENTS.md")] },
      {
        ...first,
        profile: "anthropic/claude-code-cli@1",
        sources: [source("CLAUDE.md")],
      },
    ];
    const h = harness({ analyzeCurrent: vi.fn(async () => result) });
    expect(await runCli(
      ["explain", "src/index.ts", "--compare"],
      h.io,
      h.dependencies,
    )).toBe(0);
    const text = h.stdout.join("");
    expect(text).toContain("RULEBLAST COMPARE · src/index.ts");
    expect(text).toContain("AGENTS.md");
    expect(text).toContain("CLAUDE.md");
    expect(text).not.toContain("{");
  });

  it("routes filesystem scans from io.cwd and writes one canonical JSON line", async () => {
    const h = harness();
    expect(await runCli(["subdir", "--json"], h.io, h.dependencies)).toBe(0);
    expect(h.dependencies.findRepositoryRoot).toHaveBeenCalledWith("C:\\workspace/subdir");
    expect(h.stdout).toHaveLength(1);
    expect(h.stdout[0]?.endsWith("\n")).toBe(true);
    expect(JSON.parse(h.stdout[0]!)).toMatchObject({ mode: "current" });
    expect(h.stderr).toEqual([]);
  });

  it("wraps --witness --json around the unchanged canonical result", async () => {
    const h = harness();
    expect(await runCli(["subdir", "--json", "--witness"], h.io, h.dependencies)).toBe(0);
    const parsed = JSON.parse(h.stdout[0]!) as {
      readonly envelope: string;
      readonly result: { readonly mode: string };
      readonly witness: readonly unknown[];
    };
    expect(parsed.envelope).toBe("ruleblast.witness.v1");
    expect(parsed.result.mode).toBe("current");
    expect(parsed.witness).toHaveLength(1);
    expect(await runCli(["subdir", "--json"], h.io, h.dependencies)).toBe(0);
    expect(JSON.parse(h.stdout[1]!)).toMatchObject({ mode: "current" });
    expect(h.stdout[1]).not.toContain("ruleblast.witness.v1");
  });

  it("routes diff through immutable resolved snapshots and rejects equal OIDs", async () => {
    const oid = "c".repeat(40);
    const same = snapshot(gitRef(oid));
    const h = harness({ openGitSnapshot: vi.fn(async () => same) });
    expect(await runCli(["diff", "left", "--to", "right"], h.io, h.dependencies)).toBe(1);
    expect(h.dependencies.analyzeDiff).not.toHaveBeenCalled();
    expect(h.stdout).toEqual([]);
    expect(h.stderr.join("")).toContain("same Git commit");
  });

  it("keeps display selectors separate from full immutable Git refs", async () => {
    const h = harness();
    expect(await runCli(
      ["diff", "BASE", "--to", "TARGET", "--json"], h.io, h.dependencies,
    )).toBe(0);
    expect(h.dependencies.openGitSnapshot).toHaveBeenNthCalledWith(1, "C:\\workspace", "BASE");
    expect(h.dependencies.openGitSnapshot).toHaveBeenNthCalledWith(2, "C:\\workspace", "TARGET");
    const result = JSON.parse(h.stdout[0]!);
    expect(result.before).toEqual(gitRef("a".repeat(40)));
    expect(result.after).toEqual(gitRef("b".repeat(40)));
  });

  it("carries the captured shell dialect into text CTAs", async () => {
    const result = diffResult();
    result.counts.changedStackPathCount = 1;
    result.groups = [{
      root: "src",
      changedStackPathCount: 1,
      newlySplitPathCount: 0,
      samplePaths: ["src/index.ts"],
    }];
    const h = harness({
      shellDialect: "powershell",
      openGitSnapshot: vi.fn(async (_root, ref) =>
        snapshot(gitRef((ref.startsWith("base") ? "a" : "b").repeat(40)))
      ),
      analyzeDiff: vi.fn(async () => result),
    });

    expect(await runCli([
      "diff",
      "base it's",
      "--to",
      "target it's",
    ], h.io, h.dependencies)).toBe(0);
    expect(h.stdout.join("")).toContain(
      "ruleblast explain src/index.ts --from 'base it''s' --to 'target it''s'",
    );
  });

  it("uses current analysis for explain without --from and projects only the selected path", async () => {
    const h = harness();
    expect(await runCli(["explain", "src/index.ts", "--json"], h.io, h.dependencies)).toBe(0);
    expect(h.dependencies.analyzeCurrent).toHaveBeenCalledOnce();
    expect(h.dependencies.analyzeDiff).not.toHaveBeenCalled();
    expect(JSON.parse(h.stdout[0]!)).toEqual({
      mode: "explain", analysisMode: "current", schemaVersion: 1, resolverRevision: 1,
      snapshot: worktreeRef,
      path: currentResult().paths[0],
      findings: [],
    });
  });

  it("returns 2 when the selected current explain path alone is unresolved", async () => {
    const result = addCompleteUnrelatedCurrent(
      currentResult(worktreeRef, "UNKNOWN"),
    );
    const h = harness({ analyzeCurrent: vi.fn(async () => result) });
    expect(await runCli(
      ["explain", "src/index.ts", "--json"], h.io, h.dependencies,
    )).toBe(2);
    expect(JSON.parse(h.stdout[0]!).path.path).toBe("src/index.ts");
  });

  it("treats a post-analysis missing explain path as an internal invariant failure", async () => {
    const inconsistent = currentResult();
    inconsistent.paths = [];
    const h = harness({ analyzeCurrent: vi.fn(async () => inconsistent) });
    expect(await runCli(
      ["explain", "src/index.ts", "--json"], h.io, h.dependencies,
    )).toBe(70);
    expect(h.stdout).toEqual([]);
    expect(h.stderr.join("")).toContain("Internal error");
  });

  it("uses diff analysis for explain with --from and filters findings by path", async () => {
    const other = { ...diffResult(), findings: [{
      code: "UNKNOWN_PROJECTION" as const, profile: null,
      path: "other.ts", detail: "not selected",
    }] };
    const h = harness({ analyzeDiff: vi.fn(async () => other) });
    expect(await runCli([
      "explain", "src/index.ts", "--from", "BASE", "--to", "TARGET", "--json",
    ], h.io, h.dependencies)).toBe(0);
    expect(JSON.parse(h.stdout[0]!)).toEqual({
      mode: "explain", analysisMode: "diff", schemaVersion: 1, resolverRevision: 1,
      before: other.before, after: other.after, path: other.paths[0], findings: [],
    });
  });

  it("returns 2 when the selected diff explain path alone is unresolved", async () => {
    const result = addCompleteUnrelatedDiff(diffResult(
      gitRef("a".repeat(40)), gitRef("b".repeat(40)), "UNKNOWN",
    ));
    const h = harness({ analyzeDiff: vi.fn(async () => result) });
    expect(await runCli([
      "explain", "src/index.ts", "--from", "BASE", "--to", "TARGET", "--json",
    ], h.io, h.dependencies)).toBe(2);
    expect(JSON.parse(h.stdout[0]!).path.path).toBe("src/index.ts");
  });

  it("returns a typed path error when explain target is not tracked", async () => {
    const h = harness();
    expect(await runCli(["explain", "missing.ts"], h.io, h.dependencies)).toBe(1);
    expect(h.dependencies.analyzeCurrent).not.toHaveBeenCalled();
    expect(h.stderr).toEqual([
      "TARGET_PATH_NOT_TRACKED: Tracked target path not found: \\\"missing.ts\\\" Choose a Git-tracked repository-relative path and retry.\n",
    ]);
  });

  it("routes case outside Git through its verified-result seam", async () => {
    const h = harness();
    expect(await runCli(["case", "--json"], h.io, h.dependencies)).toBe(0);
    expect(h.dependencies.openCase).toHaveBeenCalledOnce();
    expect(h.dependencies.findRepositoryRoot).not.toHaveBeenCalled();
    expect(h.dependencies.openGitSnapshot).not.toHaveBeenCalled();
    expect(h.dependencies.openTrackedWorktree).not.toHaveBeenCalled();
    expect(h.dependencies.analyzeDiff).not.toHaveBeenCalled();
  });

  it("captures a case result as closed data before presentation", async () => {
    let getterCalls = 0;
    const getter = harness({
      openCase: vi.fn(async () => Object.defineProperties({}, {
        mode: {
          enumerable: true,
          get: () => { getterCalls += 1; throw new Error("mode getter"); },
        },
      }) as unknown as DiffRuleBlastResult),
    });
    expect(await runCli(["case"], getter.io, getter.dependencies)).toBe(70);
    expect(getterCalls).toBe(0);
    expect(getter.dependencies.analyzeDiff).not.toHaveBeenCalled();

    const extra = harness({
      openCase: vi.fn(async () => ({
        ...diffResult(),
        extra: true,
      } as unknown as DiffRuleBlastResult)),
    });
    expect(await runCli(["case"], extra.io, extra.dependencies)).toBe(70);
    expect(extra.dependencies.analyzeDiff).not.toHaveBeenCalled();
  });

  it("renders case explain as a compact ExplainResult and validates its target", async () => {
    const h = harness();
    const casePath = ".github/ISSUE_TEMPLATE/missing-blast.yml";
    expect(await runCli(
      ["case", "--explain", casePath, "--json"], h.io, h.dependencies,
    )).toBe(0);
    expect(JSON.parse(h.stdout[0]!)).toMatchObject({
      mode: "explain", analysisMode: "diff", path: { path: casePath },
    });
    const missing = harness();
    expect(await runCli(
      ["case", "--explain", "missing.ts"], missing.io, missing.dependencies,
    )).toBe(1);
    expect(missing.dependencies.analyzeDiff).not.toHaveBeenCalled();
  });

  it("returns 2 only when candidates exist and no complete projection is defensible", async () => {
    const h = harness({ analyzeCurrent: vi.fn(async () => currentResult(worktreeRef, "UNKNOWN")) });
    expect(await runCli(["."], h.io, h.dependencies)).toBe(2);
    const empty = currentResult();
    empty.counts.candidatePathCount = 0;
    empty.paths = [];
    const emptyHarness = harness({ analyzeCurrent: vi.fn(async () => empty) });
    expect(await runCli(["."], emptyHarness.io, emptyHarness.dependencies)).toBe(0);

    const inconsistentSummary = currentResult(worktreeRef, "UNKNOWN");
    inconsistentSummary.counts.candidatePathCount = 0;
    const inconsistentHarness = harness({
      analyzeCurrent: vi.fn(async () => inconsistentSummary),
    });
    expect(await runCli(
      ["."], inconsistentHarness.io, inconsistentHarness.dependencies,
    )).toBe(2);
  });

  it("requires complete coverage at both diff endpoints for exit 0", async () => {
    const result = diffResult();
    result.paths[0]!.before[0]!.status = "UNKNOWN";
    result.paths[0]!.before[0]!.projectionDigest = null;
    const h = harness({ analyzeDiff: vi.fn(async () => result) });
    expect(await runCli(
      ["diff", "BASE", "--to", "TARGET"], h.io, h.dependencies,
    )).toBe(2);
  });

  it("honors NO_COLOR and injected TTY in deterministic text presentation", async () => {
    const h = harness();
    Object.defineProperty(h.io.env, "NO_COLOR", { value: "1", enumerable: true });
    expect(await runCli(["."], h.io, h.dependencies)).toBe(0);
    expect(h.stdout.join("")).not.toContain("\u001b[");

    const forced = harness();
    Object.defineProperty(forced.io.env, "NO_COLOR", { value: "1", enumerable: true });
    expect(await runCli([".", "--color=always"], forced.io, forced.dependencies)).toBe(0);
    expect(forced.stdout.join("")).not.toContain("\u001b[");
  });

  it("prints exact help/version and usage diagnostics on their proper streams", async () => {
    const help = harness();
    expect(await runCli(["--help"], help.io, help.dependencies)).toBe(0);
    expect(help.stdout.join("")).toContain("Usage:");
    expect(help.stdout.join("")).toContain("Two default realities");
    expect(help.stdout.join("").match(/--color=auto\|always\|never/g)).not.toBeNull();
    expect(help.stderr).toEqual([]);

    const version = harness();
    expect(await runCli(["--version"], version.io, version.dependencies)).toBe(0);
    expect(version.stdout).toEqual(["ruleblast 1.2.3\n"]);
    expect(version.stderr).toEqual([]);

    const usage = harness();
    expect(await runCli(["--wat"], usage.io, usage.dependencies)).toBe(1);
    expect(usage.stdout).toEqual([]);
    expect(usage.stderr.join("")).toContain("UNKNOWN_OPTION");
    expect(usage.stderr).toHaveLength(1);
    expect(usage.stderr[0]).toContain("Run ruleblast --help for usage.");
  });

  it("uses package metadata for the default version and a URL-safe entry guard", async () => {
    const h = harness();
    expect(await runCli(["--version"], h.io)).toBe(0);
    const metadata = JSON.parse(readFileSync(
      new URL("../package.json", import.meta.url), "utf8",
    )) as { version: string };
    expect(h.stdout).toEqual([`ruleblast ${metadata.version}\n`]);

    const specialPath = resolve(join(tmpdir(), "ruleblast-%-#", "cli.js"));
    expect(isDirectEntry(pathToFileURL(specialPath).href, specialPath)).toBe(true);
    expect(isDirectEntry("file:///different.js", specialPath)).toBe(false);

    const binRoot = mkdtempSync(join(tmpdir(), "ruleblast-bin-"));
    temporaryDirectories.push(binRoot);
    const target = join(binRoot, "cli-%-#.js");
    const link = join(binRoot, "ruleblast-bin");
    writeFileSync(target, "");
    symlinkSync(target, link, "file");
    expect(isDirectEntry(pathToFileURL(target).href, link)).toBe(true);
  });

  it("captures the closed CliIo record and each callback once", async () => {
    let stdoutReads = 0;
    let cwdCalls = 0;
    const base = harness();
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(hostile, {
      stdout: { enumerable: true, value: (text: string) => {
        stdoutReads += 1; base.stdout.push(text);
      } },
      stderr: { enumerable: true, value: (text: string) => base.stderr.push(text) },
      cwd: { enumerable: true, value: () => { cwdCalls += 1; return "C:\\workspace"; } },
      env: { enumerable: true, value: Object.freeze({}) },
      stdoutIsTTY: { enumerable: true, value: false },
      stderrIsTTY: { enumerable: true, value: false },
    });
    expect(await runCli(["--version"], hostile as unknown as CliIo, base.dependencies)).toBe(0);
    expect(stdoutReads).toBe(1);
    expect(cwdCalls).toBe(0);

    Object.defineProperty(hostile, "extra", { enumerable: true, value: true });
    expect(await runCli(["--version"], hostile as unknown as CliIo, base.dependencies)).toBe(70);

    const getter = { ...base.io };
    Object.defineProperty(getter, "stdout", { enumerable: true, get: () => {
      throw new Error("getter called");
    } });
    expect(await runCli(["--version"], getter, base.dependencies)).toBe(70);
  });

  it("keeps diagnostics on stderr and hides unexpected stacks unless debug is enabled", async () => {
    const failure = new Error("boom");
    const normal = harness({ findRepositoryRoot: vi.fn(async () => { throw failure; }) });
    expect(await runCli(["."], normal.io, normal.dependencies)).toBe(70);
    expect(normal.stdout).toEqual([]);
    expect(normal.stderr.join("")).toBe("Internal error: boom\n");

    const debug = harness({ findRepositoryRoot: vi.fn(async () => { throw failure; }) });
    Object.defineProperty(debug.io.env, "RULEBLAST_DEBUG", {
      value: "1", enumerable: true,
    });
    expect(await runCli(["."], debug.io, debug.dependencies)).toBe(70);
    expect(debug.stderr.join("")).toContain("Error: boom");
  });

  it.each([
    ["usage", ["--wat"]],
    ["known", ["explain", "missing.ts"]],
    ["unexpected", ["."]],
  ] as const)("resolves 70 when stderr throws while reporting %s failure", async (
    kind,
    argv,
  ) => {
    const h = harness(kind === "unexpected" ? {
      findRepositoryRoot: vi.fn(async () => { throw new Error("boom"); }),
    } : {});
    const throwingIo: CliIo = {
      ...h.io,
      stderr: () => { throw new Error("stderr failed"); },
    };
    await expect(runCli(argv, throwingIo, h.dependencies)).resolves.toBe(70);
  });

  it("resolves 70 when stdout and fallback stderr both throw", async () => {
    const h = harness();
    const throwingIo: CliIo = {
      ...h.io,
      stdout: () => { throw new Error("stdout failed"); },
      stderr: () => { throw new Error("stderr failed"); },
    };
    await expect(runCli(["--version"], throwingIo, h.dependencies)).resolves.toBe(70);
  });

  it("escapes control bytes in text paths and non-debug diagnostics", async () => {
    const result = currentResult();
    result.paths[0]!.path = "src/line\n\u001b[31m\u009b\u2028\u202e.ts";
    result.paths[0]!.projections[0]!.context.targetPath = result.paths[0]!.path;
    const base = harness({ analyzeCurrent: vi.fn(async () => result) });
    const controlSnapshot: RepositorySnapshot = {
      ...worktreeSnapshot(),
      async listPaths() { return [result.paths[0]!.path]; },
      async entry(path) {
        return path === result.paths[0]!.path
          ? { path, kind: "file", executable: false }
          : null;
      },
      async read(path) { return path === result.paths[0]!.path ? new Uint8Array() : null; },
    };
    const text = harness({
      analyzeCurrent: base.dependencies.analyzeCurrent,
      openTrackedWorktree: vi.fn(async () => controlSnapshot),
    });
    Object.defineProperty(text.io.env, "NO_COLOR", { value: "1", enumerable: true });
    expect(await runCli(
      ["explain", result.paths[0]!.path], text.io, text.dependencies,
    )).toBe(0);
    expect(text.stdout).toHaveLength(1);
    const rendered = text.stdout[0]!;
    for (const control of ["\u001b", "\u009b", "\u2028", "\u202e"]) {
      expect(rendered).not.toContain(control);
    }
    expect(rendered).not.toContain("src/line\n");

    const json = harness({
      analyzeCurrent: base.dependencies.analyzeCurrent,
      openTrackedWorktree: vi.fn(async () => controlSnapshot),
    });
    expect(await runCli(
      ["explain", result.paths[0]!.path, "--json"], json.io, json.dependencies,
    )).toBe(0);
    expect(JSON.parse(json.stdout[0]!).path.path).toBe(result.paths[0]!.path);

    const diagnostic = harness({
      findRepositoryRoot: vi.fn(async () => { throw new Error("bad\n\u001b[31mforge"); }),
    });
    expect(await runCli(["."], diagnostic.io, diagnostic.dependencies)).toBe(70);
    expect(diagnostic.stderr).toHaveLength(1);
    expect(diagnostic.stderr[0]).not.toContain("\n\u001b[31mforge");
  });

  it("maps typed repository errors to exit 1 without stdout", async () => {
    const h = harness({
      findRepositoryRoot: vi.fn(async () => {
        throw new CliRuntimeError("NOT_REPOSITORY", "No Git repository found");
      }),
    });
    expect(await runCli([".", "--json"], h.io, h.dependencies)).toBe(1);
    expect(h.stdout).toEqual([]);
    expect(h.stderr.join("")).toContain("NOT_REPOSITORY");
    expect(h.stderr).toHaveLength(1);
    expect(h.stderr[0]).toContain("Run ruleblast from a Git repository.");
  });

  it("maps each repository/ref/path adapter boundary to exit 1", async () => {
    for (const code of ["NOT_REPOSITORY", "REF_NOT_FOUND", "INVALID_PATH"] as const) {
      const h = harness({
        findRepositoryRoot: vi.fn(async () => {
          throw new CliRuntimeError(code, `typed ${code}`);
        }),
      });
      expect(await runCli(["."], h.io, h.dependencies)).toBe(1);
      expect(h.stdout).toEqual([]);
      expect(h.stderr.join("")).toContain(code);
    }
  });

  it("preserves every typed Git adapter error code", async () => {
    for (const code of [
      "UNMERGED_INDEX",
      "UNSUPPORTED_WORKTREE_NODE",
      "WORKTREE_CHANGED_DURING_SNAPSHOT",
    ] as const) {
      const h = harness({
        openTrackedWorktree: vi.fn(async () => { throw new GitSnapshotError(code); }),
      });
      expect(await runCli(["."], h.io, h.dependencies)).toBe(1);
      expect(h.stdout).toEqual([]);
      expect(h.stderr.join("")).toMatch(new RegExp(`^${code}:`));
    }

    const repository = harness({
      findRepositoryRoot: vi.fn(async () => {
        throw new GitSnapshotError("NOT_REPOSITORY");
      }),
    });
    expect(await runCli(["."], repository.io, repository.dependencies)).toBe(1);
    expect(repository.stderr.join("")).toMatch(/^NOT_REPOSITORY:/);

    const ref = harness({
      openGitSnapshot: vi.fn(async () => { throw new GitSnapshotError("REF_NOT_FOUND"); }),
    });
    expect(await runCli(["diff", "missing"], ref.io, ref.dependencies)).toBe(1);
    expect(ref.stderr.join("")).toMatch(/^REF_NOT_FOUND:/);
  });

  it("captures injected dependency data once before any routing side effect", async () => {
    const h = harness();
    const descriptors = Object.getOwnPropertyDescriptors(h.dependencies);
    const hostile = Object.create(null) as Record<string, unknown>;
    for (const [key, descriptor] of Object.entries(descriptors)) {
      Object.defineProperty(hostile, key, {
        enumerable: true,
        get: () => descriptor.value,
      });
    }
    expect(await runCli(["--version"], h.io, hostile as unknown as CliDependencies)).toBe(70);
    expect(h.stdout).toEqual([]);

    const mutable = { ...h.dependencies };
    let first = true;
    Object.defineProperty(mutable, "version", {
      enumerable: true,
      configurable: true,
      get() {
        if (first) { first = false; return "captured"; }
        throw new Error("version reread");
      },
    });
    expect(await runCli(["--version"], h.io, mutable)).toBe(70);
  });

  it("runs current analysis against a real temporary Git repository", async () => {
    const root = mkdtempSync(join(tmpdir(), "ruleblast-cli-"));
    temporaryDirectories.push(root);
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "AGENTS.md"), "same rules\n");
    writeFileSync(join(root, "CLAUDE.md"), "same rules\n");
    writeFileSync(join(root, "src", "index.ts"), "export {};\n");
    execFileSync("git", ["-C", root, "init", "-q"]);
    execFileSync("git", ["-C", root, "add", "-A"]);
    const output: string[] = [];
    const io: CliIo = {
      stdout: (text) => output.push(text), stderr: () => {}, cwd: () => root,
      env: {}, stdoutIsTTY: false, stderrIsTTY: false,
    };
    const dependencies: CliDependencies = {
      version: "test", profiles: [claudeProfile, codexProfile], resolvePath: join,
      shellDialect: "posix",
      findRepositoryRoot, openGitSnapshot, probeGitStorageFormat,
      openTrackedWorktree, analyzeCurrent, analyzeDiff,
      openCase: async () => { throw new Error("not used"); },
    };
    expect(await runCli([".", "--json"], io, dependencies)).toBe(0);
    expect(JSON.parse(output[0]!)).toMatchObject({
      mode: "current", counts: { candidatePathCount: 3 },
    });
  });
});
