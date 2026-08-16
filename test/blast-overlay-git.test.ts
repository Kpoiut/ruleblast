import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzePreparedDiff } from "../src/application/diff-analysis.js";
import {
  buildOverlayP1,
  renderBlastOverlay,
} from "../src/application/blast-overlay.js";
import { cacheGitObjectSnapshot } from "../src/application/projection-boundary.js";
import { defaultProfileDefinitions } from "../src/application/profile-catalog.js";
import {
  findRepositoryRoot,
  openGitSnapshot,
  openTrackedWorktree,
  probeGitStorageFormat,
} from "../src/git.js";
import { analyzeCurrent, analyzeDiff } from "../src/impact.js";
import { runCli, type CliDependencies, type CliIo } from "../src/cli.js";
import { openPackagedCase } from "../src/case.js";
import { claudeProfile } from "../src/profiles/claude.js";
import { codexProfile } from "../src/profiles/codex.js";
import type { GitObjectSnapshot, GitStorageObjectFormat } from "../src/snapshot.js";

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function write(root: string, relative: string, content: string): void {
  const path = join(root, ...relative.split("/"));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function initRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "ruleblast-overlay-"));
  git(root, ["init"]);
  git(root, ["config", "user.email", "overlay@example.test"]);
  git(root, ["config", "user.name", "overlay"]);
  return root;
}

function commit(root: string, message: string): string {
  git(root, ["add", "-A"]);
  git(root, ["commit", "-m", message]);
  return git(root, ["rev-parse", "HEAD"]);
}

async function overlayBetween(
  root: string,
  beforeRef: string,
  afterRef: string,
): Promise<{
  readonly format: GitStorageObjectFormat;
  readonly before: GitObjectSnapshot;
  readonly after: GitObjectSnapshot;
  readonly overlay: Awaited<ReturnType<typeof buildOverlayP1>>;
  readonly sources: readonly string[];
  readonly reads: { before: number; after: number };
}> {
  const format = await probeGitStorageFormat(root);
  if (format === null) throw new Error("storage format unavailable");
  const rawBefore = await openGitSnapshot(root, beforeRef);
  const rawAfter = await openGitSnapshot(root, afterRef);
  const before = cacheGitObjectSnapshot(rawBefore, format);
  const after = cacheGitObjectSnapshot(rawAfter, format);
  const reads = { before: 0, after: 0 };
  const countingBefore: GitObjectSnapshot = {
    get ref() { return before.ref; },
    listPaths: () => before.listPaths(),
    entry: (path) => before.entry(path),
    blobOid: (path) => before.blobOid(path),
    async read(path) {
      reads.before += 1;
      return before.read(path);
    },
  };
  const countingAfter: GitObjectSnapshot = {
    get ref() { return after.ref; },
    listPaths: () => after.listPaths(),
    entry: (path) => after.entry(path),
    blobOid: (path) => after.blobOid(path),
    async read(path) {
      reads.after += 1;
      return after.read(path);
    },
  };
  const result = await analyzePreparedDiff({
    before,
    after,
    profiles: defaultProfileDefinitions(),
  });
  const overlay = await buildOverlayP1(countingBefore, countingAfter, result);
  return {
    format,
    before,
    after,
    overlay,
    sources: result.changedInstructionSources.map(
      (change) => change.afterPath ?? change.beforePath ?? "",
    ),
    reads,
  };
}

