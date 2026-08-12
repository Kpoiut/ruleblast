import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
  type Completeness,
  type CurrentImpactCounts,
  type CurrentProfileCounts,
  type CurrentRuleBlastResult,
  type DiffImpactCounts,
  type DiffProfileCounts,
  type DiffRuleBlastResult,
  type Finding,
  type PathTransition,
  type ProfileId,
} from "./model.js";
import {
  aggregatePayloadRelation,
  buildImpactGroups,
  cacheRepositorySnapshot,
  captureCanonicalRepositoryPaths,
  compareCodePoints,
  effectiveSourcePaths,
  projectPreparedProfiles,
  projectionFindings,
  sortAndDedupeFindings,
  splitState,
  worstCompleteness,
} from "./project.js";
import type {
  PreparedProfile,
  ProfileDefinition,
} from "./profiles/profile.js";
import type { RepositorySnapshot } from "./snapshot.js";
import { buildTransition } from "./transition.js";

export interface AnalysisInput {
  readonly snapshot: RepositorySnapshot;
  readonly profiles: readonly ProfileDefinition[];
}

export interface DiffAnalysisInput {
  readonly before: RepositorySnapshot;
  readonly after: RepositorySnapshot;
  readonly profiles: readonly ProfileDefinition[];
}

const BUNDLED_PROFILE_IDS = Object.freeze([
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
].sort(compareCodePoints));

interface PreparedPair {
  readonly before: PreparedProfile;
  readonly after: PreparedProfile;
}

interface CapturedProfileDefinition {
  readonly id: ProfileId;
  readonly prepare: ProfileDefinition["prepare"];
}

