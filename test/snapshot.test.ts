import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ManifestSnapshot, ownSnapshotEntry } from "../src/snapshot.js";
import type { RepositorySnapshot } from "../src/snapshot.js";

const textDecoder = new TextDecoder();

function requireBytes(value: Uint8Array | null): Uint8Array {
  expect(value).not.toBeNull();
  if (value === null) {
    throw new Error("Expected snapshot bytes");
  }
  return value;
}

function makeEntry(
  path: string,
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    path,
    kind: "file",
    executable: false,
    base64: Buffer.from(`contents of ${path}`).toString("base64"),
    ...overrides,
  };
}

function makeManifest(entries: readonly unknown[] = []): Record<string, unknown> {
  return {
    schemaVersion: 1,
    label: "unit snapshot",
    entries,
  };
}

function loadBasicFixture(): unknown {
  return JSON.parse(
    readFileSync(
      new URL("./fixtures/snapshot/basic.json", import.meta.url),
      "utf8",
    ),
  ) as unknown;
}

describe("ownSnapshotEntry", () => {
  it("accepts a closed file or symlink record and rejects extra fields", () => {
    expect(ownSnapshotEntry(
      { path: "AGENTS.md", kind: "file", executable: false },
      "AGENTS.md",
    )).toEqual({ path: "AGENTS.md", kind: "file", executable: false });
    expect(ownSnapshotEntry(
      { path: "link", kind: "symlink", executable: false },
      "link",
    )).toEqual({ path: "link", kind: "symlink", executable: false });
    expect(() => ownSnapshotEntry(
      { path: "AGENTS.md", kind: "file", executable: false, extra: true },
      "AGENTS.md",
    )).toThrow(/own data fields/u);
    expect(() => ownSnapshotEntry(
      { path: "other.md", kind: "file", executable: false },
      "AGENTS.md",
    )).toThrow(/Invalid pack candidate entry/u);
  });
});

