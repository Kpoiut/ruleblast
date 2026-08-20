import { presentationLabel } from "./profile-catalog.js";
import { comparePayloadRelation } from "../domain/payload-relation.js";
import type { CurrentPathProjection, PathTransition, Projection } from "../model.js";

export interface ComparedStack {
  readonly label: string;
  readonly lines: readonly string[];
}

export interface ProjectionStackCompare {
  readonly path: string;
  readonly left: ComparedStack;
  readonly right: ComparedStack;
}

function stackLines(projection: Projection): readonly string[] {
  if (projection.sources.length === 0) return Object.freeze(["(no sources)"]);
  return Object.freeze(projection.sources.map((source) =>
    `${source.disposition} ${source.path}`,
  ));
}

function stackFrom(projection: Projection | undefined, fallback: string): ComparedStack {
  if (projection === undefined) {
    return { label: fallback, lines: Object.freeze(["(no projection)"]) };
  }
  return {
    label: presentationLabel(projection.profile),
    lines: stackLines(projection),
  };
}

function specifiedComposition(projection: Projection): boolean {
  return projection.composition !== "UNSPECIFIED" &&
    projection.composition !== "RUNTIME_DECIDED";
}

function comparedPair(
  projections: readonly Projection[],
): readonly [Projection | undefined, Projection | undefined] {
  let fallback: readonly [Projection, Projection] | null = null;
  for (let left = 0; left < projections.length; left += 1) {
    for (let right = left + 1; right < projections.length; right += 1) {
      const first = projections[left];
      const second = projections[right];
      if (first === undefined || second === undefined) continue;
      if (comparePayloadRelation(first, second) !== "DIFFERENT") continue;
      if (specifiedComposition(first) && specifiedComposition(second)) {
        return [first, second];
      }
      fallback ??= [first, second];
    }
  }
  return fallback ?? [projections[0], projections[1]];
}

export function compareProjectionStacks(
  path: string,
  projections: readonly Projection[],
): ProjectionStackCompare {
  const [left, right] = comparedPair(projections);
  return {
    path,
    left: stackFrom(left, "left"),
    right: stackFrom(right, "right"),
  };
}

export function comparePathStacks(
  row: CurrentPathProjection | PathTransition,
): ProjectionStackCompare {
  if ("projections" in row) return compareProjectionStacks(row.path, row.projections);
  return compareProjectionStacks(row.path, row.after);
}

export function formatProjectionCompare(compare: ProjectionStackCompare): string {
  const block = (side: ComparedStack): string =>
    [side.label, ...side.lines.map((line) => `  ${line}`)].join("\n");
  return [
    `RULEBLAST COMPARE · ${compare.path}`,
    "",
    block(compare.left),
    "",
    block(compare.right),
    "",
  ].join("\n");
}
