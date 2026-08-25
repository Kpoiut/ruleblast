import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ManifestSnapshot } from "../snapshot.js";
import {
  assertProjectionSeals,
  digestProjectionIdentity,
} from "../domain/projection-seal.js";
import { createClaudeProfile } from "../profiles/claude.js";
import { createCopilotProfile } from "../profiles/copilot.js";
import { createGeminiProfile } from "../profiles/gemini.js";
import { InvalidPackError } from "./compile.js";
import { interpretCompiledPack, uninterpretableReasons } from "./interpret.js";
import { evidenceFromPack } from "./profile.js";
import type { CompiledPack } from "./schema.js";
import type { ProfileDefinition } from "../profiles/profile.js";

export const ORACLE_SCHEMA_ID = "ruleblast.interpreter-oracle.v1";
export const ORACLE_FILE = "oracle.json";

export type OracleProof = "ORACLE" | "ADAPTER";

export interface PackVerification {
  readonly engine: "INTERPRET" | "FINGERPRINT";
  readonly proof: OracleProof;
  readonly missingOperations: readonly string[];
  readonly probeCount: number;
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

function expectStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item === "")) {
    fail(`${label} must be a string array of non-empty strings`);
  }
  return Object.freeze([...value]);
}

function expectDigestMap(
  value: unknown,
  targets: readonly string[],
  label: string,
): Readonly<Record<string, string>> {
  if (!isPlainObject(value)) fail(`${label} must be an object`);
  const keys = ownKeys(value);
  if (keys.length !== targets.length || targets.some((target) => !keys.includes(target))) {
    fail(`${label} keys must match snapshot paths`);
  }
  const digests: Record<string, string> = {};
  for (const target of targets) {
    const digest = expectString(value[target], `${label}.${target}`);
    if (!/^[0-9a-f]{64}$/u.test(digest)) {
      fail(`${label}.${target} must be a SHA-256 hex digest`);
    }
    digests[target] = digest;
  }
  return Object.freeze(digests);
}

function probeTargets(paths: readonly string[]): readonly string[] {
  return paths.length === 0 ? ["file.ts"] : paths;
}

async function verifyProbe(
  profile: ProfileDefinition,
  value: unknown,
  index: number,
  prefix: string,
): Promise<void> {
  const label = `${prefix}[${index}]`;
  const probe = expectKeys(value, [
    "snapshot",
    "projectionDigests",
    "sourceDependencyPaths",
  ], label);
  const snapshot = new ManifestSnapshot(probe.snapshot);
  const prepared = await profile.prepare(snapshot);
  const paths = await snapshot.listPaths();
  const targets = probeTargets(paths);
  const sealedDeps = expectStringArray(
    probe.sourceDependencyPaths,
    `${label}.sourceDependencyPaths`,
  );
  const actualDeps = [...prepared.sourceDependencyPaths];
  if (
    sealedDeps.length !== actualDeps.length ||
    sealedDeps.some((path, depIndex) => path !== actualDeps[depIndex])
  ) {
    fail(
      `${label} sourceDependencyPaths mismatch: expected ${sealedDeps.join(",")} actual ${actualDeps.join(",")}`,
    );
  }
  const digests = expectDigestMap(probe.projectionDigests, targets, `${label}.projectionDigests`);
  for (const target of targets) {
    const projection = prepared.project(target);
    try {
      assertProjectionSeals(projection);
    } catch (error) {
      fail(`${label} ${target}: ${error instanceof Error ? error.message : String(error)}`);
    }
    const actual = digestProjectionIdentity(projection);
    if (actual !== digests[target]) {
      fail(
        `${label} projection digest mismatch for ${target}: expected ${digests[target]} actual ${actual}`,
      );
    }
  }
}

export async function assertSealedProbes(
  profile: ProfileDefinition,
  probes: unknown,
  prefix: string,
): Promise<number> {
  if (!Array.isArray(probes) || probes.length === 0) {
    fail(`${prefix} must be a non-empty array`);
  }
  for (let index = 0; index < probes.length; index += 1) {
    await verifyProbe(profile, probes[index], index, prefix);
  }
  return probes.length;
}

