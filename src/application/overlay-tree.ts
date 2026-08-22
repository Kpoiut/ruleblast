import type { RuleBlastResult } from "../model.js";
import {
  alignmentGloss,
  classifyChangeAlignment,
  countObservedKinds,
  GIT_STORAGE_IDENTITY_LAW,
  OVERLAY_SAMPLE_CAP,
  reconstructWorkMap,
  WORKTREE_CAPTURED_IDENTITY_LAW,
  type BlastOverlayView,
  type BlastRelation,
  type ObservedChange,
  type OverlayRenderContext,
  type WorkCue,
  type WorkCueKind,
} from "./blast-overlay.js";
import type { ScoreboardMark, ScoreboardNode } from "./host-session.js";

const CUE_LABEL: Readonly<Record<WorkCueKind, string>> = {
  "inherited-stack": "Inherited stack",
  "independent-git": "Independent Git work",
  unclassified: "Unclassified",
  "already-split": "Already-split stacks",
  "empty-other": "No other tracked path moved",
};

const CUE_MARK: Readonly<Partial<Record<WorkCueKind, ScoreboardMark>>> = {
  "inherited-stack": "inherited",
  "independent-git": "independent",
  unclassified: "unclassified",
  "already-split": "split",
};

function overlayMark(relation: BlastRelation): "inherited" | "independent" | "unclassified" {
  if (relation === "IN_BLAST") return "inherited";
  if (relation === "OUTSIDE_BLAST") return "independent";
  return "unclassified";
}

function overlayPathNode(row: ObservedChange): ScoreboardNode {
  return {
    id: `overlay:${row.relation}:${row.path}`,
    kind: "observation",
    label: row.path,
    path: row.path,
    intent: "EXPLAIN_PATH",
    mark: overlayMark(row.relation),
  };
}

function overlaySection(
  id: string,
  label: string,
  relation: BlastRelation,
  rows: readonly ObservedChange[],
): ScoreboardNode | null {
  const matched = rows.filter((row) => row.relation === relation);
  if (matched.length === 0) return null;
  const shown = matched.slice(0, OVERLAY_SAMPLE_CAP);
  const children = shown.map(overlayPathNode);
  if (matched.length > OVERLAY_SAMPLE_CAP) {
    children.push({
      id: `overlay:${relation}:more`,
      kind: "group",
      label: `+${matched.length - OVERLAY_SAMPLE_CAP} more · Show Index`,
    });
  }
  return {
    id,
    kind: "group",
    label,
    description: `${matched.length}`,
    children,
  };
}

function cueNode(cue: WorkCue): ScoreboardNode {
  const node: ScoreboardNode = {
    id: `overlay:work-map:${cue.kind}`,
    kind: "observation",
    label: CUE_LABEL[cue.kind],
  };
  const withCount = cue.kind === "empty-other" ? node : { ...node, description: `${cue.count}` };
  const mark = CUE_MARK[cue.kind];
  const marked = mark === undefined ? withCount : { ...withCount, mark };
  if (cue.samplePath === null) return marked;
  return { ...marked, path: cue.samplePath, intent: "EXPLAIN_PATH" };
}

export function adjunctRenderContext(
  result: RuleBlastResult | null,
): OverlayRenderContext {
  if (result === null || result.mode !== "diff") return {};
  const instructionLineEdits = result.diffStats.editedLineCount;
  const changedStackPathCount = result.counts.changedStackPathCount;
  const from = result.before.label;
  const to = result.after.kind === "worktree" ? "WORKTREE" : result.after.label;
  if (result.after.kind === "worktree") {
    return {
      from,
      to,
      instructionLineEdits,
      changedStackPathCount,
      identityLaw: "worktree-captured",
    };
  }
  if (result.before.kind === "git" && result.after.kind === "git") {
    return {
      from,
      to,
      instructionLineEdits,
      changedStackPathCount,
      identityLaw: "git-storage",
    };
  }
  return { from, to, instructionLineEdits, changedStackPathCount };
}

export function overlayNodes(state: {
  readonly overlay: BlastOverlayView | null;
  readonly overlayUnavailable: boolean;
} & OverlayRenderContext): readonly ScoreboardNode[] {
  if (state.overlayUnavailable) {
    return [{
      id: "overlay",
      kind: "observation",
      label: "Other tracked changes",
      description: "unavailable",
      mark: "unclassified",
    }];
  }
  const overlay = state.overlay;
  if (overlay === null) return [];
  const children: ScoreboardNode[] = [];
  const alignment = classifyChangeAlignment(overlay);
  if (alignment !== null) {
    children.push({
      id: "overlay:alignment",
      kind: "observation",
      label: "Change alignment",
      description: alignment,
      children: [{
        id: "overlay:alignment:gloss",
        kind: "observation",
        label: alignmentGloss(alignment),
      }],
    });
  }
  if (overlay.observedPathCount > 0) {
    const kinds = countObservedKinds(overlay);
    children.push({
      id: "overlay:kinds",
      kind: "observation",
      label: `${kinds.added} added · ${kinds.modified} modified · ${kinds.deleted} deleted`,
    });
  }
  if (state.identityLaw === "git-storage") {
    children.push({
      id: "overlay:law",
      kind: "observation",
      label: GIT_STORAGE_IDENTITY_LAW,
    });
  } else if (state.identityLaw === "worktree-captured") {
    children.push({
      id: "overlay:law",
      kind: "observation",
      label: WORKTREE_CAPTURED_IDENTITY_LAW,
    });
  }
  if (state.instructionLineEdits !== undefined &&
      state.changedStackPathCount !== undefined) {
    children.push({
      id: "overlay:edits",
      kind: "observation",
      label: `${state.instructionLineEdits} instruction-line edits`,
      description:
        `${state.changedStackPathCount} changed stacks · ${overlay.inBlastCount} inherited other paths`,
    });
  }
  children.push({
    id: "overlay:work-map",
    kind: "group",
    label: "Work map",
    children: reconstructWorkMap(overlay).map(cueNode),
  });
  children.push(
    ...[
      overlaySection("overlay:in", "Inherited stack", "IN_BLAST", overlay.observedPaths),
      overlaySection("overlay:out", "Independent Git work", "OUTSIDE_BLAST", overlay.observedPaths),
      overlaySection("overlay:unresolved", "Unclassified", "UNRESOLVED", overlay.observedPaths),
    ].filter((node): node is ScoreboardNode => node !== null),
  );
  if (overlay.splitObservedPathCount > 0) {
    children.push({
      id: "overlay:split",
      kind: "observation",
      label: "Already-split stacks",
      description: `${overlay.splitObservedPathCount}`,
      mark: "split",
    });
  }
  return [{
    id: "overlay",
    kind: "observation",
    label: "Other tracked changes",
    description: alignment === null
      ? `${overlay.observedPathCount} paths`
      : `${alignment} · ${overlay.observedPathCount} paths`,
    children,
  }];
}
