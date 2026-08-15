import { describe, expect, it } from "vitest";
import { analyzeDiff } from "../src/impact.js";
import { parseArgs } from "../src/args.js";
import { GOOGLE_GEMINI_CLI_PROFILE_ID } from "../src/model.js";
import { claudeProfile } from "../src/profiles/claude.js";
import { codexProfile } from "../src/profiles/codex.js";
import {
  geminiProfile,
  parseGeminiFileNames,
} from "../src/profiles/gemini.js";
import { GEMINI_IMPLEMENTATION_REVISION } from "../src/profiles/gemini-evidence.js";
import { ManifestSnapshot } from "../src/snapshot.js";

function snapshot(files: Readonly<Record<string, string>>): ManifestSnapshot {
  return new ManifestSnapshot({
    schemaVersion: 1,
    label: "gemini",
    entries: Object.entries(files).map(([path, contents]) => ({
      path,
      kind: "file" as const,
      executable: false,
      base64: Buffer.from(contents, "utf8").toString("base64"),
    })),
  });
}

describe("google/gemini-cli@1 evidence", () => {
  it("pins the v0.55.1 implementation revision", () => {
    expect(GEMINI_IMPLEMENTATION_REVISION).toContain("v0.55.1");
    expect(GEMINI_IMPLEMENTATION_REVISION).toContain("41327e407da58aa01c409ef6685b7b5d379f295e");
    expect(geminiProfile.evidence.some((item) => item.claim.includes("JIT"))).toBe(true);
    expect(geminiProfile.evidence.some((item) => item.claim.includes("geminiignore"))).toBe(true);
    expect(geminiProfile.evidence.some((item) => item.claim.includes("wrappers"))).toBe(true);
  });

  it("unions tracked context.fileName with default GEMINI.md", () => {
    expect(parseGeminiFileNames('{"context":{"fileName":["AGENTS.md"]}}').names).toEqual([
      "AGENTS.md",
      "GEMINI.md",
    ]);
    expect(parseGeminiFileNames("{}").names).toEqual(["GEMINI.md"]);
  });
});

