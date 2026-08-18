import { presentationLabel } from "./profile-catalog.js";
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

export function compareProjectionStacks(
  path: string,
  projections: readonly Projection[],
): ProjectionStackCompare {
  return {
    path,
    left: stackFrom(projections[0], "left"),
    right: stackFrom(projections[1], "right"),
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