describe("ManifestSnapshot", () => {
  it("uses the checked fixture label for a deterministic fixture ref", async () => {
    const snapshot: RepositorySnapshot = new ManifestSnapshot(loadBasicFixture());

    expect(snapshot.ref).toEqual({
      kind: "fixture",
      label: "basic snapshot",
      oid: null,
    });
    expect(Object.keys(snapshot.ref).sort()).toEqual(["kind", "label", "oid"]);
    expect(await snapshot.listPaths()).toEqual([
      "README.md",
      "bin/run.sh",
      "latest",
    ]);
    expect(await snapshot.entry("bin/run.sh")).toEqual({
      path: "bin/run.sh",
      kind: "file",
      executable: true,
    });
    expect(await snapshot.entry("latest")).toEqual({
      path: "latest",
      kind: "symlink",
      executable: false,
    });
    expect(textDecoder.decode(requireBytes(await snapshot.read("latest")))).toBe(
      "README.md",
    );
  });

  it("normalizes separators, repeated separators, and dot segments", async () => {
    const snapshot = new ManifestSnapshot(
      makeManifest([makeEntry("docs\\.\\guide//index.md")]),
    );

    expect(await snapshot.listPaths()).toEqual(["docs/guide/index.md"]);
    expect(await snapshot.entry("docs//guide\\./index.md")).toEqual({
      path: "docs/guide/index.md",
      kind: "file",
      executable: false,
    });
    expect(
      textDecoder.decode(
        requireBytes(await snapshot.read("docs\\guide//index.md")),
      ),
    ).toBe("contents of docs\\.\\guide//index.md");
  });

  it.each([
    ["empty", ""],
    ["dot-only", "."],
    ["separator-only", "///"],
    ["POSIX absolute", "/repo/file"],
    ["rooted backslash", "\\repo\\file"],
    ["Windows drive absolute", "C:\\repo\\file"],
    ["Windows drive relative", "C:repo\\file"],
    ["dot-prefixed Windows drive", ".\\C:repo\\file"],
    ["Windows UNC", "\\\\server\\share\\file"],
    ["slash UNC", "//server/share/file"],
    ["leading traversal", "../file"],
    ["middle traversal", "a/../file"],
    ["trailing traversal", "a/.."],
    ["backslash traversal", "a\\..\\file"],
    ["NUL", "a\0b"],
  ])("rejects an unsafe manifest path (%s)", (_description, path) => {
    expect(() => new ManifestSnapshot(makeManifest([makeEntry(path)]))).toThrow(
      TypeError,
    );
  });

  it.each([
    "",
    ".",
    "/file",
    "\\file",
    "C:\\file",
    "C:file",
    "./C:file",
    "\\\\server\\share\\file",
    "../file",
    "a/../file",
    "a\\..\\file",
    "a\0b",
  ])("rejects unsafe method lookup path %j", async (path) => {
    const snapshot = new ManifestSnapshot(makeManifest([makeEntry("file")]));

    await expect(snapshot.entry(path)).rejects.toThrow(TypeError);
    await expect(snapshot.read(path)).rejects.toThrow(TypeError);
  });

  it("rejects duplicate paths after normalization", () => {
    expect(
      () =>
        new ManifestSnapshot(
          makeManifest([makeEntry("a\\b"), makeEntry("a/./b")]),
        ),
    ).toThrow(TypeError);
  });

  it("sorts paths by Unicode code point rather than UTF-16 or locale order", async () => {
    const supplementary = "\u{10000}.txt";
    const privateUseBmp = "\uE000.txt";
    const decomposed = "e\u0301.txt";
    const composed = "\u00E9.txt";
    const snapshot = new ManifestSnapshot(
      makeManifest([
        makeEntry(supplementary),
        makeEntry(composed),
        makeEntry(privateUseBmp),
        makeEntry(decomposed),
      ]),
    );

    expect(await snapshot.listPaths()).toEqual([
      decomposed,
      composed,
      privateUseBmp,
      supplementary,
    ]);
  });

  it("returns null for missing entries and bytes", async () => {
    const snapshot = new ManifestSnapshot(makeManifest([makeEntry("known")]));

    expect(await snapshot.entry("missing")).toBeNull();
    expect(await snapshot.read("missing")).toBeNull();
  });

  it("copies manifest data at construction and bytes on every read", async () => {
    const sourceEntry = makeEntry("original", {
      base64: Buffer.from("original bytes").toString("base64"),
    });
    const sourceManifest = makeManifest([sourceEntry]);
    const snapshot = new ManifestSnapshot(sourceManifest);

    sourceEntry.path = "changed";
    sourceEntry.kind = "symlink";
    sourceEntry.executable = true;
    sourceEntry.base64 = Buffer.from("changed bytes").toString("base64");
    sourceManifest.label = "changed label";

    const firstRead = requireBytes(await snapshot.read("original"));
    expect(textDecoder.decode(firstRead)).toBe("original bytes");
    firstRead[0] = 0;

    expect(
      textDecoder.decode(requireBytes(await snapshot.read("original"))),
    ).toBe("original bytes");
    expect(snapshot.ref.label).toBe("unit snapshot");
  });

  it("returns fresh list and entry values", async () => {
    const snapshot = new ManifestSnapshot(makeManifest([makeEntry("stable")]));
    const firstPaths = (await snapshot.listPaths()) as string[];
    const firstEntry = await snapshot.entry("stable");

    firstPaths[0] = "changed";
    firstPaths.push("extra");
    expect(firstEntry).not.toBeNull();
    firstEntry!.path = "changed";
    firstEntry!.kind = "symlink";
    firstEntry!.executable = true;

    expect(await snapshot.listPaths()).toEqual(["stable"]);
    expect(await snapshot.entry("stable")).toEqual({
      path: "stable",
      kind: "file",
      executable: false,
    });
  });

  it.each([
    ["top-level unknown key", { ...makeManifest(), cwd: "C:\\repo" }],
    [
      "entry filesystem reference",
      makeManifest([makeEntry("file", { filesystemPath: "C:\\repo\\file" })]),
    ],
    ["entry unknown key", makeManifest([makeEntry("file", { extra: true })])],
  ])("rejects a non-closed manifest shape (%s)", (_description, manifest) => {
    expect(() => new ManifestSnapshot(manifest)).toThrow(TypeError);
  });

  it.each([
    ["wrong schema", { ...makeManifest(), schemaVersion: 2 }],
    ["string schema", { ...makeManifest(), schemaVersion: "1" }],
    ["missing schema", { label: "unit snapshot", entries: [] }],
    ["number label", { ...makeManifest(), label: 1 }],
    ["missing label", { schemaVersion: 1, entries: [] }],
    ["non-array entries", { ...makeManifest(), entries: {} }],
    ["missing entries", { schemaVersion: 1, label: "unit snapshot" }],
    ["non-object manifest", null],
  ])("validates the manifest fields (%s)", (_description, manifest) => {
    expect(() => new ManifestSnapshot(manifest)).toThrow(TypeError);
  });

  it.each([
    ["non-string path", makeEntry("file", { path: 1 })],
    ["invalid kind", makeEntry("file", { kind: "directory" })],
    ["non-boolean executable", makeEntry("file", { executable: 0 })],
    ["non-string base64", makeEntry("file", { base64: 1 })],
    [
      "missing base64",
      { path: "file", kind: "file", executable: false },
    ],
  ])("validates entry fields (%s)", (_description, entry) => {
    expect(() => new ManifestSnapshot(makeManifest([entry]))).toThrow(TypeError);
  });

  it.each([
    "Zg",
    "Zg=",
    "Zg===",
    "Zg==\n",
    "Zg__",
    "====",
    "Zh==",
  ])("rejects non-canonical base64 %j", (base64) => {
    expect(
      () =>
        new ManifestSnapshot(
          makeManifest([makeEntry("file", { base64 })]),
        ),
    ).toThrow(TypeError);
  });

  it.each([
    ["", ""],
    ["Zg==", "f"],
    ["Zm8=", "fo"],
    ["Zm9v", "foo"],
  ])("accepts canonical base64 %j", async (base64, expected) => {
    const snapshot = new ManifestSnapshot(
      makeManifest([makeEntry("file", { base64 })]),
    );

    expect(
      textDecoder.decode(requireBytes(await snapshot.read("file"))),
    ).toBe(expected);
  });
});