describe("google/gemini-cli@1", () => {
  it("selects ancestor GEMINI.md files root-to-leaf for READ_TARGET", async () => {
    const prepared = await geminiProfile.prepare(snapshot({
      "GEMINI.md": "root",
      "packages/GEMINI.md": "packages",
      "packages/api/GEMINI.md": "api",
      "packages/ui/GEMINI.md": "ui sibling",
      "packages/api/src/client.ts": "code",
    }));
    const projection = prepared.project("packages/api/src/client.ts");
    expect(projection.profile).toBe(GOOGLE_GEMINI_CLI_PROFILE_ID);
    expect(projection.context).toEqual({
      cwd: ".",
      trigger: "READ_TARGET",
      targetPath: "packages/api/src/client.ts",
      repositoryOnly: true,
    });
    expect(projection.composition).toBe("ORDERED");
    expect(projection.sources.map((source) => source.path)).toEqual([
      "GEMINI.md",
      "packages/GEMINI.md",
      "packages/api/GEMINI.md",
    ]);
    expect(projection.sources.every((source) => source.disposition === "SELECTED")).toBe(true);
  });

  it("does not select sibling or untouched descendant GEMINI.md files", async () => {
    const prepared = await geminiProfile.prepare(snapshot({
      "GEMINI.md": "root",
      "packages/ui/GEMINI.md": "ui",
      "packages/api/src/client.ts": "code",
    }));
    const projection = prepared.project("packages/api/src/client.ts");
    expect(projection.sources.map((source) => source.path)).toEqual(["GEMINI.md"]);
  });

  it("does not treat a nested AGENTS.md as a default Gemini source", async () => {
    const prepared = await geminiProfile.prepare(snapshot({
      "AGENTS.md": "codex",
      "packages/AGENTS.md": "nested",
      "packages/api.ts": "code",
    }));
    const projection = prepared.project("packages/api.ts");
    expect(projection.sources).toEqual([]);
  });

  it("selects AGENTS.md only after tracked project fileName unions it in", async () => {
    const prepared = await geminiProfile.prepare(snapshot({
      ".gemini/settings.json": JSON.stringify({ context: { fileName: ["AGENTS.md"] } }),
      "AGENTS.md": "agents",
      "GEMINI.md": "gemini",
      "src/file.ts": "code",
    }));
    const projection = prepared.project("src/file.ts");
    expect(projection.sources.map((source) => source.path)).toEqual([
      "AGENTS.md",
      "GEMINI.md",
    ]);
  });

  it("expands relative imports and keeps vendor wrappers out of payload units", async () => {
    const prepared = await geminiProfile.prepare(snapshot({
      "GEMINI.md": "root\n@./shared.md\n",
      "shared.md": "imported",
      "src/file.ts": "code",
    }));
    const projection = prepared.project("src/file.ts");
    expect(projection.sources.map((source) => [source.path, source.disposition])).toEqual([
      ["GEMINI.md", "SELECTED"],
      ["shared.md", "IMPORTED"],
    ]);
    expect(projection.normalizedPayloadUnits.length).toBeGreaterThan(0);
    expect(JSON.stringify(projection.normalizedPayloadUnits)).not.toContain("Context from");
  });

  it("includes a two-hop imported file in sourceDependencyPaths and diff sources", async () => {
    const before = snapshot({
      "GEMINI.md": "@a.md\n",
      "a.md": "@b.md\n",
      "b.md": "VALUE_A\n",
      "src/file.ts": "target\n",
    });
    const after = snapshot({
      "GEMINI.md": "@a.md\n",
      "a.md": "@b.md\n",
      "b.md": "VALUE_B\n",
      "src/file.ts": "target\n",
    });
    const prepared = await geminiProfile.prepare(before);
    expect(prepared.project("src/file.ts").sources.map((source) => source.path))
      .toEqual(["GEMINI.md", "a.md", "b.md"]);
    expect([...prepared.sourceDependencyPaths].sort()).toEqual(["GEMINI.md", "a.md", "b.md"]);

    const diff = await analyzeDiff({
      before,
      after,
      profiles: [claudeProfile, codexProfile, geminiProfile],
    });
    const changed = diff.changedInstructionSources.flatMap((change) =>
      [change.beforePath, change.afterPath].filter((path): path is string => path !== null),
    );
    expect(changed).toContain("b.md");
    const target = diff.paths.find((path) => path.path === "src/file.ts");
    expect(target?.changedProfiles).toContain(GOOGLE_GEMINI_CLI_PROFILE_ID);
    expect(target?.causes).toContain("b.md");
  });

  it("treats @path inside an HTML comment as an import (no comment state)", async () => {
    const prepared = await geminiProfile.prepare(snapshot({
      "GEMINI.md": "root\n<!-- @./hidden.md -->\n",
      "hidden.md": "secret",
      "src/file.ts": "code",
    }));
    const projection = prepared.project("src/file.ts");
    expect(projection.sources.map((source) => source.path)).toContain("hidden.md");
  });

  it("marks missing and absolute imports partial without guessing", async () => {
    const prepared = await geminiProfile.prepare(snapshot({
      "GEMINI.md": "root\n@./missing.md\n@/etc/passwd\n",
      "src/file.ts": "code",
    }));
    const projection = prepared.project("src/file.ts");
    expect(projection.status).toBe("PARTIAL");
    expect(projection.sources.some((source) => source.disposition === "UNRESOLVED_IMPORT")).toBe(true);
  });

  it("accepts --reality google/gemini-cli@1 and rejects a fifth invented surface", () => {
    expect(parseArgs([".", "--reality", "google/gemini-cli@1"])).toMatchObject({
      action: "scan",
      realities: ["google/gemini-cli@1"],
    });
    expect(() => parseArgs([".", "--reality", "cursor/editor@1"])).toThrow(/must be one of/i);
  });
});