describe("blast overlay on Git tree blob identity", () => {
  it("joins a scoped instruction edit into IN and OUTSIDE without reading blobs", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "root rules\n");
    write(root, "packages/api/AGENTS.md", "api before\n");
    write(root, "packages/api/in.ts", "in\n");
    write(root, "docs/out.md", "out\n");
    const beforeRef = commit(root, "seed");
    write(root, "packages/api/AGENTS.md", "api after\n");
    write(root, "packages/api/in.ts", "in changed\n");
    write(root, "docs/out.md", "out changed\n");
    const afterRef = commit(root, "scoped instruction plus mixed content");

    const { overlay, sources, reads } = await overlayBetween(root, beforeRef, afterRef);
    expect(sources).toContain("packages/api/AGENTS.md");
    expect(overlay.observedPathCount).toBeGreaterThanOrEqual(2);
    expect(overlay.inBlastCount).toBeGreaterThanOrEqual(1);
    expect(overlay.outsideBlastCount).toBeGreaterThanOrEqual(1);
    expect(overlay.inBlastCount + overlay.outsideBlastCount + overlay.unresolvedCount)
      .toBe(overlay.observedPathCount);
    const inPaths = overlay.observedPaths
      .filter((row) => row.relation === "IN_BLAST")
      .map((row) => row.path);
    const outPaths = overlay.observedPaths
      .filter((row) => row.relation === "OUTSIDE_BLAST")
      .map((row) => row.path);
    expect(inPaths).toContain("packages/api/in.ts");
    expect(outPaths).toContain("docs/out.md");
    expect(inPaths).not.toContain("packages/api/AGENTS.md");
    expect(outPaths).not.toContain("packages/api/AGENTS.md");
    expect(reads).toEqual({ before: 0, after: 0 });
    const text = renderBlastOverlay(overlay);
    expect(text).toContain("OTHER TRACKED CHANGES (selected realities)");
    expect(text).toContain("packages/api/in.ts");
    expect(text).toContain("docs/out.md");
  });

  it("does not treat an instruction-source-only content edit as OTHER", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "before\n");
    write(root, "src/app.ts", "app\n");
    const beforeRef = commit(root, "seed");
    write(root, "AGENTS.md", "after\n");
    const afterRef = commit(root, "instruction only");
    const { overlay, sources } = await overlayBetween(root, beforeRef, afterRef);
    expect(sources).toContain("AGENTS.md");
    expect(overlay.observedPathCount).toBe(0);
  });

  it("keeps GEMINI.md outside selected-reality sources on the default pair", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "root\n");
    write(root, "src/app.ts", "app\n");
    const beforeRef = commit(root, "seed");
    write(root, "GEMINI.md", "gemini\n");
    write(root, "src/app.ts", "app changed\n");
    const afterRef = commit(root, "gemini plus consumer");
    const { overlay, sources } = await overlayBetween(root, beforeRef, afterRef);
    expect(sources).not.toContain("GEMINI.md");
    expect(overlay.observedPaths.map((row) => row.path)).toContain("GEMINI.md");
  });

  it("treats notes.md → AGENTS.md as source ADD plus OTHER DELETE", async () => {
    const root = initRepo();
    write(root, "notes.md", "# Instructions\n");
    write(root, "src/app.ts", "app\n");
    const beforeRef = commit(root, "notes");
    git(root, ["rm", "notes.md"]);
    write(root, "AGENTS.md", "# Instructions\n");
    const afterRef = commit(root, "rename notes to AGENTS");
    const { overlay, sources } = await overlayBetween(root, beforeRef, afterRef);
    expect(sources).toContain("AGENTS.md");
    const deleted = overlay.observedPaths.find((row) => row.path === "notes.md");
    expect(deleted).toEqual({
      path: "notes.md",
      kind: "DELETE",
      relation: "UNRESOLVED",
    });
  });

  it("does not treat same-OID mode or kind flips as OTHER", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "root\n");
    write(root, "mode.sh", "echo hi\n");
    write(root, "kind.txt", "hello");
    const beforeRef = commit(root, "seed");
    git(root, ["update-index", "--chmod=+x", "mode.sh"]);
    const blob = git(root, ["rev-parse", "HEAD:kind.txt"]);
    git(root, ["update-index", "--add", "--cacheinfo", `120000,${blob},kind.txt`]);
    const afterRef = commit(root, "mode and kind same oid");
    const { overlay, before, after } = await overlayBetween(root, beforeRef, afterRef);
    expect(before.blobOid("mode.sh")).toBe(after.blobOid("mode.sh"));
    expect(before.blobOid("kind.txt")).toBe(after.blobOid("kind.txt"));
    expect(overlay.observedPaths.map((row) => row.path)).not.toContain("mode.sh");
    expect(overlay.observedPaths.map((row) => row.path)).not.toContain("kind.txt");
  });

  it("keeps overlay wall cost inside the locked Git-pair budget", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "root\n");
    for (let index = 0; index < 80; index += 1) {
      write(root, `fill/f${String(index).padStart(2, "0")}.txt`, "x\n");
    }
    write(root, "packages/api/AGENTS.md", "api before\n");
    write(root, "packages/api/in.ts", "in\n");
    write(root, "docs/out.md", "out\n");
    const beforeRef = commit(root, "wide seed");
    write(root, "packages/api/AGENTS.md", "api after\n");
    write(root, "packages/api/in.ts", "in changed\n");
    write(root, "docs/out.md", "out changed\n");
    const afterRef = commit(root, "wide edit");
    const format = await probeGitStorageFormat(root);
    if (format === null) throw new Error("storage format unavailable");
    const before = cacheGitObjectSnapshot(await openGitSnapshot(root, beforeRef), format);
    const after = cacheGitObjectSnapshot(await openGitSnapshot(root, afterRef), format);
    const profiles = defaultProfileDefinitions();
    const baseline: number[] = [];
    const withOverlay: number[] = [];
    for (let sample = 0; sample < 4; sample += 1) {
      let started = performance.now();
      const result = await analyzePreparedDiff({ before, after, profiles });
      baseline.push(performance.now() - started);
      started = performance.now();
      const again = await analyzePreparedDiff({ before, after, profiles });
      await buildOverlayP1(before, after, again);
      withOverlay.push(performance.now() - started);
      expect(again.schemaVersion).toBe(result.schemaVersion);
    }
    const median = (values: number[]): number =>
      [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)]!;
    expect(median(withOverlay) - median(baseline)).toBeLessThan(500);
  });
});