function validateProfiles(
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

function capturedPreparedProfile(
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

async function prepareDefinitions(
  definitions: readonly CapturedProfileDefinition[],
  snapshot: RepositorySnapshot,
): Promise<readonly PreparedProfile[]> {
  const prepared: PreparedProfile[] = [];
  for (const definition of definitions) {
    prepared.push(capturedPreparedProfile(
      definition,
      await definition.prepare(snapshot),
    ));
  }
  return prepared;
}

async function preparePairs(
  definitions: readonly CapturedProfileDefinition[],
  before: RepositorySnapshot,
  after: RepositorySnapshot,
): Promise<readonly PreparedPair[]> {
  const pairs: PreparedPair[] = [];
  for (const definition of definitions) {
    const beforePrepared = capturedPreparedProfile(
      definition,
      await definition.prepare(before),
    );
    const afterPrepared = capturedPreparedProfile(
      definition,
      await definition.prepare(after),
    );
    pairs.push({ before: beforePrepared, after: afterPrepared });
  }
  return pairs;
}

async function candidatePaths(
  snapshot: RepositorySnapshot,
): Promise<readonly string[]> {
  const paths = [...new Set(await snapshot.listPaths())].sort(compareCodePoints);
  const existing = await Promise.all(paths.map(async (path) =>
    (await snapshot.entry(path)) === null ? null : path,
  ));
  return existing.filter((path): path is string => path !== null);
}

function emptyCurrentProfileCounts(profile: ProfileId): CurrentProfileCounts {
  return {
    profile,
    completePathCount: 0,
    partialPathCount: 0,
    unknownPathCount: 0,
  };
}

function emptyDiffProfileCounts(profile: ProfileId): DiffProfileCounts {
  return {
    ...emptyCurrentProfileCounts(profile),
    changedStackPathCount: 0,
  };
}

function incrementCompleteness(
  counts: CurrentProfileCounts,
  status: Completeness,
): void {
  if (status === "COMPLETE") counts.completePathCount += 1;
  else if (status === "PARTIAL") counts.partialPathCount += 1;
  else counts.unknownPathCount += 1;
}

export async function analyzeCurrent(
  input: AnalysisInput,
): Promise<CurrentRuleBlastResult> {
  const profilesSource = input.profiles;
  const snapshotSource = input.snapshot;
  const definitions = validateProfiles(profilesSource);
  const snapshot = cacheRepositorySnapshot(snapshotSource);
  const prepared = await prepareDefinitions(definitions, snapshot);
  const paths = await candidatePaths(snapshot);
  const byProfile = definitions.map((profile) =>
    emptyCurrentProfileCounts(profile.id),
  );
  const counts: CurrentImpactCounts = {
    candidatePathCount: paths.length,
    currentSplitPathCount: 0,
    partialPathCount: 0,
    unknownPathCount: 0,
    indeterminatePathCount: 0,
    byProfile,
  };
  const findings: Finding[] = [];
  const pathResults = paths.map((path) => {
    const projections = projectPreparedProfiles(prepared, path);
    projections.forEach((projection, index) => {
      const profileCounts = byProfile[index];
      if (profileCounts === undefined) {
        throw new Error("Profile counts disappeared during current analysis");
      }
      incrementCompleteness(profileCounts, projection.status);
      findings.push(...projectionFindings(projection, null));
    });
    const aggregate = aggregatePayloadRelation(projections);
    counts.currentSplitPathCount += aggregate.relation === "DIFFERENT" ? 1 : 0;
    counts.partialPathCount += projections.some(
      (projection) => projection.status === "PARTIAL",
    ) ? 1 : 0;
    counts.unknownPathCount += projections.some(
      (projection) => projection.status === "UNKNOWN",
    ) ? 1 : 0;
    counts.indeterminatePathCount += aggregate.hasIndeterminateCoverage ? 1 : 0;
    return {
      path,
      projections,
      payloadRelation: aggregate.relation,
      isSplit: splitState(aggregate.relation),
    };
  });
  return {
    mode: "current",
    schemaVersion: 1,
    resolverRevision: 1,
    snapshot: snapshot.ref,
    counts,
    paths: pathResults,
    findings: sortAndDedupeFindings(findings),
  };
}

export async function analyzeDiff(
  input: DiffAnalysisInput,
): Promise<DiffRuleBlastResult> {
  const profilesSource = input.profiles;
  const beforeSource = input.before;
  const afterSource = input.after;
  const definitions = validateProfiles(profilesSource);
  const before = cacheRepositorySnapshot(beforeSource);
  const after = afterSource === beforeSource
    ? before
    : cacheRepositorySnapshot(afterSource);
  const pairs = await preparePairs(definitions, before, after);
  const dependencies = new Set<string>();
  for (const pair of pairs) {
    for (const path of pair.before.sourceDependencyPaths) dependencies.add(path);
    for (const path of pair.after.sourceDependencyPaths) dependencies.add(path);
  }
  const transition = await buildTransition(before, after, dependencies);
  const changedSourcePaths = new Set<string>();
  for (const change of transition.sourceChanges) {
    if (change.beforePath !== null) changedSourcePaths.add(change.beforePath);
    if (change.afterPath !== null) changedSourcePaths.add(change.afterPath);
  }
  const byProfile = definitions.map((profile) =>
    emptyDiffProfileCounts(profile.id),
  );
  const counts: DiffImpactCounts = {
    candidatePathCount: transition.candidatePaths.length,
    changedStackPathCount: 0,
    newlySplitPathCount: 0,
    convergedPathCount: 0,
    currentSplitPathCount: 0,
    partialPathCount: 0,
    unknownPathCount: 0,
    indeterminatePathCount: 0,
    byProfile,
  };
  const findings: Finding[] = [];
  for (const change of transition.sourceChanges) {
    if (change.stats.binaryChangedSourceCount > 0) {
      findings.push({
        code: "BINARY_SOURCE",
        profile: null,
        path: change.afterPath ?? change.beforePath ?? ".",
        detail: "diff: binary instruction source changed",
      });
    }
  }

  const pathResults: PathTransition[] = transition.candidatePaths.map((path) => {
    const beforeProjections = projectPreparedProfiles(
      pairs.map((pair) => pair.before),
      path,
    );
    const afterProjections = projectPreparedProfiles(
      pairs.map((pair) => pair.after),
      path,
    );
    const changedProfiles: ProfileId[] = [];
    const pairStatuses: Completeness[] = [];
    for (let index = 0; index < pairs.length; index += 1) {
      const beforeProjection = beforeProjections[index];
      const afterProjection = afterProjections[index];
      const profileCounts = byProfile[index];
      if (beforeProjection === undefined || afterProjection === undefined ||
          profileCounts === undefined) {
        throw new Error("Profile pair disappeared during diff analysis");
      }
      const pairStatus = worstCompleteness(
        beforeProjection.status,
        afterProjection.status,
      );
      pairStatuses.push(pairStatus);
      incrementCompleteness(profileCounts, pairStatus);
      if (pairStatus === "COMPLETE" &&
          beforeProjection.projectionDigest !== afterProjection.projectionDigest) {
        profileCounts.changedStackPathCount += 1;
        changedProfiles.push(afterProjection.profile);
      }
      findings.push(...projectionFindings(beforeProjection, "before"));
      findings.push(...projectionFindings(afterProjection, "after"));
    }
    const beforeAggregate = aggregatePayloadRelation(beforeProjections);
    const afterAggregate = aggregatePayloadRelation(afterProjections);
    counts.changedStackPathCount += changedProfiles.length > 0 ? 1 : 0;
    counts.newlySplitPathCount += beforeAggregate.relation === "SAME" &&
      afterAggregate.relation === "DIFFERENT" ? 1 : 0;
    counts.convergedPathCount += beforeAggregate.relation === "DIFFERENT" &&
      afterAggregate.relation === "SAME" ? 1 : 0;
    counts.currentSplitPathCount += afterAggregate.relation === "DIFFERENT" ? 1 : 0;
    counts.partialPathCount += pairStatuses.includes("PARTIAL") ? 1 : 0;
    counts.unknownPathCount += pairStatuses.includes("UNKNOWN") ? 1 : 0;
    counts.indeterminatePathCount += beforeAggregate.hasIndeterminateCoverage ||
      afterAggregate.hasIndeterminateCoverage ||
      pairStatuses.some((status) => status !== "COMPLETE") ? 1 : 0;

    const effective = effectiveSourcePaths([
      ...beforeProjections,
      ...afterProjections,
    ]);
    const causes = changedProfiles.length === 0
      ? []
      : [...changedSourcePaths]
          .filter((sourcePath) => effective.has(sourcePath))
          .sort(compareCodePoints);
    return {
      path,
      before: beforeProjections,
      after: afterProjections,
      changedProfiles,
      beforePayloadRelation: beforeAggregate.relation,
      afterPayloadRelation: afterAggregate.relation,
      wasSplit: splitState(beforeAggregate.relation),
      isSplit: splitState(afterAggregate.relation),
      causes,
    };
  });
  return {
    mode: "diff",
    schemaVersion: 1,
    resolverRevision: 1,
    before: before.ref,
    after: after.ref,
    diffStats: { ...transition.diffStats },
    changedInstructionSources: transition.sourceChanges.map((change) => ({
      ...change,
      stats: { ...change.stats },
    })),
    counts,
    groups: buildImpactGroups(pathResults),
    paths: pathResults,
    findings: sortAndDedupeFindings(findings),
  };
}
