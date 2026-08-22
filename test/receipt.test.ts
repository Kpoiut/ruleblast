import { beforeAll, describe, expect, it } from "vitest";
import { ensureConformanceLab } from "../src/application/conformance-lab.js";
import { CliUsageError, parseArgs } from "../src/args.js";
import { currentExplain, present } from "../src/cli-output.js";
import { receiptForCurrent, receiptForExplain } from "../src/render-receipt.js";
import { rbctxForProjection } from "../src/domain/rbctx.js";
import {
  OPENAI_CODEX_CLI_PROFILE_ID,
  type CurrentRuleBlastResult,
  type Projection,
} from "../src/model.js";

function projection(overrides: Partial<Projection> = {}): Projection {
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
    ...overrides,
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

async function capturePresent(
  value: CurrentRuleBlastResult,
  kind: "json" | "text",
  extras: { witness?: boolean; receipt?: boolean } = {},
): Promise<string> {
  const stdout: string[] = [];
  await present(
    value,
    { kind, color: "never" },
    {
      stdout: (text) => { stdout.push(text); },
      stderr: () => { throw new Error("present must not write stderr"); },
      env: {},
      stdoutIsTTY: false,
    },
    undefined,
    extras,
  );
  return stdout.join("");
}

describe("RBCTX identity", () => {
  it("is stable for the same projection and moves when a source digest moves", () => {
    const first = rbctxForProjection(projection());
    const second = rbctxForProjection(projection());
    const moved = rbctxForProjection(projection({
      sources: [{
        path: "src/AGENTS.md",
        disposition: "SELECTED",
        digest: "CHANGED",
        bytesUsed: 12,
        truncated: false,
      }],
    }));
    expect(first).toMatch(/^RBCTX1:[0-9a-f]{12}$/u);
    expect(first).toBe(second);
    expect(moved).not.toBe(first);
  });
});

describe("pasteable receipt", () => {
  beforeAll(async () => {
    await ensureConformanceLab();
  });

  it("derives a deterministic card from existing result counts only", async () => {
    const result = currentResult();
    const first = await receiptForCurrent(result);
    const second = await receiptForCurrent(result);
    expect(first).toEqual(second);
    expect(first.version).toBe("RBREC1");
    expect(first.rbctx).toMatch(/^RBCTX1:[0-9a-f]{12}$/u);
    expect(first.markdown).toContain("RULEBLAST PROOF");
    expect(first.markdown).toContain("+-- scoreboard");
    expect(first.markdown).toContain("WORKTREE");
    expect(first.markdown).toContain("CX Codex");
    expect(first.markdown).not.toContain("openai/codex-cli@1");
    expect(first.markdown).toContain("agent-allow ask");
    expect(first.markdown).toContain("Not a claim about model compliance.");
    expect(first.markdown).toContain("EVIDENCE");
    const scoreboard = first.markdown.slice(0, first.markdown.indexOf("EVIDENCE"));
    expect(scoreboard).not.toContain("Copilot");
    expect((await receiptForCurrent(result, "yes")).markdown).toContain("agent-allow yes");
  });

  it("keeps default JSON free of receipt or context envelopes", async () => {
    const raw = await capturePresent(currentResult(), "json");
    expect(JSON.parse(raw)).toEqual(currentResult());
    expect(raw).not.toContain("RBREC1");
    expect(raw).not.toContain("RBCTX1");
    expect(raw).not.toContain("ruleblast.witness.v1");
  });

  it("emits the receipt card for --receipt json and markdown for text", async () => {
    const card = JSON.parse(await capturePresent(currentResult(), "json", { receipt: true })) as {
      readonly version: string;
      readonly rbctx: string;
      readonly markdown: string;
    };
    expect(card.version).toBe("RBREC1");
    expect(card.rbctx).toMatch(/^RBCTX1:/u);
    expect(await capturePresent(currentResult(), "text", { receipt: true })).toContain(
      "RULEBLAST PROOF",
    );
  });

  it("derives an explain receipt from the path projections instead of a stub", async () => {
    const explained = currentExplain(currentResult(), "src/file.ts");
    const card = await receiptForExplain(explained);
    expect(card.version).toBe("RBREC1");
    expect(card.title).toBe("explain");
    expect(card.rbctx).toMatch(/^RBCTX1:[0-9a-f]{12}$/u);
    expect(card.markdown).toContain("src/file.ts");
    expect(card.markdown).toContain("CX Codex");
    expect(card.markdown).toContain("COMPLETE");
    expect(card.markdown).toContain("ORDERED");
    expect(card.markdown).toContain("SAME");
    expect(card.markdown).toContain("EVIDENCE");
    expect(card.markdown).toContain("LAB");
    expect(card.markdown).not.toMatch(/^RULEBLAST PROOF\nexplain src\/file\.ts\n/u);
    const stdout: string[] = [];
    await present(
      explained,
      { kind: "json", color: "never" },
      {
        stdout: (text) => { stdout.push(text); },
        stderr: () => { throw new Error("present must not write stderr"); },
        env: {},
        stdoutIsTTY: false,
      },
      undefined,
      { receipt: true },
    );
    const emitted = JSON.parse(stdout.join("")) as {
      readonly version: string;
      readonly title: string;
      readonly rbctx: string;
      readonly markdown: string;
    };
    expect(emitted).toEqual(card);
  });

  it("derives a diff explain receipt from before and after projections", async () => {
    const explained = {
      mode: "explain" as const,
      analysisMode: "diff" as const,
      schemaVersion: 1 as const,
      resolverRevision: 1 as const,
      before: { kind: "git" as const, label: "HEAD~1", oid: null },
      after: { kind: "git" as const, label: "HEAD", oid: null },
      path: {
        path: "src/file.ts",
        before: [projection()],
        after: [projection({ projectionDigest: "q" })],
        changedProfiles: [OPENAI_CODEX_CLI_PROFILE_ID],
        beforePayloadRelation: "SAME" as const,
        afterPayloadRelation: "DIFFERENT" as const,
        wasSplit: false,
        isSplit: true,
        causes: ["AGENTS.md"],
      },
      findings: [],
    };
    const card = await receiptForExplain(explained);
    expect(card.title).toBe("explain");
    expect(card.markdown).toContain("HEAD~1 → HEAD");
    expect(card.markdown).toContain("src/file.ts");
    expect(card.markdown).toContain("SAME → DIFFERENT");
    expect(card.markdown).toContain("CX Codex");
    expect(card.markdown).toContain("LAB");
    expect(card.markdown).not.toMatch(/^RULEBLAST PROOF\nexplain /u);
  });
});

describe("--receipt parser", () => {
  it("accepts one --receipt and still rejects later product flags", () => {
    expect(parseArgs([".", "--receipt"])).toMatchObject({
      action: "scan", receipt: true, witness: false,
    });
    expect(parseArgs(["diff", "HEAD~1", "--receipt", "--witness"])).toMatchObject({
      action: "diff", receipt: true, witness: true,
    });
    expect(() => parseArgs([".", "--receipt", "--receipt"])).toThrow(CliUsageError);
    expect(() => parseArgs([".", "--reality", "github/copilot-vscode@1"])).toThrow(
      CliUsageError,
    );
  });
});
