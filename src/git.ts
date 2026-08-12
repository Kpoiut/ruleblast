import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SnapshotRef } from "./model.js";
import type { RepositorySnapshot, SnapshotEntry } from "./snapshot.js";

const execFileAsync = promisify(execFile);
const MAX_GIT_OUTPUT_BYTES = 256 * 1024 * 1024;

interface TreeEntry extends SnapshotEntry {
  readonly oid: string;
}

function compareCodePoints(left: string, right: string): number {
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftPoint = left.codePointAt(leftIndex);
    const rightPoint = right.codePointAt(rightIndex);
    if (leftPoint === undefined || rightPoint === undefined) {
      throw new Error("Unable to compare Git paths");
    }
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
    leftIndex += leftPoint > 0xffff ? 2 : 1;
    rightIndex += rightPoint > 0xffff ? 2 : 1;
  }
  return leftIndex === left.length ? (rightIndex === right.length ? 0 : -1) : 1;
}

async function runGit(directory: string, args: readonly string[]): Promise<Buffer> {
  const result = await execFileAsync(
    "git",
    [
      "--no-optional-locks",
      "--no-replace-objects",
      "-c",
      "core.fsmonitor=false",
      "-C",
      directory,
      ...args,
    ],
    {
      encoding: "buffer",
      env: {
        ...process.env,
        GIT_NO_LAZY_FETCH: "1",
        GIT_OPTIONAL_LOCKS: "0",
      },
      maxBuffer: MAX_GIT_OUTPUT_BYTES,
    },
  );
  return Buffer.from(result.stdout);
}

function parseTree(output: Buffer): Map<string, TreeEntry> {
  const entries = new Map<string, TreeEntry>();
  let offset = 0;
  while (offset < output.length) {
    const terminator = output.indexOf(0, offset);
    if (terminator === -1) throw new Error("Invalid git ls-tree output");
    const record = output.subarray(offset, terminator).toString("utf8");
    offset = terminator + 1;
    if (record === "") continue;
    const tab = record.indexOf("\t");
    if (tab === -1) throw new Error("Invalid git ls-tree record");
    const metadata = record.slice(0, tab).split(" ");
    const path = record.slice(tab + 1);
    const mode = metadata[0];
    const type = metadata[1];
    const oid = metadata[2];
    if (mode === undefined || type !== "blob" || oid === undefined || path === "") {
      if (mode === "160000") continue;
      throw new Error("Invalid git ls-tree record");
    }
    const entry = mode === "100644"
      ? { path, kind: "file" as const, executable: false, oid }
      : mode === "100755"
        ? { path, kind: "file" as const, executable: true, oid }
        : mode === "120000"
          ? { path, kind: "symlink" as const, executable: false, oid }
          : null;
    if (entry !== null) entries.set(path, entry);
  }
  return entries;
}

function lineOutput(output: Buffer): string {
  if (output.at(-1) !== 0x0a) throw new Error("Unexpected git output");
  const end = output.at(-2) === 0x0d ? -2 : -1;
  return output.subarray(0, end).toString("utf8");
}

function parseFullObjectId(output: Buffer): string {
  const oid = lineOutput(output);
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(oid)) {
    throw new Error("Invalid Git object ID");
  }
  return oid;
}

class GitSnapshot implements RepositorySnapshot {
  readonly #reference: SnapshotRef;
  readonly #entries: ReadonlyMap<string, TreeEntry>;
  readonly #paths: readonly string[];
  readonly #blobs = new Map<string, Uint8Array>();
  readonly #root: string;

  public constructor(root: string, oid: string, entries: ReadonlyMap<string, TreeEntry>) {
    this.#root = root;
    this.#reference = { kind: "git", label: oid, oid };
    this.#entries = entries;
    this.#paths = [...entries.keys()].sort(compareCodePoints);
  }

  public get ref(): SnapshotRef { return { ...this.#reference }; }
  public async listPaths(): Promise<readonly string[]> { return [...this.#paths]; }

  public async entry(path: string): Promise<SnapshotEntry | null> {
    const entry = this.#entries.get(path);
    return entry === undefined ? null : { path: entry.path, kind: entry.kind, executable: entry.executable };
  }

  public async read(path: string): Promise<Uint8Array | null> {
    const entry = this.#entries.get(path);
    if (entry === undefined) return null;
    let bytes = this.#blobs.get(entry.oid);
    if (bytes === undefined) {
      bytes = new Uint8Array(await runGit(this.#root, ["cat-file", "blob", entry.oid]));
      this.#blobs.set(entry.oid, bytes);
    }
    return new Uint8Array(bytes);
  }
}

export async function findRepositoryRoot(start: string): Promise<string> {
  return lineOutput(await runGit(start, ["rev-parse", "--show-toplevel"]));
}

export async function openGitSnapshot(root: string, ref: string): Promise<RepositorySnapshot> {
  const oid = parseFullObjectId(await runGit(root, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]));
  const entries = parseTree(await runGit(root, ["ls-tree", "-rz", "--full-tree", "-r", oid]));
  return new GitSnapshot(root, oid, entries);
}
