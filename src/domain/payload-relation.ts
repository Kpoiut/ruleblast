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
