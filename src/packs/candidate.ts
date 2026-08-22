import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { compareCodePoints } from "../domain/repository-path.js";
import { ManifestSnapshot } from "../snapshot.js";
import { InvalidPackError, decodePackEvidence } from "./compile.js";
import { bundledDirectoryForPackId, listContainedDirectories } from "./load.js";
import type { PackClaim } from "./schema.js";

export const CANDIDATE_SCHEMA_ID = "ruleblast.candidate.v1";

export const CANDIDATE_STABILITIES = Object.freeze([
  "forming",
  "watch",
  "preview",
] as const);

export type CandidateStability = (typeof CANDIDATE_STABILITIES)[number];

export const CANDIDATE_FIXTURE_SCHEMA_ID = "ruleblast.candidate-fixture.v1";

export const FIXTURE_AXES = Object.freeze([
  "selection",
  "rejection",
  "precedence",
  "ambiguity",
  "unknown",
] as const);

export type FixtureAxis = (typeof FIXTURE_AXES)[number];

const CANDIDATE_ID_PATTERN =
  /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*(@[1-9][0-9]*)?$/u;
const FIXTURE_ID_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9-]+)+$/u;

export interface CandidateSurface {
  readonly schema: typeof CANDIDATE_SCHEMA_ID;
  readonly id: string;
  readonly label: string;
  readonly admission: "not-admitted";
  readonly stability: CandidateStability;
  readonly reason: string;
  readonly evidence: readonly PackClaim[];
}

export interface CandidateFixture {
  readonly schema: typeof CANDIDATE_FIXTURE_SCHEMA_ID;
  readonly axis: FixtureAxis;
  readonly id: string;
  readonly claimId: string;
  readonly expectedStatus: "UNKNOWN";
  readonly expectedComposition: "UNSPECIFIED";
  readonly reason: string;
  readonly snapshot: unknown;
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
  return decodeCandidateSurface(readJsonFile(join(directory, "candidate.json")));
}

function expectEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    fail(`${label} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function readJsonFile(path: string): unknown {
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

export function decodeCandidateFixture(value: unknown): CandidateFixture {
  const object = expectKeys(value, [
    "schema",
    "axis",
    "id",
    "claimId",
    "expectedStatus",
    "expectedComposition",
    "reason",
    "snapshot",
  ], "fixture");
  const schema = expectString(object.schema, "fixture.schema");
  if (schema !== CANDIDATE_FIXTURE_SCHEMA_ID) {
    fail(`unsupported candidate fixture schema: ${schema}`);
  }
  const id = expectString(object.id, "fixture.id");
  if (FIXTURE_ID_PATTERN.exec(id)?.[0] !== id) {
    fail(`fixture.id is not a fixture id: ${JSON.stringify(id)}`);
  }
  try {
    void new ManifestSnapshot(object.snapshot);
  } catch (error) {
    fail(`fixture.snapshot is not a ManifestSnapshot: ${String(error)}`);
  }
  return Object.freeze({
    schema: CANDIDATE_FIXTURE_SCHEMA_ID,
    axis: expectEnum(object.axis, FIXTURE_AXES, "fixture.axis"),
    id,
    claimId: expectString(object.claimId, "fixture.claimId"),
    expectedStatus: expectEnum(object.expectedStatus, ["UNKNOWN"] as const, "fixture.expectedStatus"),
    expectedComposition: expectEnum(
      object.expectedComposition,
      ["UNSPECIFIED"] as const,
      "fixture.expectedComposition",
    ),
    reason: expectString(object.reason, "fixture.reason"),
    snapshot: object.snapshot,
  });
}

export function readCandidateInventory(root: string): readonly CandidateSurface[] {
  const loaded: CandidateSurface[] = [];
  for (const name of listContainedDirectories(root)) {
    const surface = readCandidateSurface(join(root, name));
    if (bundledDirectoryForPackId(surface.id) !== name) {
      fail(`candidate directory ${JSON.stringify(name)} does not match id ${JSON.stringify(surface.id)}`);
    }
    loaded.push(surface);
  }
  return Object.freeze(loaded);
}

function assertFixtureTree(directory: string): void {
  const fixturesRoot = join(directory, "fixtures");
  let entries: readonly { readonly name: string; readonly isDirectory: () => boolean }[];
  try {
    entries = readdirSync(fixturesRoot, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) fail(`fixtures must contain only axis directories: ${entry.name}`);
    if (!(FIXTURE_AXES as readonly string[]).includes(entry.name)) {
      fail(`unknown fixture axis directory: ${entry.name}`);
    }
  }
}

export function listCandidateFixtures(
  directory: string,
  claimIds: ReadonlySet<string>,
): readonly CandidateFixture[] {
  assertFixtureTree(directory);
  const fixtures: CandidateFixture[] = [];
  const seen = new Set<string>();
  for (const axis of FIXTURE_AXES) {
    const axisDirectory = join(directory, "fixtures", axis);
    let entries: readonly { readonly name: string; readonly isFile: () => boolean }[];
    try {
      entries = readdirSync(axisDirectory, { withFileTypes: true });
    } catch {
      continue;
    }
    const names: string[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        fail(`fixture axis ${axis} contains a non-JSON file: ${entry.name}`);
      }
      names.push(entry.name);
    }
    names.sort(compareCodePoints);
    for (const name of names) {
      const path = join(axisDirectory, name);
      const fixture = decodeCandidateFixture(readJsonFile(path));
      if (fixture.axis !== axis) {
        fail(`fixture axis ${fixture.axis} does not match directory ${axis}`);
      }
      if (!claimIds.has(fixture.claimId)) {
        fail(`fixture claimId ${JSON.stringify(fixture.claimId)} is not in candidate evidence`);
      }
      if (seen.has(fixture.id)) fail(`duplicate fixture id: ${fixture.id}`);
      seen.add(fixture.id);
      fixtures.push(fixture);
    }
  }
  return Object.freeze(fixtures);
}
