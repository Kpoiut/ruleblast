import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InvalidPackError, decodePackEvidence } from "./compile.js";
import type { PackClaim } from "./schema.js";

export const CANDIDATE_SCHEMA_ID = "ruleblast.candidate.v1";

export const CANDIDATE_STABILITIES = Object.freeze([
  "forming",
  "watch",
  "preview",
] as const);

export type CandidateStability = (typeof CANDIDATE_STABILITIES)[number];

const CANDIDATE_ID_PATTERN =
  /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*(@[1-9][0-9]*)?$/u;

export interface CandidateSurface {
  readonly schema: typeof CANDIDATE_SCHEMA_ID;
  readonly id: string;
  readonly label: string;
  readonly admission: "not-admitted";
  readonly stability: CandidateStability;
  readonly reason: string;
  readonly evidence: readonly PackClaim[];
}

function fail(detail: string): never {
  throw new InvalidPackError(detail);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ownKeys(value: object): readonly string[] {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) {
    fail("object must not have symbol keys");
  }
  return keys as string[];
}

function expectKeys(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!isPlainObject(value)) fail(`${label} must be an object`);
  const actual = ownKeys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    fail(`${label} has unknown or missing fields (${actual.join(",")})`);
  }
  return value;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") fail(`${label} must be a non-empty string`);
  return value;
}

export function decodeCandidateSurface(value: unknown): CandidateSurface {
  const object = expectKeys(value, [
    "schema",
    "id",
    "label",
    "admission",
    "stability",
    "reason",
    "evidence",
  ], "candidate");
  const schema = expectString(object.schema, "candidate.schema");
  if (schema !== CANDIDATE_SCHEMA_ID) fail(`unsupported candidate schema: ${schema}`);
  const id = expectString(object.id, "candidate.id");
  if (CANDIDATE_ID_PATTERN.exec(id)?.[0] !== id) {
    fail(`candidate.id is not a runtime surface id: ${JSON.stringify(id)}`);
  }
  const admission = expectString(object.admission, "candidate.admission");
  if (admission !== "not-admitted") fail("candidate.admission must be not-admitted");
  const stability = expectString(object.stability, "candidate.stability");
  if (!(CANDIDATE_STABILITIES as readonly string[]).includes(stability)) {
    fail(`candidate.stability must be one of ${CANDIDATE_STABILITIES.join(", ")}`);
  }
  return Object.freeze({
    schema: CANDIDATE_SCHEMA_ID,
    id,
    label: expectString(object.label, "candidate.label"),
    admission: "not-admitted",
    stability: stability as CandidateStability,
    reason: expectString(object.reason, "candidate.reason"),
    evidence: decodePackEvidence(object.evidence),
  });
}

export function readCandidateSurface(directory: string): CandidateSurface {
  const path = join(directory, "candidate.json");
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new InvalidPackError(`unreadable JSON ${path}: ${String(error)}`);
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new InvalidPackError(`malformed JSON ${path}: ${String(error)}`);
  }
  return decodeCandidateSurface(value);
}
