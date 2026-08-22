import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../../src/canonical.js";
import { loadBundledPack } from "../../src/packs/load.js";
import {
  canInterpretResolver,
  interpretCompiledPack,
  uninterpretableReasons,
} from "../../src/packs/interpret.js";
import { profileFromCompiledPack } from "../../src/packs/profile.js";
import { createCodexProfile, codexProfile } from "../../src/profiles/codex.js";
import { createCopilotProfile } from "../../src/profiles/copilot.js";
import { ManifestSnapshot } from "../../src/snapshot.js";

const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const fixtureRoot = join(repositoryRoot, "test/fixtures/codex");

describe("spec-driven pack interpreter", () => {
  it("does not import vendor Codex adapter code", () => {
    const interpret = readFileSync(join(repositoryRoot, "src/packs/interpret.ts"), "utf8");
    const profile = readFileSync(join(repositoryRoot, "src/packs/profile.ts"), "utf8");
    expect(interpret).not.toContain("profiles/codex");
    expect(interpret).not.toContain("createCodexProfile");
    expect(interpret).not.toContain("fingerprint");
    expect(profile).not.toContain("createCodexProfile");
    expect(profile).toContain("interpretCompiledPack");
  });

  it("admits interpretation from resolver operations, not fingerprint", () => {
    const codex = loadBundledPack("openai-codex-cli@1").resolver;
    expect(uninterpretableReasons(codex)).toEqual([]);
    expect(canInterpretResolver(codex)).toBe(true);
    expect(canInterpretResolver({ ...codex, fingerprint: "claude-v1" })).toBe(true);
    expect(canInterpretResolver({ ...codex, fingerprint: "gemini-v1" })).toBe(true);
    expect(canInterpretResolver({ ...codex, fingerprint: "copilot-v1" })).toBe(true);
  });

  it("names the missing operations on fingerprint-backed bundled packs", () => {
    const claude = uninterpretableReasons(
      loadBundledPack("anthropic-claude-code-cli@1").resolver,
    );
    const gemini = uninterpretableReasons(
      loadBundledPack("google-gemini-cli@1").resolver,
    );
    const copilot = uninterpretableReasons(
      loadBundledPack("github-copilot-cli@1").resolver,
    );
    expect(claude).toEqual(["transform"]);
    expect(gemini).toEqual(["onSymlink", "transform"]);
    expect(copilot).toEqual([]);
    const oracleOps = (directory: string): readonly string[] => {
      const oracle = JSON.parse(
        readFileSync(join(repositoryRoot, "packs/bundled", directory, "oracle.json"), "utf8"),
      ) as { readonly kind: string; readonly missingOperations?: readonly string[] };
      return oracle.missingOperations ?? [];
    };
    expect(oracleOps("anthropic-claude-code-cli@1")).toEqual(claude);
    expect(oracleOps("google-gemini-cli@1")).toEqual(gemini);
    expect(JSON.parse(
      readFileSync(join(repositoryRoot, "packs/bundled/github-copilot-cli@1/oracle.json"), "utf8"),
    )).toMatchObject({ kind: "interpret", packId: "github/copilot-cli@1" });
    expect(claude.join("\n")).not.toMatch(/fingerprint/iu);
    expect(canInterpretResolver(loadBundledPack("anthropic-claude-code-cli@1").resolver))
      .toBe(false);
    const profile = readFileSync(join(repositoryRoot, "src/packs/profile.ts"), "utf8");
    expect(profile).toContain("createClaudeProfile");
    expect(profile).toContain("createGeminiProfile");
    expect(profile).toContain("createCopilotProfile");
  });

  it("keeps shared-prefix nested targets byte-identical to the adapter oracle", async () => {
    const pack = loadBundledPack("openai-codex-cli@1");
    const snapshot = new ManifestSnapshot({
      schemaVersion: 1,
      label: "prefix-cache",
      entries: [
        { path: "AGENTS.md", kind: "file", executable: false, base64: Buffer.from("root\n").toString("base64") },
        { path: "src/AGENTS.md", kind: "file", executable: false, base64: Buffer.from("src\n").toString("base64") },
        { path: "src/a/one.ts", kind: "file", executable: false, base64: Buffer.from("one\n").toString("base64") },
        { path: "src/a/two.ts", kind: "file", executable: false, base64: Buffer.from("two\n").toString("base64") },
      ],
    });
    const catalog = profileFromCompiledPack(pack);
    const adapter = await createCodexProfile({
      id: pack.pack.id,
      evidence: catalog.evidence,
      overrideName: "AGENTS.override.md",
      agentsName: "AGENTS.md",
      byteLimit: 32768,
    }).prepare(snapshot);
    const engine = await interpretCompiledPack(pack).prepare(snapshot);
    const left = engine.project("src/a/one.ts");
    const right = engine.project("src/a/two.ts");
    expect(left.sources.map((source) => source.path)).toEqual(["AGENTS.md", "src/AGENTS.md"]);
    expect(right.sources.map((source) => source.path)).toEqual(left.sources.map((source) => source.path));
    expect(canonicalJson(left)).toBe(canonicalJson(adapter.project("src/a/one.ts")));
    expect(canonicalJson(right)).toBe(canonicalJson(adapter.project("src/a/two.ts")));
  });

  it("interprets the bundled Copilot pack onto the adapter oracle", async () => {
    const pack = loadBundledPack("github-copilot-cli@1");
    expect(uninterpretableReasons(pack.resolver)).toEqual([]);
    const interpreted = interpretCompiledPack(pack);
    const catalog = profileFromCompiledPack(pack);
    expect(catalog.id).toBe(interpreted.id);
    const fixtureRoot = join(repositoryRoot, "test/fixtures/copilot");
    const files = readdirSync(fixtureRoot).filter((name) => name.endsWith(".json")).sort();
    expect(files.length).toBeGreaterThan(2);
    for (const file of files) {
      const snapshot = new ManifestSnapshot(
        JSON.parse(readFileSync(join(fixtureRoot, file), "utf8")),
      );
      const adapter = await createCopilotProfile({
        id: pack.pack.id,
        evidence: catalog.evidence,
      }).prepare(snapshot);
      const engine = await interpreted.prepare(snapshot);
      expect([...engine.sourceDependencyPaths]).toEqual([...adapter.sourceDependencyPaths]);
      const paths = await snapshot.listPaths();
      const targets = paths.length === 0 ? ["file.ts"] : paths;
      for (const target of targets) {
        expect(canonicalJson(engine.project(target)), `${file} ${target}`).toBe(
          canonicalJson(adapter.project(target)),
        );
      }
    }
  });

  it("interprets the bundled Codex pack onto the adapter oracle", async () => {
    const pack = loadBundledPack("openai-codex-cli@1");
    const interpreted = interpretCompiledPack(pack);
    const catalog = profileFromCompiledPack(pack);
    expect(interpreted.id).toBe(codexProfile.id);
    expect(catalog.id).toBe(codexProfile.id);
    const files = readdirSync(fixtureRoot).filter((name) => name.endsWith(".json")).sort();
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const snapshot = new ManifestSnapshot(
        JSON.parse(readFileSync(join(fixtureRoot, file), "utf8")),
      );
      const adapter = await createCodexProfile({
        id: pack.pack.id,
        evidence: catalog.evidence,
        overrideName: "AGENTS.override.md",
        agentsName: "AGENTS.md",
        byteLimit: 32768,
      }).prepare(snapshot);
      const engine = await interpreted.prepare(snapshot);
      expect([...engine.sourceDependencyPaths].sort()).toEqual(
        [...adapter.sourceDependencyPaths].sort(),
      );
      const paths = await snapshot.listPaths();
      const targets = paths.length === 0 ? ["file.ts"] : paths;
      for (const target of targets) {
        expect(canonicalJson(engine.project(target))).toBe(canonicalJson(adapter.project(target)));
      }
    }
  });
});
