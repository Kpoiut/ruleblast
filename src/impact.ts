import {
  type Completeness,
  type CurrentImpactCounts,
  type CurrentProfileCounts,
  type CurrentRuleBlastResult,
  type DiffRuleBlastResult,
  type Finding,
  type ProfileId,
} from "./model.js";
import {
  cacheRepositorySnapshot,
  projectPreparedProfiles,
} from "./application/projection-boundary.js";
import {
  prepareDefinitions,
  validateProfiles,
} from "./application/profile-preparation.js";
import { analyzePreparedDiff } from "./application/diff-analysis.js";
import {
  projectionFindings,
  sortAndDedupeFindings,
} from "./domain/impact-derivation.js";
import { compareCodePoints } from "./domain/repository-path.js";
import {
  aggregatePayloadRelation,
  splitState,
} from "./domain/payload-relation.js";
import type { ProfileDefinition } from "./profiles/profile.js";
import type { RepositorySnapshot } from "./snapshot.js";

export interface AnalysisInput {
  readonly snapshot: RepositorySnapshot;
  readonly profiles: readonly ProfileDefinition[];
}

export interface DiffAnalysisInput {
  readonly before: RepositorySnapshot;
  readonly after: RepositorySnapshot;
  readonly profiles: readonly ProfileDefinition[];
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
  const beforeSource = input.before;
  const afterSource = input.after;
  const before = cacheRepositorySnapshot(beforeSource);
  const after = afterSource === beforeSource
    ? before
    : cacheRepositorySnapshot(afterSource);
  return analyzePreparedDiff({
    before,
    after,
    profiles: input.profiles,
  });
}
