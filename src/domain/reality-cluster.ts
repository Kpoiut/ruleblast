import type { Projection } from "../model.js";
import { comparePayloadRelation } from "./payload-relation.js";
import { compareCodePoints } from "./repository-path.js";

export interface RealityCluster {
  readonly members: readonly string[];
}

export interface PathRealityGroups {
  readonly clusters: readonly RealityCluster[];
  readonly unresolved: readonly string[];
}

export interface RealityGroupTally {
  readonly key: string;
  readonly clusters: readonly RealityCluster[];
  readonly unresolved: readonly string[];
  readonly pathCount: number;
  readonly samplePaths: readonly string[];
}

function findRoot(parent: number[], index: number): number {
  let current = index;
  while (parent[current] !== current) {
    const next = parent[current];
    if (next === undefined) throw new Error("cluster parent disappeared");
    current = next;
  }
  return current;
}

export function clusterEquivalentProjections(
  projections: readonly Projection[],
): PathRealityGroups {
  const complete: Projection[] = [];
  const unresolved: string[] = [];
  for (const projection of projections) {
    if (projection.status !== "COMPLETE") unresolved.push(projection.profile);
    else complete.push(projection);
  }
  const parent = complete.map((_, index) => index);
  for (let left = 0; left < complete.length; left += 1) {
    for (let right = left + 1; right < complete.length; right += 1) {
      if (comparePayloadRelation(complete[left]!, complete[right]!) !== "SAME") continue;
      parent[findRoot(parent, right)] = findRoot(parent, left);
    }
  }
  const grouped = new Map<number, string[]>();
  for (let index = 0; index < complete.length; index += 1) {
    const root = findRoot(parent, index);
    const members = grouped.get(root) ?? [];
    members.push(complete[index]!.profile);
    grouped.set(root, members);
  }
  const clusters = [...grouped.values()]
    .map((members) => Object.freeze({
      members: Object.freeze([...members].sort(compareCodePoints)),
    }))
    .sort((left, right) => compareCodePoints(left.members[0]!, right.members[0]!));
  return Object.freeze({
    clusters: Object.freeze(clusters),
    unresolved: Object.freeze([...unresolved].sort(compareCodePoints)),
  });
}

function groupKey(groups: PathRealityGroups): string {
  return [
    ...groups.clusters.map((cluster) => cluster.members.join("+")),
    groups.unresolved.length === 0 ? "" : `?${groups.unresolved.join(",")}`,
  ].filter((part) => part !== "").join("|");
}

export function tallyRealityGroups(
  paths: readonly {
    readonly path: string;
    readonly projections: readonly Projection[];
  }[],
): readonly RealityGroupTally[] {
  const tallies = new Map<string, {
    clusters: readonly RealityCluster[];
    unresolved: readonly string[];
    paths: string[];
  }>();
  for (const item of paths) {
    const groups = clusterEquivalentProjections(item.projections);
    const key = groupKey(groups);
    const existing = tallies.get(key);
    if (existing === undefined) {
      tallies.set(key, {
        clusters: groups.clusters,
        unresolved: groups.unresolved,
        paths: [item.path],
      });
    } else {
      existing.paths.push(item.path);
    }
  }
  return Object.freeze(
    [...tallies.entries()]
      .map(([key, value]) => Object.freeze({
        key,
        clusters: value.clusters,
        unresolved: value.unresolved,
        pathCount: value.paths.length,
        samplePaths: Object.freeze(value.paths.slice(0, 1)),
      }))
      .sort((left, right) =>
        right.pathCount - left.pathCount || compareCodePoints(left.key, right.key)
      ),
  );
}