async function verifyProbes(
  profile: ProfileDefinition,
  probes: unknown,
): Promise<void> {
  await assertSealedProbes(profile, probes, "oracle.probes");
}

/** Lab-only: uninterpretable oracles still replay probes on the handwritten adapter. */
function fingerprintAdapterOracle(pack: CompiledPack): ProfileDefinition {
  const bound = { id: pack.pack.id, evidence: evidenceFromPack(pack) };
  if (pack.resolver.fingerprint === "claude-v1") return createClaudeProfile(bound);
  if (pack.resolver.fingerprint === "gemini-v1") return createGeminiProfile(bound);
  if (pack.resolver.fingerprint === "copilot-v1") return createCopilotProfile(bound);
  throw new InvalidPackError(
    `Pack engine not implemented for fingerprint ${pack.resolver.fingerprint}`,
  );
}

async function verifyInterpret(
  pack: CompiledPack,
  oracle: Record<string, unknown>,
): Promise<PackVerification> {
  const missing = uninterpretableReasons(pack.resolver);
  if (missing.length !== 0) {
    fail(`oracle kind interpret but resolver is missing ${missing.join(", ")}`);
  }
  const profile = interpretCompiledPack(pack);
  await verifyProbes(profile, oracle.probes);
  return Object.freeze({
    engine: "INTERPRET",
    proof: "ORACLE",
    missingOperations: Object.freeze([] as string[]),
    probeCount: Array.isArray(oracle.probes) ? oracle.probes.length : 0,
  });
}

async function verifyFingerprint(
  pack: CompiledPack,
  oracle: Record<string, unknown>,
): Promise<PackVerification> {
  const missing = uninterpretableReasons(pack.resolver);
  const sealed = expectStringArray(oracle.missingOperations, "oracle.missingOperations");
  if (missing.length === 0) fail("oracle kind uninterpretable but resolver is interpretable");
  if (sealed.length !== missing.length || sealed.some((item, index) => item !== missing[index])) {
    fail(
      `oracle missingOperations mismatch: expected ${sealed.join(",")} actual ${missing.join(",")}`,
    );
  }
  try {
    interpretCompiledPack(pack);
    fail("oracle kind uninterpretable but interpreter admitted the resolver");
  } catch (error) {
    if (!(error instanceof InvalidPackError)) throw error;
  }
  const profile = fingerprintAdapterOracle(pack);
  await verifyProbes(profile, oracle.probes);
  return Object.freeze({
    engine: "FINGERPRINT",
    proof: "ADAPTER",
    missingOperations: missing,
    probeCount: Array.isArray(oracle.probes) ? oracle.probes.length : 0,
  });
}

export async function verifyBundledPack(
  directory: string,
  pack: CompiledPack,
): Promise<PackVerification> {
  const raw = readJson(join(directory, ORACLE_FILE));
  if (!isPlainObject(raw)) fail("oracle must be an object");
  const kind = expectString(raw.kind, "oracle.kind");
  const keys = kind === "interpret"
    ? ["schema", "kind", "packId", "probes"] as const
    : kind === "uninterpretable"
      ? ["schema", "kind", "packId", "missingOperations", "probes"] as const
      : fail("oracle.kind must be interpret or uninterpretable");
  const oracle = expectKeys(raw, keys, "oracle");
  if (oracle.schema !== ORACLE_SCHEMA_ID) fail(`unsupported oracle schema: ${String(oracle.schema)}`);
  const packId = expectString(oracle.packId, "oracle.packId");
  if (packId !== pack.pack.id) {
    fail(`oracle.packId ${JSON.stringify(packId)} does not match ${JSON.stringify(pack.pack.id)}`);
  }
  if (kind === "interpret") return verifyInterpret(pack, oracle);
  return verifyFingerprint(pack, oracle);
}
