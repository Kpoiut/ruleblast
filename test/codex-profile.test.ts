import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { sha256 } from "../src/canonical.js";
import { OPENAI_CODEX_CLI_PROFILE_ID } from "../src/model.js";
import {
  assembleCodexProjectInstructions,
  codexProfile,
} from "../src/profiles/codex.js";
import { digestNormalizedPayload } from "../src/profiles/profile.js";
import { ManifestSnapshot } from "../src/snapshot.js";
import type { RepositorySnapshot, SnapshotEntry } from "../src/snapshot.js";

const fixtureDirectory = new URL("./fixtures/codex/", import.meta.url);

async function fixture(name: string): Promise<ManifestSnapshot> {
  return new ManifestSnapshot(JSON.parse(await readFile(new URL(`${name}.json`, fixtureDirectory), "utf8")));
}

async function project(name: string, targetPath: string) {
  return (await codexProfile.prepare(await fixture(name))).project(targetPath);
}

function snapshot(entries: Readonly<Record<string, Uint8Array | null>>): ManifestSnapshot {
  return new ManifestSnapshot({
    schemaVersion: 1,
    label: "generated Codex budget case",
    entries: Object.entries(entries).map(([path, bytes]) => ({
      path,
      kind: bytes === null ? "symlink" : "file",
      executable: false,
      base64: Buffer.from(bytes ?? new Uint8Array()).toString("base64"),
    })),
  });
}

