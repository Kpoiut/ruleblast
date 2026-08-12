import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findRepositoryRoot,
  GitSnapshotError,
  openGitSnapshot,
  openTrackedWorktree,
} from "../src/git.js";

const repositories: string[] = [];
const decoder = new TextDecoder();

async function withMockedFs<T>(
  mutateAfterLstat: (path: string, count: number) => void,
  action: (gitModule: typeof import("../src/git.js")) => Promise<T>,
): Promise<T> {
  let count = 0;
  vi.resetModules();
  vi.doMock("node:fs/promises", async (importOriginal) => {
    const original = await importOriginal<typeof import("node:fs/promises")>();
    return {
      ...original,
      lstat: async (...args: Parameters<typeof original.lstat>) => {
        try {
          const result = await original.lstat(...args);
          mutateAfterLstat(String(args[0]), ++count);
          return result;
        } catch (error) {
          mutateAfterLstat(String(args[0]), ++count);
          throw error;
        }
      },
    };
  });
  try {
    return await action(await import("../src/git.js"));
  } finally {
    vi.doUnmock("node:fs/promises");
    vi.resetModules();
  }
}

async function withMockedNodeLstat<T>(
  node: string,
  mutate: (count: number) => void,
  action: (gitModule: typeof import("../src/git.js")) => Promise<T>,
): Promise<T> {
  let count = 0;
  return withMockedFs((path) => {
    if (path === node) mutate(++count);
  }, action);
}


function git(directory: string, args: readonly string[]): Buffer {
  return execFileSync("git", ["-C", directory, ...args], { encoding: "buffer" });
}

function gitInput(directory: string, args: readonly string[], input: Buffer): Buffer {
  return execFileSync("git", ["-C", directory, ...args], { encoding: "buffer", input });
}

function objectExistsWithoutLazyFetch(directory: string, oid: string): boolean {
  try {
    execFileSync(
      "git",
      ["--no-replace-objects", "-C", directory, "cat-file", "-e", oid],
      {
        env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
        stdio: "ignore",
      },
    );
    return true;
  } catch {
    return false;
  }
}

function commitTree(directory: string, entries: readonly { mode: string; path: string; bytes: Buffer }[]): string {
  const records = entries.map(({ mode, path, bytes }) => {
    const blob = decoder.decode(gitInput(directory, ["hash-object", "-w", "--stdin"], bytes)).trim();
    return Buffer.from(`${mode} blob ${blob}\t${path}\0`);
  });
  const tree = decoder.decode(gitInput(directory, ["mktree", "-z"], Buffer.concat(records))).trim();
  const oid = decoder.decode(git(directory, ["commit-tree", tree, "-m", "tree"])).trim();
  git(directory, ["update-ref", "HEAD", oid]);
  return oid;
}

function repository(): string {
  const directory = mkdtempSync(join(tmpdir(), "ruleblast-git-"));
  repositories.push(directory);
  git(directory, ["init"]);
  git(directory, ["config", "user.name", "Ruleblast Tests"]);
  git(directory, ["config", "user.email", "tests@example.invalid"]);
  return directory;
}

function commit(directory: string, message = "snapshot"): string {
  git(directory, ["add", "-A"]);
  git(directory, ["commit", "-m", message]);
  return decoder.decode(git(directory, ["rev-parse", "HEAD"])).trim();
}

