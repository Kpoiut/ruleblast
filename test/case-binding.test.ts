import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../src/canonical.js";
import {
  captureCaseResult,
  openPackagedCase,
  verifyPromotedReceipt,
} from "../src/case.js";

const RECEIPT_PATH = resolve(
  import.meta.dirname,
  "..",
  "cases",
  "kpoiut__ruleblast",
  "27d52e2cd6ee..e420008a1c10.json",
);
const RELATIVE_PATH = "kpoiut__ruleblast/27d52e2cd6ee..e420008a1c10.json";

function readSource(path: string): string {
  return readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
}

function recanonicalize(mutate: (receipt: Record<string, unknown>) => void): Uint8Array {
  const receipt = JSON.parse(readFileSync(RECEIPT_PATH, "utf8")) as Record<string, unknown>;
  mutate(receipt);
  return Buffer.from(`${canonicalJson(receipt)}\n`, "utf8");
}

describe("promoted case binding", () => {
  it("does not duplicate receipt, core, or commit identity as source literals", () => {
    const source = readSource("src/case.ts");
    for (const literal of [
      "5735038d47cae7b538e113d51214dbbc6ecd29cbca815912813abaa900ecfc89",
      "1e907a88ed648ebbd68b4f588c3bd09058ab7714e8f85a3f2d4a1c60e5a40938",
      "27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8",
      "e420008a1c10c5c328e506247560117f4d40b855",
      "27d52e2cd6ee..e420008a1c10.json",
    ]) {
      expect(source).not.toContain(literal);
    }
    expect(readSource("src/render-text.ts")).not.toMatch(/ruleblast@\d+\.\d+\.\d+/u);
  });

  it("binds the promoted receipt by path convention and internal digest", async () => {
    const bytes = readFileSync(RECEIPT_PATH);
    const verified = verifyPromotedReceipt(bytes, RELATIVE_PATH);
    const receipt = JSON.parse(bytes.toString("utf8")) as {
      readonly resultCore: unknown;
      readonly coreDigest: string;
      readonly repository: { readonly owner: string; readonly repo: string };
      readonly base: string;
      readonly head: string;
    };

    expect(verified.receiptSha256).toBe(sha256(bytes));
    expect(verified.resultCore).toEqual(receipt.resultCore);
    expect(verified.presentation).toEqual({
      label: `${receipt.repository.owner}/${receipt.repository.repo}`,
      beforeLabel: receipt.base.slice(0, 12),
      afterLabel: receipt.head.slice(0, 12),
    });
    expect(await openPackagedCase()).toEqual(receipt.resultCore);
    expect(captureCaseResult(receipt.resultCore)).toEqual(receipt.resultCore);
  });

  it("rejects a receipt whose path, digest, or identity does not bind", () => {
    const bytes = readFileSync(RECEIPT_PATH);
    expect(() => verifyPromotedReceipt(bytes, "other/27d52e2cd6ee..e420008a1c10.json"))
      .toThrow(/path/iu);
    expect(() => verifyPromotedReceipt(
      recanonicalize((receipt) => {
        receipt.coreDigest = "0".repeat(64);
      }),
      RELATIVE_PATH,
    )).toThrow(/digest/iu);
    expect(() => verifyPromotedReceipt(
      recanonicalize((receipt) => {
        receipt.base = "abc";
      }),
      RELATIVE_PATH,
    )).toThrow(/identit|oid|commit/iu);
    expect(() => captureCaseResult({
      mode: "diff",
      schemaVersion: 1,
      resolverRevision: 1,
      before: { kind: "git", label: "x", oid: "x" },
      after: { kind: "git", label: "y", oid: "y" },
      paths: [],
      findings: [],
    })).toThrow(/unverified|digest|identit|invalid/iu);
  });
});