describe("Codex profile", () => {
  it("uses a root AGENTS.md for a root target", async () => {
    const projection = await project("root", "file.ts");
    expect(projection.sources).toMatchObject([{ path: "AGENTS.md", disposition: "SELECTED", digest: sha256("root"), bytesUsed: 4 }]);
  });

  it("resolves root-to-cwd instructions and same-directory override precedence", async () => {
    const projection = await project("override", "services/payments/refund.ts");
    expect(projection.profile).toBe(OPENAI_CODEX_CLI_PROFILE_ID);
    expect(projection.context).toEqual({ cwd: "services/payments", trigger: "STARTUP", targetPath: "services/payments/refund.ts", repositoryOnly: true });
    expect(projection.sources.map(({ path, disposition }) => ({ path, disposition }))).toEqual([
      { path: "AGENTS.md", disposition: "SELECTED" },
      { path: "services/AGENTS.md", disposition: "SELECTED" },
      { path: "services/payments/AGENTS.override.md", disposition: "SELECTED" },
      { path: "services/payments/AGENTS.md", disposition: "SHADOWED" },
    ]);
  });

  it("keeps root and nested instructions in root-to-cwd order", async () => {
    const projection = await project("nested", "services/payments/refund.ts");
    expect(projection.sources.map((source) => source.path)).toEqual(["AGENTS.md", "services/AGENTS.md", "services/payments/AGENTS.md"]);
  });

  it("does not include sibling instructions", async () => {
    expect((await project("sibling", "services/payments/refund.ts")).sources.map((source) => source.path)).toEqual(["AGENTS.md", "services/payments/AGENTS.md"]);
  });

  it("selects an empty override before content and does not fall through", async () => {
    const projection = await project("empty-override", "file.ts");
    expect(projection.sources.map(({ path, disposition }) => ({ path, disposition }))).toEqual([
      { path: "AGENTS.override.md", disposition: "SELECTED_EMPTY" },
      { path: "AGENTS.md", disposition: "SHADOWED" },
    ]);
    expect(projection.normalizedPayloadUnits).toEqual([]);
  });

  it("does not spend instruction budget on trim-empty selections", async () => {
    const projection = await project("whitespace-budget", "services/file.ts");
    expect(projection.sources.map(({ path, disposition, bytesUsed }) => ({ path, disposition, bytesUsed }))).toEqual([
      { path: "AGENTS.override.md", disposition: "SELECTED_EMPTY", bytesUsed: 0 },
      { path: "AGENTS.md", disposition: "SHADOWED", bytesUsed: 0 },
      { path: "services/AGENTS.md", disposition: "SELECTED", bytesUsed: 6 },
    ]);
  });

  it("omits empty selected AGENTS content from payload units", async () => {
    const projection = await project("empty-agents", "file.ts");
    expect(projection.sources).toMatchObject([{ path: "AGENTS.md", disposition: "SELECTED_EMPTY", bytesUsed: 0 }]);
    expect(projection.normalizedPayloadUnits).toEqual([]);
  });

  it("applies the 32 KiB cap exactly and truncates only the final selected source", async () => {
    const exact = (await codexProfile.prepare(await fixture("cap-exact"))).project("file.ts");
    expect(exact.sources).toMatchObject([{ bytesUsed: 32 * 1024, truncated: false }]);
    const truncated = (await codexProfile.prepare(await fixture("cap-truncated"))).project("services/file.ts");
    expect(truncated.sources.map(({ path, bytesUsed, truncated }) => ({ path, bytesUsed, truncated }))).toEqual([
      { path: "AGENTS.md", bytesUsed: 32 * 1024 - 1, truncated: false },
      { path: "services/AGENTS.md", bytesUsed: 1, truncated: true },
    ]);
    expect(truncated.normalizedPayloadUnits).toHaveLength(2);
    expect(truncated.normalizedPayloadUnits[1]).toEqual([sha256("ruleblast-payload-line-v1\0y")]);
  });

  it("records a zero-remaining selected source as truncated selected-empty without spending budget", async () => {
    const projection = (await codexProfile.prepare(snapshot({
      "AGENTS.md": new TextEncoder().encode("x".repeat(32 * 1024)),
      "services/AGENTS.md": new TextEncoder().encode("y"),
    }))).project("services/file.ts");
    expect(projection.sources.map(({ path, disposition, bytesUsed, truncated }) => ({ path, disposition, bytesUsed, truncated }))).toEqual([
      { path: "AGENTS.md", disposition: "SELECTED", bytesUsed: 32 * 1024, truncated: false },
      { path: "services/AGENTS.md", disposition: "SELECTED_EMPTY", bytesUsed: 0, truncated: true },
    ]);
  });

  it("decodes invalid UTF-8 with replacement consistently", async () => {
    const projection = await project("invalid-utf8", "file.ts");
    expect(projection.normalizedPayloadUnits).toEqual([[sha256("ruleblast-payload-line-v1\0�a")]]);
  });

  it("keeps tracked instruction candidates exhaustive and never discovers untracked files", async () => {
    const prepared = await codexProfile.prepare(await fixture("nested"));
    expect(prepared.sourceDependencyPaths).toEqual(["AGENTS.md", "services/AGENTS.md", "services/payments/AGENTS.md"]);
    expect(prepared.sourceDependencyPaths).toEqual([...prepared.sourceDependencyPaths].sort());
    expect(prepared.sourceDependencyPaths).not.toContain("untracked/AGENTS.md");
  });

  it("marks a named instruction symlink unknown while retaining its raw link-text digest", async () => {
    const base = await fixture("instruction-symlink");
    const read = vi.fn((path: string) => base.read(path));
    const projection = (await codexProfile.prepare({
      get ref() { return base.ref; },
      listPaths: () => base.listPaths(),
      entry: (path) => base.entry(path),
      read,
    })).project("file.ts");
    expect(projection.status).toBe("UNKNOWN");
    expect(projection.sources).toMatchObject([{ path: "AGENTS.md", digest: sha256("outside") }]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(projection.evidence).toEqual(["UNSUPPORTED_BOUNDARY: named Codex instruction symlink was not followed: AGENTS.md"]);

    const shadowedLink = await codexProfile.prepare(new ManifestSnapshot({
      schemaVersion: 1,
      label: "shadowed link",
      entries: [
        { path: "AGENTS.override.md", kind: "file", executable: false, base64: Buffer.from("selected").toString("base64") },
        { path: "AGENTS.md", kind: "symlink", executable: false, base64: Buffer.from("shadow-target").toString("base64") },
      ],
    }));
    expect(shadowedLink.project("file.ts").sources).toMatchObject([
      { path: "AGENTS.override.md", disposition: "SELECTED" },
      { path: "AGENTS.md", disposition: "SHADOWED", digest: sha256("shadow-target") },
    ]);
  });

  it("exports exactly the two pinned evidence references", () => {
    expect(codexProfile.evidence).toEqual([
      expect.objectContaining({ url: "https://learn.chatgpt.com/docs/agent-configuration/agents-md", retrievedAt: "2026-08-12" }),
      expect.objectContaining({ url: "https://github.com/openai/codex/commit/4ef836f883c38ba6d39e6920f335ce6452b7de33", revision: "4ef836f883c38ba6d39e6920f335ce6452b7de33" }),
    ]);
  });

  it("uses payload units without its assembly separator", async () => {
    const projection = await project("assembly", "services/refund.ts");
    expect(projection.sources.reduce((sum, source) => sum + source.bytesUsed, 0)).toBe(10);
    expect(projection.normalizedPayloadUnits).toEqual([[sha256("ruleblast-payload-line-v1\0root")], [sha256("ruleblast-payload-line-v1\0nested")]]);
    expect(projection.normalizedPayloadDigest)
      .toBe(digestNormalizedPayload(projection.normalizedPayloadUnits, "ORDERED"));
    const assembled = assembleCodexProjectInstructions(["root", "nested"]);
    expect(assembled).toBe("root\n\nnested");
    expect(assembled).not.toContain("--- project-doc ---");
  });

  it("reads candidates during preparation and clones cached directory context for each target", async () => {
    const prepared = await codexProfile.prepare(await fixture("root"));
    const first = prepared.project("a.ts");
    const expected = JSON.parse(JSON.stringify(first));
    const second = prepared.project("b.ts");
    expect(first.context.targetPath).toBe("a.ts");
    expect(second.context.targetPath).toBe("b.ts");
    expect(second.projectionDigest).not.toBe(first.projectionDigest);
    first.sources[0]!.path = "mutated";
    first.normalizedPayloadUnits[0]![0] = "mutated";
    first.evidence.push("mutated");
    expect(prepared.project("a.ts")).toEqual(expected);
  });

  it("reads each exact-basename regular candidate once during preparation", async () => {
    const base = await fixture("nested");
    let reads = 0;
    const observed: string[] = [];
    const wrapped: RepositorySnapshot = {
      get ref() { return base.ref; },
      async listPaths() { return [...await base.listPaths(), "AGENTS.md.bak", "not-AGENTS.md"]; },
      entry: (path) => base.entry(path),
      async read(path) {
        reads += 1;
        observed.push(path);
        return base.read(path);
      },
    };
    const prepared = await codexProfile.prepare(wrapped);
    expect(reads).toBe(3);
    expect(observed).toEqual(["AGENTS.md", "services/AGENTS.md", "services/payments/AGENTS.md"]);
    expect(codexProfile.isInstructionPath("not-AGENTS.md")).toBe(false);
    expect(codexProfile.isInstructionPath("AGENTS.md.bak")).toBe(false);
    expect(codexProfile.isInstructionPath("nested/AGENTS.md")).toBe(true);
    await expect(Promise.resolve(prepared.project("services/file.ts"))).resolves.toBeDefined();
    expect(reads).toBe(3);
  });

  it("deduplicates enumeration and captures immutable candidate entries and bytes during preparation", async () => {
    const mutableEntry: SnapshotEntry = { path: "AGENTS.md", kind: "file", executable: false };
    const mutableBytes = new TextEncoder().encode("root");
    const entry = vi.fn(async () => mutableEntry);
    const read = vi.fn(async () => mutableBytes);
    const prepared = await codexProfile.prepare({
      ref: { kind: "fixture", label: "mutable candidate", oid: null },
      async listPaths() { return ["AGENTS.md", "AGENTS.md"]; },
      entry,
      read,
    });
    mutableEntry.kind = "symlink";
    mutableBytes[0] = "x".charCodeAt(0);
    entry.mockImplementation(async () => { throw new Error("entry read after prepare"); });
    read.mockImplementation(async () => { throw new Error("byte read after prepare"); });
    const projection = prepared.project("file.ts");
    expect(entry).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);
    expect(projection.sources).toMatchObject([{ disposition: "SELECTED", digest: sha256("root") }]);
  });

  it("rejects accessor-backed candidate entries without invoking accessors", async () => {
    const kind = vi.fn(() => "file");
    const entry = { path: "AGENTS.md", executable: false };
    Object.defineProperty(entry, "kind", { get: kind, enumerable: true });
    await expect(codexProfile.prepare({
      ref: { kind: "fixture", label: "accessor candidate", oid: null },
      async listPaths() { return ["AGENTS.md"]; },
      async entry() { return entry as unknown as SnapshotEntry; },
      async read() { return new TextEncoder().encode("ignored"); },
    })).rejects.toThrow(TypeError);
    expect(kind).not.toHaveBeenCalled();
  });

  it("keeps the semantic fingerprint stable for ignored raw bytes but changes it for used bytes", async () => {
    const cap = new TextEncoder().encode("x".repeat(32 * 1024));
    const first = (await codexProfile.prepare(snapshot({ "AGENTS.md": new Uint8Array([...cap, 0x61]) }))).project("file.ts");
    const ignoredChanged = (await codexProfile.prepare(snapshot({ "AGENTS.md": new Uint8Array([...cap, 0x62]) }))).project("file.ts");
    const usedChanged = (await codexProfile.prepare(snapshot({ "AGENTS.md": new Uint8Array([0x79, ...cap.slice(1), 0x61]) }))).project("file.ts");
    expect(ignoredChanged.sources[0]?.digest).not.toBe(first.sources[0]?.digest);
    expect(ignoredChanged.projectionDigest).toBe(first.projectionDigest);
    expect(usedChanged.projectionDigest).not.toBe(first.projectionDigest);
  });

  it("excludes shadowed source bytes from the semantic fingerprint", async () => {
    const first = (await codexProfile.prepare(snapshot({
      "AGENTS.override.md": new TextEncoder().encode("override"),
      "AGENTS.md": new TextEncoder().encode("first shadow"),
    }))).project("file.ts");
    const shadowChanged = (await codexProfile.prepare(snapshot({
      "AGENTS.override.md": new TextEncoder().encode("override"),
      "AGENTS.md": new TextEncoder().encode("second shadow"),
    }))).project("file.ts");
    expect(shadowChanged.sources[1]?.digest).not.toBe(first.sources[1]?.digest);
    expect(shadowChanged.projectionDigest).toBe(first.projectionDigest);
  });

  it("loads the order fixture and follows the root-to-cwd chain despite manifest order", async () => {
    const projection = await project("order", "z/file.ts");
    expect(projection.sources.map((source) => source.path)).toEqual(["AGENTS.md", "z/AGENTS.md"]);
  });

  it("fails preparation when a discovered regular candidate cannot be read", async () => {
    const broken: RepositorySnapshot = {
      ref: { kind: "fixture", label: "missing candidate bytes", oid: null },
      async listPaths() { return ["AGENTS.md"]; },
      async entry() { return { path: "AGENTS.md", kind: "file", executable: false }; },
      async read() { return null; },
    };
    await expect(codexProfile.prepare(broken))
      .rejects.toThrow("Missing Codex candidate bytes during preparation: AGENTS.md");
  });

  it("orders dependency paths by Unicode code point rather than host collation or UTF-16 code units", async () => {
    const prepared = await codexProfile.prepare(snapshot({
      "\u{10000}/AGENTS.md": new TextEncoder().encode("astral"),
      "\uE000/AGENTS.md": new TextEncoder().encode("bmp"),
    }));
    expect(prepared.sourceDependencyPaths).toEqual(["\uE000/AGENTS.md", "\u{10000}/AGENTS.md"]);
  });
});
