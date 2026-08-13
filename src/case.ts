import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "./canonical.js";
import type { DiffRuleBlastResult } from "./model.js";

const RECEIPT_URL = new URL(
  "../cases/kpoiut__ruleblast/27d52e2cd6ee..e420008a1c10.json",
  import.meta.url,
);
const RECEIPT_SHA256 =
  "5735038d47cae7b538e113d51214dbbc6ecd29cbca815912813abaa900ecfc89";
const CORE_SHA256 =
  "1e907a88ed648ebbd68b4f588c3bd09058ab7714e8f85a3f2d4a1c60e5a40938";
const BASE = "27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8";
const HEAD = "e420008a1c10c5c328e506247560117f4d40b855";
const RESULT_FIELDS = [
  "mode",
  "schemaVersion",
  "resolverRevision",
  "before",
  "after",
  "diffStats",
  "changedInstructionSources",
  "counts",
  "groups",
  "paths",
  "findings",
] as const;

export const PACKAGED_CASE_PRESENTATION = Object.freeze({
  label: "kpoiut/ruleblast",
  beforeLabel: BASE.slice(0, 12),
  afterLabel: HEAD.slice(0, 12),
});

interface CaseReceipt {
  readonly schemaVersion: unknown;
  readonly repository: {
    readonly url?: unknown;
    readonly owner?: unknown;
    readonly repo?: unknown;
  };
  readonly base: unknown;
  readonly head: unknown;
  readonly resolverRevision: unknown;
  readonly resultCore: unknown;
  readonly coreDigest: unknown;
}

function fail(message: string): never {
  throw new TypeError(`Packaged case receipt failed verification: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertCore(
  value: unknown,
  base: string,
  head: string,
): asserts value is DiffRuleBlastResult {
  if (!isRecord(value) || value.mode !== "diff" || value.schemaVersion !== 1 ||
      value.resolverRevision !== 1 || !isRecord(value.before) ||
      !isRecord(value.after) || value.before.kind !== "git" ||
      value.before.label !== base || value.before.oid !== base ||
      value.after.kind !== "git" || value.after.label !== head ||
      value.after.oid !== head || !Array.isArray(value.paths) ||
      !Array.isArray(value.findings)) {
    fail("resultCore identity is invalid");
  }
}

function parseReceipt(bytes: Uint8Array): CaseReceipt {
  if (sha256(bytes) !== RECEIPT_SHA256) fail("receipt SHA-256 changed");
  const text = Buffer.from(bytes).toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return fail("receipt is not JSON");
  }
  if (!isRecord(parsed)) fail("receipt must be an object");
  if (text !== `${canonicalJson(parsed)}\n`) {
    fail("receipt must be canonical single-line JSON with one LF");
  }
  return parsed as unknown as CaseReceipt;
}

function verifyReceipt(receipt: CaseReceipt): DiffRuleBlastResult {
  if (receipt.schemaVersion !== 1 || receipt.resolverRevision !== 1 ||
      receipt.base !== BASE || receipt.head !== HEAD ||
      !isRecord(receipt.repository) ||
      receipt.repository.url !== "https://github.com/kpoiut/ruleblast" ||
      receipt.repository.owner !== "kpoiut" ||
      receipt.repository.repo !== "ruleblast") {
    fail("repository identity or resolver revision changed");
  }
  assertCore(receipt.resultCore, BASE, HEAD);
  const digest = sha256(canonicalJson(receipt.resultCore));
  if (receipt.coreDigest !== CORE_SHA256 || digest !== CORE_SHA256) {
    fail("resultCore digest changed");
  }
  return receipt.resultCore;
}

export function captureCaseResult(value: unknown): DiffRuleBlastResult {
  const captured = JSON.parse(canonicalJson(value)) as unknown;
  if (!isRecord(captured) || Object.keys(captured).length !== RESULT_FIELDS.length ||
      RESULT_FIELDS.some((field) => !(field in captured)) ||
      !isRecord(captured.before) ||
      !isRecord(captured.after) || typeof captured.before.oid !== "string" ||
      typeof captured.after.oid !== "string") {
    fail("case dependency returned an invalid result");
  }
  assertCore(captured, BASE, HEAD);
  if (sha256(canonicalJson(captured)) !== CORE_SHA256) {
    fail("case dependency returned an unverified result");
  }
  return captured;
}

export async function openPackagedCase(): Promise<DiffRuleBlastResult> {
  return verifyReceipt(parseReceipt(await readFile(RECEIPT_URL)));
}
