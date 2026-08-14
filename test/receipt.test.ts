import { describe, expect, it } from "vitest";
import { CliUsageError, parseArgs } from "../src/args.js";
import { present } from "../src/cli-output.js";
import { rbctxForProjection } from "../src/domain/rbctx.js";
import {
  OPENAI_CODEX_CLI_PROFILE_ID,
  type CurrentRuleBlastResult,
  type Projection,
} from "../src/model.js";
import { receiptForCurrent } from "../src/render-receipt.js";

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

function capturePresent(
  value: CurrentRuleBlastResult,
  kind: "json" | "text",
  extras: { witness?: boolean; receipt?: boolean } = {},
): string {
  const stdout: string[] = [];
  present(
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
  it("derives a deterministic card from existing result counts only", () => {
    const result = currentResult();
    const first = receiptForCurrent(result);
    const second = receiptForCurrent(result);
    expect(first).toEqual(second);
    expect(first.version).toBe("RBREC1");
    expect(first.rbctx).toMatch(/^RBCTX1:[0-9a-f]{12}$/u);
    expect(first.markdown).toContain("RULEBLAST PROOF");
    expect(first.markdown).toContain("WORKTREE");
    expect(first.markdown).toContain("openai/codex-cli@1");
    expect(first.markdown).toContain("Not a claim about model compliance.");
    expect(first.markdown).not.toContain("Copilot");
  });

  it("keeps default JSON free of receipt or context envelopes", () => {
    const raw = capturePresent(currentResult(), "json");
    expect(JSON.parse(raw)).toEqual(currentResult());
    expect(raw).not.toContain("RBREC1");
    expect(raw).not.toContain("RBCTX1");
    expect(raw).not.toContain("ruleblast.witness.v1");
  });

  it("emits the receipt card for --receipt json and markdown for text", () => {
    const card = JSON.parse(capturePresent(currentResult(), "json", { receipt: true })) as {
      readonly version: string;
      readonly rbctx: string;
      readonly markdown: string;
    };
    expect(card.version).toBe("RBREC1");
    expect(card.rbctx).toMatch(/^RBCTX1:/u);
    expect(capturePresent(currentResult(), "text", { receipt: true })).toContain(
      "RULEBLAST PROOF",
    );
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
