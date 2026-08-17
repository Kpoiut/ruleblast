import type { SnapshotRef } from "./model.js";

export interface SnapshotEntry {
  path: string;
  kind: "file" | "symlink";
  executable: boolean;
}

export interface RepositorySnapshot {
  readonly ref: SnapshotRef;
  listPaths(): Promise<readonly string[]>;
  entry(path: string): Promise<SnapshotEntry | null>;
  read(path: string): Promise<Uint8Array | null>;
}

export type GitStorageObjectFormat = "sha1" | "sha256";

export interface GitObjectSnapshot extends RepositorySnapshot {
  blobOid(path: string): string | null;
}

export function isGitObjectSnapshot(
  snapshot: RepositorySnapshot,
): snapshot is GitObjectSnapshot {
  return typeof (snapshot as GitObjectSnapshot).blobOid === "function";
}

export interface WorktreeIdentitySource extends RepositorySnapshot {
  withObjectIdentity(format: GitStorageObjectFormat): GitObjectSnapshot;
}

export function isWorktreeIdentitySource(
  snapshot: RepositorySnapshot,
): snapshot is WorktreeIdentitySource {
  return typeof (snapshot as WorktreeIdentitySource).withObjectIdentity === "function";
}

interface StoredEntry extends SnapshotEntry {
  readonly bytes: Uint8Array;
}

const MANIFEST_KEYS = ["schemaVersion", "label", "entries"] as const;
const ENTRY_KEYS = ["path", "kind", "executable", "base64"] as const;
const CANONICAL_BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:/;

function fail(message: string): never {
  throw new TypeError(message);
}

function assertClosedRecord(
  value: unknown,
  expectedKeys: readonly string[],
  description: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${description} must be an object`);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(`${description} must be a plain object`);
  }

  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some(
      (key) => typeof key !== "string" || !expectedKeys.includes(key),
    )
  ) {
    fail(`${description} has missing or unknown fields`);
  }

  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      fail(`${description}.${key} must be a data property`);
    }
  }
}

function assertDenseDataArray(
  value: unknown,
  description: string,
): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    fail(`${description} must be an array`);
  }

  if (Reflect.ownKeys(value).length !== value.length + 1) {
    fail(`${description} must be a dense JSON array`);
  }

  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) {
      fail(`${description} must contain only data elements`);
    }
  }
}

function normalizeRepositoryPath(value: unknown): string {
  if (typeof value !== "string") {
    fail("Snapshot path must be a string");
  }
  if (value.includes("\0")) {
    fail("Snapshot path must not contain NUL");
  }

  const slashPath = value.replace(/\\/g, "/");
  if (slashPath.startsWith("/") || WINDOWS_DRIVE_PATTERN.test(slashPath)) {
    fail(`Snapshot path must be repository-relative: ${JSON.stringify(value)}`);
  }

  const segments = slashPath.split("/");
  if (segments.includes("..")) {
    fail(`Snapshot path must not traverse: ${JSON.stringify(value)}`);
  }

  const normalized = segments
    .filter((segment) => segment !== "" && segment !== ".")
    .join("/");
  if (normalized === "") {
    fail("Snapshot path must not be empty");
  }
  if (WINDOWS_DRIVE_PATTERN.test(normalized)) {
    fail(`Snapshot path must be repository-relative: ${JSON.stringify(value)}`);
  }

  return normalized;
}

function decodeCanonicalBase64(value: unknown): Uint8Array {
  if (typeof value !== "string" || !CANONICAL_BASE64_PATTERN.test(value)) {
    fail("Snapshot entry base64 must be canonical base64");
  }

  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) {
    fail("Snapshot entry base64 must be canonical base64");
  }

  return new Uint8Array(decoded);
}

function validateEntry(value: unknown, index: number): StoredEntry {
  const description = `Snapshot manifest entry ${index}`;
  assertClosedRecord(value, ENTRY_KEYS, description);

  const path = normalizeRepositoryPath(value.path);
  const kind = value.kind;
  if (kind !== "file" && kind !== "symlink") {
    fail(`${description}.kind must be file or symlink`);
  }
  if (typeof value.executable !== "boolean") {
    fail(`${description}.executable must be a boolean`);
  }

  return {
    path,
    kind,
    executable: value.executable,
    bytes: decodeCanonicalBase64(value.base64),
  };
}

function compareCodePoints(left: string, right: string): number {
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    const leftCodePoint = left.codePointAt(leftIndex);
    const rightCodePoint = right.codePointAt(rightIndex);
    if (leftCodePoint === undefined || rightCodePoint === undefined) {
      fail("Unable to compare snapshot paths");
    }
    if (leftCodePoint !== rightCodePoint) {
      return leftCodePoint < rightCodePoint ? -1 : 1;
    }

    leftIndex += leftCodePoint > 0xffff ? 2 : 1;
    rightIndex += rightCodePoint > 0xffff ? 2 : 1;
  }

  if (leftIndex === left.length && rightIndex === right.length) {
    return 0;
  }
  return leftIndex === left.length ? -1 : 1;
}

export class ManifestSnapshot implements RepositorySnapshot {
  readonly #reference: SnapshotRef;
  readonly #entriesByPath: ReadonlyMap<string, StoredEntry>;
  readonly #paths: readonly string[];

  public constructor(manifest: unknown) {
    assertClosedRecord(manifest, MANIFEST_KEYS, "Snapshot manifest");
    if (manifest.schemaVersion !== 1) {
      fail("Snapshot manifest schemaVersion must be 1");
    }
    if (typeof manifest.label !== "string") {
      fail("Snapshot manifest label must be a string");
    }
    assertDenseDataArray(manifest.entries, "Snapshot manifest entries");

    const entriesByPath = new Map<string, StoredEntry>();
    for (let index = 0; index < manifest.entries.length; index += 1) {
      const storedEntry = validateEntry(manifest.entries[index], index);
      if (entriesByPath.has(storedEntry.path)) {
        fail(`Duplicate snapshot path: ${JSON.stringify(storedEntry.path)}`);
      }
      entriesByPath.set(storedEntry.path, storedEntry);
    }

    this.#reference = {
      kind: "fixture",
      label: manifest.label,
      oid: null,
    };
    this.#entriesByPath = entriesByPath;
    this.#paths = [...entriesByPath.keys()].sort(compareCodePoints);
  }

  public get ref(): SnapshotRef {
    return { ...this.#reference };
  }

  public async listPaths(): Promise<readonly string[]> {
    return [...this.#paths];
  }

  public async entry(path: string): Promise<SnapshotEntry | null> {
    const storedEntry = this.#entriesByPath.get(normalizeRepositoryPath(path));
    if (storedEntry === undefined) {
      return null;
    }

    return {
      path: storedEntry.path,
      kind: storedEntry.kind,
      executable: storedEntry.executable,
    };
  }

  public async read(path: string): Promise<Uint8Array | null> {
    const storedEntry = this.#entriesByPath.get(normalizeRepositoryPath(path));
    return storedEntry === undefined ? null : new Uint8Array(storedEntry.bytes);
  }
}
