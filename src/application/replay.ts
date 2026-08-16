import { createHash } from "node:crypto";
import { canonicalJson } from "../canonical.js";
import { openPackagedCase } from "../case.js";
import type { RuleBlastResult } from "../model.js";

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

export function replayMetricsFromResult(result: RuleBlastResult): ReplayMetrics {
  const profileIds = result.counts.byProfile.map((row) => row.profile);
  const byProfile = result.counts.byProfile.map((row) => ({
    profile: row.profile,
    completePathCount: row.completePathCount,
    changedStackPathCount: "changedStackPathCount" in row ? row.changedStackPathCount : null,
  }));
  if (result.mode === "current") {
    return Object.freeze({
      kind: "ruleblast.replay.v1",
      schemaVersion: 1,
      resolverRevision: 1,
      mode: "current",
      profileIds: Object.freeze([...profileIds]),
      candidatePathCount: result.counts.candidatePathCount,
      changedStackPathCount: null,
      currentSplitPathCount: result.counts.currentSplitPathCount,
      newlySplitPathCount: null,
      convergedPathCount: null,
      partialPathCount: result.counts.partialPathCount,
      unknownPathCount: result.counts.unknownPathCount,
      indeterminatePathCount: result.counts.indeterminatePathCount,
      byProfile: Object.freeze(byProfile),
    });
  }
  return Object.freeze({
    kind: "ruleblast.replay.v1",
    schemaVersion: 1,
    resolverRevision: 1,
    mode: "diff",
    profileIds: Object.freeze([...profileIds]),
    candidatePathCount: result.counts.candidatePathCount,
    changedStackPathCount: result.counts.changedStackPathCount,
    currentSplitPathCount: result.counts.currentSplitPathCount,
    newlySplitPathCount: result.counts.newlySplitPathCount,
    convergedPathCount: result.counts.convergedPathCount,
    partialPathCount: result.counts.partialPathCount,
    unknownPathCount: result.counts.unknownPathCount,
    indeterminatePathCount: result.counts.indeterminatePathCount,
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
