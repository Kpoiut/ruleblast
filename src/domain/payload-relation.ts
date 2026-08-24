import { compareCodePoints } from "./repository-path.js";
import type {
  Completeness,
  PayloadRelation,
  Projection,
} from "../model.js";

export interface AggregatePayloadRelation {
  readonly relation: PayloadRelation;
  readonly hasIndeterminateCoverage: boolean;
}

function equalSequence(
  left: readonly (readonly string[])[],
  right: readonly (readonly string[])[],
): boolean {
  return left.length === right.length && left.every((leftUnit, unitIndex) => {
    const rightUnit = right[unitIndex];
    return rightUnit !== undefined &&
      leftUnit.length === rightUnit.length &&
      leftUnit.every((digest, lineIndex) => digest === rightUnit[lineIndex]);
  });
}

function contributionMultiset(
  units: readonly (readonly string[])[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const contribution of units) {
    const key = JSON.stringify(contribution);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function equalMultiset(
  left: readonly (readonly string[])[],
  right: readonly (readonly string[])[],
): boolean {
  if (left.length !== right.length) return false;
  const leftCounts = contributionMultiset(left);
  const rightCounts = contributionMultiset(right);
  return leftCounts.size === rightCounts.size &&
    [...leftCounts].every(([key, count]) => rightCounts.get(key) === count);
}

export function assertUsableProjection(projection: Projection): void {
  if (projection.status === "COMPLETE" && projection.projectionDigest === null) {
    throw new TypeError(
      `COMPLETE projectionDigest is required for ${projection.profile} at ${projection.context.targetPath}`,
    );
  }
}

export function comparePayloadRelation(
  left: Projection,
  right: Projection,
): PayloadRelation {
  assertUsableProjection(left);
  assertUsableProjection(right);
  if (left.status !== "COMPLETE" || right.status !== "COMPLETE") {
    return "INDETERMINATE";
  }
  if (left.composition === "RUNTIME_DECIDED" ||
      right.composition === "RUNTIME_DECIDED") {
    return "INDETERMINATE";
  }

  const sameMultiset = equalMultiset(
    left.normalizedPayloadUnits,
    right.normalizedPayloadUnits,
  );
  if (left.composition === "ORDERED" && right.composition === "ORDERED") {
    return equalSequence(left.normalizedPayloadUnits, right.normalizedPayloadUnits)
      ? "SAME"
      : "DIFFERENT";
  }
  if (left.composition === "UNORDERED" && right.composition === "UNORDERED") {
    return sameMultiset ? "SAME" : "DIFFERENT";
  }
  return sameMultiset ? "INDETERMINATE" : "DIFFERENT";
}

export function aggregatePayloadRelation(
  projections: readonly Projection[],
): AggregatePayloadRelation {
  for (const projection of projections) assertUsableProjection(projection);
  let hasDifference = false;
  let hasIndeterminateCoverage = projections.some(
    (projection) => projection.status !== "COMPLETE",
  );
  for (let left = 0; left < projections.length; left += 1) {
    for (let right = left + 1; right < projections.length; right += 1) {
      const leftProjection = projections[left];
      const rightProjection = projections[right];
      if (leftProjection === undefined || rightProjection === undefined) {
        throw new Error("Projection pair disappeared during aggregation");
      }
      const relation = comparePayloadRelation(leftProjection, rightProjection);
      hasDifference ||= relation === "DIFFERENT";
      hasIndeterminateCoverage ||= relation === "INDETERMINATE";
    }
  }
  return {
    relation: hasDifference
      ? "DIFFERENT"
      : hasIndeterminateCoverage
        ? "INDETERMINATE"
        : "SAME",
    hasIndeterminateCoverage,
  };
}

export interface RuntimePairSplit {
  readonly left: string;
  readonly right: string;
  readonly differentPathCount: number;
  readonly newlyDifferentPathCount: number;
  readonly convergedPathCount: number;
}

function pairKey(left: string, right: string): string {
  return `${left}\0${right}`;
}

function catalogProfiles(
  rows: readonly { readonly projections: readonly Projection[] }[],
): readonly string[] {
  return [...new Set(rows.flatMap((row) => row.projections.map((item) => item.profile)))]
    .sort(compareCodePoints);
}

function emptyPairCounts(profiles: readonly string[]): Map<string, [number, number, number]> {
  const counts = new Map<string, [number, number, number]>();
  for (let left = 0; left < profiles.length; left += 1) {
    for (let right = left + 1; right < profiles.length; right += 1) {
      counts.set(pairKey(profiles[left]!, profiles[right]!), [0, 0, 0]);
    }
  }
  return counts;
}

function freezePairs(
  counts: ReadonlyMap<string, readonly [number, number, number]>,
): readonly RuntimePairSplit[] {
  return Object.freeze([...counts].map(([key, [differentPathCount, newlyDifferentPathCount, convergedPathCount]]) => {
    const [left, right] = key.split("\0");
    return Object.freeze({
      left: left!,
      right: right!,
      differentPathCount,
      newlyDifferentPathCount,
      convergedPathCount,
    });
  }));
}

export function runtimePairSplits(
  rows: readonly { readonly projections: readonly Projection[] }[],
): readonly RuntimePairSplit[] {
  const profiles = catalogProfiles(rows);
  if (profiles.length < 2) return Object.freeze([]);
  const counts = emptyPairCounts(profiles);
  for (const row of rows) {
    const byId = new Map(row.projections.map((item) => [item.profile, item]));
    for (let left = 0; left < profiles.length; left += 1) {
      for (let right = left + 1; right < profiles.length; right += 1) {
        const leftProjection = byId.get(profiles[left]!);
        const rightProjection = byId.get(profiles[right]!);
        if (leftProjection === undefined || rightProjection === undefined) continue;
        if (comparePayloadRelation(leftProjection, rightProjection) !== "DIFFERENT") continue;
        const key = pairKey(profiles[left]!, profiles[right]!);
        const current = counts.get(key);
        if (current === undefined) continue;
        current[0] += 1;
      }
    }
  }
  return freezePairs(counts);
}

export function runtimePairDeltas(
  rows: readonly {
    readonly before: readonly Projection[];
    readonly after: readonly Projection[];
  }[],
): readonly RuntimePairSplit[] {
  const profiles = catalogProfiles(rows.flatMap((row) => [
    { projections: row.before },
    { projections: row.after },
  ]));
  if (profiles.length < 2) return Object.freeze([]);
  const counts = emptyPairCounts(profiles);
  for (const row of rows) {
    const beforeById = new Map(row.before.map((item) => [item.profile, item]));
    const afterById = new Map(row.after.map((item) => [item.profile, item]));
    for (let left = 0; left < profiles.length; left += 1) {
      for (let right = left + 1; right < profiles.length; right += 1) {
        const key = pairKey(profiles[left]!, profiles[right]!);
        const current = counts.get(key);
        if (current === undefined) continue;
        const afterLeft = afterById.get(profiles[left]!);
        const afterRight = afterById.get(profiles[right]!);
        const afterRelation = afterLeft !== undefined && afterRight !== undefined
          ? comparePayloadRelation(afterLeft, afterRight)
          : null;
        if (afterRelation === "DIFFERENT") current[0] += 1;
        const beforeLeft = beforeById.get(profiles[left]!);
        const beforeRight = beforeById.get(profiles[right]!);
        const beforeRelation = beforeLeft !== undefined && beforeRight !== undefined
          ? comparePayloadRelation(beforeLeft, beforeRight)
          : null;
        if (beforeRelation === "SAME" && afterRelation === "DIFFERENT") current[1] += 1;
        if (beforeRelation === "DIFFERENT" && afterRelation === "SAME") current[2] += 1;
      }
    }
  }
  return freezePairs(counts);
}

export function splitState(relation: PayloadRelation): boolean | null {
  return relation === "DIFFERENT"
    ? true
    : relation === "SAME"
      ? false
      : null;
}

export function worstCompleteness(
  before: Completeness,
  after: Completeness,
): Completeness {
  if (before === "UNKNOWN" || after === "UNKNOWN") return "UNKNOWN";
  if (before === "PARTIAL" || after === "PARTIAL") return "PARTIAL";
  return "COMPLETE";
}
