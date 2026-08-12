import { describe, expect, it } from "vitest";
import { ManifestSnapshot } from "../src/snapshot.js";
import type { RepositorySnapshot, SnapshotEntry } from "../src/snapshot.js";
import { buildTransition } from "../src/transition.js";
import { sha256 } from "../src/canonical.js";

function snapshot(entries: Readonly<Record<string, string>>): ManifestSnapshot {
  return new ManifestSnapshot({ schemaVersion: 1, label: "test", entries: Object.entries(entries).map(([path, content]) => ({ path, kind: "file", executable: false, base64: Buffer.from(content).toString("base64") })) });
}

function sparseSnapshot(
  paths: readonly string[],
  blobs: Readonly<Record<string, string>>,
  unreadablePaths: ReadonlySet<string> = new Set(),
): RepositorySnapshot {
  return {
    ref: { kind: "fixture", label: "sparse", oid: null },
    async listPaths() { return paths; },
    async entry(path): Promise<SnapshotEntry | null> {
      return blobs[path] === undefined ? null : { path, kind: "file", executable: false };
    },
    async read(path) {
      if (unreadablePaths.has(path)) {
        throw new Error(`Unexpected read of ${path}`);
      }
      return blobs[path] === undefined ? null : new TextEncoder().encode(blobs[path]);
    },
  };
}

describe("buildTransition", () => {
  it("keeps sorted after blobs as candidates while excluding deletions", async () => {
    const result = await buildTransition(snapshot({ "z.md": "z", "old.md": "gone" }), snapshot({ "😀.md": "x", "a.md": "a", "sparse.md": "index blob" }), new Set());
    expect(result.candidatePaths).toEqual(["a.md", "sparse.md", "😀.md"]);
    expect(result.sourceChanges).toEqual([]);
  });

  it("retains sparse-backed blobs but excludes paths no longer backed by an after blob", async () => {
    const result = await buildTransition(
      sparseSnapshot([], {}),
      sparseSnapshot(["deleted.md", "sparse.md"], { "sparse.md": "index blob" }),
      new Set(),
    );
    expect(result.candidatePaths).toEqual(["sparse.md"]);
  });

  it("retains metadata-backed candidates without reading unrelated blob content", async () => {
    const result = await buildTransition(
      sparseSnapshot([], {}),
      sparseSnapshot(["promised.md"], { "promised.md": "unavailable" }, new Set(["promised.md"])),
      new Set(),
    );
    expect(result.candidatePaths).toEqual(["promised.md"]);
  });

  it("uses same-path modifications and treats equal-content moves as delete plus add", async () => {
    const result = await buildTransition(snapshot({ "same.md": "before\n", "old.md": "move\n", "deleted.md": "gone\n" }), snapshot({ "same.md": "after\n", "new.md": "move\n", "added.md": "new\n" }), new Set(["same.md", "old.md", "new.md", "deleted.md", "added.md"]));
    expect(result.sourceChanges.map(({ kind, beforePath, afterPath }) => ({ kind, beforePath, afterPath }))).toEqual([
      { kind: "ADD", beforePath: null, afterPath: "added.md" },
      { kind: "DELETE", beforePath: "deleted.md", afterPath: null },
      { kind: "ADD", beforePath: null, afterPath: "new.md" },
      { kind: "DELETE", beforePath: "old.md", afterPath: null },
      { kind: "MODIFY", beforePath: "same.md", afterPath: "same.md" },
    ]);
    expect(result.diffStats).toEqual({ addedLineCount: 3, deletedLineCount: 3, editedLineCount: 6, binaryChangedSourceCount: 0 });
    const modified = result.sourceChanges.find((change) => change.kind === "MODIFY");
    expect(modified).toMatchObject({
      beforeDigest: sha256("before\n"),
      afterDigest: sha256("after\n"),
    });
  });

  it("only emits dependency source changes and returns immutable records and arrays", async () => {
    const result = await buildTransition(snapshot({ "dep.md": "before\r\n", "ignored.md": "before\n" }), snapshot({ "dep.md": "before\n", "ignored.md": "after\n" }), new Set(["dep.md"]));
    expect(result.sourceChanges).toHaveLength(1);
    expect(result.sourceChanges[0]!.stats).toEqual({ addedLineCount: 0, deletedLineCount: 0, editedLineCount: 0, binaryChangedSourceCount: 0 });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.candidatePaths)).toBe(true);
    expect(Object.isFrozen(result.sourceChanges)).toBe(true);
    expect(Object.isFrozen(result.sourceChanges[0])).toBe(true);
    expect(Object.isFrozen(result.diffStats)).toBe(true);
  });

  it("retains empty additions and aggregates binary source changes", async () => {
    const result = await buildTransition(
      sparseSnapshot([], {}),
      sparseSnapshot(["binary.md", "empty.md"], { "binary.md": "\0changed", "empty.md": "" }),
      new Set(["binary.md", "empty.md"]),
    );
    expect(result.sourceChanges.map((change) => change.kind)).toEqual(["ADD", "ADD"]);
    expect(result.sourceChanges[1]!.stats).toEqual({ addedLineCount: 0, deletedLineCount: 0, editedLineCount: 0, binaryChangedSourceCount: 0 });
    expect(result.diffStats).toEqual({ addedLineCount: 0, deletedLineCount: 0, editedLineCount: 0, binaryChangedSourceCount: 1 });
  });
});