describe("CLI Git pair overlay", () => {
  function cliAt(root: string): { io: CliIo; dependencies: CliDependencies; stdout: string[] } {
    const stdout: string[] = [];
    const io: CliIo = {
      stdout: (text) => { stdout.push(text); },
      stderr: () => {},
      cwd: () => root,
      env: {},
      stdoutIsTTY: false,
    };
    const dependencies: CliDependencies = {
      version: "test",
      profiles: [claudeProfile, codexProfile],
      resolvePath: join,
      shellDialect: "posix",
      findRepositoryRoot,
      openGitSnapshot,
      openTrackedWorktree,
      analyzeCurrent,
      analyzeDiff,
      openCase: openPackagedCase,
    };
    return { io, dependencies, stdout };
  }

  it("prints the overlay on human Git-to-Git text and omits it from JSON", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "root rules\n");
    write(root, "packages/api/AGENTS.md", "api before\n");
    write(root, "packages/api/in.ts", "in\n");
    write(root, "docs/out.md", "out\n");
    const beforeRef = commit(root, "seed");
    write(root, "packages/api/AGENTS.md", "api after\n");
    write(root, "packages/api/in.ts", "in changed\n");
    write(root, "docs/out.md", "out changed\n");
    const afterRef = commit(root, "edit");
    const text = cliAt(root);
    expect(await runCli(
      ["diff", beforeRef, "--to", afterRef, "--color=never"],
      text.io,
      text.dependencies,
    )).toBe(0);
    const printed = text.stdout.join("");
    expect(printed).toContain("OTHER TRACKED CHANGES (selected realities)");
    expect(printed).toContain("packages/api/in.ts");
    expect(printed).toContain("docs/out.md");

    const json = cliAt(root);
    expect(await runCli(
      ["diff", beforeRef, "--to", afterRef, "--json"],
      json.io,
      json.dependencies,
    )).toBe(0);
    expect(json.stdout.join("")).not.toContain("OTHER TRACKED CHANGES");
    const parsed = JSON.parse(json.stdout.join("")) as { readonly schemaVersion: number };
    expect(parsed.schemaVersion).toBe(1);
  });

  it("does not print overlay for HEAD to WORKTREE", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "root\n");
    write(root, "src/app.ts", "app\n");
    commit(root, "seed");
    write(root, "src/app.ts", "dirty\n");
    const run = cliAt(root);
    expect(await runCli(["diff", "--color=never"], run.io, run.dependencies)).toBe(0);
    expect(run.stdout.join("")).not.toContain("OTHER TRACKED CHANGES");
  });
});
