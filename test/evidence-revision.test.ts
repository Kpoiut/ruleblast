import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  evidenceDigest,
  revealEvidenceRevisions,
  renderEvidenceReveal,
} from "../src/application/evidence-revision.js";
import { parseArgs } from "../src/args.js";
import { present } from "../src/cli-output.js";
import {
  OPENAI_CODEX_CLI_PROFILE_ID,
  type CurrentRuleBlastResult,
  type Projection,
} from "../src/model.js";
import { FINGERPRINT_BUILTINS } from "../src/packs/schema.js";
import { profilesForReality } from "../src/application/profile-catalog.js";
import { receiptForCurrent } from "../src/render-receipt.js";
import { renderDetail } from "../src/render-detail.js";
import { renderText } from "../src/render-text.js";

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

describe("offline evidence-revision reveal", () => {
  it("marks bundled realities SEALED when no candidate evidence is committed", () => {
    const reveal = revealEvidenceRevisions();
    expect(reveal.bundled).toHaveLength(4);
    expect(reveal.bundled.map((row) => row.id).sort()).toEqual([
      "anthropic/claude-code-cli@1",
      "github/copilot-cli@1",
      "google/gemini-cli@1",
      "openai/codex-cli@1",
    ]);
    for (const row of reveal.bundled) {
      expect(row.status).toBe("SEALED");
      expect(row.evidenceDigest).toMatch(/^[0-9a-f]{64}$/u);
      expect(row.candidateDigest).toBeNull();
    }
  });

  it("marks a bundled reality POSSIBLY_STALE when committed candidate evidence differs", () => {
    const reveal = revealEvidenceRevisions();
    const codex = reveal.bundled.find((row) => row.id === "openai/codex-cli@1");
    expect(codex).toBeDefined();
    const root = mkdtempSync(join(tmpdir(), "ruleblast-evidence-"));
    const directory = join(root, "openai-codex-cli@1");
    mkdirSync(directory);
    writeFileSync(join(directory, "candidate.json"), JSON.stringify({
      schema: "ruleblast.candidate.v1",
      id: "openai/codex-cli@1",
      label: "Codex CLI",
      admission: "not-admitted",
      stability: "watch",
      reason: "later retrieved claims for the same surface",
      evidence: [{
        claimId: "codex.discover.1",
        sourceType: "vendor-doc",
        sourceUrl: "https://learn.chatgpt.com/docs/agent-configuration/agents-md",
        retrievedAt: "2026-08-20",
        sourceRevision: "2026-08-20",
        claim: "A later retrieved Codex discovery claim that is not the sealed pack claim.",
      }],
    }));
    const drifted = revealEvidenceRevisions({ candidateRoot: root });
    const driftedCodex = drifted.bundled.find((row) => row.id === "openai/codex-cli@1");
    expect(driftedCodex?.status).toBe("POSSIBLY_STALE");
    expect(driftedCodex?.candidateDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(driftedCodex?.candidateDigest).not.toBe(codex?.evidenceDigest);
    expect(drifted.bundled.filter((row) => row.id !== "openai/codex-cli@1")
      .every((row) => row.status === "SEALED")).toBe(true);
  });

  it("marks NO_KNOWN_DRIFT when candidate evidence bytes match the sealed pack", () => {
    const sealed = revealEvidenceRevisions().bundled.find(
      (row) => row.id === "openai/codex-cli@1",
    );
    expect(sealed).toBeDefined();
    const evidence = JSON.parse(
      readFileSync(join(repositoryRoot, "packs/bundled/openai-codex-cli@1/evidence.json"), "utf8"),
    ) as unknown;
    const root = mkdtempSync(join(tmpdir(), "ruleblast-evidence-match-"));
    const directory = join(root, "openai-codex-cli@1");
    mkdirSync(directory);
    writeFileSync(join(directory, "candidate.json"), JSON.stringify({
      schema: "ruleblast.candidate.v1",
      id: "openai/codex-cli@1",
      label: "Codex CLI",
      admission: "not-admitted",
      stability: "watch",
      reason: "same claims as the sealed pack",
      evidence,
    }));
    const matched = revealEvidenceRevisions({ candidateRoot: root });
    const row = matched.bundled.find((item) => item.id === "openai/codex-cli@1");
    expect(row?.status).toBe("NO_KNOWN_DRIFT");
    expect(row?.candidateDigest).toBe(sealed?.evidenceDigest);
    expect(evidenceDigest([
      {
        claimId: "keep",
        sourceType: "vendor-doc",
        sourceUrl: "https://example.invalid/claim",
        retrievedAt: "2026-08-20",
        sourceRevision: "2026-08-20",
        claim: "identical bytes",
      },
    ])).toBe(evidenceDigest([
      {
        claimId: "keep",
        sourceType: "vendor-doc",
        sourceUrl: "https://example.invalid/claim",
        retrievedAt: "2026-08-20",
        sourceRevision: "2026-08-20",
        claim: "identical bytes",
      },
    ]));
  });

  it("lists Grok Build as a not-admitted candidate runtime, never a model name", () => {
    const reveal = revealEvidenceRevisions();
    const grok = reveal.candidates.find((row) => row.id === "xai/grok-build-cli");
    expect(grok).toBeDefined();
    expect(grok?.admission).toBe("not-admitted");
    expect(grok?.stability).toBe("forming");
    expect(grok?.label).toBe("Grok Build CLI");
    expect(reveal.candidates.some((row) => /glm|composer|llama|deepseek-v4|qwen-model/i.test(row.id)))
      .toBe(false);
  });

  it("does not grow fingerprint builtins or public --reality ids", () => {
    expect([...FINGERPRINT_BUILTINS]).toEqual([
      "codex-v1",
      "claude-v1",
      "gemini-v1",
      "copilot-v1",
    ]);
    expect(() => profilesForReality("xai/grok-build-cli")).toThrow(/Unknown opt-in reality/);
    expect(() => profilesForReality("xai/grok-build-cli@1")).toThrow(/Unknown opt-in reality/);
    expect(() => parseArgs([".", "--reality", "grok-4"])).toThrow(/must be one of/);
    expect(() => parseArgs([".", "--reality", "cursor/composer@1"])).toThrow(/must be one of/);
    expect(() => parseArgs([".", "--reality", "zai/glm-5.3@1"])).toThrow(/must be one of/);
    expect(() => parseArgs([".", "--reality", "meta/llama@1"])).toThrow(/must be one of/);
    expect(() => parseArgs([".", "--pack", "qwen"])).toThrow(/Unknown option/);
  });

  it("prints the reveal on --detail and --receipt, never on canonical JSON or the summary", () => {
    const result = currentResult();
    const summary = renderText(result, {
      currentLabel: "WORKTREE",
      caseLabel: null,
      shellDialect: "posix",
    }, false);
    const detailed = renderDetail(result, {
      currentLabel: "WORKTREE",
      caseLabel: null,
      shellDialect: "posix",
    }, false);
    const receipt = receiptForCurrent(result);
    const json = captureJson(result);
    const text = renderEvidenceReveal(revealEvidenceRevisions());
    expect(text).toContain("EVIDENCE");
    expect(text).toContain("SEALED");
    expect(text).not.toMatch(/^EVIDENCE[\s\S]*\bCURRENT\b/u);
    expect(text).toContain("CANDIDATE");
    expect(text).toContain("NOT_ADMITTED");
    expect(text).toContain("xai/grok-build-cli");
    expect(detailed).toContain("EVIDENCE");
    expect(detailed).toContain("SEALED");
    expect(detailed).not.toMatch(/EVIDENCE[\s\S]*\bCURRENT\b/u);
    expect(receipt.markdown).toContain("EVIDENCE");
    expect(summary).not.toContain("EVIDENCE");
    expect(summary).not.toContain("POSSIBLY_STALE");
    expect(JSON.parse(json)).toEqual(result);
    expect(json).not.toContain("POSSIBLY_STALE");
    expect(json).not.toContain("NOT_ADMITTED");
  });
});
