import type { DiffRuleBlastResult, PathTransition } from "../model.js";
import { blobIdentityKind } from "../domain/git-blob-identity.js";
import { compareCodePoints, unionSortedPaths } from "../domain/repository-path.js";
import type { GitObjectSnapshot } from "../snapshot.js";

export const OVERLAY_SAMPLE_CAP = 8;

export const OVERLAY_UNAVAILABLE =
  "OTHER TRACKED CHANGES (selected realities)\n  unavailable — Git blob identity law could not be established\n";

export const GIT_STORAGE_IDENTITY_LAW = "Git storage blob-object identity";
export const WORKTREE_CAPTURED_IDENTITY_LAW = "captured worktree blob identity";

export function renderBlastOverlay(
  view: BlastOverlayView,
  context: OverlayRenderContext = {},
): string {
  const lines = [
    "",
    "OTHER TRACKED CHANGES (selected realities)",
    `${view.observedPathCount} paths`,
    `  ${view.inBlastCount} in this blast · ${view.outsideBlastCount} outside this blast · ${view.unresolvedCount} unresolved`,
  ];
  if (view.observedPathCount > 0) {
    const kinds = countObservedKinds(view);
    lines.push(
      `  ${kinds.added} added · ${kinds.modified} modified · ${kinds.deleted} deleted`,
    );
    if (kinds.deleted > 0) {
      lines.push(
        kinds.deleted === 1
          ? "  1 deleted path is not an after-snapshot target"
          : `  ${kinds.deleted} deleted paths are not after-snapshot targets`,
      );
    }
  }
  const law = identityLawLine(context.identityLaw);
  if (law !== null) lines.push(law);
  if (view.splitObservedPathCount > 0) {
    lines.push(
      `  ${view.splitObservedPathCount} currently have a proven profile payload difference`,
    );
  }
  if (context.instructionLineEdits !== undefined &&
      context.changedStackPathCount !== undefined) {
    lines.push(
      `  ${context.instructionLineEdits} instruction-line edits · ${context.changedStackPathCount} changed stacks · ${view.inBlastCount} inherited other paths`,
    );
  }
  const alignment = classifyChangeAlignment(view);
  if (alignment !== null) {
    lines.push(
      "",
      "CHANGE ALIGNMENT (selected realities; not actor telemetry)",
      `  ${alignment}`,
      `  ${alignmentGloss(alignment)}`,
    );
  }
  if (view.observedPathCount > 0) {
    lines.push(
      "",
      "INTENT (selected realities; not actor telemetry; not a stored session)",
    );
    if (view.inBlastCount > 0) {
      lines.push(`  CONTINUE  ${view.inBlastCount}  later work inherits the instruction edit`);
    }
    if (view.outsideBlastCount > 0) {
      lines.push(
        `  REJECT  ${view.outsideBlastCount}  Git moved; selected stacks did not; not a recommendation to discard the change`,
      );
    }
    if (view.unresolvedCount > 0) {
      lines.push(
        `  UNRESOLVED  ${view.unresolvedCount}  do not treat as inherited or independent`,
      );
    }
  }
  const sections = [
    ["IN_BLAST", "IN THIS BLAST"],
    ["OUTSIDE_BLAST", "OUTSIDE THIS BLAST"],
    ["UNRESOLVED", "UNRESOLVED"],
  ] as const;
  const sampleCap = context.sampleCap ?? OVERLAY_SAMPLE_CAP;
  for (const [relation, heading] of sections) {
    const rows = view.observedPaths.filter((row) => row.relation === relation);
    if (rows.length === 0) continue;
    lines.push("", heading);
    const shown = Number.isFinite(sampleCap) ? rows.slice(0, sampleCap) : rows;
    for (const row of shown) {
      lines.push(`  ${row.path}`);
    }
    if (shown.length < rows.length) {
      lines.push(`  … +${rows.length - shown.length} more`);
    }
  }
  return `${lines.join("\n")}\n${renderWorkMap(view, context)}`;
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

export type WorkCueKind =
  | "inherited-stack"
  | "independent-git"
  | "unclassified"
  | "already-split"
  | "empty-other";

export interface WorkCue {
  readonly kind: WorkCueKind;
  readonly count: number;
  readonly samplePath: string | null;
}

export type OverlayIdentityLaw = "git-storage" | "worktree-captured";

export interface OverlayRenderContext {
  readonly from?: string;
  readonly to?: string;
  readonly instructionLineEdits?: number;
  readonly changedStackPathCount?: number;
  readonly identityLaw?: OverlayIdentityLaw;
  readonly sampleCap?: number;
}

export type ChangeAlignment = "ALIGNED" | "MIXED" | "DIVERGENT" | "UNRESOLVED";

export function alignmentGloss(alignment: ChangeAlignment): string {
  if (alignment === "ALIGNED") {
    return "every other tracked path inherited the changed stack";
  }
  if (alignment === "MIXED") {
    return "other tracked motion is not one inherited class";
  }
  if (alignment === "DIVERGENT") {
    return "a proven profile payload difference is present";
  }
  return "at least one other path cannot be classified";
}

export function countObservedKinds(view: BlastOverlayView): {
  readonly added: number;
  readonly modified: number;
  readonly deleted: number;
} {
  let added = 0;
  let modified = 0;
  let deleted = 0;
  for (const row of view.observedPaths) {
    if (row.kind === "ADD") added += 1;
    else if (row.kind === "DELETE") deleted += 1;
    else modified += 1;
  }
  return { added, modified, deleted };
}

function identityLawLine(law: OverlayIdentityLaw | undefined): string | null {
  if (law === "git-storage") return `  ${GIT_STORAGE_IDENTITY_LAW}`;
  if (law === "worktree-captured") return `  ${WORKTREE_CAPTURED_IDENTITY_LAW}`;
  return null;
}

export function classifyChangeAlignment(
  view: BlastOverlayView,
): ChangeAlignment | null {
  if (view.observedPathCount === 0) return null;
  if (view.unresolvedCount > 0) return "UNRESOLVED";
  if (view.splitObservedPathCount > 0) return "DIVERGENT";
  if (view.inBlastCount > 0 && view.outsideBlastCount === 0) return "ALIGNED";
  return "MIXED";
}

function firstObserved(
  view: BlastOverlayView,
  relation: BlastRelation,
): string | null {
  return view.observedPaths.find((row) => row.relation === relation)?.path ?? null;
}

export function reconstructWorkMap(view: BlastOverlayView): readonly WorkCue[] {
  if (view.observedPathCount === 0) {
    return Object.freeze([
      Object.freeze({ kind: "empty-other", count: 0, samplePath: null }),
    ]);
  }
  const cues: WorkCue[] = [];
  if (view.inBlastCount > 0) {
    cues.push(Object.freeze({
      kind: "inherited-stack",
      count: view.inBlastCount,
      samplePath: firstObserved(view, "IN_BLAST"),
    }));
  }
  if (view.outsideBlastCount > 0) {
    cues.push(Object.freeze({
      kind: "independent-git",
      count: view.outsideBlastCount,
      samplePath: firstObserved(view, "OUTSIDE_BLAST"),
    }));
  }
  if (view.unresolvedCount > 0) {
    cues.push(Object.freeze({
      kind: "unclassified",
      count: view.unresolvedCount,
      samplePath: firstObserved(view, "UNRESOLVED"),
    }));
  }
  if (view.splitObservedPathCount > 0) {
    cues.push(Object.freeze({
      kind: "already-split",
      count: view.splitObservedPathCount,
      samplePath: null,
    }));
  }
  return Object.freeze(cues);
}

function pathWord(count: number): string {
  return count === 1 ? "path" : "paths";
}

function sampleLines(cue: WorkCue): readonly string[] {
  return cue.samplePath === null ? [] : [`    first: ${cue.samplePath}`];
}

function formatCue(cue: WorkCue): readonly string[] {
  if (cue.kind === "empty-other") return ["  no other tracked path moved"];
  if (cue.kind === "inherited-stack") {
    return [
      `  ${cue.count} ${pathWord(cue.count)} inherited the changed stack`,
      ...sampleLines(cue),
      "    later work here inherits the instruction edit",
    ];
  }
  if (cue.kind === "independent-git") {
    return [
      `  ${cue.count} ${pathWord(cue.count)} moved in Git without a selected-stack change`,
      ...sampleLines(cue),
      "    later work here does not inherit the instruction edit",
    ];
  }
  if (cue.kind === "unclassified") {
    return [
      `  ${cue.count} ${pathWord(cue.count)} cannot be classified`,
      ...sampleLines(cue),
      "    do not treat as inherited or independent",
    ];
  }
  return [
    `  ${cue.count} ${pathWord(cue.count)} already ${cue.count === 1 ? "has" : "have"} a proven profile payload difference`,
    "    one selected surface is not the other surface's stack",
  ];
}

function nextExplain(
  cues: readonly WorkCue[],
  context: OverlayRenderContext,
): string | null {
  const sample = cues.find((cue) => cue.samplePath !== null)?.samplePath ?? null;
  if (sample === null) return null;
  if (context.from !== undefined && context.to !== undefined) {
    return `  next: ruleblast explain ${sample} --from ${context.from} --to ${context.to} --json`;
  }
  return `  next: ruleblast explain ${sample} --json`;
}

function renderWorkMap(
  view: BlastOverlayView,
  context: OverlayRenderContext,
): string {
  const cues = reconstructWorkMap(view);
  const lines = ["", "WORK MAP (selected realities; not actor telemetry)"];
  for (const cue of cues) lines.push(...formatCue(cue));
  const next = nextExplain(cues, context);
  if (next !== null) lines.push(next);
  return `${lines.join("\n")}\n`;
}

export function classifyObserved(
  kind: ObservedKind,
  transition: PathTransition | undefined,
): BlastRelation {
  if (kind === "DELETE" || transition === undefined) return "UNRESOLVED";
  if (transition.changedProfiles.length > 0) return "IN_BLAST";
  const beforeByProfile = new Map(
    transition.before.map((projection) => [projection.profile, projection]),
  );
  const afterByProfile = new Map(
    transition.after.map((projection) => [projection.profile, projection]),
  );
  const profiles = new Set([...beforeByProfile.keys(), ...afterByProfile.keys()]);
  if (profiles.size === 0) return "UNRESOLVED";
  for (const profile of profiles) {
    const before = beforeByProfile.get(profile);
    const after = afterByProfile.get(profile);
    if (before === undefined || after === undefined ||
        before.status !== "COMPLETE" || after.status !== "COMPLETE") {
      return "UNRESOLVED";
    }
  }
  return "OUTSIDE_BLAST";
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
  const beforePaths = [...await before.listPaths()].sort(compareCodePoints);
  const afterPaths = [...await after.listPaths()].sort(compareCodePoints);
  const transitions = new Map(result.paths.map((row) => [row.path, row]));
  const sources = sourcePaths(result);
  const observed: ObservedChange[] = [];
  for (const path of unionSortedPaths(beforePaths, afterPaths)) {
    if (sources.has(path)) continue;
    const kind = blobIdentityKind(before.blobOid(path), after.blobOid(path));
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
