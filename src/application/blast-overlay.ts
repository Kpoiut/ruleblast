import type { DiffRuleBlastResult, PathTransition } from "../model.js";
import { compareCodePoints } from "../domain/repository-path.js";
import type { GitObjectSnapshot } from "../snapshot.js";

export const OVERLAY_SAMPLE_CAP = 8;

export const OVERLAY_UNAVAILABLE =
  "OTHER TRACKED CHANGES (selected realities)\n  unavailable — Git blob identity law could not be established\n";

export function renderBlastOverlay(view: BlastOverlayView): string {
  const lines = [
    "",
    "OTHER TRACKED CHANGES (selected realities)",
    `${view.observedPathCount} paths`,
    `  ${view.inBlastCount} in this blast · ${view.outsideBlastCount} outside this blast · ${view.unresolvedCount} unresolved`,
  ];
  if (view.splitObservedPathCount > 0) {
    lines.push(
      `  ${view.splitObservedPathCount} currently have a proven profile payload difference`,
    );
  }
  const sections = [
    ["IN_BLAST", "IN THIS BLAST"],
    ["OUTSIDE_BLAST", "OUTSIDE THIS BLAST"],
    ["UNRESOLVED", "UNRESOLVED"],
  ] as const;
  for (const [relation, heading] of sections) {
    const rows = view.observedPaths.filter((row) => row.relation === relation);
    if (rows.length === 0) continue;
    lines.push("", heading);
    for (const row of rows.slice(0, OVERLAY_SAMPLE_CAP)) {
      lines.push(`  ${row.path}`);
    }
    if (rows.length > OVERLAY_SAMPLE_CAP) {
      lines.push(`  … +${rows.length - OVERLAY_SAMPLE_CAP} more`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export type BlastRelation = "IN_BLAST" | "OUTSIDE_BLAST" | "UNRESOLVED";
export type ObservedKind = "ADD" | "DELETE" | "MODIFY";

export interface ObservedChange {
  readonly path: string;
  readonly kind: ObservedKind;
  readonly relation: BlastRelation;
}

export interface BlastOverlayView {
  readonly observedPathCount: number;
  readonly inBlastCount: number;
  readonly outsideBlastCount: number;
  readonly unresolvedCount: number;
  readonly splitObservedPathCount: number;
  readonly observedPaths: readonly ObservedChange[];
}

export function classifyObserved(
  kind: ObservedKind,
  transition: PathTransition | undefined,
): BlastRelation {
  if (kind === "DELETE" || transition === undefined) return "UNRESOLVED";
  if (transition.changedProfiles.length > 0) return "IN_BLAST";
  const afterByProfile = new Map(
    transition.after.map((projection) => [projection.profile, projection]),
  );
  const incomplete = transition.before.some((projection) => {
    const after = afterByProfile.get(projection.profile);
    return after === undefined ||
      projection.status !== "COMPLETE" ||
      after.status !== "COMPLETE";
  });
  return incomplete ? "UNRESOLVED" : "OUTSIDE_BLAST";
}

function sourcePaths(result: DiffRuleBlastResult): ReadonlySet<string> {
  const paths = new Set<string>();
  for (const change of result.changedInstructionSources) {
    if (change.beforePath !== null) paths.add(change.beforePath);
    if (change.afterPath !== null) paths.add(change.afterPath);
  }
  return paths;
}

export async function buildOverlayP1(
  before: GitObjectSnapshot,
  after: GitObjectSnapshot,
  result: DiffRuleBlastResult,
): Promise<BlastOverlayView> {
  const beforePaths = new Set(await before.listPaths());
  const afterPaths = new Set(await after.listPaths());
  const transitions = new Map(result.paths.map((row) => [row.path, row]));
  const sources = sourcePaths(result);
  const observed: ObservedChange[] = [];
  const names = [...new Set([...beforePaths, ...afterPaths])].sort(compareCodePoints);
  for (const path of names) {
    if (sources.has(path)) continue;
    const beforeOid = before.blobOid(path);
    const afterOid = after.blobOid(path);
    const kind: ObservedKind | null = beforeOid === null && afterOid !== null
      ? "ADD"
      : beforeOid !== null && afterOid === null
        ? "DELETE"
        : beforeOid !== null && afterOid !== null && beforeOid !== afterOid
          ? "MODIFY"
          : null;
    if (kind === null) continue;
    observed.push({
      path,
      kind,
      relation: classifyObserved(kind, transitions.get(path)),
    });
  }
  const inBlastCount = observed.filter((row) => row.relation === "IN_BLAST").length;
  const outsideBlastCount = observed.filter((row) => row.relation === "OUTSIDE_BLAST").length;
  const unresolvedCount = observed.filter((row) => row.relation === "UNRESOLVED").length;
  const splitObservedPathCount = observed.filter((row) => {
    if (row.kind === "DELETE") return false;
    return transitions.get(row.path)?.isSplit === true;
  }).length;
  return Object.freeze({
    observedPathCount: observed.length,
    inBlastCount,
    outsideBlastCount,
    unresolvedCount,
    splitObservedPathCount,
    observedPaths: Object.freeze(observed),
  });
}
