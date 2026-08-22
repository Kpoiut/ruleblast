import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../src/canonical.js";
import { InvalidPackError } from "../src/packs/compile.js";
import { interpretCompiledPack } from "../src/packs/interpret.js";
import { loadBundledPack } from "../src/packs/load.js";
import { profileFromCompiledPack } from "../src/packs/profile.js";
import { verifyBundledPack } from "../src/packs/verify.js";
import { createCodexProfile } from "../src/profiles/codex.js";
import { ManifestSnapshot } from "../src/snapshot.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

interface SealedProbe {
  readonly snapshot: { readonly label: string };
  readonly sourceDependencyPaths: readonly string[];
  readonly projectionDigests: Readonly<Record<string, string>>;
}

function fixtureFiles(relative: string): string[] {
  return readdirSync(join(repositoryRoot, relative))
    .filter((name) => name.endsWith(".json"))
    .sort();
}

function readOracle(directory: string): {
  readonly kind: string;
  readonly packId: string;
  readonly probes: readonly SealedProbe[];
  readonly missingOperations?: readonly string[];
} {
  return JSON.parse(
    readFileSync(join(repositoryRoot, "packs/bundled", directory, "oracle.json"), "utf8"),
  ) as {
    readonly kind: string;
    readonly packId: string;
    readonly probes: readonly SealedProbe[];
    readonly missingOperations?: readonly string[];
  };
}

async function expectAdapterProbes(
  directory: string,
  fixtureRelative: string,
): Promise<void> {
  const files = fixtureFiles(fixtureRelative);
  expect(files.length).toBeGreaterThan(0);
  const oracle = readOracle(directory);
  expect(oracle.probes).toHaveLength(files.length);
  const pack = loadBundledPack(directory);
  const adapter = profileFromCompiledPack(pack);
  await verifyBundledPack(join(repositoryRoot, "packs/bundled", directory), pack);
  for (const [index, file] of files.entries()) {
    const snapshotJson = JSON.parse(
      readFileSync(join(repositoryRoot, fixtureRelative, file), "utf8"),
    ) as { readonly label: string };
    const probe = oracle.probes[index];
    expect(probe?.snapshot).toEqual(snapshotJson);
    const snapshot = new ManifestSnapshot(snapshotJson);
    const prepared = await adapter.prepare(snapshot);
    expect([...prepared.sourceDependencyPaths]).toEqual(probe?.sourceDependencyPaths);
    const paths = await snapshot.listPaths();
    const targets = paths.length === 0 ? ["file.ts"] : paths;
    for (const target of targets) {
      expect(sha256(canonicalJson(prepared.project(target)))).toBe(
        probe?.projectionDigests[target],
      );
    }
  }
}

describe("codex interpreter oracle probes", () => {
  it("packs the existing Codex fixture suite and matches the adapter oracle", async () => {
    const files = fixtureFiles("test/fixtures/codex");
    expect(files.length).toBeGreaterThan(5);
    const oracle = readOracle("openai-codex-cli@1");
    expect(oracle.kind).toBe("interpret");
    expect(oracle.packId).toBe("openai/codex-cli@1");
    expect(oracle.probes).toHaveLength(files.length);
    const pack = loadBundledPack("openai-codex-cli@1");
    const catalog = profileFromCompiledPack(pack);
    const interpreted = interpretCompiledPack(pack);
    await verifyBundledPack(join(repositoryRoot, "packs/bundled/openai-codex-cli@1"), pack);
    for (const [index, file] of files.entries()) {
      const snapshotJson = JSON.parse(
        readFileSync(join(repositoryRoot, "test/fixtures/codex", file), "utf8"),
      ) as { readonly label: string };
      const probe = oracle.probes[index];
      expect(probe?.snapshot).toEqual(snapshotJson);
      const snapshot = new ManifestSnapshot(snapshotJson);
      const engine = await interpreted.prepare(snapshot);
      const adapter = await createCodexProfile({
        id: pack.pack.id,
        evidence: catalog.evidence,
        overrideName: "AGENTS.override.md",
        agentsName: "AGENTS.md",
        byteLimit: 32768,
      }).prepare(snapshot);
      expect([...engine.sourceDependencyPaths]).toEqual([...adapter.sourceDependencyPaths]);
      expect([...engine.sourceDependencyPaths]).toEqual(probe?.sourceDependencyPaths);
      const paths = await snapshot.listPaths();
      const targets = paths.length === 0 ? ["file.ts"] : paths;
      for (const target of targets) {
        expect(canonicalJson(engine.project(target))).toBe(canonicalJson(adapter.project(target)));
        expect(sha256(canonicalJson(engine.project(target)))).toBe(
          probe?.projectionDigests[target],
        );
      }
    }
  });
});

describe("fingerprint adapter oracle probes", () => {
  it("packs the Claude fixture suite through the fingerprint adapter, not OPS-only", async () => {
    const oracle = readOracle("anthropic-claude-code-cli@1");
    expect(oracle.kind).toBe("uninterpretable");
    expect(oracle.packId).toBe("anthropic/claude-code-cli@1");
    expect(oracle.missingOperations?.length).toBeGreaterThan(0);
    expect(() => interpretCompiledPack(loadBundledPack("anthropic-claude-code-cli@1")))
      .toThrow(InvalidPackError);
    await expectAdapterProbes("anthropic-claude-code-cli@1", "test/fixtures/claude");
  });

  it("packs the Gemini fixture suite through the fingerprint adapter", async () => {
    await expectAdapterProbes("google-gemini-cli@1", "test/fixtures/gemini");
  });

  it("packs the Copilot fixture suite through the fingerprint adapter", async () => {
    await expectAdapterProbes("github-copilot-cli@1", "test/fixtures/copilot");
  });
});
