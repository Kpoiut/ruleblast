import type {
  CurrentPathProjection,
  PathTransition,
  RuleBlastResult,
} from "../model.js";

export interface PathGlance {
  readonly statusLineText: string;
  readonly accessibleStatusText: string;
}

function firstSourcePath(
  projections: readonly { readonly sources: readonly { readonly path: string }[] }[],
): string | undefined {
  return projections[0]?.sources[0]?.path;
}

function governed(path: string, source: string): PathGlance {
  return {
    statusLineText: `RB · ${source}`,
    accessibleStatusText: `RuleBlast: ${path} is governed by ${source}`,
  };
}

function diffPathGlance(path: string, row: PathTransition): PathGlance | null {
  if (row.changedProfiles.length > 0) {
    const cause = row.causes[0];
    return {
      statusLineText: cause === undefined ? "RB · Δ" : `RB · Δ · ${cause}`,
      accessibleStatusText: cause === undefined
        ? `RuleBlast: ${path} changed instruction stack`
        : `RuleBlast: ${path} inherits the changed stack from ${cause}`,
    };
  }
  if (
    row.beforePayloadRelation === "SAME" &&
    row.afterPayloadRelation === "DIFFERENT"
  ) {
    return {
      statusLineText: "RB · ≠",
      accessibleStatusText: `RuleBlast: ${path} newly split across profiles`,
    };
  }
  const source = firstSourcePath(row.after);
  return source === undefined ? null : governed(path, source);
}

function currentPathGlance(
  path: string,
  row: CurrentPathProjection,
): PathGlance | null {
  if (row.isSplit === true) {
    return {
      statusLineText: "RB · split",
      accessibleStatusText:
        `RuleBlast: ${path} already disagrees across selected realities`,
    };
  }
  const source = firstSourcePath(row.projections);
  return source === undefined ? null : governed(path, source);
}

/** Status-line micro-insight for one path in the last result. */
export function pathGlance(
  result: RuleBlastResult,
  path: string,
): PathGlance | null {
  if (result.mode === "diff") {
    const row = result.paths.find((item) => item.path === path);
    return row === undefined ? null : diffPathGlance(path, row);
  }
  const row = result.paths.find((item) => item.path === path);
  return row === undefined ? null : currentPathGlance(path, row);
}

/** Compare is for disagreed realities, not every two-profile path. */
export function resourceCanCompare(
  row: CurrentPathProjection | PathTransition,
): boolean {
  return "projections" in row
    ? row.isSplit === true
    : row.afterPayloadRelation === "DIFFERENT";
}
