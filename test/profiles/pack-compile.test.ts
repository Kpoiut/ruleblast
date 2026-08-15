import { describe, expect, it } from "vitest";
import {
  InvalidPackError,
  compilePack,
  decodePackBundle,
} from "../../src/packs/compile.js";

const claim = {
  claimId: "codex.discover.1",
  sourceType: "vendor-doc",
  sourceUrl: "https://learn.chatgpt.com/docs/agent-configuration/agents-md",
  retrievedAt: "2026-08-12",
  sourceRevision: "2026-08-12",
  claim: "Codex discovers AGENTS.md through the repository hierarchy.",
} as const;

function validBundle(overrides: Record<string, unknown> = {}): unknown {
  return {
    pack: {
      schema: "ruleblast.pack.v1",
      id: "openai/codex-cli@1",
      label: "Codex CLI",
      shortLabel: "Codex",
      badge: "CX",
    },
    evidence: [{ ...claim }],
    resolver: {
      context: { cwd: "dirname-target", trigger: "STARTUP", repositoryOnly: true },
      discover: {
        origins: [
          {
            kind: "ancestors",
            from: "repositoryRoot",
            to: "cwd",
            inclusive: true,
            names: ["AGENTS.override.md", "AGENTS.md"],
          },
        ],
        claimIds: ["codex.discover.1"],
      },
      select: {
        mode: "first-per-directory",
        names: ["AGENTS.override.md", "AGENTS.md"],
        shadows: { "AGENTS.override.md": ["AGENTS.md"] },
        claimIds: ["codex.discover.1"],
      },
      transform: [
        { kind: "byte-budget", bytes: 32768, claimIds: ["codex.discover.1"] },
      ],
      assemble: { mode: "ordered", claimIds: ["codex.discover.1"] },
      fingerprint: "codex-v1",
      onSymlink: "unknown-unfollowed",
    },
    ...overrides,
  };
}

function expectInvalid(bundle: unknown, pattern: RegExp): void {
  expect(() => compilePack(decodePackBundle(bundle))).toThrow(InvalidPackError);
  try {
    compilePack(decodePackBundle(bundle));
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidPackError);
    expect(String(error)).toMatch(/INVALID_PACK/);
    expect(String(error)).toMatch(pattern);
  }
}

describe("increment 1 pack compile", () => {
  it("accepts a closed Codex-shaped bundle", () => {
    const compiled = compilePack(decodePackBundle(validBundle()));
    expect(compiled.pack.id).toBe("openai/codex-cli@1");
    expect(compiled.resolver.fingerprint).toBe("codex-v1");
    expect(compiled.claims.has("codex.discover.1")).toBe(true);
  });

  it("rejects an unknown pack key", () => {
    const bundle = validBundle();
    (bundle as { pack: Record<string, unknown> }).pack.admission = "default";
    expectInvalid(bundle, /unknown|admission/i);
  });

  it("rejects executable-looking unknown keys as unknown fields", () => {
    const bundle = validBundle();
    (bundle as { resolver: Record<string, unknown> }).resolver.script = "rm -rf /";
    expectInvalid(bundle, /unknown|script/i);
  });

  it("rejects a dangling claimId", () => {
    const bundle = validBundle();
    (bundle as { resolver: { assemble: { claimIds: string[] } } }).resolver.assemble
      .claimIds = ["missing.claim"];
    expectInvalid(bundle, /claim/i);
  });

  it("rejects a semantic node without claimIds", () => {
    const bundle = validBundle();
    (bundle as { resolver: { discover: { claimIds: string[] } } }).resolver.discover
      .claimIds = [];
    expectInvalid(bundle, /claim/i);
  });

  it("rejects a path-escaping name", () => {
    const bundle = validBundle();
    (bundle as { resolver: { select: { names: string[] } } }).resolver.select.names = [
      "../secret.md",
    ];
    expectInvalid(bundle, /path|escape|\.\./i);
  });

  it("rejects an unknown fingerprint", () => {
    const bundle = validBundle();
    (bundle as { resolver: { fingerprint: string } }).resolver.fingerprint = "custom-v1";
    expectInvalid(bundle, /fingerprint/i);
  });

  it("rejects a bad evidence date", () => {
    const bundle = validBundle();
    (bundle as { evidence: Array<{ retrievedAt: string }> }).evidence[0]!.retrievedAt =
      "2026-13-40";
    expectInvalid(bundle, /date|retrievedAt/i);
  });
});

describe("increment 2.0.2 pack load fail-closed", () => {
  it("rejects a path-escaping bundled directory name", async () => {
    const { loadBundledPack } = await import("../../src/packs/load.js");
    expect(() => loadBundledPack("../secret")).toThrow(InvalidPackError);
    expect(() => loadBundledPack("../secret")).toThrow(/unsafe pack directory/u);
  });

  it("rejects a nested or drive-relative bundled directory name", async () => {
    const { loadBundledPack } = await import("../../src/packs/load.js");
    for (const name of [
      "openai-codex-cli@1/extra",
      "C:secret",
      "openai-codex-cli@1\\extra",
    ]) {
      expect(() => loadBundledPack(name), name).toThrow(InvalidPackError);
      expect(() => loadBundledPack(name), name).toThrow(/unsafe pack directory/u);
    }
  });

  it("maps each catalog pack id onto one contained bundled directory", async () => {
    const { PROFILE_CATALOG } = await import("../../src/application/profile-catalog.js");
    const { bundledDirectoryForPackId, loadBundledPack } = await import(
      "../../src/packs/load.js"
    );
    const directories = [
      "anthropic-claude-code-cli@1",
      "github-copilot-cli@1",
      "google-gemini-cli@1",
      "openai-codex-cli@1",
    ];
    expect(PROFILE_CATALOG.map((entry) => bundledDirectoryForPackId(entry.id)).sort())
      .toEqual(directories);
    for (const entry of PROFILE_CATALOG) {
      expect(loadBundledPack(bundledDirectoryForPackId(entry.id)).pack.id).toBe(entry.id);
    }
  });

  it("rejects an empty claim id string before dangling-claim analysis", () => {
    const bundle = validBundle();
    (bundle as { resolver: { discover: { claimIds: string[] } } }).resolver.discover
      .claimIds = [""];
    expectInvalid(bundle, /non-empty string/i);
  });

  it("rejects a Windows-stream or drive fragment in a select name", () => {
    const bundle = validBundle();
    (bundle as { resolver: { select: { names: string[] } } }).resolver.select.names = [
      "AGENTS.md:zone",
    ];
    expectInvalid(bundle, /safe repository-relative name/i);
  });

  it("wraps malformed pack JSON as INVALID_PACK", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const { readPackDirectory } = await import("../../src/packs/load.js");
    const root = mkdtempSync(join(tmpdir(), "ruleblast-pack-"));
    try {
      writeFileSync(join(root, "pack.json"), "{");
      writeFileSync(join(root, "evidence.json"), "[]");
      writeFileSync(join(root, "resolver.json"), "{}");
      expect(() => readPackDirectory(root)).toThrow(InvalidPackError);
      expect(() => readPackDirectory(root)).toThrow(/malformed JSON/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("wraps a missing pack file as INVALID_PACK", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const { readPackDirectory } = await import("../../src/packs/load.js");
    const root = mkdtempSync(join(tmpdir(), "ruleblast-pack-missing-"));
    try {
      expect(() => readPackDirectory(root)).toThrow(InvalidPackError);
      expect(() => readPackDirectory(root)).toThrow(/unreadable JSON/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
