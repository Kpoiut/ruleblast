import { compareCodePoints } from "./repository-path.js";
import type {
  Completeness,
  PayloadRelation,
  Projection,
} from "../model.js";
import {
  assertNormalizedPayloadSeal,
  assertUsableProjection,
} from "./projection-seal.js";

export {
  assertNormalizedPayloadSeal,
  assertProjectionDigestSeal,
  assertUsableProjection,
  digestNormalizedPayload,
  digestProjectionIdentity,
  movingProjectionDigest,
} from "./projection-seal.js";

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
    const key = contribution.join("\0");
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

export function comparePayloadRelation(
  left: Projection,
  right: Projection,
): PayloadRelation {
  assertUsableProjection(left);
  assertUsableProjection(right);
  assertNormalizedPayloadSeal(left);
  assertNormalizedPayloadSeal(right);
  if (left.status !== "COMPLETE" || right.status !== "COMPLETE") {
    return "INDETERMINATE";
  }
  if (left.composition === "RUNTIME_DECIDED" ||
      right.composition === "RUNTIME_DECIDED") {
    return "INDETERMINATE";
  }

  if (left.composition === "ORDERED" && right.composition === "ORDERED" &&
      left.normalizedPayloadDigest !== null && right.normalizedPayloadDigest !== null) {
    return left.normalizedPayloadDigest === right.normalizedPayloadDigest
      ? "SAME"
      : "DIFFERENT";
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

export interface RuntimePairRelation {
  readonly left: string;
  readonly right: string;
  readonly relation: PayloadRelation;
}

export interface RuntimePairEvent {
  readonly left: string;
  readonly right: string;
  readonly path: string;
  readonly after: PayloadRelation;
  readonly before: PayloadRelation | null;
  readonly different: boolean;
  readonly newlyDifferent: boolean;
  readonly converged: boolean;
  readonly indeterminate: boolean;
}

export interface PairPathRow {
  readonly path: string;
  readonly projections: readonly Projection[];
}

export interface PairDeltaRow {
  readonly path: string;
  readonly before: readonly Projection[];
  readonly after: readonly Projection[];
}

export function pairRelations(
  projections: readonly Projection[],
): readonly RuntimePairRelation[] {
  const profiles = [...new Set(projections.map((item) => item.profile))]
    .sort(compareCodePoints);
  const byId = new Map(projections.map((item) => [item.profile, item]));
  const rows: RuntimePairRelation[] = [];
  for (let left = 0; left < profiles.length; left += 1) {
    for (let right = left + 1; right < profiles.length; right += 1) {
      const leftProjection = byId.get(profiles[left]!);
      const rightProjection = byId.get(profiles[right]!);
      if (leftProjection === undefined || rightProjection === undefined) continue;
      rows.push(Object.freeze({
        left: profiles[left]!,
        right: profiles[right]!,
        relation: comparePayloadRelation(leftProjection, rightProjection),
      }));
    }
  }
  return Object.freeze(rows);
}

function pushPairEvent(
  events: RuntimePairEvent[],
  path: string,
  pair: RuntimePairRelation,
  before: PayloadRelation | null,
): void {
  const after = pair.relation;
  const different = after === "DIFFERENT";
  const newlyDifferent = before === "SAME" && after === "DIFFERENT";
  const converged = before === "DIFFERENT" && after === "SAME";
  const indeterminate = after === "INDETERMINATE";
  if (!different && !indeterminate && !converged) return;
  events.push(Object.freeze({
    left: pair.left,
    right: pair.right,
    path,
    after,
    before,
    different,
    newlyDifferent,
    converged,
    indeterminate,
  }));
}

export function currentPairEvents(
  rows: readonly PairPathRow[],
): readonly RuntimePairEvent[] {
  const events: RuntimePairEvent[] = [];
  for (const row of rows) {
    for (const pair of pairRelations(row.projections)) {
      pushPairEvent(events, row.path, pair, null);
    }
  }
  return Object.freeze(events);
}

export function diffPairEvents(
  rows: readonly PairDeltaRow[],
): readonly RuntimePairEvent[] {
  const events: RuntimePairEvent[] = [];
  for (const row of rows) {
    const beforeBy = new Map(
      pairRelations(row.before).map((pair) => [pairKey(pair.left, pair.right), pair.relation]),
    );
    for (const pair of pairRelations(row.after)) {
      pushPairEvent(
        events,
        row.path,
        pair,
        beforeBy.get(pairKey(pair.left, pair.right)) ?? null,
      );
    }
  }
  return Object.freeze(events);
}

export function pathPayloadRelation(
  projections: readonly Projection[],
  events: readonly RuntimePairEvent[],
): AggregatePayloadRelation {
  for (const projection of projections) assertUsableProjection(projection);
  const hasDifference = events.some((event) => event.different);
  const hasIndeterminateCoverage = events.some((event) => event.indeterminate) ||
    projections.some((projection) => projection.status !== "COMPLETE");
  return {
    relation: hasDifference
      ? "DIFFERENT"
      : hasIndeterminateCoverage
        ? "INDETERMINATE"
        : "SAME",
    hasIndeterminateCoverage,
  };
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
  readonly indeterminatePathCount: number;
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

function emptyPairCounts(
  profiles: readonly string[],
): Map<string, [number, number, number, number]> {
  const counts = new Map<string, [number, number, number, number]>();
  for (let left = 0; left < profiles.length; left += 1) {
    for (let right = left + 1; right < profiles.length; right += 1) {
      counts.set(pairKey(profiles[left]!, profiles[right]!), [0, 0, 0, 0]);
    }
  }
  return counts;
}

function freezePairs(
  counts: ReadonlyMap<string, readonly [number, number, number, number]>,
): readonly RuntimePairSplit[] {
  return Object.freeze([...counts].map(([key, tuple]) => {
    const [left, right] = key.split("\0");
    return Object.freeze({
      left: left!,
      right: right!,
      differentPathCount: tuple[0],
      newlyDifferentPathCount: tuple[1],
      convergedPathCount: tuple[2],
      indeterminatePathCount: tuple[3],
    });
  }));
}

export function splitsFromEvents(
  events: readonly RuntimePairEvent[],
  profiles: readonly string[],
): readonly RuntimePairSplit[] {
  if (profiles.length < 2) return Object.freeze([]);
  const counts = emptyPairCounts(profiles);
  for (const event of events) {
    const current = counts.get(pairKey(event.left, event.right));
    if (current === undefined) continue;
    if (event.different) current[0] += 1;
    if (event.newlyDifferent) current[1] += 1;
    if (event.converged) current[2] += 1;
    if (event.indeterminate) current[3] += 1;
  }
  return freezePairs(counts);
}

export function pairTopologyFor(
  result:
    | { readonly mode: "current"; readonly paths: readonly PairPathRow[] }
    | { readonly mode: "diff"; readonly paths: readonly PairDeltaRow[] },
): {
  readonly events: readonly RuntimePairEvent[];
  readonly splits: readonly RuntimePairSplit[];
} {
  if (result.mode === "current") {
    const events = currentPairEvents(result.paths);
    return Object.freeze({
      events,
      splits: splitsFromEvents(events, catalogProfiles(result.paths)),
    });
  }
  const events = diffPairEvents(result.paths);
  return Object.freeze({
    events,
    splits: splitsFromEvents(
      events,
      catalogProfiles(result.paths.flatMap((row) => [
        { projections: row.before },
        { projections: row.after },
      ])),
    ),
  });
}

export function runtimePairSplits(
  rows: readonly PairPathRow[],
): readonly RuntimePairSplit[] {
  return pairTopologyFor({ mode: "current", paths: rows }).splits;
}

export function runtimePairDeltas(
  rows: readonly PairDeltaRow[],
): readonly RuntimePairSplit[] {
  return pairTopologyFor({ mode: "diff", paths: rows }).splits;
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
