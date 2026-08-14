import { describe, expect, it } from "vitest";
import { CliUsageError, parseArgs } from "../src/args.js";
import { present } from "../src/cli-output.js";
import { witnessForProjection } from "../src/domain/witness.js";
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
      disposition: "SHADOWED",
      digest: "abc",
      bytesUsed: 0,
      truncated: false,
    }, {
      path: "src/AGENTS.override.md",
      disposition: "SELECTED",
      digest: "def",
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
    snapshot: { kind: "worktree", label: "worktree", oid: null },
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
  witness: boolean,
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
    { witness },
  );
  return stdout.join("");
}

describe("resolution witness graph", () => {
  it("names same-directory override precedence instead of only repeating SHADOWED", () => {
    const graph = witnessForProjection(projection());
    expect(graph.version).toBe("RBWIT1");
    expect(graph.profile).toBe(OPENAI_CODEX_CLI_PROFILE_ID);
    expect(graph.targetPath).toBe("src/file.ts");
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rule: "same-directory-override-precedence",
        decision: "SHADOWED",
        inputs: ["src/AGENTS.md", "AGENTS.override.md"],
      }),
      expect.objectContaining({
        rule: "documented-selection",
        decision: "SELECTED",
      }),
    ]));
  });

  it("keeps default JSON as the canonical result with no witness envelope", () => {
    const raw = capturePresent(currentResult(), "json", false);
    const parsed = JSON.parse(raw) as CurrentRuleBlastResult;
    expect(parsed).toEqual(currentResult());
    expect(raw).not.toContain("ruleblast.witness.v1");
    expect(raw).not.toContain("RBWIT1");
  });

  it("wraps opt-in witness JSON without mutating the enclosed result", () => {
    const result = currentResult();
    const parsed = JSON.parse(capturePresent(result, "json", true)) as {
      readonly envelope: string;
      readonly result: CurrentRuleBlastResult;
      readonly witness: readonly { readonly version: string }[];
    };
    expect(parsed.envelope).toBe("ruleblast.witness.v1");
    expect(parsed.result).toEqual(result);
    expect(parsed.witness[0]?.version).toBe("RBWIT1");
  });

  it("appends why-edges to text without changing the default renderer", () => {
    const text = capturePresent(currentResult(), "text", true);
    expect(text).toContain("WHY this resolution");
    expect(text).toContain("same-directory-override-precedence");
    expect(capturePresent(currentResult(), "text", false)).not.toContain(
      "WHY this resolution",
    );
  });
});

describe("--witness parser", () => {
  it("accepts one --witness on every analysis action", () => {
    expect(parseArgs([".", "--witness"])).toMatchObject({
      action: "scan", witness: true,
    });
    expect(parseArgs(["diff", "HEAD~1", "--witness"])).toMatchObject({
      action: "diff", witness: true,
    });
    expect(parseArgs(["explain", "src/args.ts", "--witness", "--json"])).toMatchObject({
      action: "explain", witness: true, output: { kind: "json" },
    });
    expect(parseArgs(["case", "--witness"])).toMatchObject({
      action: "case", witness: true,
    });
  });

  it("rejects a duplicate --witness and later product flags", () => {
    expect(() => parseArgs([".", "--witness", "--witness"])).toThrow(CliUsageError);
    expect(() => parseArgs([".", "--reality", "github/copilot-cli@1"])).toThrow(
      /Unknown option/u,
    );
  });
});
