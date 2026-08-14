import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  GITHUB_COPILOT_CLI_PROFILE_ID,
  GOOGLE_GEMINI_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
  type ProfileId,
} from "../model.js";
import { compareCodePoints } from "../domain/repository-path.js";
import type {
  PreparedProfile,
  ProfileDefinition,
} from "../profiles/profile.js";
import type { RepositorySnapshot } from "../snapshot.js";
import { captureCanonicalRepositoryPaths } from "./projection-boundary.js";

const DEFAULT_PROFILE_IDS = Object.freeze([
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
].sort(compareCodePoints));

const OPT_IN_PROFILE_IDS = Object.freeze([
  GITHUB_COPILOT_CLI_PROFILE_ID,
  GOOGLE_GEMINI_CLI_PROFILE_ID,
]);

export interface PreparedPair {
  readonly before: PreparedProfile;
  readonly after: PreparedProfile;
}

export interface CapturedProfileDefinition {
  readonly id: ProfileId;
  readonly prepare: ProfileDefinition["prepare"];
}

export function validateProfiles(
  profiles: readonly ProfileDefinition[],
): readonly CapturedProfileDefinition[] {
  if (!Array.isArray(profiles) ||
      (profiles.length !== DEFAULT_PROFILE_IDS.length &&
        profiles.length !== DEFAULT_PROFILE_IDS.length + 1)) {
    throw new TypeError("V1 analysis requires the two default profiles and at most one opt-in reality");
  }
  const arrayDescriptors = Object.getOwnPropertyDescriptors(profiles);
  const captured: CapturedProfileDefinition[] = [];
  for (let index = 0; index < profiles.length; index += 1) {
    const element = arrayDescriptors[String(index)];
    if (element === undefined || !("value" in element) ||
        typeof element.value !== "object" || element.value === null) {
      throw new TypeError(`Profile ${index} must be an own data element`);
    }
    const profile = element.value as ProfileDefinition;
    const descriptors = Object.getOwnPropertyDescriptors(profile);
    const idDescriptor = descriptors.id;
    const prepareDescriptor = descriptors.prepare;
    if (idDescriptor === undefined || !("value" in idDescriptor) ||
        prepareDescriptor === undefined || !("value" in prepareDescriptor)) {
      throw new TypeError(`Profile ${index} id and prepare must be own data properties`);
    }
    const id = idDescriptor.value as unknown;
    const prepare = prepareDescriptor.value as unknown;
    if (typeof id !== "string") throw new TypeError(`Profile ${index} id must be a string`);
    if (typeof prepare !== "function") {
      throw new TypeError(`Profile prepare must be a function: ${id}`);
    }
    captured.push(Object.freeze({
      id,
      prepare: (snapshot: RepositorySnapshot) => prepare.call(profile, snapshot),
    }));
  }
  const byId = new Map<ProfileId, CapturedProfileDefinition>();
  const extras: ProfileId[] = [];
  for (const profile of captured) {
    const allowed = DEFAULT_PROFILE_IDS.includes(profile.id) ||
      OPT_IN_PROFILE_IDS.includes(profile.id);
    if (!allowed) {
      throw new TypeError(`Unknown v1 profile id: ${profile.id}`);
    }
    if (byId.has(profile.id)) {
      throw new TypeError(`Duplicate v1 profile id: ${profile.id}`);
    }
    byId.set(profile.id, profile);
    if (!DEFAULT_PROFILE_IDS.includes(profile.id)) extras.push(profile.id);
  }
  for (const id of DEFAULT_PROFILE_IDS) {
    if (!byId.has(id)) {
      throw new TypeError(`Missing bundled v1 profile id: ${id}`);
    }
  }
  if (extras.length > 1) {
    throw new TypeError("V1 analysis accepts at most one opt-in reality");
  }
  return [...byId.keys()].sort(compareCodePoints).map((id) => byId.get(id)!);
}

function capturePreparedProfile(
  definition: CapturedProfileDefinition,
  prepared: PreparedProfile,
): PreparedProfile {
  const preparedId = prepared.id;
  const sourceDependencyValue = prepared.sourceDependencyPaths;
  const project = prepared.project;
  if (preparedId !== definition.id) {
    throw new TypeError(
      `Prepared profile id ${preparedId} does not match definition id ${definition.id}`,
    );
  }
  if (typeof project !== "function") {
    throw new TypeError(`Prepared profile project must be a function: ${preparedId}`);
  }
  const sourceDependencyPaths = Object.freeze(
    [...new Set(captureCanonicalRepositoryPaths(
      sourceDependencyValue,
      `prepared profile ${preparedId} dependencies`,
    ))].sort(compareCodePoints),
  );
  return Object.freeze({
    id: preparedId,
    sourceDependencyPaths,
    project: (targetPath: string) => project.call(prepared, targetPath),
  });
}

export async function prepareDefinitions(
  definitions: readonly CapturedProfileDefinition[],
  snapshot: RepositorySnapshot,
): Promise<readonly PreparedProfile[]> {
  const prepared: PreparedProfile[] = [];
  for (const definition of definitions) {
    prepared.push(capturePreparedProfile(
      definition,
      await definition.prepare(snapshot),
    ));
  }
  return prepared;
}

export async function preparePairs(
  definitions: readonly CapturedProfileDefinition[],
  before: RepositorySnapshot,
  after: RepositorySnapshot,
): Promise<readonly PreparedPair[]> {
  const pairs: PreparedPair[] = [];
  for (const definition of definitions) {
    const beforePrepared = capturePreparedProfile(
      definition,
      await definition.prepare(before),
    );
    const afterPrepared = capturePreparedProfile(
      definition,
      await definition.prepare(after),
    );
    pairs.push({ before: beforePrepared, after: afterPrepared });
  }
  return pairs;
}
