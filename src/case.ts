import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "./canonical.js";
import type { DiffRuleBlastResult } from "./model.js";

const CASES_ROOT = fileURLToPath(new URL("../cases", import.meta.url));
const GIT_OID = /^[0-9a-f]{40}$/u;
const GIT_DIGEST = /^[0-9a-f]{64}$/u;
const GITHUB_NAME = /^[A-Za-z0-9_.-]+$/u;
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

export interface PackagedCasePresentation {
  readonly label: string;
  readonly beforeLabel: string;
  readonly afterLabel: string;
}

export interface VerifiedPromotedCase {
  readonly receiptSha256: string;
  readonly resultCore: DiffRuleBlastResult;
  readonly presentation: PackagedCasePresentation;
  readonly base: string;
  readonly head: string;
}

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

function requireGitOid(value: unknown, label: string): string {
  if (typeof value !== "string" || !GIT_OID.test(value)) {
    fail(`${label} must be a full Git commit id`);
  }
  return value;
}

function requireGithubName(value: unknown, label: string): string {
  if (typeof value !== "string" || !GITHUB_NAME.test(value)) {
    fail(`${label} is not a public GitHub identity`);
  }
  return value;
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

function listReceiptPaths(root: string, relative = ""): string[] {
  const directory = relative === "" ? root : join(root, relative);
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const next = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) found.push(...listReceiptPaths(root, next));
    else if (entry.isFile() && entry.name.endsWith(".json")) found.push(next);
  }
  return found.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function parseReceipt(bytes: Uint8Array): CaseReceipt {
  if (bytes.byteLength === 0) fail("receipt is empty");
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

export function verifyPromotedReceipt(
  bytes: Uint8Array,
  relativePosixPath: string,
): VerifiedPromotedCase {
  const receiptSha256 = sha256(bytes);
  if (!GIT_DIGEST.test(receiptSha256)) fail("receipt SHA-256 is incomplete");
  const receipt = parseReceipt(bytes);
  if (receipt.schemaVersion !== 1 || receipt.resolverRevision !== 1 ||
      !isRecord(receipt.repository)) {
    fail("repository identity or resolver revision changed");
  }
  const owner = requireGithubName(receipt.repository.owner, "owner");
  const repo = requireGithubName(receipt.repository.repo, "repo");
  const base = requireGitOid(receipt.base, "base");
  const head = requireGitOid(receipt.head, "head");
  const expectedPath = `${owner}__${repo}/${base.slice(0, 12)}..${head.slice(0, 12)}.json`;
  if (relativePosixPath !== expectedPath) {
    fail("receipt path does not bind to repository identity");
  }
  if (receipt.repository.url !== `https://github.com/${owner}/${repo}`) {
    fail("repository identity or resolver revision changed");
  }
  if (typeof receipt.coreDigest !== "string" || !GIT_DIGEST.test(receipt.coreDigest)) {
    fail("resultCore digest changed");
  }
  assertCore(receipt.resultCore, base, head);
  const digest = sha256(canonicalJson(receipt.resultCore));
  if (digest !== receipt.coreDigest) fail("resultCore digest changed");
  return {
    receiptSha256,
    resultCore: receipt.resultCore,
    presentation: {
      label: `${owner}/${repo}`,
      beforeLabel: base.slice(0, 12),
      afterLabel: head.slice(0, 12),
    },
    base,
    head,
  };
}

function loadPromotedCase(): VerifiedPromotedCase {
  const receipts = listReceiptPaths(CASES_ROOT);
  if (receipts.length !== 1) {
    fail("exactly one promoted receipt must be packaged");
  }
  const relativePosixPath = receipts[0]!;
  return verifyPromotedReceipt(
    readFileSync(join(CASES_ROOT, ...relativePosixPath.split("/"))),
    relativePosixPath,
  );
}

export function packagedCasePresentation(): PackagedCasePresentation {
  return loadPromotedCase().presentation;
}

export function captureCaseResult(value: unknown): DiffRuleBlastResult {
  const promoted = loadPromotedCase();
  const captured = JSON.parse(canonicalJson(value)) as unknown;
  if (!isRecord(captured) || Object.keys(captured).length !== RESULT_FIELDS.length ||
      RESULT_FIELDS.some((field) => !(field in captured)) ||
      !isRecord(captured.before) ||
      !isRecord(captured.after) || typeof captured.before.oid !== "string" ||
      typeof captured.after.oid !== "string") {
    fail("case dependency returned an invalid result");
  }
  assertCore(captured, promoted.base, promoted.head);
  if (sha256(canonicalJson(captured)) !== sha256(canonicalJson(promoted.resultCore))) {
    fail("case dependency returned an unverified result");
  }
  return captured;
}

export async function openPackagedCase(): Promise<DiffRuleBlastResult> {
  return loadPromotedCase().resultCore;
}
