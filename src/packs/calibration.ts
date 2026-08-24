import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../canonical.js";
import { InvalidPackError, decodePackEvidence } from "./compile.js";
import type { PackClaim } from "./schema.js";
import type { CompiledPack } from "./schema.js";
import {
  assembleObservation,
  CALIBRATION_PACK_IDS,
  type CalibrationPackId,
  type TargetObservation,
} from "./observation.js";
import { observeSnapshot } from "./observe.js";

export const CALIBRATION_SCHEMA_ID = "ruleblast.runtime-calibration.v1";
export const CALIBRATION_FILE = "calibration.json";
export const CALIBRATION_PROBE_SCHEMA_ID = "ruleblast.runtime-observation.v1";

export type CalibrationObservation = "vendor-dump" | "no-introspection";
export type CalibrationProof = "CALIBRATED" | "NO_INTROSPECTION";

export interface CalibrationRuntime {
  readonly surfaceId: string;
  readonly revision: string;
  readonly observationMethod: "sealed-offline-dump";
  readonly artifactDigest: string;
  readonly probeSchema: typeof CALIBRATION_PROBE_SCHEMA_ID;
}

export interface RuntimeCalibration {
  readonly schema: typeof CALIBRATION_SCHEMA_ID;
  readonly packId: string;
  readonly observation: CalibrationObservation;
  readonly evidence: readonly PackClaim[];
  readonly probes: readonly unknown[];
  readonly runtime: CalibrationRuntime | null;
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

function decodeTargetObservation(
  value: unknown,
  label: string,
): TargetObservation {
  if (isPlainObject(value) && Object.hasOwn(value, "contributions")) {
    fail(`${label} must not carry interpreter-shaped contributions`);
  }
  const object = expectKeys(value, [
    "loadedPaths",
    "loadedTexts",
    "vendorAssembly",
    "truncated",
  ], label);
  if (typeof object.truncated !== "boolean") fail(`${label}.truncated must be a boolean`);
  if (!Array.isArray(object.loadedPaths) ||
    object.loadedPaths.some((item) => typeof item !== "string" || item === "")) {
    fail(`${label}.loadedPaths must be a string array of non-empty strings`);
  }
  if (!Array.isArray(object.loadedTexts) ||
    object.loadedTexts.some((item) => typeof item !== "string")) {
    fail(`${label}.loadedTexts must be a string array`);
  }
  if (object.loadedPaths.length !== object.loadedTexts.length) {
    fail(`${label} loadedPaths and loadedTexts must be the same length`);
  }
  return Object.freeze({
    loadedPaths: Object.freeze([...object.loadedPaths as string[]]),
    loadedTexts: Object.freeze([...object.loadedTexts as string[]]),
    vendorAssembly: typeof object.vendorAssembly === "string"
      ? object.vendorAssembly
      : fail(`${label}.vendorAssembly must be a string`),
    truncated: object.truncated,
  });
}

function asCalibrationPackId(id: string): CalibrationPackId {
  if (!(CALIBRATION_PACK_IDS as readonly string[]).includes(id)) {
    fail(`vendor-dump calibration pack id is not a catalog runtime: ${id}`);
  }
  return id as CalibrationPackId;
}

async function assertVendorObservations(
  packId: CalibrationPackId,
  probes: readonly unknown[],
): Promise<void> {
  for (let index = 0; index < probes.length; index += 1) {
    const label = `calibration.probes[${index}]`;
    const probe = expectKeys(probes[index], ["snapshot", "targets"], label);
    if (Object.hasOwn(probes[index] as object, "projectionDigests")) {
      fail(`${label} must not copy oracle projectionDigests`);
    }
    if (Object.hasOwn(probes[index] as object, "sourceDependencyPaths")) {
      fail(`${label} must not copy oracle sourceDependencyPaths`);
    }
    const targets = probe.targets;
    if (!isPlainObject(targets)) fail(`${label}.targets must be an object`);
    const keys = ownKeys(targets);
    if (keys.length === 0) fail(`${label}.targets must not be empty`);
    const sealed: Record<string, TargetObservation> = {};
    for (const target of keys) {
      const observed = decodeTargetObservation(targets[target], `${label}.targets.${target}`);
      const assembled = assembleObservation(
        packId,
        observed.loadedPaths.map((path, fileIndex) => ({
          path,
          text: observed.loadedTexts[fileIndex]!,
        })),
      );
      if (assembled !== observed.vendorAssembly) {
        fail(`${label}.targets.${target} vendorAssembly is not assembled from loaded files`);
      }
      sealed[target] = observed;
    }
    const live = await observeSnapshot(packId, probe.snapshot);
    if (canonicalJson(sealed) !== canonicalJson(live.targets)) {
      fail(`${label} is not the live vendor-source observation`);
    }
  }
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

function decodeCalibrationRuntime(value: unknown): CalibrationRuntime {
  const object = expectKeys(value, [
    "surfaceId",
    "revision",
    "observationMethod",
    "artifactDigest",
    "probeSchema",
  ], "calibration.runtime");
  const observationMethod = expectString(object.observationMethod, "calibration.runtime.observationMethod");
  if (observationMethod !== "sealed-offline-dump") {
    fail("calibration.runtime.observationMethod must be sealed-offline-dump");
  }
  const artifactDigest = expectString(object.artifactDigest, "calibration.runtime.artifactDigest");
  if (!/^[0-9a-f]{64}$/u.test(artifactDigest)) {
    fail("calibration.runtime.artifactDigest must be a SHA-256 hex digest");
  }
  const probeSchema = expectString(object.probeSchema, "calibration.runtime.probeSchema");
  if (probeSchema !== CALIBRATION_PROBE_SCHEMA_ID) {
    fail(`calibration.runtime.probeSchema must be ${CALIBRATION_PROBE_SCHEMA_ID}`);
  }
  return Object.freeze({
    surfaceId: expectString(object.surfaceId, "calibration.runtime.surfaceId"),
    revision: expectString(object.revision, "calibration.runtime.revision"),
    observationMethod: "sealed-offline-dump",
    artifactDigest,
    probeSchema: CALIBRATION_PROBE_SCHEMA_ID,
  });
}

export function decodeRuntimeCalibration(value: unknown): RuntimeCalibration {
  if (!isPlainObject(value)) fail("calibration must be an object");
  const observation = expectString(value.observation, "calibration.observation");
  if (observation !== "vendor-dump" && observation !== "no-introspection") {
    fail("calibration.observation must be vendor-dump or no-introspection");
  }
  const keys = observation === "vendor-dump"
    ? ["schema", "packId", "observation", "evidence", "probes", "runtime"]
    : ["schema", "packId", "observation", "evidence", "probes"];
  const object = expectKeys(value, keys, "calibration");
  const schema = expectString(object.schema, "calibration.schema");
  if (schema !== CALIBRATION_SCHEMA_ID) fail(`unsupported calibration schema: ${schema}`);
  if (!Array.isArray(object.probes)) fail("calibration.probes must be an array");
  if (observation === "no-introspection" && object.probes.length !== 0) {
    fail("no-introspection calibration must not carry probes");
  }
  if (observation === "vendor-dump" && object.probes.length === 0) {
    fail("vendor-dump calibration must carry sealed probes");
  }
  const runtime = observation === "vendor-dump"
    ? decodeCalibrationRuntime(object.runtime)
    : null;
  return Object.freeze({
    schema: CALIBRATION_SCHEMA_ID,
    packId: expectString(object.packId, "calibration.packId"),
    observation: observation as CalibrationObservation,
    evidence: decodePackEvidence(object.evidence),
    probes: Object.freeze([...object.probes]),
    runtime,
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
  if (decoded.runtime === null) fail("vendor-dump calibration must identify the observed runtime");
  const packId = asCalibrationPackId(pack.pack.id);
  const artifactDigest = sha256(canonicalJson(decoded.probes));
  if (decoded.runtime.artifactDigest !== artifactDigest) {
    fail(
      `calibration.runtime.artifactDigest mismatch: expected ${artifactDigest}`,
    );
  }
  await assertVendorObservations(packId, decoded.probes);
  return "CALIBRATED";
}
