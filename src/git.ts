import { execFile } from "node:child_process";
import { constants, type BigIntStats } from "node:fs";
import { lstat, open, readFile, readlink } from "node:fs/promises";
import { join } from "node:path";
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
  try {
    return lineOutput(await runGit(start, ["rev-parse", "--show-toplevel"]));
  } catch (error: unknown) {
    if (isGitCommandFailure(error)) throw new GitSnapshotError("NOT_REPOSITORY");
    throw error;
  }
}

export async function openGitSnapshot(root: string, ref: string): Promise<RepositorySnapshot> {
  let oid: string;
  try {
    oid = parseFullObjectId(await runGit(root, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]));
  } catch (error: unknown) {
    if (isGitCommandFailure(error)) throw new GitSnapshotError("REF_NOT_FOUND");
    throw error;
  }
  const entries = parseTree(await runGit(root, ["ls-tree", "-rz", "--full-tree", "-r", oid]));
  return new GitSnapshot(root, oid, entries);
}

export type GitSnapshotErrorCode =
  | "NOT_REPOSITORY"
  | "REF_NOT_FOUND"
  | "UNMERGED_INDEX"
  | "UNSUPPORTED_WORKTREE_NODE"
  | "WORKTREE_CHANGED_DURING_SNAPSHOT";

export class GitSnapshotError extends Error {
  public constructor(public readonly code: GitSnapshotErrorCode) {
    super(code);
    this.name = "GitSnapshotError";
  }
}

function isGitCommandFailure(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    typeof (error as NodeJS.ErrnoException).code === "number";
}

interface IndexEntry extends SnapshotEntry {
  readonly oid: string;
  readonly skip: boolean;
}
interface WorktreeEntry extends SnapshotEntry { readonly bytes: Uint8Array; }
interface NodeSignature { readonly kind: "file" | "symlink" | "missing"; readonly identity: string; readonly target?: Uint8Array; }
interface IndexState { readonly bytes: Buffer | null; readonly mtime: bigint | null; }
interface Capture { readonly entries: Map<string, WorktreeEntry>; readonly inventory: Map<string, IndexEntry>; readonly signature: Map<string, NodeSignature>; readonly ancestors: Map<string, NodeSignature>; readonly index: IndexState; }

function nulRecords(output: Buffer): Buffer[] {
  const records: Buffer[] = [];
  let start = 0;
  while (start < output.length) {
    const end = output.indexOf(0, start);
    if (end < 0) throw new Error("Invalid NUL-delimited git output");
    records.push(output.subarray(start, end)); start = end + 1;
  }
  return records;
}

async function trackedInventory(root: string): Promise<Map<string, IndexEntry>> {
  const [stageOutput, flagsOutput] = await Promise.all([
    runGit(root, ["ls-files", "--stage", "-z"]), runGit(root, ["ls-files", "-v", "-z"]),
  ]);
  const skip = new Set<string>();
  for (const record of nulRecords(flagsOutput)) {
    const text = record.toString("utf8");
    if (text.length >= 3 && (text[0] === "S" || text[0] === "s") && text[1] === " ") skip.add(text.slice(2));
  }
  const entries = new Map<string, IndexEntry>();
  for (const record of nulRecords(stageOutput)) {
    const tab = record.indexOf(9); if (tab < 0) throw new Error("Invalid git index record");
    const [mode, oid, stageText] = record.subarray(0, tab).toString("utf8").split(" ");
    const path = record.subarray(tab + 1).toString("utf8");
    const stage = Number(stageText);
    if (!Number.isInteger(stage) || !mode || !oid || !path) throw new Error("Invalid git index record");
    if (stage !== 0) throw new GitSnapshotError("UNMERGED_INDEX");
    if (mode === "160000") continue;
    const entry = mode === "100644" || mode === "100755"
      ? { path, kind: "file" as const, executable: mode === "100755", oid, skip: skip.has(path) }
      : mode === "120000" ? { path, kind: "symlink" as const, executable: false, oid, skip: skip.has(path) } : null;
    if (entry === null) throw new Error("Unsupported git index mode");
    entries.set(path, entry);
  }
  return entries;
}

async function indexState(root: string): Promise<IndexState> {
  const indexPath = lineOutput(await runGit(root, ["rev-parse", "--git-path", "index"]));
  const path = indexPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(indexPath) ? indexPath : join(root, indexPath);
  try {
    const stat = await lstat(path, { bigint: true });
    return { bytes: await readFile(path), mtime: stat.mtimeNs };
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { bytes: null, mtime: null };
    throw error;
  }
}

