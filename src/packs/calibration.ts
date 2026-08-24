import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InvalidPackError, decodePackEvidence } from "./compile.js";
import { interpretCompiledPack, uninterpretableReasons } from "./interpret.js";
import { assertSealedProbes } from "./verify.js";
import type { PackClaim } from "./schema.js";
import type { CompiledPack } from "./schema.js";

export const CALIBRATION_SCHEMA_ID = "ruleblast.runtime-calibration.v1";
export const CALIBRATION_FILE = "calibration.json";

export type CalibrationObservation = "vendor-dump" | "no-introspection";
export type CalibrationProof = "CALIBRATED" | "NO_INTROSPECTION";

export interface RuntimeCalibration {
  readonly schema: typeof CALIBRATION_SCHEMA_ID;
  readonly packId: string;
  readonly observation: CalibrationObservation;
  readonly evidence: readonly PackClaim[];
  readonly probes: readonly unknown[];
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

function readJson(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new InvalidPackError(`unreadable JSON ${path}: ${String(error)}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new InvalidPackError(`malformed JSON ${path}: ${String(error)}`);
  }
}

export function decodeRuntimeCalibration(value: unknown): RuntimeCalibration {
  const object = expectKeys(value, [
    "schema",
    "packId",
    "observation",
    "evidence",
    "probes",
  ], "calibration");
  const schema = expectString(object.schema, "calibration.schema");
  if (schema !== CALIBRATION_SCHEMA_ID) fail(`unsupported calibration schema: ${schema}`);
  const observation = expectString(object.observation, "calibration.observation");
  if (observation !== "vendor-dump" && observation !== "no-introspection") {
    fail("calibration.observation must be vendor-dump or no-introspection");
  }
  if (!Array.isArray(object.probes)) fail("calibration.probes must be an array");
  if (observation === "no-introspection" && object.probes.length !== 0) {
    fail("no-introspection calibration must not carry probes");
  }
  if (observation === "vendor-dump" && object.probes.length === 0) {
    fail("vendor-dump calibration must carry sealed probes");
  }
  return Object.freeze({
    schema: CALIBRATION_SCHEMA_ID,
    packId: expectString(object.packId, "calibration.packId"),
    observation: observation as CalibrationObservation,
    evidence: decodePackEvidence(object.evidence),
    probes: Object.freeze([...object.probes]),
  });
}

export function readSealedCalibration(directory: string, packId: string): RuntimeCalibration {
  const decoded = decodeRuntimeCalibration(readJson(join(directory, CALIBRATION_FILE)));
  if (decoded.packId !== packId) {
    fail(
      `calibration.packId ${JSON.stringify(decoded.packId)} does not match ${JSON.stringify(packId)}`,
    );
  }
  return decoded;
}

export function assertSealedCalibrationRecord(directory: string, packId: string): void {
  readSealedCalibration(directory, packId);
}

export async function verifyPackCalibration(
  directory: string,
  pack: CompiledPack,
): Promise<CalibrationProof> {
  const decoded = readSealedCalibration(directory, pack.pack.id);
  if (decoded.observation === "no-introspection") return "NO_INTROSPECTION";
  const missing = uninterpretableReasons(pack.resolver);
  if (missing.length !== 0) {
    fail(`vendor-dump calibration but resolver is missing ${missing.join(", ")}`);
  }
  await assertSealedProbes(
    interpretCompiledPack(pack),
    decoded.probes,
    "calibration.probes",
  );
  return "CALIBRATED";
}
