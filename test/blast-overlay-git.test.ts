import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { analyzePreparedDiff } from "../src/application/diff-analysis.js";
import {
  buildOverlayP1,
  OVERLAY_UNAVAILABLE,
  renderBlastOverlay,
} from "../src/application/blast-overlay.js";
import { cacheGitObjectSnapshot } from "../src/application/projection-boundary.js";
import {
  defaultProfileDefinitions,
  profilesForRealities,
} from "../src/application/profile-catalog.js";
import type { ProfileDefinition } from "../src/profiles/profile.js";
import {
  findRepositoryRoot,
  openGitSnapshot,
  openTrackedWorktree,
  probeGitStorageFormat,
} from "../src/git.js";
import { isWorktreeIdentitySource } from "../src/snapshot.js";
import { analyzeCurrent, analyzeDiff } from "../src/impact.js";
import { runCli, type CliDependencies, type CliIo } from "../src/cli.js";
import { openPackagedCase } from "../src/case.js";
import { claudeProfile } from "../src/profiles/claude.js";
import { codexProfile } from "../src/profiles/codex.js";
import type { GitObjectSnapshot, GitStorageObjectFormat } from "../src/snapshot.js";
import { compareCodePoints } from "../src/domain/repository-path.js";
import { identityDeltaFromGit } from "./git-identity-oracle.js";

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function write(root: string, relative: string, content: string): void {
  const path = join(root, ...relative.split("/"));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function gitBlobSha1(bytes: Buffer): string {
  return createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
}

type PublicManifest = {
  readonly beforeBlobs: Readonly<Record<string, string>>;
  readonly afterBlobs: Readonly<Record<string, string>>;
};

function publicFixture(name: string): { root: string; manifest: PublicManifest } {
  const root = join(dirname(fileURLToPath(import.meta.url)), "fixtures", name);
  return {
    root,
    manifest: JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as PublicManifest,
  };
}

function bindFixtureBytes(
  fixture: string,
  side: "before" | "after",
  blobs: Readonly<Record<string, string>>,
): void {
  for (const [path, oid] of Object.entries(blobs)) {
    const file = join(fixture, side, ...path.split("/"));
    const bytes = readFileSync(file);
    expect(gitBlobSha1(bytes), `sha1 ${side} ${path}`).toBe(oid);
    expect(
      execFileSync("git", ["hash-object", file], { encoding: "utf8" }).trim(),
      `hash-object ${side} ${path}`,
    ).toBe(oid);
  }
}

function copyTree(from: string, to: string): void {
  for (const name of readdirSync(from)) {
    const source = join(from, name);
    const destination = join(to, name);
    if (statSync(source).isDirectory()) {
      mkdirSync(destination, { recursive: true });
      copyTree(source, destination);
      continue;
    }
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
}

function initRepo(objectFormat?: GitStorageObjectFormat): string {
  const root = mkdtempSync(join(tmpdir(), "ruleblast-overlay-"));
  const init = objectFormat === undefined
    ? ["init"]
    : ["init", `--object-format=${objectFormat}`];
  git(root, init);
  git(root, ["config", "user.email", "overlay@example.test"]);
  git(root, ["config", "user.name", "overlay"]);
  git(root, ["config", "core.autocrlf", "false"]);
  return root;
}

function commit(root: string, message: string): string {
  git(root, ["add", "-A"]);
  git(root, ["commit", "-m", message]);
  return git(root, ["rev-parse", "HEAD"]);
}

function expectObservedMatchesGitIdentity(
  overlay: { readonly observedPaths: readonly { readonly path: string; readonly kind: string }[] },
  sources: readonly string[],
  root: string,
  beforeRef: string,
  afterRef: string,
): void {
  const excluded = new Set(sources);
  const expected = identityDeltaFromGit(root, beforeRef, afterRef)
    .filter((row) => !excluded.has(row.path))
    .sort((left, right) => compareCodePoints(left.path, right.path));
  const observed = [...overlay.observedPaths]
    .map((row) => ({ path: row.path, kind: row.kind }))
    .sort((left, right) => compareCodePoints(left.path, right.path));
  expect(observed).toEqual(expected);
}

function seedScopedPair(root: string): { beforeRef: string; afterRef: string } {
  write(root, "AGENTS.md", "root rules\n");
  write(root, "packages/api/AGENTS.md", "api before\n");
  write(root, "packages/api/in.ts", "in\n");
  write(root, "docs/out.md", "out\n");
  const beforeRef = commit(root, "seed");
  write(root, "packages/api/AGENTS.md", "api after\n");
  write(root, "packages/api/in.ts", "in changed\n");
  write(root, "docs/out.md", "out changed\n");
  return { beforeRef, afterRef: commit(root, "scoped") };
}

async function expectOverlayWall(
  before: GitObjectSnapshot,
  after: GitObjectSnapshot,
  pathCount: number | { readonly before: number; readonly after: number },
): Promise<void> {
  const expected = typeof pathCount === "number"
    ? { before: pathCount, after: pathCount }
    : pathCount;
  expect((await before.listPaths()).length).toBe(expected.before);
  expect((await after.listPaths()).length).toBe(expected.after);
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
  const ordered = [...baseline].sort((left, right) => left - right);
  const overlayOrdered = [...withOverlay].sort((left, right) => left - right);
  const median = (values: number[]): number =>
    values[Math.floor(values.length / 2)]!;
  const p95 = (values: number[]): number =>
    values[Math.max(0, Math.ceil(values.length * 0.95) - 1)]!;
  expect(median(overlayOrdered) - median(ordered)).toBeLessThan(500);
  expect(p95(overlayOrdered) - p95(ordered)).toBeLessThan(500);
}

async function overlayBetween(
  root: string,
  beforeRef: string,
  afterRef: string,
  profiles: readonly ProfileDefinition[] = defaultProfileDefinitions(),
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
    profiles,
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

describe("blast overlay on Git storage blob identity", () => {
  it("joins a scoped instruction edit into IN and OUTSIDE without reading blobs", async () => {
    const root = initRepo();
    const { beforeRef, afterRef } = seedScopedPair(root);

    const { overlay, sources, reads, before, after } = await overlayBetween(
      root,
      beforeRef,
      afterRef,
    );
    expect(sources).toEqual(["packages/api/AGENTS.md"]);
    expectObservedMatchesGitIdentity(overlay, sources, root, beforeRef, afterRef);
    expect(overlay.observedPathCount).toBe(2);
    expect(overlay.inBlastCount).toBe(1);
    expect(overlay.outsideBlastCount).toBe(1);
    expect(overlay.unresolvedCount).toBe(0);
    expect(overlay.inBlastCount + overlay.outsideBlastCount + overlay.unresolvedCount)
      .toBe(overlay.observedPathCount);
    const inPaths = overlay.observedPaths
      .filter((row) => row.relation === "IN_BLAST")
      .map((row) => row.path);
    const outPaths = overlay.observedPaths
      .filter((row) => row.relation === "OUTSIDE_BLAST")
      .map((row) => row.path);
    expect(inPaths).toEqual(["packages/api/in.ts"]);
    expect(outPaths).toEqual(["docs/out.md"]);
    expect(before.blobOid("packages/api/in.ts")).toMatch(/^[0-9a-f]{40}$/u);
    expect(after.blobOid("packages/api/in.ts")).toMatch(/^[0-9a-f]{40}$/u);
    expect(before.blobOid("packages/api/in.ts")).not.toBe(after.blobOid("packages/api/in.ts"));
    expect(before.blobOid("docs/out.md")).not.toBe(after.blobOid("docs/out.md"));
    expect(reads).toEqual({ before: 0, after: 0 });
    const text = renderBlastOverlay(overlay);
    expect(text).toContain("OTHER TRACKED CHANGES (selected realities)");
    expect(text).toContain("packages/api/in.ts");
    expect(text).toContain("docs/out.md");
  });

  it("seals the recorded openai/codex paste-burst topology as IN plus OUTSIDE", async () => {
    // Recorded 2026-08-17 from GitHub commit API. Full-tree replay of
    // 2651980bdf80 → 58e8f75b276b is still EXPLORING. This locks the join
    // on that pair's named paths: nested AGENTS.md added, same-folder
    // consumers modified, root-and-docs files added, root AGENTS.md unchanged.
    const publicPair = {
      repository: "https://github.com/openai/codex",
      before: "2651980bdf803ec3dd7d7540648de286e4de2ec2",
      after: "58e8f75b276bbc6bae5bde633137ceee399db6d9",
      unchangedRootAgentsBlob: "9c14089e5f869f4cfe54c8189db86d0e5b5b26e1",
    } as const;
    const inPaths = [
      "codex-rs/tui/src/bottom_pane/chat_composer.rs",
      "codex-rs/tui/src/bottom_pane/paste_burst.rs",
      "codex-rs/tui/src/bottom_pane/textarea.rs",
      "codex-rs/tui2/src/bottom_pane/chat_composer.rs",
      "codex-rs/tui2/src/bottom_pane/paste_burst.rs",
      "codex-rs/tui2/src/bottom_pane/textarea.rs",
    ] as const;
    const outsidePaths = [
      ".markdownlint-cli2.yaml",
      "docs/tui-chat-composer.md",
    ] as const;
    const sourcePaths = [
      "codex-rs/tui/src/bottom_pane/AGENTS.md",
      "codex-rs/tui2/src/bottom_pane/AGENTS.md",
    ] as const;

    const root = initRepo();
    write(root, "AGENTS.md", "root agents\n");
    for (const path of inPaths) write(root, path, `${path} before\n`);
    const beforeRef = commit(root, "seed");
    write(root, sourcePaths[0], "tui nest after\n");
    write(root, sourcePaths[1], "tui2 nest after\n");
    for (const path of inPaths) write(root, path, `${path} after\n`);
    for (const path of outsidePaths) write(root, path, `${path} added\n`);
    const afterRef = commit(root, "paste-burst topology");

    const { overlay, sources, before, after } = await overlayBetween(
      root,
      beforeRef,
      afterRef,
    );
    expectObservedMatchesGitIdentity(overlay, sources, root, beforeRef, afterRef);
    expect(publicPair.repository).toContain("openai/codex");
    expect(publicPair.unchangedRootAgentsBlob).toMatch(/^[0-9a-f]{40}$/u);
    expect(before.blobOid("AGENTS.md")).toBe(after.blobOid("AGENTS.md"));
    expect([...sources].sort()).toEqual([...sourcePaths]);
    expect(overlay.observedPathCount).toBe(inPaths.length + outsidePaths.length);
    expect(overlay.inBlastCount).toBe(inPaths.length);
    expect(overlay.outsideBlastCount).toBe(outsidePaths.length);
    expect(overlay.unresolvedCount).toBe(0);
    expect(
      overlay.observedPaths.filter((row) => row.relation === "IN_BLAST").map((row) => row.path),
    ).toEqual([...inPaths]);
    expect(
      overlay.observedPaths
        .filter((row) => row.relation === "OUTSIDE_BLAST")
        .map((row) => row.path),
    ).toEqual([...outsidePaths]);
  });

  it("joins public paste-burst bytes through real Git storage object identity", async () => {
    const fixture = join(
      dirname(fileURLToPath(import.meta.url)),
      "fixtures",
      "overlay-public-pair",
    );
    const manifest = JSON.parse(readFileSync(join(fixture, "manifest.json"), "utf8")) as {
      readonly beforeBlobs: Readonly<Record<string, string>>;
      readonly afterBlobs: Readonly<Record<string, string>>;
    };
    const root = initRepo();
    copyTree(join(fixture, "before"), root);
    const beforeRef = commit(root, "public before bytes");
    copyTree(join(fixture, "after"), root);
    const afterRef = commit(root, "public after bytes");
    const { overlay, before, after, sources } = await overlayBetween(
      root,
      beforeRef,
      afterRef,
    );
    for (const [path, oid] of Object.entries(manifest.beforeBlobs)) {
      expect(before.blobOid(path), path).toBe(oid);
    }
    for (const [path, oid] of Object.entries(manifest.afterBlobs)) {
      expect(after.blobOid(path), path).toBe(oid);
    }
    expectObservedMatchesGitIdentity(overlay, sources, root, beforeRef, afterRef);
    expect([...sources].sort()).toEqual([
      "codex-rs/tui/src/bottom_pane/AGENTS.md",
      "codex-rs/tui2/src/bottom_pane/AGENTS.md",
    ]);
    expect(overlay.inBlastCount).toBe(6);
    expect(overlay.outsideBlastCount).toBe(2);
    expect(overlay.unresolvedCount).toBe(0);
    expect(
      overlay.observedPaths.filter((row) => row.relation === "IN_BLAST").map((row) => row.path),
    ).toEqual([
      "codex-rs/tui/src/bottom_pane/chat_composer.rs",
      "codex-rs/tui/src/bottom_pane/paste_burst.rs",
      "codex-rs/tui/src/bottom_pane/textarea.rs",
      "codex-rs/tui2/src/bottom_pane/chat_composer.rs",
      "codex-rs/tui2/src/bottom_pane/paste_burst.rs",
      "codex-rs/tui2/src/bottom_pane/textarea.rs",
    ]);
    expect(
      overlay.observedPaths
        .filter((row) => row.relation === "OUTSIDE_BLAST")
        .map((row) => row.path),
    ).toEqual([
      ".markdownlint-cli2.yaml",
      "docs/tui-chat-composer.md",
    ]);
  });

  it("binds public fixture bytes to SHA-1, git hash-object, and tree blob oids", async () => {
    const fixture = join(
      dirname(fileURLToPath(import.meta.url)),
      "fixtures",
      "overlay-public-pair",
    );
    const manifest = JSON.parse(readFileSync(join(fixture, "manifest.json"), "utf8")) as {
      readonly beforeBlobs: Readonly<Record<string, string>>;
      readonly afterBlobs: Readonly<Record<string, string>>;
    };
    const check = (side: "before" | "after", blobs: Readonly<Record<string, string>>) => {
      for (const [path, oid] of Object.entries(blobs)) {
        const file = join(fixture, side, ...path.split("/"));
        const bytes = readFileSync(file);
        expect(gitBlobSha1(bytes), `sha1 ${side} ${path}`).toBe(oid);
        expect(
          execFileSync("git", ["hash-object", file], { encoding: "utf8" }).trim(),
          `hash-object ${side} ${path}`,
        ).toBe(oid);
      }
    };
    check("before", manifest.beforeBlobs);
    check("after", manifest.afterBlobs);
    const root = initRepo();
    copyTree(join(fixture, "before"), root);
    const beforeRef = commit(root, "before");
    copyTree(join(fixture, "after"), root);
    const afterRef = commit(root, "after");
    const { overlay, before, after, sources } = await overlayBetween(root, beforeRef, afterRef);
    expectObservedMatchesGitIdentity(overlay, sources, root, beforeRef, afterRef);
    for (const [path, oid] of Object.entries(manifest.beforeBlobs)) {
      expect(before.blobOid(path), `tree ${path}`).toBe(oid);
    }
    for (const [path, oid] of Object.entries(manifest.afterBlobs)) {
      expect(after.blobOid(path), `tree ${path}`).toBe(oid);
    }
  });

  it("keeps public-byte pair overlay wall inside the locked budget", async () => {
    const fixture = join(
      dirname(fileURLToPath(import.meta.url)),
      "fixtures",
      "overlay-public-pair",
    );
    const root = initRepo();
    copyTree(join(fixture, "before"), root);
    const beforeRef = commit(root, "before");
    copyTree(join(fixture, "after"), root);
    const afterRef = commit(root, "after");
    const format = await probeGitStorageFormat(root);
    if (format === null) throw new Error("storage format unavailable");
    await expectOverlayWall(
      cacheGitObjectSnapshot(await openGitSnapshot(root, beforeRef), format),
      cacheGitObjectSnapshot(await openGitSnapshot(root, afterRef), format),
      { before: 7, after: 11 },
    );
  });

  it("keeps the 2→206 nested-only shape at OUTSIDE 0", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "root\n");
    write(root, "codex-rs/tui/src/bottom_pane/AGENTS.md", "before nest\n");
    write(root, "codex-rs/tui/src/bottom_pane/chat_composer.rs", "composer before\n");
    write(root, "codex-rs/tui/src/bottom_pane/paste_burst.rs", "burst before\n");
    write(root, "docs/out.md", "stable\n");
    const beforeRef = commit(root, "seed");
    write(root, "codex-rs/tui/src/bottom_pane/AGENTS.md", "after nest\n");
    write(root, "codex-rs/tui/src/bottom_pane/chat_composer.rs", "composer after\n");
    write(root, "codex-rs/tui/src/bottom_pane/paste_burst.rs", "burst after\n");
    const afterRef = commit(root, "2-206 shape");
    const { overlay, sources } = await overlayBetween(root, beforeRef, afterRef);
    expectObservedMatchesGitIdentity(overlay, sources, root, beforeRef, afterRef);
    expect(sources).toEqual(["codex-rs/tui/src/bottom_pane/AGENTS.md"]);
    expect(overlay.outsideBlastCount).toBe(0);
    expect(overlay.inBlastCount).toBe(2);
    expect(overlay.observedPaths.map((row) => row.path)).toEqual([
      "codex-rs/tui/src/bottom_pane/chat_composer.rs",
      "codex-rs/tui/src/bottom_pane/paste_burst.rs",
    ]);
  });

  it("joins 2→206 public bytes through real Git and keeps OUTSIDE 0", async () => {
    const { root: fixture, manifest } = publicFixture("overlay-206");
    bindFixtureBytes(fixture, "before", manifest.beforeBlobs);
    bindFixtureBytes(fixture, "after", manifest.afterBlobs);
    expect(manifest.beforeBlobs["AGENTS.md"]).toBe(manifest.afterBlobs["AGENTS.md"]);
    const repo = initRepo();
    copyTree(join(fixture, "before"), repo);
    const beforeRef = commit(repo, "206 before");
    copyTree(join(fixture, "after"), repo);
    const afterRef = commit(repo, "206 after");
    const { overlay, before, after, sources } = await overlayBetween(
      repo,
      beforeRef,
      afterRef,
    );
    expectObservedMatchesGitIdentity(overlay, sources, repo, beforeRef, afterRef);
    for (const [path, oid] of Object.entries(manifest.beforeBlobs)) {
      expect(before.blobOid(path), path).toBe(oid);
    }
    for (const [path, oid] of Object.entries(manifest.afterBlobs)) {
      expect(after.blobOid(path), path).toBe(oid);
    }
    expect(sources).toEqual(["codex-rs/tui/src/bottom_pane/AGENTS.md"]);
    expect(overlay.outsideBlastCount).toBe(0);
    expect(overlay.inBlastCount).toBe(2);
    expect(overlay.unresolvedCount).toBe(0);
    expect(overlay.observedPaths).toEqual([
      {
        path: "codex-rs/tui/src/bottom_pane/chat_composer.rs",
        kind: "MODIFY",
        relation: "IN_BLAST",
      },
      {
        path: "codex-rs/tui/src/bottom_pane/paste_burst.rs",
        kind: "MODIFY",
        relation: "IN_BLAST",
      },
    ]);
  });

  it("does not treat an instruction-source-only content edit as OTHER", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "before\n");
    write(root, "src/app.ts", "app\n");
    const beforeRef = commit(root, "seed");
    write(root, "AGENTS.md", "after\n");
    const afterRef = commit(root, "instruction only");
    const { overlay, sources } = await overlayBetween(root, beforeRef, afterRef);
    expectObservedMatchesGitIdentity(overlay, sources, root, beforeRef, afterRef);
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
    expectObservedMatchesGitIdentity(overlay, sources, root, beforeRef, afterRef);
    expect(sources).not.toContain("GEMINI.md");
    expect(overlay.observedPaths.map((row) => row.path)).toContain("GEMINI.md");
  });

  it("treats GEMINI.md as a selected-reality source when Gemini is opted in", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "root\n");
    write(root, "src/app.ts", "app\n");
    const beforeRef = commit(root, "seed");
    write(root, "GEMINI.md", "gemini\n");
    write(root, "src/app.ts", "app changed\n");
    const afterRef = commit(root, "gemini plus consumer");
    const { overlay, sources } = await overlayBetween(
      root,
      beforeRef,
      afterRef,
      profilesForRealities(["google/gemini-cli@1"]),
    );
    expectObservedMatchesGitIdentity(overlay, sources, root, beforeRef, afterRef);
    expect(sources).toContain("GEMINI.md");
    expect(overlay.observedPaths.map((row) => row.path)).not.toContain("GEMINI.md");
    expect(overlay.observedPaths.map((row) => row.path)).toContain("src/app.ts");
  });

  it("does not treat a gitlink as OTHER", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "root\n");
    write(root, "docs/out.md", "out\n");
    const beforeRef = commit(root, "seed");
    const commitOid = git(root, ["rev-parse", "HEAD"]);
    git(root, ["update-index", "--add", "--cacheinfo", `160000,${commitOid},vendor/lib`]);
    write(root, "docs/out.md", "out changed\n");
    const afterRef = commit(root, "gitlink plus outside");
    const { overlay, sources } = await overlayBetween(root, beforeRef, afterRef);
    expectObservedMatchesGitIdentity(overlay, sources, root, beforeRef, afterRef);
    expect(overlay.observedPaths.map((row) => row.path)).toEqual(["docs/out.md"]);
    expect(overlay.observedPaths.map((row) => row.path)).not.toContain("vendor/lib");
  });

  it("joins IN and OUTSIDE on a sha256 storage repo when Git can create one", async ({ skip }) => {
    let root: string;
    try {
      root = initRepo("sha256");
    } catch {
      skip("Git cannot initialize --object-format=sha256 repositories");
      return;
    }
    const { beforeRef, afterRef } = seedScopedPair(root);
    const format = await probeGitStorageFormat(root);
    if (format !== "sha256") {
      skip("probeGitStorageFormat did not report sha256 on a sha256-initialized repo");
      return;
    }
    const { overlay, before, after, sources } = await overlayBetween(root, beforeRef, afterRef);
    expectObservedMatchesGitIdentity(overlay, sources, root, beforeRef, afterRef);
    expect(before.blobOid("packages/api/in.ts")).toMatch(/^[0-9a-f]{64}$/u);
    expect(after.blobOid("docs/out.md")).toMatch(/^[0-9a-f]{64}$/u);
    expect(overlay.inBlastCount).toBe(1);
    expect(overlay.outsideBlastCount).toBe(1);
    expect(overlay.observedPaths.map((row) => row.path)).toEqual([
      "docs/out.md",
      "packages/api/in.ts",
    ]);
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
    expectObservedMatchesGitIdentity(overlay, sources, root, beforeRef, afterRef);
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
    const { overlay, before, after, sources } = await overlayBetween(root, beforeRef, afterRef);
    expectObservedMatchesGitIdentity(overlay, sources, root, beforeRef, afterRef);
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
    await expectOverlayWall(
      cacheGitObjectSnapshot(await openGitSnapshot(root, beforeRef), format),
      cacheGitObjectSnapshot(await openGitSnapshot(root, afterRef), format),
      84,
    );
  });

  it("keeps A0 pair overlay wall inside the locked budget", async () => {
    const root = initRepo();
    const { beforeRef, afterRef } = seedScopedPair(root);
    const format = await probeGitStorageFormat(root);
    if (format === null) throw new Error("storage format unavailable");
    await expectOverlayWall(
      cacheGitObjectSnapshot(await openGitSnapshot(root, beforeRef), format),
      cacheGitObjectSnapshot(await openGitSnapshot(root, afterRef), format),
      4,
    );
  });
});

