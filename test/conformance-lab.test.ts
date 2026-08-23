import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ensureConformanceLab,
  inventoryConformanceLab,
  renderConformanceLab,
} from "../src/application/conformance-lab.js";
import { renderEvidenceReveal } from "../src/application/evidence-revision.js";
import { parseArgs } from "../src/args.js";
import { present } from "../src/cli-output.js";
import {
  OPENAI_CODEX_CLI_PROFILE_ID,
  type CurrentRuleBlastResult,
  type Projection,
} from "../src/model.js";
import { FIXTURE_AXES, decodeCandidateFixture } from "../src/packs/candidate.js";
import { InvalidPackError } from "../src/packs/compile.js";
import { interpretCompiledPack, uninterpretableReasons } from "../src/packs/interpret.js";
import { loadBundledPack } from "../src/packs/load.js";
import { verifyBundledPack } from "../src/packs/verify.js";
import { FINGERPRINT_BUILTINS } from "../src/packs/schema.js";
import { profilesForReality } from "../src/application/profile-catalog.js";
import { receiptForCurrent } from "../src/render-receipt.js";
import { renderDetail } from "../src/render-detail.js";
import { renderText } from "../src/render-text.js";
import { renderResultIndex } from "../src/application/result-index.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function projection(): Projection {
  return {
    profile: OPENAI_CODEX_CLI_PROFILE_ID,
    context: {
      cwd: "src",
      trigger: "STARTUP",
      targetPath: "src/file.ts",
      repositoryOnly: true,
    },
    status: "COMPLETE",
    composition: "ORDERED",
    sources: [{
      path: "src/AGENTS.md",
      disposition: "SELECTED",
      digest: "abc",
      bytesUsed: 12,
      truncated: false,
    }],
    normalizedPayloadUnits: [["x"]],
    projectionDigest: "p",
    normalizedPayloadDigest: "n",
    evidence: ["budget"],
  };
}

function currentResult(): CurrentRuleBlastResult {
  return {
    mode: "current",
    schemaVersion: 1,
    resolverRevision: 1,
    snapshot: { kind: "worktree", label: "WORKTREE", oid: null },
    counts: {
      candidatePathCount: 1,
      currentSplitPathCount: 0,
      partialPathCount: 0,
      unknownPathCount: 0,
      indeterminatePathCount: 0,
      byProfile: [{
        profile: OPENAI_CODEX_CLI_PROFILE_ID,
        completePathCount: 1,
        partialPathCount: 0,
        unknownPathCount: 0,
      }],
    },
    paths: [{
      path: "src/file.ts",
      projections: [projection()],
      payloadRelation: "SAME",
      isSplit: false,
    }],
    findings: [],
  };
}

function captureJson(result: CurrentRuleBlastResult): string {
  const stdout: string[] = [];
  present(
    result,
    { kind: "json", color: "never" },
    {
      stdout: (text) => { stdout.push(text); },
      stderr: () => { throw new Error("present must not write stderr"); },
      env: {},
      stdoutIsTTY: false,
    },
  );
  return stdout.join("");
}

