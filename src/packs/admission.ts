import { canonicalJson, sha256 } from "../canonical.js";
import { isUnversionedRuntimeId, isVersionedRuntimeId } from "../domain/runtime-id.js";
import { FIXTURE_AXES, type FixtureAxis } from "./candidate.js";
import { InvalidPackError } from "./compile.js";
import type { ResolverSpec } from "./schema.js";

export const ADMISSION_SCHEMA_ID = "ruleblast.reality-admission.v1";

export interface RealityAdmission {
  readonly schema: typeof ADMISSION_SCHEMA_ID;
  readonly candidateId: string;
  readonly modeledId: string;
  readonly evidenceRevision: string;
  readonly resolverDigest: string;
  readonly fixtureAxes: readonly FixtureAxis[];
  readonly oracleProof: "ORACLE";
  readonly calibration: "CALIBRATED" | "NO_INTROSPECTION";
}

export interface RealityAdmissionInput {
  readonly candidateId: string;
  readonly resolver: ResolverSpec;
  readonly fixtureAxes: readonly FixtureAxis[];
  readonly evidenceRevision: string;
  readonly oracleProof: "ORACLE" | "ADAPTER";
  readonly calibration: "CALIBRATED" | "NO_INTROSPECTION";
}

function fail(detail: string): never {
  throw new InvalidPackError(detail);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ownKeys(value: object): readonly string[] {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) fail("object must not have symbol keys");
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

function modeledFromCandidate(candidateId: string, modeledId: string): void {
  if (!isUnversionedRuntimeId(candidateId)) {
    fail(`admission.candidateId must be unversioned: ${JSON.stringify(candidateId)}`);
  }
  if (!isVersionedRuntimeId(modeledId)) {
    fail(`admission.modeledId must be versioned: ${JSON.stringify(modeledId)}`);
  }
  if (!modeledId.startsWith(`${candidateId}@`)) {
    fail(`admission.modeledId must be ${candidateId}@N`);
  }
}

export function decodeRealityAdmission(value: unknown): RealityAdmission {
  const object = expectKeys(value, [
    "schema",
    "candidateId",
    "modeledId",
    "evidenceRevision",
    "resolverDigest",
    "fixtureAxes",
    "oracleProof",
    "calibration",
  ], "admission");
  const schema = expectString(object.schema, "admission.schema");
  if (schema !== ADMISSION_SCHEMA_ID) fail(`unsupported admission schema: ${schema}`);
  const candidateId = expectString(object.candidateId, "admission.candidateId");
  const modeledId = expectString(object.modeledId, "admission.modeledId");
  modeledFromCandidate(candidateId, modeledId);
  const fixtureAxes = object.fixtureAxes;
  if (!Array.isArray(fixtureAxes)) fail("admission.fixtureAxes must be an array");
  if (
    fixtureAxes.length !== FIXTURE_AXES.length ||
    FIXTURE_AXES.some((axis, index) => fixtureAxes[index] !== axis)
  ) {
    fail(`admission.fixtureAxes must be ${FIXTURE_AXES.join(", ")}`);
  }
  const oracleProof = expectString(object.oracleProof, "admission.oracleProof");
  if (oracleProof !== "ORACLE") fail("admission.oracleProof must be ORACLE");
  const calibration = expectString(object.calibration, "admission.calibration");
  if (calibration !== "CALIBRATED" && calibration !== "NO_INTROSPECTION") {
    fail("admission.calibration must be CALIBRATED or NO_INTROSPECTION");
  }
  const resolverDigest = expectString(object.resolverDigest, "admission.resolverDigest");
  if (!/^[0-9a-f]{64}$/u.test(resolverDigest)) {
    fail("admission.resolverDigest must be a SHA-256 hex digest");
  }
  return Object.freeze({
    schema: ADMISSION_SCHEMA_ID,
    candidateId,
    modeledId,
    evidenceRevision: expectString(object.evidenceRevision, "admission.evidenceRevision"),
    resolverDigest,
    fixtureAxes: FIXTURE_AXES,
    oracleProof: "ORACLE",
    calibration: calibration as RealityAdmission["calibration"],
  });
}

export function assertRealityAdmission(
  record: RealityAdmission,
  input: RealityAdmissionInput,
): void {
  if (record.candidateId !== input.candidateId) {
    fail(`admission.candidateId ${record.candidateId} does not match ${input.candidateId}`);
  }
  modeledFromCandidate(input.candidateId, record.modeledId);
  const digest = sha256(canonicalJson(input.resolver));
  if (record.resolverDigest !== digest) {
    fail(`admission.resolverDigest mismatch: expected ${digest}`);
  }
  if (
    record.fixtureAxes.length !== input.fixtureAxes.length ||
    record.fixtureAxes.some((axis, index) => axis !== input.fixtureAxes[index])
  ) {
    fail("admission.fixtureAxes do not match recorded axes");
  }
  if (input.oracleProof !== "ORACLE" || record.oracleProof !== "ORACLE") {
    fail("admission requires ORACLE proof, not an adapter fingerprint");
  }
  if (record.calibration !== input.calibration) {
    fail("admission.calibration does not match sealed calibration proof");
  }
  if (record.evidenceRevision !== input.evidenceRevision) {
    fail("admission.evidenceRevision does not match recorded evidence revision");
  }
}