afterEach(() => {
  for (const directory of repositories.splice(0)) {
    rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

describe("Git commit snapshots", () => {
  it("finds a repository root from a nested directory", async () => {
    const root = repository();
    const nested = join(root, "a", "b", "c");
    mkdirSync(nested, { recursive: true });

    expect(await findRepositoryRoot(nested)).toBe(root.replace(/\\/g, "/"));
  });

  it("classifies an actual Git non-repository failure", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ruleblast-non-repo-"));
    repositories.push(directory);

    await expect(findRepositoryRoot(directory)).rejects.toEqual(
      expect.objectContaining<Partial<GitSnapshotError>>({
        name: "GitSnapshotError",
        code: "NOT_REPOSITORY",
      }),
    );
  });

  it("accepts only a full Git object ID returned while resolving a ref", async () => {
    const root = repository();
    writeFileSync(join(root, "tracked.txt"), "tracked");
    const oid = commit(root);

    expect((await openGitSnapshot(root, "HEAD")).ref.oid).toBe(oid);
  });

  it("classifies an actual missing-ref failure", async () => {
    const root = repository();

    await expect(openGitSnapshot(root, "missing-ref")).rejects.toEqual(
      expect.objectContaining<Partial<GitSnapshotError>>({
        name: "GitSnapshotError",
        code: "REF_NOT_FOUND",
      }),
    );
  });

  it("rejects a non-object-ID result while resolving a ref", async () => {
    const mockedExecFile = Object.assign((() => undefined) as unknown as typeof execFile, {
      [promisify.custom]: async () => ({
        stdout: Buffer.from("not-an-object-id\n"),
        stderr: Buffer.alloc(0),
      }),
    });
    vi.resetModules();
    vi.doMock("node:child_process", () => ({ execFile: mockedExecFile }));
    try {
      await expect(
        (async () => {
          const gitModule = await import("../src/git.js");
          return gitModule.openGitSnapshot("unused", "HEAD");
        })(),
      ).rejects.toThrow("Invalid Git object ID");
    } finally {
      vi.doUnmock("node:child_process");
      vi.resetModules();
    }
  });

  it("lists and reads commit blobs, including executable files", async () => {
    const root = repository();
    writeFileSync(join(root, "plain.txt"), "plain bytes");
    writeFileSync(join(root, "run.sh"), "#!/bin/sh\necho run\n");
    git(root, ["add", "plain.txt", "run.sh"]);
    git(root, ["update-index", "--chmod=+x", "run.sh"]);
    git(root, ["commit", "-m", "snapshot"]);
    const oid = decoder.decode(git(root, ["rev-parse", "HEAD"])).trim();

    const snapshot = await openGitSnapshot(root, "HEAD");
    expect(snapshot.ref).toEqual({ kind: "git", label: oid, oid });
    expect(await snapshot.listPaths()).toEqual(["plain.txt", "run.sh"]);
    expect(await snapshot.entry("plain.txt")).toEqual({ path: "plain.txt", kind: "file", executable: false });
    expect(await snapshot.entry("run.sh")).toEqual({ path: "run.sh", kind: "file", executable: true });
    expect(decoder.decode((await snapshot.read("plain.txt"))!)).toBe("plain bytes");
    const first = (await snapshot.read("run.sh"))!;
    first[0] = 0;
    expect(decoder.decode((await snapshot.read("run.sh"))!)).toBe("#!/bin/sh\necho run\n");
  });

  it("reads committed blobs larger than the default execFile buffer", async () => {
    const root = repository();
    const expected = Buffer.alloc(2 * 1024 * 1024, 0xa5);
    writeFileSync(join(root, "large.bin"), expected);
    commit(root);

    const snapshot = await openGitSnapshot(root, "HEAD");

    const actual = await snapshot.read("large.bin");
    expect(actual?.byteLength).toBe(expected.byteLength);
    expect(Buffer.compare(Buffer.from(actual!), expected)).toBe(0);
  });

  it("preserves space, Unicode, tabs, and newlines in paths using NUL-safe tree parsing", async () => {
    const root = repository();
    const paths = ["space name.txt", "café.txt", "tab\tname.txt", "line\nbreak.txt"];
    commitTree(root, paths.map((path) => ({ mode: "100644", path, bytes: Buffer.from(path) })));

    const snapshot = await openGitSnapshot(root, "HEAD");
    expect(await snapshot.listPaths()).toEqual(["café.txt", "line\nbreak.txt", "space name.txt", "tab\tname.txt"]);
    for (const path of paths) expect(Buffer.from((await snapshot.read(path))!)).toEqual(Buffer.from(path));
  });

  it("returns symlink target bytes when the platform permits creating symlinks", async () => {
    const root = repository();
    writeFileSync(join(root, "target.txt"), "target");
    try {
      symlinkSync("target.txt", join(root, "link"));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    commit(root);

    const snapshot = await openGitSnapshot(root, "HEAD");
    expect(await snapshot.entry("link")).toEqual({ path: "link", kind: "symlink", executable: false });
    expect(Buffer.from((await snapshot.read("link"))!)).toEqual(Buffer.from("target.txt"));
  });

  it("excludes gitlinks", async () => {
    const child = repository();
    writeFileSync(join(child, "child.txt"), "child");
    commit(child);
    const root = repository();
    git(root, ["-c", "protocol.file.allow=always", "submodule", "add", child, "vendor/child"]);
    commit(root);

    const snapshot = await openGitSnapshot(root, "HEAD");
    expect(await snapshot.listPaths()).toEqual([".gitmodules"]);
    expect(await snapshot.entry("vendor/child")).toBeNull();
  });

  it("resolves the ref once and remains immutable across branch and worktree changes", async () => {
    const root = repository();
    writeFileSync(join(root, "version.txt"), "one");
    const oid = commit(root, "one");
    const snapshot = await openGitSnapshot(root, "HEAD");
    writeFileSync(join(root, "version.txt"), "two");
    writeFileSync(join(root, "untracked.txt"), "not committed");
    commit(root, "two");

    expect(snapshot.ref).toEqual({ kind: "git", label: oid, oid });
    expect(decoder.decode((await snapshot.read("version.txt"))!)).toBe("one");
    expect(await snapshot.read("untracked.txt")).toBeNull();
  });

  it("reads the original committed blob after a replacement object is installed", async () => {
    const root = repository();
    writeFileSync(join(root, "version.txt"), "original");
    commit(root);
    const originalBlob = decoder.decode(git(root, ["rev-parse", "HEAD:version.txt"])).trim();
    const replacementBlob = decoder.decode(
      gitInput(root, ["hash-object", "-w", "--stdin"], Buffer.from("replacement")),
    ).trim();
    const snapshot = await openGitSnapshot(root, "HEAD");

    git(root, ["replace", originalBlob, replacementBlob]);

    expect(decoder.decode((await snapshot.read("version.txt"))!)).toBe("original");
  });

  it("does not lazy-fetch a missing promised blob", async () => {
    const remote = repository();
    writeFileSync(join(remote, "promised.txt"), "promised bytes");
    commit(remote);
    git(remote, ["config", "uploadpack.allowFilter", "true"]);
    const promisedBlob = decoder.decode(
      git(remote, ["rev-parse", "HEAD:promised.txt"]),
    ).trim();
    const cloneParent = mkdtempSync(join(tmpdir(), "ruleblast-promisor-"));
    repositories.push(cloneParent);
    git(cloneParent, [
      "clone",
      "--filter=blob:none",
      "--no-checkout",
      pathToFileURL(remote).href,
      "clone",
    ]);
    const clone = join(cloneParent, "clone");
    const snapshot = await openGitSnapshot(clone, "HEAD");
    expect(objectExistsWithoutLazyFetch(clone, promisedBlob)).toBe(false);
    const tracePath = join(cloneParent, "git-trace.json");
    const originalTrace = process.env.GIT_TRACE2_EVENT;
    process.env.GIT_TRACE2_EVENT = tracePath;

    try {
      await expect(snapshot.read("promised.txt")).rejects.toThrow();
    } finally {
      if (originalTrace === undefined) delete process.env.GIT_TRACE2_EVENT;
      else process.env.GIT_TRACE2_EVENT = originalTrace;
    }

    expect(objectExistsWithoutLazyFetch(clone, promisedBlob)).toBe(false);
    expect(readFileSync(tracePath, "utf8")).not.toContain("git-upload-pack");
  });

  it("does not invoke fsmonitor or modify the index", async () => {
    const root = repository();
    writeFileSync(join(root, "tracked.txt"), "tracked");
    commit(root);
    const sentinel = join(root, "fsmonitor-sentinel");
    writeFileSync(sentinel, "#!/bin/sh\ntouch fsmonitor-was-called\n");
    chmodSync(sentinel, 0o755);
    git(root, ["config", "core.fsmonitor", sentinel]);
    const index = join(root, ".git", "index");
    const beforeBytes = readFileSync(index);
    const beforeMtime = lstatSync(index).mtimeMs;

    await openGitSnapshot(root, "HEAD");

    expect(lstatSync(index).mtimeMs).toBe(beforeMtime);
    expect(readFileSync(index)).toEqual(beforeBytes);
    expect(() => lstatSync(join(root, "fsmonitor-was-called"))).toThrow();
  });
});

describe("tracked worktree snapshots", () => {
  it("captures an empty freshly initialized repository with no index", async () => {
    const root = repository();
    const snapshot = await openTrackedWorktree(root);
    expect(await snapshot.listPaths()).toEqual([]);
  });
  it("captures only tracked paths and eagerly copies modified bytes", async () => {
    const root = repository();
    writeFileSync(join(root, "tracked.txt"), "committed");
    commit(root);
    writeFileSync(join(root, "tracked.txt"), "modified");
    writeFileSync(join(root, "AGENTS.md"), "untracked");

    const snapshot = await openTrackedWorktree(root);
    writeFileSync(join(root, "tracked.txt"), "later");
    expect(await snapshot.listPaths()).toEqual(["tracked.txt"]);
    expect(decoder.decode((await snapshot.read("tracked.txt"))!)).toBe("modified");
    expect(await snapshot.read("AGENTS.md")).toBeNull();
  });

  it("omits deleted tracked files", async () => {
    const root = repository();
    writeFileSync(join(root, "gone.txt"), "committed");
    commit(root);
    rmSync(join(root, "gone.txt"));

    const snapshot = await openTrackedWorktree(root);
    expect(await snapshot.listPaths()).toEqual([]);
    expect(await snapshot.read("gone.txt")).toBeNull();
  });

  it("does not modify the index while capturing the overlay", async () => {
    const root = repository();
    writeFileSync(join(root, "tracked.txt"), "tracked");
    commit(root);
    const index = join(root, ".git", "index");
    const before = readFileSync(index);
    const mtime = lstatSync(index).mtimeMs;

    await openTrackedWorktree(root);

    expect(readFileSync(index)).toEqual(before);
    expect(lstatSync(index).mtimeMs).toBe(mtime);
  });

  it("keeps NUL-delimited unusual tracked names intact", async () => {
    const root = repository();
    const paths = ["space name.txt", "café.txt", "tab\tname.txt", "line\nbreak.txt"];
    try { for (const path of paths) writeFileSync(join(root, path), path); } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error;
    }
    commit(root);
    const snapshot = await openTrackedWorktree(root);
    expect(await snapshot.listPaths()).toEqual(["café.txt", "line\nbreak.txt", "space name.txt", "tab\tname.txt"]);
  });

  it("uses the actual node type for regular-to-symlink replacements", async () => {
    const root = repository();
    writeFileSync(join(root, "node"), "regular"); commit(root);
    rmSync(join(root, "node"));
    try { symlinkSync("outside-target", join(root, "node")); } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return; throw error;
    }
    const snapshot = await openTrackedWorktree(root);
    expect(await snapshot.entry("node")).toEqual({ path: "node", kind: "symlink", executable: false });
    expect(Buffer.from((await snapshot.read("node"))!)).toEqual(Buffer.from("outside-target"));
  });

  it("rejects a directory replacement with a typed error", async () => {
    const root = repository();
    writeFileSync(join(root, "node"), "regular"); commit(root);
    rmSync(join(root, "node")); mkdirSync(join(root, "node"));
    await expect(openTrackedWorktree(root)).rejects.toMatchObject({ code: "UNSUPPORTED_WORKTREE_NODE" });
  });

  it("rejects a tracked path whose existing ancestor is a symlink", async () => {
    const root = repository(); const outside = repository();
    mkdirSync(join(root, "dir")); writeFileSync(join(root, "dir", "tracked.txt"), "inside"); commit(root);
    writeFileSync(join(outside, "tracked.txt"), "outside bytes"); rmSync(join(root, "dir"), { recursive: true });
    try { symlinkSync(outside, join(root, "dir"), "junction"); } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return; throw error;
    }
    await expect(openTrackedWorktree(root)).rejects.toMatchObject({ code: "UNSUPPORTED_WORKTREE_NODE" });
  });

  it("rejects unmerged index stages before capture", async () => {
    const root = repository(); writeFileSync(join(root, "node"), "regular"); commit(root);
    const oid = decoder.decode(git(root, ["rev-parse", "HEAD:node"])).trim();
    gitInput(root, ["update-index", "--index-info"], Buffer.from(`100644 ${oid} 1\tnode\n`));
    await expect(openTrackedWorktree(root)).rejects.toMatchObject({ code: "UNMERGED_INDEX" });
  });

  it("uses the stage-zero blob for a missing skip-worktree path", async () => {
    const root = repository(); writeFileSync(join(root, "node"), "indexed"); commit(root);
    git(root, ["update-index", "--skip-worktree", "node"]); rmSync(join(root, "node"));
    const snapshot = await openTrackedWorktree(root);
    expect(await snapshot.listPaths()).toEqual(["node"]);
    expect(decoder.decode((await snapshot.read("node"))!)).toBe("indexed");
  });

  it("does not invoke an fsmonitor hook", async () => {
    const root = repository(); writeFileSync(join(root, "node"), "tracked"); commit(root);
    const sentinel = join(root, "fsmonitor-sentinel"); writeFileSync(sentinel, "#!/bin/sh\ntouch fsmonitor-was-called\n"); chmodSync(sentinel, 0o755);
    git(root, ["config", "core.fsmonitor", sentinel]);
    await openTrackedWorktree(root);
    expect(() => lstatSync(join(root, "fsmonitor-was-called"))).toThrow();
  });

  it("captures a stable symlink-to-regular replacement as a file", async () => {
    const root = repository(); writeFileSync(join(root, "target"), "target");
    try { symlinkSync("target", join(root, "node")); } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return; throw error;
    }
    commit(root); rmSync(join(root, "node")); writeFileSync(join(root, "node"), "regular");
    const snapshot = await openTrackedWorktree(root);
    expect(await snapshot.entry("node")).toEqual({ path: "node", kind: "file", executable: false });
    expect(decoder.decode((await snapshot.read("node"))!)).toBe("regular");
  });

  it("retries a deterministic regular-file mutation and returns second-attempt bytes", async () => {
    const root = repository(); const node = join(root, "node"); writeFileSync(node, "one"); commit(root);
    const snapshot = await withMockedFs((path, count) => {
      if (path === node && count === 2) writeFileSync(node, "two");
    }, ({ openTrackedWorktree: openTracked }) => openTracked(root));
    expect(decoder.decode((await snapshot.read("node"))!)).toBe("two");
  });

  it("fails when deterministic mutations invalidate both capture attempts", async () => {
    const root = repository(); const node = join(root, "node"); writeFileSync(node, "one"); commit(root);
    let version = 1;
    await expect(withMockedFs((path, count) => {
      if (path === node && (count === 2 || count === 4)) writeFileSync(node, `changed-${++version}`);
    }, ({ openTrackedWorktree: openTracked }) => openTracked(root))).rejects.toMatchObject({ code: "WORKTREE_CHANGED_DURING_SNAPSHOT" });
  });

  it("does not let a missing path restored during capture escape as a deletion", async () => {
    const root = repository(); const node = join(root, "node"); writeFileSync(node, "indexed"); commit(root); rmSync(node);
    const snapshot = await withMockedFs((path, count) => {
      if (path === node && count === 2) writeFileSync(node, "restored");
    }, ({ openTrackedWorktree: openTracked }) => openTracked(root));
    expect(await snapshot.listPaths()).toEqual(["node"]);
    expect(decoder.decode((await snapshot.read("node"))!)).toBe("restored");
  });

  it("does not let a symlink retarget during capture escape with stale target bytes", async () => {
    const root = repository(); const node = join(root, "node");
    try { symlinkSync("first", node); } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return; throw error;
    }
    commit(root);
    const snapshot = await withMockedFs((path, count) => {
      if (path === node && count === 2) { rmSync(node); symlinkSync("second", node); }
    }, ({ openTrackedWorktree: openTracked }) => openTracked(root));
    expect(await snapshot.entry("node")).toEqual({ path: "node", kind: "symlink", executable: false });
    expect(decoder.decode((await snapshot.read("node"))!)).toBe("second");
  });

  it("never returns transient symlink bytes when a target changes A-to-B-to-A", async () => {
    const root = repository(); const node = join(root, "node");
    try { symlinkSync("A", node); } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return; throw error;
    }
    commit(root);
    let changedToB = false; let restoredToA = false;
    await expect(withMockedNodeLstat(node, (count) => {
      if (count === 1) { rmSync(node); symlinkSync("B", node); changedToB = true; }
      if (count === 3) { rmSync(node); symlinkSync("A", node); restoredToA = true; }
    }, ({ openTrackedWorktree: openTracked }) => openTracked(root))).rejects.toMatchObject({ code: "WORKTREE_CHANGED_DURING_SNAPSHOT" });
    expect(changedToB).toBe(true);
    expect(restoredToA).toBe(true);
    expect(readlinkSync(node)).toBe("A");
  });

  it("returns detached entry records and byte copies", async () => {
    const root = repository(); writeFileSync(join(root, "node"), "bytes"); commit(root);
    const snapshot = await openTrackedWorktree(root); const entry = (await snapshot.entry("node"))!;
    entry.path = "changed"; entry.executable = true;
    const bytes = (await snapshot.read("node"))!; bytes[0] = 0;
    expect(await snapshot.entry("node")).toEqual({ path: "node", kind: "file", executable: false });
    expect(decoder.decode((await snapshot.read("node"))!)).toBe("bytes");
  });
});