describe("candidate reality conformance lab", () => {
  beforeAll(async () => {
    await ensureConformanceLab();
  });

  it("inventories bundled interpreter coverage from resolver operations", async () => {
    const lab = await inventoryConformanceLab();
    expect(lab.bundled.map((row) => row.id)).toEqual([
      "anthropic/claude-code-cli@1",
      "github/copilot-cli@1",
      "google/gemini-cli@1",
      "openai/codex-cli@1",
    ]);
    const byId = Object.fromEntries(lab.bundled.map((row) => [row.id, row]));
    expect(byId["openai/codex-cli@1"]?.engine).toBe("INTERPRET");
    expect(byId["openai/codex-cli@1"]?.proof).toBe("ORACLE");
    expect(byId["openai/codex-cli@1"]?.missingOperations).toEqual([]);
    expect(byId["anthropic/claude-code-cli@1"]?.engine).toBe("INTERPRET");
    expect(byId["anthropic/claude-code-cli@1"]?.proof).toBe("ORACLE");
    expect(byId["google/gemini-cli@1"]?.proof).toBe("ORACLE");
    expect(byId["google/gemini-cli@1"]?.engine).toBe("INTERPRET");
    const bundledRoot = join(repositoryRoot, "packs/bundled");
    const bundledDirs = readdirSync(bundledRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(bundledDirs).toHaveLength(4);
    for (const name of bundledDirs) {
      expect(existsSync(join(bundledRoot, name, "oracle.json"))).toBe(true);
    }
    for (const row of lab.bundled) {
      const pack = loadBundledPack(row.id.replaceAll("/", "-"));
      const missing = uninterpretableReasons(pack.resolver);
      expect(row.missingOperations).toEqual(missing);
      expect(row.engine).toBe(missing.length === 0 ? "INTERPRET" : "FINGERPRINT");
      if (row.engine === "INTERPRET") {
        expect(interpretCompiledPack(pack).id).toBe(pack.pack.id);
      } else {
        expect(() => interpretCompiledPack(pack)).toThrow(InvalidPackError);
      }
    }
    expect(byId["anthropic/claude-code-cli@1"]?.missingOperations).toEqual([]);
    expect(byId["google/gemini-cli@1"]?.missingOperations).toEqual([]);
    expect(byId["google/gemini-cli@1"]?.probeCount).toBeGreaterThan(0);
    expect(byId["anthropic/claude-code-cli@1"]?.probeCount).toBeGreaterThan(0);
    expect(byId["github/copilot-cli@1"]?.missingOperations).toEqual([]);
    expect(byId["github/copilot-cli@1"]?.engine).toBe("INTERPRET");
    expect(byId["github/copilot-cli@1"]?.proof).toBe("ORACLE");
  });

  it("inventories Grok Build fixture axes without admitting a public reality", async () => {
    const lab = await inventoryConformanceLab();
    expect(FIXTURE_AXES).toEqual([
      "selection",
      "rejection",
      "precedence",
      "ambiguity",
      "unknown",
    ]);
    expect(lab.candidates).toHaveLength(1);
    const grok = lab.candidates[0];
    expect(grok?.id).toBe("xai/grok-build-cli");
    expect(grok?.label).toBe("Grok Build CLI");
    expect(grok?.admission).toBe("not-admitted");
    expect(grok?.stability).toBe("forming");
    expect(grok?.interpreter).toBe("NONE");
    expect(grok?.load).toBe("LOADED");
    expect(grok?.proof).toBe("UNEXECUTED");
    expect(grok?.evidenceClaims).toBe(4);
    expect(grok?.axes.map((axis) => [axis.axis, axis.status])).toEqual([
      ["selection", "RECORDED"],
      ["rejection", "RECORDED"],
      ["precedence", "RECORDED"],
      ["ambiguity", "RECORDED"],
      ["unknown", "RECORDED"],
    ]);
    expect(grok?.axes.every((axis) => axis.fixtures.length === 1)).toBe(true);
    expect(grok?.blocked).toEqual(["no interpreter-admissible resolver"]);
    expect(() => profilesForReality("xai/grok-build-cli")).toThrow(/Unknown opt-in reality/);
    expect(() => parseArgs([".", "--reality", "xai/grok-build-cli"])).toThrow(/must be one of/);
    expect([...FINGERPRINT_BUILTINS]).toHaveLength(4);
  });

  it("prints a machine-answerable matrix on --detail and --receipt, never on JSON, summary, or --index", async () => {
    const result = currentResult();
    const summary = renderText(result, {
      currentLabel: "WORKTREE",
      caseLabel: null,
      shellDialect: "posix",
    }, false);
    const detailed = await renderDetail(result, {
      currentLabel: "WORKTREE",
      caseLabel: null,
      shellDialect: "posix",
    }, false);
    const receipt = await receiptForCurrent(result);
    const json = captureJson(result);
    const index = renderResultIndex(result);
    const lab = await renderConformanceLab();
    const identified = await renderConformanceLab(undefined, "identity");
    expect(lab).toContain("LAB");
    expect(lab).toContain("INTERPRET");
    expect(lab).toContain("ORACLE");
    expect(lab).not.toContain("openai/codex-cli@1");
    expect(identified).toContain("openai/codex-cli@1");
    expect(identified).toContain("anthropic/claude-code-cli@1");
    expect(identified).toContain("github/copilot-cli@1");
    expect(identified).toContain("google/gemini-cli@1");
    expect(detailed).toContain("openai/codex-cli@1");
    expect(receipt.markdown).not.toContain("openai/codex-cli@1");
    expect(lab).not.toMatch(/\bOPS\b/u);
    expect(lab).toContain("0 ops");
    expect(lab).not.toContain("FINGERPRINT");
    expect(lab).not.toContain("ADAPTER");
    expect(lab).toContain("probes");
    expect(lab).toContain("xai/grok-build-cli");
    expect(lab).toContain("NOT_ADMITTED");
    expect(lab).toContain("selection RECORDED");
    expect(lab).toContain("rejection RECORDED");
    expect(lab).toContain("precedence RECORDED");
    expect(lab).toContain("ambiguity RECORDED");
    expect(lab).toContain("unknown RECORDED");
    expect(lab).toContain("load LOADED");
    expect(lab).toContain("interpreter NONE");
    expect(lab).toContain("proof UNEXECUTED");
    expect(lab).toContain("no interpreter-admissible resolver");
    expect(lab).toContain("Not model quality");
    expect(lab).toContain("RECORDED is not a passing oracle");
    expect(lab).not.toMatch(/\bPRESENT\b/u);
    expect(lab).not.toMatch(/\bCOMPLETE\b/u);
    expect(lab).not.toContain("CHAIN");
    expect(lab).not.toContain("BENCH");
    expect(lab).not.toMatch(/\bCURRENT\b/u);
    expect(lab).not.toMatch(/fingerprint is an admission/iu);
    expect(detailed).toContain("LAB");
    expect(detailed.indexOf("EVIDENCE")).toBeLessThan(detailed.indexOf("LAB"));
    expect(receipt.markdown).toContain("LAB");
    expect(receipt.markdown.indexOf("EVIDENCE")).toBeLessThan(receipt.markdown.indexOf("LAB"));
    expect(summary).not.toContain("LAB");
    expect(index).not.toContain("LAB");
    expect(JSON.parse(json)).toEqual(result);
    expect(json).not.toContain("LAB");
    expect(json).not.toContain("NOT_ADMITTED");
    expect(renderEvidenceReveal()).not.toContain("LAB");
  });

  it("treats a missing fixture axis as ABSENT and does not invent a fifth engine", async () => {
    const root = mkdtempSync(join(tmpdir(), "ruleblast-lab-"));
    const directory = join(root, "xai-grok-build-cli");
    mkdirSync(directory);
    writeFileSync(join(directory, "candidate.json"), JSON.stringify({
      schema: "ruleblast.candidate.v1",
      id: "xai/grok-build-cli",
      label: "Grok Build CLI",
      admission: "not-admitted",
      stability: "forming",
      reason: "isolated lab fixture",
      evidence: [{
        claimId: "grok.discover.1",
        sourceType: "vendor-doc",
        sourceUrl: "https://docs.x.ai/build/features/project-rules",
        retrievedAt: "2026-08-20",
        sourceRevision: "2026-07-04",
        claim: "Root-to-cwd discovery.",
      }],
    }));
    const lab = await inventoryConformanceLab({ candidateRoot: root });
    expect(lab.candidates[0]?.axes.every((axis) => axis.status === "ABSENT")).toBe(true);
    expect(lab.candidates[0]?.load).toBe("ABSENT");
    expect(lab.candidates[0]?.blocked).toEqual([
      "missing axes: selection, rejection, precedence, ambiguity, unknown",
      "no interpreter-admissible resolver",
    ]);
    expect(existsSync(join(repositoryRoot, "Cargo.toml"))).toBe(false);
    expect(existsSync(join(repositoryRoot, "go.mod"))).toBe(false);
  });

  it("fails closed on a fixture that claims certainty, mismatches its axis, or uses an unknown axis directory", async () => {
    const snapshot = {
      schemaVersion: 1,
      label: "grok fixture tree",
      entries: [{
        path: "AGENTS.md",
        kind: "file",
        executable: false,
        base64: Buffer.from("root", "utf8").toString("base64"),
      }],
    };
    expect(() => decodeCandidateFixture({
      schema: "ruleblast.candidate-fixture.v1",
      axis: "selection",
      id: "grok.selection.root-to-cwd",
      claimId: "grok.discover.1",
      expectedStatus: "COMPLETE",
      expectedComposition: "UNSPECIFIED",
      reason: "documented root-to-cwd load",
      snapshot,
    })).toThrow(InvalidPackError);
    expect(() => decodeCandidateFixture({
      schema: "ruleblast.candidate-fixture.v1",
      axis: "selection",
      id: "grok.selection.root-to-cwd",
      claimId: "grok.discover.1",
      expectedStatus: "UNKNOWN",
      expectedComposition: "ORDERED",
      reason: "no sealed order",
      snapshot,
    })).toThrow(InvalidPackError);
    expect(() => decodeCandidateFixture({
      schema: "ruleblast.candidate-fixture.v1",
      axis: "selection",
      id: "grok.selection.root-to-cwd",
      claimId: "grok.discover.1",
      expectedStatus: "UNKNOWN",
      expectedComposition: "UNSPECIFIED",
      reason: "documented root-to-cwd load remains unexecuted",
    })).toThrow(InvalidPackError);
    expect(() => decodeCandidateFixture({
      schema: "ruleblast.candidate-fixture.v1",
      axis: "selection",
      id: "grok.selection.root-to-cwd",
      claimId: "grok.discover.1",
      expectedStatus: "UNKNOWN",
      expectedComposition: "UNSPECIFIED",
      reason: "documented root-to-cwd load remains unexecuted",
      snapshot: { schemaVersion: 1, label: "bad", entries: "nope" },
    })).toThrow(/fixture\.snapshot is not a ManifestSnapshot/u);
    expect(() => decodeCandidateFixture({
      schema: "ruleblast.candidate-fixture.v1",
      axis: "selection",
      id: "grok.selection.root-to-cwd",
      claimId: "grok.discover.1",
      expectedStatus: "UNKNOWN",
      expectedComposition: "UNSPECIFIED",
      reason: "documented root-to-cwd load remains unexecuted",
      snapshot,
    })).not.toThrow();
    expect(() => decodeCandidateFixture({
      schema: "ruleblast.candidate-fixture.v1",
      axis: "selection",
      id: "bad",
      claimId: "missing",
      expectedStatus: "YES",
      expectedComposition: "UNSPECIFIED",
      reason: "no",
    })).toThrow(InvalidPackError);
    const root = mkdtempSync(join(tmpdir(), "ruleblast-lab-mismatch-"));
    const directory = join(root, "xai-grok-build-cli");
    mkdirSync(join(directory, "fixtures", "selection"), { recursive: true });
    writeFileSync(join(directory, "candidate.json"), JSON.stringify({
      schema: "ruleblast.candidate.v1",
      id: "xai/grok-build-cli",
      label: "Grok Build CLI",
      admission: "not-admitted",
      stability: "forming",
      reason: "isolated",
      evidence: [{
        claimId: "grok.discover.1",
        sourceType: "vendor-doc",
        sourceUrl: "https://docs.x.ai/build/features/project-rules",
        retrievedAt: "2026-08-20",
        sourceRevision: "2026-07-04",
        claim: "Root-to-cwd discovery.",
      }],
    }));
    writeFileSync(join(directory, "fixtures", "selection", "wrong-axis.json"), JSON.stringify({
      schema: "ruleblast.candidate-fixture.v1",
      axis: "unknown",
      id: "grok.unknown.wrong-dir",
      claimId: "grok.discover.1",
      expectedStatus: "UNKNOWN",
      expectedComposition: "UNSPECIFIED",
      reason: "axis directory mismatch",
    }));
    await expect(inventoryConformanceLab({ candidateRoot: root })).rejects.toThrow(InvalidPackError);
    const extra = mkdtempSync(join(tmpdir(), "ruleblast-lab-extra-axis-"));
    const extraDir = join(extra, "xai-grok-build-cli");
    mkdirSync(join(extraDir, "fixtures", "other"), { recursive: true });
    writeFileSync(join(extraDir, "candidate.json"), JSON.stringify({
      schema: "ruleblast.candidate.v1",
      id: "xai/grok-build-cli",
      label: "Grok Build CLI",
      admission: "not-admitted",
      stability: "forming",
      reason: "isolated",
      evidence: [{
        claimId: "grok.discover.1",
        sourceType: "vendor-doc",
        sourceUrl: "https://docs.x.ai/build/features/project-rules",
        retrievedAt: "2026-08-20",
        sourceRevision: "2026-07-04",
        claim: "Root-to-cwd discovery.",
      }],
    }));
    writeFileSync(join(extraDir, "fixtures", "other", "nope.json"), "{}");
    await expect(inventoryConformanceLab({ candidateRoot: extra })).rejects.toThrow(InvalidPackError);
  });

  it("fails closed when a sealed interpreter oracle does not match live output", async () => {
    const pack = loadBundledPack("openai-codex-cli@1");
    const sealed = JSON.parse(
      readFileSync(join(repositoryRoot, "packs/bundled/openai-codex-cli@1/oracle.json"), "utf8"),
    ) as {
      readonly probes: readonly {
        readonly snapshot: unknown;
        readonly sourceDependencyPaths: readonly string[];
        readonly projectionDigests: Readonly<Record<string, string>>;
      }[];
    };
    const first = sealed.probes[0];
    expect(first).toBeDefined();
    const brokenDigests = { ...first!.projectionDigests };
    const firstTarget = Object.keys(brokenDigests)[0];
    expect(firstTarget).toBeDefined();
    brokenDigests[firstTarget!] = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const root = mkdtempSync(join(tmpdir(), "ruleblast-oracle-"));
    writeFileSync(join(root, "oracle.json"), JSON.stringify({
      schema: "ruleblast.interpreter-oracle.v1",
      kind: "interpret",
      packId: "openai/codex-cli@1",
      probes: [{
        snapshot: first!.snapshot,
        sourceDependencyPaths: first!.sourceDependencyPaths,
        projectionDigests: brokenDigests,
      }],
    }));
    await expect(verifyBundledPack(root, pack)).rejects.toThrow(/oracle\.probes\[0\] projection digest mismatch/u);
    const geminiPack = loadBundledPack("google-gemini-cli@1");
    const gemini = JSON.parse(
      readFileSync(join(repositoryRoot, "packs/bundled/google-gemini-cli@1/oracle.json"), "utf8"),
    ) as {
      readonly probes: readonly {
        readonly snapshot: unknown;
        readonly sourceDependencyPaths: readonly string[];
        readonly projectionDigests: Readonly<Record<string, string>>;
      }[];
    };
    const adapterProbe = gemini.probes[0];
    expect(adapterProbe).toBeDefined();
    const adapterBroken = { ...adapterProbe!.projectionDigests };
    const adapterTarget = Object.keys(adapterBroken)[0];
    expect(adapterTarget).toBeDefined();
    adapterBroken[adapterTarget!] = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const adapterRoot = mkdtempSync(join(tmpdir(), "ruleblast-oracle-adapter-"));
    writeFileSync(join(adapterRoot, "oracle.json"), JSON.stringify({
      schema: "ruleblast.interpreter-oracle.v1",
      kind: "interpret",
      packId: "google/gemini-cli@1",
      probes: [{
        snapshot: adapterProbe!.snapshot,
        sourceDependencyPaths: adapterProbe!.sourceDependencyPaths,
        projectionDigests: adapterBroken,
      }],
    }));
    await expect(verifyBundledPack(adapterRoot, geminiPack))
      .rejects.toThrow(/oracle\.probes\[0\] projection digest mismatch/u);
    const blocked = {
      ...geminiPack,
      resolver: {
        ...geminiPack.resolver,
        transform: [{ kind: "byte-budget" as const, bytes: 0, claimIds: ["gemini.imports.1"] }],
      },
    };
    const opsRoot = mkdtempSync(join(tmpdir(), "ruleblast-oracle-ops-"));
    writeFileSync(join(opsRoot, "oracle.json"), JSON.stringify({
      schema: "ruleblast.interpreter-oracle.v1",
      kind: "uninterpretable",
      packId: "google/gemini-cli@1",
      missingOperations: ["context.cwd"],
      probes: gemini.probes,
    }));
    await expect(verifyBundledPack(opsRoot, blocked))
      .rejects.toThrow(/oracle missingOperations mismatch/u);
    const missing = mkdtempSync(join(tmpdir(), "ruleblast-oracle-missing-"));
    await expect(verifyBundledPack(missing, pack)).rejects.toThrow(InvalidPackError);
  });

  it("packs committed candidate inventory with the CLI", () => {
    const descriptor = JSON.parse(
      readFileSync(join(repositoryRoot, "package.json"), "utf8"),
    ) as { readonly files: readonly string[] };
    expect(descriptor.files).toContain("packs/candidate");
    expect(descriptor.files).toContain("packs/bundled");
  });
});
