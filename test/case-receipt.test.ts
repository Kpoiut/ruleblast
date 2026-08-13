import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../src/canonical.js";

const CASE_PATH = resolve(
  import.meta.dirname,
  "..",
  "cases",
  "kpoiut__ruleblast",
  "27d52e2cd6ee..e420008a1c10.json",
);
const BASE = "27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8";
const HEAD = "e420008a1c10c5c328e506247560117f4d40b855";
const PRODUCER = "ad815c092ce0e5a34dbcabf739b460c88696bff7";
const CORE_DIGEST = "1e907a88ed648ebbd68b4f588c3bd09058ab7714e8f85a3f2d4a1c60e5a40938";

interface CaseReceipt {
  readonly schemaVersion: number;
  readonly repository: {
    readonly url: string;
    readonly owner: string;
    readonly repo: string;
  };
  readonly base: string;
  readonly head: string;
  readonly resolverRevision: number;
  readonly resultCore: {
    readonly resolverRevision: number;
    readonly counts: {
      readonly candidatePathCount: number;
      readonly changedStackPathCount: number;
      readonly newlySplitPathCount: number;
      readonly currentSplitPathCount: number;
      readonly convergedPathCount: number;
      readonly partialPathCount: number;
      readonly unknownPathCount: number;
      readonly indeterminatePathCount: number;
      readonly byProfile: readonly {
        readonly profile: string;
        readonly changedStackPathCount: number;
        readonly completePathCount: number;
        readonly partialPathCount: number;
        readonly unknownPathCount: number;
      }[];
    };
    readonly diffStats: {
      readonly addedLineCount: number;
      readonly deletedLineCount: number;
      readonly editedLineCount: number;
      readonly binaryChangedSourceCount: number;
    };
  };
  readonly coreDigest: string;
  readonly producer: {
    readonly gitCommit: string;
    readonly packageVersion: string;
    readonly artifactDigest: string;
    readonly dependencyClosureDigest: string;
  };
  readonly releaseReproductionCommand: string;
}

describe("promoted Blast Case receipt", () => {
  it("pins the real RuleBlast self-case and its verified pilot metrics", () => {
    expect(existsSync(CASE_PATH)).toBe(true);
    const bytes = readFileSync(CASE_PATH);
    const text = bytes.toString("utf8");
    const receipt = JSON.parse(text) as CaseReceipt;

    expect(text).toBe(`${canonicalJson(receipt)}\n`);
    expect(text.slice(0, -1)).not.toContain("\n");
    expect(bytes.byteLength).toBeLessThan(1024 * 1024);
    expect(receipt).toMatchObject({
      schemaVersion: 1,
      repository: {
        url: "https://github.com/kpoiut/ruleblast",
        owner: "kpoiut",
        repo: "ruleblast",
      },
      base: BASE,
      head: HEAD,
      resolverRevision: 1,
      coreDigest: CORE_DIGEST,
      producer: {
        gitCommit: PRODUCER,
        packageVersion: "0.0.0-development",
        artifactDigest:
          "7c68471b3067e60406e1faf15afadf9c4e442f2b39e30f680cf87e1e648032c0",
        dependencyClosureDigest:
          "df14d3a9d71cda2ad8efa9bba5ec3e50fedd9b29be08a35ff02c17fa9f2b43b7",
      },
      releaseReproductionCommand:
        `npx ruleblast@1.0.0 diff ${BASE} --to ${HEAD} --json`,
    });
    expect(receipt.resolverRevision).toBe(receipt.resultCore.resolverRevision);
    expect(receipt.coreDigest).toBe(sha256(canonicalJson(receipt.resultCore)));
    expect(receipt.producer.artifactDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(receipt.producer.dependencyClosureDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(receipt.resultCore.counts).toEqual({
      candidatePathCount: 106,
      changedStackPathCount: 106,
      newlySplitPathCount: 0,
      convergedPathCount: 0,
      currentSplitPathCount: 0,
      partialPathCount: 0,
      unknownPathCount: 0,
      indeterminatePathCount: 0,
      byProfile: [
        {
          profile: "anthropic/claude-code-cli@1",
          changedStackPathCount: 106,
          completePathCount: 106,
          partialPathCount: 0,
          unknownPathCount: 0,
        },
        {
          profile: "openai/codex-cli@1",
          changedStackPathCount: 106,
          completePathCount: 106,
          partialPathCount: 0,
          unknownPathCount: 0,
        },
      ],
    });
    expect(receipt.resultCore.diffStats).toEqual({
      addedLineCount: 33,
      deletedLineCount: 0,
      editedLineCount: 33,
      binaryChangedSourceCount: 0,
    });
    expect(text).not.toContain("D:\\TUT123");
    expect(text).not.toContain("RuleBlast repository instructions");
    expect(text).not.toContain("@AGENTS.md");
  });
});
