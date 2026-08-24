import { createHash } from "node:crypto";
import { canonicalJson } from "../canonical.js";
import { openPackagedCase } from "../case.js";
import { worstCompleteness } from "../domain/payload-relation.js";
import { compareCodePoints } from "../domain/repository-path.js";
import type { Completeness, RuleBlastResult } from "../model.js";

export interface ReplayProfileRow {
  readonly profile: string;
  readonly completePathCount: number;
  readonly changedStackPathCount: number | null;
}

export interface ReplayMetrics {
  readonly kind: "ruleblast.replay.v1";
  readonly schemaVersion: 1;
  readonly resolverRevision: 1;
  readonly mode: "current" | "diff";
  readonly profileIds: readonly string[];
  readonly candidatePathCount: number;
  readonly changedStackPathCount: number | null;
  readonly currentSplitPathCount: number;
  readonly newlySplitPathCount: number | null;
  readonly convergedPathCount: number | null;
  readonly partialPathCount: number;
  readonly unknownPathCount: number;
  readonly indeterminatePathCount: number;
  readonly byProfile: readonly ReplayProfileRow[];
}

export interface PackagedCaseReplay {
  readonly metrics: ReplayMetrics;
  readonly digest: string;
  readonly expectedCoreDigest: string;
}

export const PACKAGED_CASE_CORE_DIGEST =
  "1e907a88ed648ebbd68b4f588c3bd09058ab7714e8f85a3f2d4a1c60e5a40938";

function incrementComplete(
  row: { completePathCount: number },
  status: Completeness,
): void {
  if (status === "COMPLETE") row.completePathCount += 1;
}

export function replayMetricsFromResult(result: RuleBlastResult): ReplayMetrics {
  const profileIds = [...new Set(
    result.mode === "current"
      ? result.paths.flatMap((path) => path.projections.map((item) => item.profile))
      : result.paths.flatMap((path) => [
        ...path.before.map((item) => item.profile),
        ...path.after.map((item) => item.profile),
      ]),
  )].sort(compareCodePoints);
  const byProfile = profileIds.map((profile) => ({
    profile,
    completePathCount: 0,
    changedStackPathCount: result.mode === "diff" ? 0 : null as number | null,
  }));
  const byId = new Map(byProfile.map((row) => [row.profile, row]));
  let currentSplitPathCount = 0;
  let partialPathCount = 0;
  let unknownPathCount = 0;
  let indeterminatePathCount = 0;
  let changedStackPathCount = 0;
  let newlySplitPathCount = 0;
  let convergedPathCount = 0;
  if (result.mode === "current") {
    for (const path of result.paths) {
      if (path.isSplit === true) currentSplitPathCount += 1;
      if (path.projections.some((item) => item.status === "PARTIAL")) partialPathCount += 1;
      if (path.projections.some((item) => item.status === "UNKNOWN")) unknownPathCount += 1;
      if (path.payloadRelation === "INDETERMINATE") indeterminatePathCount += 1;
      for (const projection of path.projections) {
        const row = byId.get(projection.profile);
        if (row === undefined) continue;
        incrementComplete(row, projection.status);
      }
    }
    return Object.freeze({
      kind: "ruleblast.replay.v1",
      schemaVersion: 1,
      resolverRevision: 1,
      mode: "current",
      profileIds: Object.freeze([...profileIds]),
      candidatePathCount: result.paths.length,
      changedStackPathCount: null,
      currentSplitPathCount,
      newlySplitPathCount: null,
      convergedPathCount: null,
      partialPathCount,
      unknownPathCount,
      indeterminatePathCount,
      byProfile: Object.freeze(byProfile),
    });
  }
  for (const path of result.paths) {
    if (path.changedProfiles.length > 0) changedStackPathCount += 1;
    if (path.isSplit === true) currentSplitPathCount += 1;
    if (path.beforePayloadRelation === "SAME" && path.afterPayloadRelation === "DIFFERENT") {
      newlySplitPathCount += 1;
    }
    if (path.beforePayloadRelation === "DIFFERENT" && path.afterPayloadRelation === "SAME") {
      convergedPathCount += 1;
    }
    const pairStatuses = profileIds.map((profile) => {
      const before = path.before.find((item) => item.profile === profile);
      const after = path.after.find((item) => item.profile === profile);
      if (before === undefined || after === undefined) return "UNKNOWN" as const;
      return worstCompleteness(before.status, after.status);
    });
    if (pairStatuses.includes("PARTIAL")) partialPathCount += 1;
    if (pairStatuses.includes("UNKNOWN")) unknownPathCount += 1;
    if (
      path.beforePayloadRelation === "INDETERMINATE" ||
      path.afterPayloadRelation === "INDETERMINATE" ||
      path.before.some((item) => item.status !== "COMPLETE") ||
      path.after.some((item) => item.status !== "COMPLETE")
    ) {
      indeterminatePathCount += 1;
    }
    for (const profile of profileIds) {
      const row = byId.get(profile);
      const before = path.before.find((item) => item.profile === profile);
      const after = path.after.find((item) => item.profile === profile);
      if (row === undefined || before === undefined || after === undefined) continue;
      incrementComplete(row, worstCompleteness(before.status, after.status));
      if (
        before.status === "COMPLETE" && after.status === "COMPLETE" &&
        before.projectionDigest !== after.projectionDigest
      ) {
        row.changedStackPathCount = (row.changedStackPathCount ?? 0) + 1;
      }
    }
  }
  return Object.freeze({
    kind: "ruleblast.replay.v1",
    schemaVersion: 1,
    resolverRevision: 1,
    mode: "diff",
    profileIds: Object.freeze([...profileIds]),
    candidatePathCount: result.paths.length,
    changedStackPathCount,
    currentSplitPathCount,
    newlySplitPathCount,
    convergedPathCount,
    partialPathCount,
    unknownPathCount,
    indeterminatePathCount,
    byProfile: Object.freeze(byProfile),
  });
}

export function replayDigest(metrics: ReplayMetrics): string {
  return createHash("sha256").update(canonicalJson(metrics)).digest("hex");
}

export async function replayPackagedCase(): Promise<PackagedCaseReplay> {
  const result = await openPackagedCase();
  const metrics = replayMetricsFromResult(result);
  return Object.freeze({
    metrics,
    digest: replayDigest(metrics),
    expectedCoreDigest: PACKAGED_CASE_CORE_DIGEST,
  });
}