function unsupported(): never { throw new GitSnapshotError("UNSUPPORTED_WORKTREE_NODE"); }
function fileIdentity(stat: Pick<BigIntStats, "dev" | "ino" | "size" | "mtimeNs">): string { return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}`; }
async function nodeSignature(path: string): Promise<NodeSignature> {
  try {
    const stat = await lstat(path, { bigint: true });
    if (stat.isSymbolicLink()) {
      const target = await readlink(path, "buffer");
      const after = await lstat(path, { bigint: true });
      if (!after.isSymbolicLink() || `${after.dev}:${after.ino}:${after.mtimeNs}` !== `${stat.dev}:${stat.ino}:${stat.mtimeNs}`) throw new GitSnapshotError("WORKTREE_CHANGED_DURING_SNAPSHOT");
      return { kind: "symlink", identity: `${stat.dev}:${stat.ino}:${stat.mtimeNs}:${target.toString("base64")}`, target: new Uint8Array(target) };
    }
    if (stat.isFile()) return { kind: "file", identity: fileIdentity(stat) };
    return unsupported();
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { kind: "missing", identity: "missing" };
    throw error;
  }
}

async function copyNode(path: string, signature: NodeSignature): Promise<Uint8Array> {
  if (signature.kind === "symlink") return new Uint8Array(signature.target!);
  if (signature.kind !== "file") throw new Error("Cannot copy missing node");
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await handle.stat({ bigint: true });
    if (!stat.isFile() || fileIdentity(stat) !== signature.identity) {
      throw new GitSnapshotError("WORKTREE_CHANGED_DURING_SNAPSHOT");
    }
    const bytes = new Uint8Array(await handle.readFile()); const after = await handle.stat({ bigint: true });
    if (!after.isFile() || fileIdentity(after) !== signature.identity) throw new GitSnapshotError("WORKTREE_CHANGED_DURING_SNAPSHOT");
    return bytes;
  } finally { await handle.close(); }
}

async function ancestorSignatures(root: string, relativePath: string): Promise<Map<string, NodeSignature>> {
  const result = new Map<string, NodeSignature>(); let current = root;
  for (const part of relativePath.split("/").slice(0, -1)) {
    current = join(current, part);
    try {
      const stat = await lstat(current, { bigint: true });
      if (!stat.isDirectory()) return unsupported();
      result.set(current, { kind: "file", identity: `${stat.dev}:${stat.ino}:${stat.mtimeNs}` });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") break;
      throw error;
    }
  }
  return result;
}

async function capture(root: string): Promise<Capture> {
  const before = await indexState(root);
  const inventory = await trackedInventory(root);
  const entries = new Map<string, WorktreeEntry>(); const signature = new Map<string, NodeSignature>(); const ancestors = new Map<string, NodeSignature>();
  for (const entry of inventory.values()) {
    for (const [path, node] of await ancestorSignatures(root, entry.path)) ancestors.set(path, node);
    const path = join(root, entry.path); const node = await nodeSignature(path); signature.set(entry.path, node);
    if (node.kind === "missing") {
      if (entry.skip) entries.set(entry.path, { ...entry, bytes: new Uint8Array(await runGit(root, ["cat-file", "blob", entry.oid])) });
      continue;
    }
    const kind = node.kind;
    entries.set(entry.path, { path: entry.path, kind, executable: kind === "file" ? entry.executable : false, bytes: await copyNode(path, node) });
  }
  return { entries, inventory, signature, ancestors, index: before };
}

function sameInventory(left: Map<string, IndexEntry>, right: Map<string, IndexEntry>): boolean {
  return left.size === right.size && [...left].every(([path, entry]) => {
    const other = right.get(path); return other !== undefined && other.oid === entry.oid && other.kind === entry.kind && other.executable === entry.executable && other.skip === entry.skip;
  });
}

class WorktreeSnapshot implements RepositorySnapshot {
  readonly #entries: ReadonlyMap<string, WorktreeEntry>; readonly #paths: readonly string[];
  public constructor(entries: Map<string, WorktreeEntry>) { this.#entries = entries; this.#paths = [...entries.keys()].sort(compareCodePoints); }
  public get ref(): SnapshotRef { return { kind: "worktree", label: "worktree", oid: null }; }
  public async listPaths(): Promise<readonly string[]> { return [...this.#paths]; }
  public async entry(path: string): Promise<SnapshotEntry | null> { const entry = this.#entries.get(path); return entry === undefined ? null : { path: entry.path, kind: entry.kind, executable: entry.executable }; }
  public async read(path: string): Promise<Uint8Array | null> { const entry = this.#entries.get(path); return entry === undefined ? null : new Uint8Array(entry.bytes); }
}

export async function openTrackedWorktree(root: string): Promise<RepositorySnapshot> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const captured = await capture(root); const afterInventory = await trackedInventory(root); const afterIndex = await indexState(root);
      const stableNodes = await Promise.all([...captured.signature].map(async ([path, before]) => {
        const after = await nodeSignature(join(root, path)); return after.kind === before.kind && after.identity === before.identity;
      }));
      const stableAncestors = await Promise.all([...captured.ancestors].map(async ([path, before]) => {
        const stat = await lstat(path, { bigint: true }); return stat.isDirectory() && `${stat.dev}:${stat.ino}:${stat.mtimeNs}` === before.identity;
      }));
      const sameIndex = captured.index.bytes === null ? afterIndex.bytes === null : afterIndex.bytes !== null && captured.index.bytes.equals(afterIndex.bytes);
      if (sameInventory(captured.inventory, afterInventory) && stableNodes.every(Boolean) && stableAncestors.every(Boolean) && sameIndex && captured.index.mtime === afterIndex.mtime) return new WorktreeSnapshot(captured.entries);
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;
      if (error instanceof GitSnapshotError && (error.code === "UNSUPPORTED_WORKTREE_NODE" || error.code === "UNMERGED_INDEX")) throw error;
      if (!(error instanceof GitSnapshotError) && code !== "ELOOP" && code !== "ENOENT" && code !== "ENOTDIR" && code !== "EINVAL" && code !== "EISDIR") throw error;
    }
  }
  throw new GitSnapshotError("WORKTREE_CHANGED_DURING_SNAPSHOT");
}
