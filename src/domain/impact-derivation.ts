import { compareCodePoints, pathDirname } from "./repository-path.js";
import type {
  Finding,
  FindingCode,
  ImpactGroup,
  PathTransition,
  ProfileId,
  Projection,
} from "../model.js";

function findingCode(evidence: string): FindingCode | null {
  if (evidence.startsWith("UNSUPPORTED_GLOB_SEMANTIC:")) {
    return "UNSUPPORTED_GLOB_SEMANTIC";
  }
  if (evidence.startsWith("UNSUPPORTED_BOUNDARY:")) {
    return "UNSUPPORTED_BOUNDARY";
  }
  return null;
}

export function projectionFindings(
  projection: Projection,
  phase: "before" | "after" | null,
): Finding[] {
  const prefix = phase === null ? "" : `${phase}: `;
  const findings: Finding[] = [];
  if (projection.status === "PARTIAL") {
    findings.push({
      code: "PARTIAL_PROJECTION",
      profile: projection.profile,
      path: projection.context.targetPath,
      detail: `${prefix}projection is partial`,
    });
  } else if (projection.status === "UNKNOWN") {
    findings.push({
      code: "UNKNOWN_PROJECTION",
      profile: projection.profile,
      path: projection.context.targetPath,
      detail: `${prefix}projection is unknown`,
    });
  }
  if (projection.composition === "UNSPECIFIED") {
    findings.push({
      code: "UNSPECIFIED_COMPOSITION",
      profile: projection.profile,
      path: projection.context.targetPath,
      detail: `${prefix}composition order is unspecified`,
    });
  }
  for (const evidence of projection.evidence) {
    const code = findingCode(evidence);
    if (code !== null) {
      findings.push({
        code,
        profile: projection.profile,
        path: projection.context.targetPath,
        detail: `${prefix}${evidence}`,
      });
    }
  }
  return findings;
}

function compareNullableProfile(
  left: ProfileId | null,
  right: ProfileId | null,
): number {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  return compareCodePoints(left, right);
}

export function sortAndDedupeFindings(
  findings: readonly Finding[],
): Finding[] {
  const unique = new Map<string, Finding>();
  for (const finding of findings) {
    const key = JSON.stringify([
      finding.code,
      finding.profile,
      finding.path,
      finding.detail,
    ]);
    if (!unique.has(key)) unique.set(key, { ...finding });
  }
  return [...unique.values()].sort((left, right) =>
    compareCodePoints(left.path, right.path) ||
    compareNullableProfile(left.profile, right.profile) ||
    compareCodePoints(left.code, right.code) ||
    compareCodePoints(left.detail, right.detail),
  );
}

export function effectiveSourcePaths(
  projections: readonly Projection[],
): Set<string> {
  const paths = new Set<string>();
  for (const projection of projections) {
    for (const source of projection.sources) {
      if (source.disposition !== "SHADOWED") paths.add(source.path);
    }
  }
  return paths;
}

function directoryDepth(path: string): number {
  return path === "." ? 0 : path.split("/").length;
}

function nearestCause(causes: readonly string[]): string | null {
  const sorted = [...causes].sort((left, right) => {
    const depth = directoryDepth(pathDirname(right)) - directoryDepth(pathDirname(left));
    return depth || compareCodePoints(left, right);
  });
  return sorted[0] ?? null;
}

export function buildImpactGroups(
  paths: readonly PathTransition[],
): ImpactGroup[] {
  const groups = new Map<string, {
    changedStackPathCount: number;
    newlySplitPathCount: number;
    samplePaths: string[];
  }>();
  for (const path of paths) {
    const cause = nearestCause(path.causes);
    if (cause === null) continue;
    const root = pathDirname(cause);
    let group = groups.get(root);
    if (group === undefined) {
      group = {
        changedStackPathCount: 0,
        newlySplitPathCount: 0,
        samplePaths: [],
      };
      groups.set(root, group);
    }
    group.changedStackPathCount += path.changedProfiles.length > 0 ? 1 : 0;
    group.newlySplitPathCount += path.beforePayloadRelation === "SAME" &&
      path.afterPayloadRelation === "DIFFERENT" ? 1 : 0;
    group.samplePaths.push(path.path);
  }
  return [...groups].map(([root, group]) => ({
    root,
    changedStackPathCount: group.changedStackPathCount,
    newlySplitPathCount: group.newlySplitPathCount,
    samplePaths: group.samplePaths.sort(compareCodePoints).slice(0, 3),
  })).sort((left, right) => compareCodePoints(left.root, right.root));
}
