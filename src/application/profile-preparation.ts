import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
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

const BUNDLED_PROFILE_IDS = Object.freeze([
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
].sort(compareCodePoints));

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
  if (!Array.isArray(profiles) || profiles.length !== BUNDLED_PROFILE_IDS.length) {
    throw new TypeError("V1 analysis requires exactly the two bundled profiles");
  }
  const arrayDescriptors = Object.getOwnPropertyDescriptors(profiles);
  const captured = BUNDLED_PROFILE_IDS.map((_, index): CapturedProfileDefinition => {
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
    return Object.freeze({
      id,
      prepare: (snapshot: RepositorySnapshot) => prepare.call(profile, snapshot),
    });
  });
  const byId = new Map<ProfileId, CapturedProfileDefinition>();
  for (const profile of captured) {
    if (!BUNDLED_PROFILE_IDS.includes(profile.id)) {
      throw new TypeError(`Unknown v1 profile id: ${profile.id}`);
    }
    if (byId.has(profile.id)) {
      throw new TypeError(`Duplicate v1 profile id: ${profile.id}`);
    }
    byId.set(profile.id, profile);
  }
  for (const id of BUNDLED_PROFILE_IDS) {
    if (!byId.has(id)) {
      throw new TypeError(`Missing bundled v1 profile id: ${id}`);
    }
  }
  return BUNDLED_PROFILE_IDS.map((id) => byId.get(id)!);
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