describe("CLI Git pair overlay", () => {
  function cliAt(
    root: string,
    overrides: Partial<CliDependencies> = {},
  ): { io: CliIo; dependencies: CliDependencies; stdout: string[] } {
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
      probeGitStorageFormat,
      analyzeCurrent,
      analyzeDiff,
      openCase: openPackagedCase,
      ...overrides,
    };
    return { io, dependencies, stdout };
  }

  it("prints the overlay on human Git-to-Git text and omits it from JSON", async () => {
    const root = initRepo();
    const { beforeRef, afterRef } = seedScopedPair(root);
    const text = cliAt(root);
    expect(await runCli(
      ["diff", beforeRef, "--to", afterRef, "--color=never"],
      text.io,
      text.dependencies,
    )).toBe(0);
    const printed = text.stdout.join("");
    expect(printed).toContain("OTHER TRACKED CHANGES (selected realities)");
    expect(printed).toContain("CHANGE ALIGNMENT (selected realities; not actor telemetry)");
    expect(printed).toContain("Git storage blob-object identity");
    expect(printed).toContain("WORK MAP (selected realities; not actor telemetry)");
    expect(printed).toContain("later work here inherits the instruction edit");
    expect(printed).toContain("later work here does not inherit the instruction edit");
    expect(printed).toContain("next: ruleblast explain");
    expect(printed).toContain("packages/api/in.ts");
    expect(printed).toContain("docs/out.md");

    const json = cliAt(root);
    expect(await runCli(
      ["diff", beforeRef, "--to", afterRef, "--json"],
      json.io,
      json.dependencies,
    )).toBe(0);
    expect(json.stdout.join("")).not.toContain("OTHER TRACKED CHANGES");
    expect(json.stdout.join("")).not.toContain("CHANGE ALIGNMENT");
    expect(json.stdout.join("")).not.toContain("WORK MAP");
    const parsed = JSON.parse(json.stdout.join("")) as { readonly schemaVersion: number };
    expect(parsed.schemaVersion).toBe(1);
  });

  it("probes Git storage format once on a human Git pair", async () => {
    const root = initRepo();
    const { beforeRef, afterRef } = seedScopedPair(root);
    const probe = vi.fn(probeGitStorageFormat);
    const once = cliAt(root, { probeGitStorageFormat: probe });
    expect(await runCli(
      ["diff", beforeRef, "--to", afterRef, "--color=never"],
      once.io,
      once.dependencies,
    )).toBe(0);
    expect(probe).toHaveBeenCalledOnce();
    expect(once.stdout.join("")).toContain("OTHER TRACKED CHANGES (selected realities)");
  });

  it("keeps receipt and witness text overlay-bearing and JSON overlay-free", async () => {
    const root = initRepo();
    const { beforeRef, afterRef } = seedScopedPair(root);
    const receipt = cliAt(root);
    expect(await runCli(
      ["diff", beforeRef, "--to", afterRef, "--receipt", "--color=never"],
      receipt.io,
      receipt.dependencies,
    )).toBe(0);
    expect(receipt.stdout.join("")).toContain("RULEBLAST PROOF");
    expect(receipt.stdout.join("")).toContain("OTHER TRACKED CHANGES (selected realities)");

    const witness = cliAt(root);
    expect(await runCli(
      ["diff", beforeRef, "--to", afterRef, "--witness", "--color=never"],
      witness.io,
      witness.dependencies,
    )).toBe(0);
    expect(witness.stdout.join("")).toContain("WHY this resolution");
    expect(witness.stdout.join("")).toContain("OTHER TRACKED CHANGES (selected realities)");

    const witnessJson = cliAt(root);
    expect(await runCli(
      ["diff", beforeRef, "--to", afterRef, "--json", "--witness"],
      witnessJson.io,
      witnessJson.dependencies,
    )).toBe(0);
    expect(witnessJson.stdout.join("")).not.toContain("OTHER TRACKED CHANGES");
  });

  it("drops GEMINI.md from OTHER when Gemini is a selected reality", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "root\n");
    write(root, "src/app.ts", "app\n");
    const beforeRef = commit(root, "seed");
    write(root, "GEMINI.md", "gemini\n");
    write(root, "src/app.ts", "app changed\n");
    const afterRef = commit(root, "gemini");
    const run = cliAt(root);
    expect(await runCli(
      [
        "diff", beforeRef, "--to", afterRef,
        "--reality", "google/gemini-cli@1", "--color=never",
      ],
      run.io,
      run.dependencies,
    )).toBe(0);
    const overlay = run.stdout.join("").slice(
      run.stdout.join("").indexOf("OTHER TRACKED CHANGES"),
    );
    expect(overlay).toContain("src/app.ts");
    expect(overlay).not.toContain("GEMINI.md");
  });

  it("does not probe or print overlay on explain of a Git pair", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "root\n");
    write(root, "src/app.ts", "app\n");
    const beforeRef = commit(root, "seed");
    write(root, "src/app.ts", "app changed\n");
    const afterRef = commit(root, "edit");
    const probe = vi.fn(async () => {
      throw new Error("explain must not probe storage format");
    });
    const run = cliAt(root, { probeGitStorageFormat: probe });
    expect(await runCli(
      [
        "explain", "src/app.ts", "--from", beforeRef, "--to", afterRef,
        "--color=never",
      ],
      run.io,
      run.dependencies,
    )).toBe(0);
    expect(probe).not.toHaveBeenCalled();
    expect(run.stdout.join("")).not.toContain("OTHER TRACKED CHANGES");
  });

  it("binds dirty worktree bytes to Git blob identity without reading during overlay", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "root rules\n");
    write(root, "packages/api/AGENTS.md", "api before\n");
    write(root, "packages/api/in.ts", "in\n");
    write(root, "docs/out.md", "out\n");
    const beforeRef = commit(root, "seed");
    write(root, "packages/api/AGENTS.md", "api after\n");
    write(root, "packages/api/in.ts", "in changed\n");
    write(root, "docs/out.md", "out changed\n");
    const before = await openGitSnapshot(root, beforeRef);
    const worktree = await openTrackedWorktree(root);
    expect(isWorktreeIdentitySource(worktree)).toBe(true);
    if (!isWorktreeIdentitySource(worktree)) return;
    const format = await probeGitStorageFormat(root);
    expect(format).toBe("sha1");
    const after = worktree.withObjectIdentity(format!);
    const dirtyIn = readFileSync(join(root, "packages/api/in.ts"));
    expect(after.blobOid("packages/api/in.ts")).toBe(gitBlobSha1(dirtyIn));
    expect(after.blobOid("packages/api/in.ts")).toBe(
      execFileSync("git", ["-C", root, "hash-object", "packages/api/in.ts"], {
        encoding: "utf8",
      }).trim(),
    );
    expect(after.blobOid("AGENTS.md")).toBe(before.blobOid("AGENTS.md"));
    expect(after.blobOid("packages/api/in.ts")).not.toBe(before.blobOid("packages/api/in.ts"));
    const wrappedBefore = cacheGitObjectSnapshot(before, format!);
    const wrappedAfter = cacheGitObjectSnapshot(after, format!);
    const result = await analyzePreparedDiff({
      before: wrappedBefore,
      after: wrappedAfter,
      profiles: defaultProfileDefinitions(),
    });
    const overlay = await buildOverlayP1(wrappedBefore, wrappedAfter, result);
    expect(overlay.inBlastCount).toBe(1);
    expect(overlay.outsideBlastCount).toBe(1);
    expect(overlay.observedPaths.map((row) => row.path)).toEqual([
      "docs/out.md",
      "packages/api/in.ts",
    ]);
  });

  it("prints the overlay on human Git-to-WORKTREE text and omits it from JSON", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "root rules\n");
    write(root, "packages/api/AGENTS.md", "api before\n");
    write(root, "packages/api/in.ts", "in\n");
    write(root, "docs/out.md", "out\n");
    commit(root, "seed");
    write(root, "packages/api/AGENTS.md", "api after\n");
    write(root, "packages/api/in.ts", "in changed\n");
    write(root, "docs/out.md", "out changed\n");
    const probe = vi.fn(probeGitStorageFormat);
    const text = cliAt(root, { probeGitStorageFormat: probe });
    expect(await runCli(["diff", "--color=never"], text.io, text.dependencies)).toBe(0);
    expect(probe).toHaveBeenCalledOnce();
    const printed = text.stdout.join("");
    expect(printed).toContain("OTHER TRACKED CHANGES (selected realities)");
    expect(printed).toContain("CHANGE ALIGNMENT (selected realities; not actor telemetry)");
    expect(printed).toContain("captured worktree blob identity");
    expect(printed).toContain("WORK MAP (selected realities; not actor telemetry)");
    expect(printed).toContain("packages/api/in.ts");
    expect(printed).toContain("docs/out.md");
    expect(printed).toContain("later work here inherits the instruction edit");
    expect(printed).toContain("later work here does not inherit the instruction edit");

    const json = cliAt(root);
    expect(await runCli(["diff", "--json"], json.io, json.dependencies)).toBe(0);
    expect(json.stdout.join("")).not.toContain("OTHER TRACKED CHANGES");
    expect(json.stdout.join("")).not.toContain("CHANGE ALIGNMENT");
    expect(json.stdout.join("")).not.toContain("WORK MAP");
    expect(JSON.parse(json.stdout.join(""))).toMatchObject({ schemaVersion: 1 });
  });

  it("does not probe storage format on --json", async () => {
    const root = initRepo();
    write(root, "AGENTS.md", "root\n");
    write(root, "src/app.ts", "app\n");
    const beforeRef = commit(root, "seed");
    write(root, "src/app.ts", "app changed\n");
    const afterRef = commit(root, "edit");
    const probe = vi.fn(async () => {
      throw new Error("json must not probe storage format");
    });
    const json = cliAt(root, { probeGitStorageFormat: probe });
    expect(await runCli(
      ["diff", beforeRef, "--to", afterRef, "--json"],
      json.io,
      json.dependencies,
    )).toBe(0);
    expect(probe).not.toHaveBeenCalled();
    expect(json.stdout.join("")).not.toContain("OTHER TRACKED CHANGES");
    expect(JSON.parse(json.stdout.join(""))).toMatchObject({ schemaVersion: 1 });
  });

  it("prints unavailable and keeps exit 0 when blob identity cannot be established", async () => {
    const root = initRepo();
    const { beforeRef, afterRef } = seedScopedPair(root);
    const probe = vi.fn(async (_root: string) => null);
    const run = cliAt(root, { probeGitStorageFormat: probe });
    expect(await runCli(
      ["diff", beforeRef, "--to", afterRef, "--color=never"],
      run.io,
      run.dependencies,
    )).toBe(0);
    expect(probe).toHaveBeenCalledOnce();
    expect(String(probe.mock.calls[0]?.[0]).replaceAll("\\", "/"))
      .toBe(root.replaceAll("\\", "/"));
    const printed = run.stdout.join("");
    const overlay = printed.slice(printed.indexOf("OTHER TRACKED CHANGES"));
    expect(overlay).toContain(OVERLAY_UNAVAILABLE.trim());
    expect(overlay).not.toContain("IN THIS BLAST");
    expect(overlay).not.toContain("WORK MAP");
    expect(overlay).not.toContain("packages/api/in.ts");
    expect(printed).toContain("packages/api/AGENTS.md");
  });
});
