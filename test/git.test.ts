import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findRepositoryRoot, openGitSnapshot } from "../src/git.js";

const repositories: string[] = [];
const decoder = new TextDecoder();

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

  it("accepts only a full Git object ID returned while resolving a ref", async () => {
    const root = repository();
    writeFileSync(join(root, "tracked.txt"), "tracked");
    const oid = commit(root);

    expect((await openGitSnapshot(root, "HEAD")).ref.oid).toBe(oid);
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
