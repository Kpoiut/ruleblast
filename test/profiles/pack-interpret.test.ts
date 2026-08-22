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
    expect(claude).toEqual([
      "context.cwd",
      "context.trigger",
      "assemble.mode",
      "select.mode",
      "discover.origins",
      "discover.range",
      "transform",
    ]);
    expect(gemini).toEqual([
      "context.cwd",
      "context.trigger",
      "onSymlink",
      "select.mode",
      "discover.origins",
      "discover.range",
      "transform",
    ]);
    expect(copilot).toEqual([
      "context.cwd",
      "context.trigger",
      "assemble.mode",
      "select.mode",
      "discover.origins",
      "discover.origin",
      "transform",
    ]);
    const oracleOps = (directory: string): readonly string[] => {
      const oracle = JSON.parse(
        readFileSync(join(repositoryRoot, "packs/bundled", directory, "oracle.json"), "utf8"),
      ) as { readonly kind: string; readonly missingOperations?: readonly string[] };
      expect(oracle.kind).toBe("uninterpretable");
      return oracle.missingOperations ?? [];
    };
    expect(oracleOps("anthropic-claude-code-cli@1")).toEqual(claude);
    expect(oracleOps("google-gemini-cli@1")).toEqual(gemini);
    expect(oracleOps("github-copilot-cli@1")).toEqual(copilot);
    expect(claude.join("\n")).not.toMatch(/fingerprint/iu);
    expect(canInterpretResolver(loadBundledPack("anthropic-claude-code-cli@1").resolver))
      .toBe(false);
    const profile = readFileSync(join(repositoryRoot, "src/packs/profile.ts"), "utf8");
    expect(profile).toContain("createClaudeProfile");
    expect(profile).toContain("createGeminiProfile");
    expect(profile).toContain("createCopilotProfile");
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
