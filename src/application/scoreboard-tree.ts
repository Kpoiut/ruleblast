import { summarizeSourceBlasts } from "../domain/source-blast.js";
import {
  analysisState,
  formatAnalysisState,
} from "./analysis-state.js";
import { classifyChangeAlignment } from "./blast-overlay.js";
import { adjunctRenderContext, overlayNodes } from "./overlay-tree.js";
import { presentationFor, presentationLabel } from "./profile-catalog.js";
import { renderRuntimePairLines, scoreboardView, uncertainPathCount } from "./scoreboard-view.js";
import type {
  CompanionState,
  ScoreboardNode,
} from "./host-session.js";

export function companionStatusLine(state: CompanionState): string {
  const core = formatAnalysisState(analysisState(state.lifecycle, state.completeness));
  const parts = [core];
  if (state.overlay !== null && !state.overlayUnavailable) {
    const alignment = classifyChangeAlignment(state.overlay);
    if (alignment !== null) parts.push(alignment);
  }
  if (state.dirtyBuffer) parts.push("unsaved editor buffer is not in the snapshot");
  return parts.join(" · ");
}

function realityLabel(realities: readonly string[]): string {
  if (realities.length === 0) return "Reality default (Codex + Claude Code)";
  return `Reality + ${realities.map((id) => presentationFor(id).shortLabel).join(" + ")}`;
}

function sourceNode(
  profile: string,
  source: { readonly path: string; readonly disposition: string; readonly changed: boolean },
): ScoreboardNode {
  const node: ScoreboardNode = {
    id: `source:${profile}:${source.path}`,
    kind: "instruction-source",
    label: `${source.disposition} ${source.path}`,
    path: source.path,
    intent: "OPEN_PATH",
  };
  return source.changed
    ? { ...node, description: "changed", mark: "affected" }
    : node;
}

function metricLeaf(
  id: string,
  label: string,
  accessibleLabel: string,
  mark?: ScoreboardNode["mark"],
): ScoreboardNode {
  return mark === undefined
    ? { id, kind: "counts", label, accessibleLabel }
    : { id, kind: "counts", label, accessibleLabel, mark };
}

function realityNode(state: CompanionState): ScoreboardNode {
  return {
    id: "reality",
    kind: "reality",
    label: realityLabel(state.realities),
    intent: "SELECT_REALITY",
  };
}

function pairGroup(result: NonNullable<CompanionState["result"]>): ScoreboardNode | null {
  const lines = renderRuntimePairLines(result);
  if (lines.length === 0) return null;
  return {
    id: "pairs",
    kind: "group",
    label: "Runtime pairs",
    collapsed: false,
    children: lines.map((line) => metricLeaf(
      `pair:${line}`,
      line,
      line,
      "split",
    )),
  };
}

function blastGroup(state: CompanionState): ScoreboardNode | null {
  const result = state.result;
  if (result === null || result.mode !== "diff") return null;
  const blasts = summarizeSourceBlasts(result, undefined, { limit: Infinity });
  if (blasts.length === 0) return null;
  return {
    id: "blast",
    kind: "group",
    label: "Changed sources",
    collapsed: false,
    children: blasts.map((blast) => ({
      id: `blast:${blast.sourcePath}`,
      kind: "instruction-source",
      label: blast.sourcePath,
      path: blast.sourcePath,
      intent: "OPEN_INSTRUCTION_SOURCE",
      description: `${blast.changedStackPathCount} paths`,
      children: blast.byProfile.map((row) => ({
        id: `blast:${blast.sourcePath}:${row.profile}`,
        kind: "profile",
        label: presentationLabel(row.profile),
        description: `${row.affectedPathCount} affected`,
      })),
    })),
  };
}

export function companionTree(state: CompanionState): ScoreboardNode[] {
  const result = state.result;
  const board = result === null ? null : scoreboardView(result);

  if (result === null || board === null) {
    if (state.error !== null) {
      return [{
        id: "error",
        kind: "error",
        label: state.error.code,
        description: state.error.message,
        accessibleLabel: `RuleBlast error: ${state.error.message}`,
      }];
    }
    return [];
  }

  const nodes: ScoreboardNode[] = [];
  if (state.error !== null) {
    nodes.push({
      id: "error",
      kind: "error",
      label: state.error.code,
      description: state.error.message,
      accessibleLabel: `RuleBlast error: ${state.error.message}`,
    });
  }

  if (state.lifecycle === "STALE") {
    nodes.push(metricLeaf(
      "stale",
      "STALE",
      state.staleCause === "realities"
        ? "RuleBlast last result is stale because selected realities changed"
        : "RuleBlast last result is stale because the workspace changed",
      "uncertain",
    ));
    const pairs = pairGroup(result);
    if (pairs !== null) nodes.push(pairs);
    const blast = blastGroup(state);
    if (blast !== null) nodes.push(blast);
    nodes.push(realityNode(state));
    return nodes;
  }

  const uncertain = uncertainPathCount(result);
  if (result.mode === "diff") {
    nodes.push(metricLeaf(
      "metric-changed",
      `Δ ${board.changedStackPathCount} changed`,
      `${board.changedStackPathCount} paths have changed instruction stacks`,
      "affected",
    ));
    nodes.push(metricLeaf(
      "metric-split",
      `≠ ${board.newlySplitPathCount} split`,
      `${board.newlySplitPathCount} paths newly split across profiles`,
      (board.newlySplitPathCount ?? 0) > 0 ? "split" : undefined,
    ));
  } else if (board.currentSplitPathCount > 0) {
    nodes.push(metricLeaf(
      "metric-already-split",
      `${board.currentSplitPathCount} already split`,
      `${board.currentSplitPathCount} paths already disagree across selected realities`,
    ));
  }
  nodes.push(metricLeaf(
    "metric-uncertain",
    `? ${uncertain} unresolved`,
    `${uncertain} paths have incomplete projections`,
    uncertain > 0 ? "uncertain" : undefined,
  ));

  const pairs = pairGroup(result);
  if (pairs !== null) nodes.push(pairs);

  const blast = blastGroup(state);
  if (blast !== null) nodes.push(blast);

  nodes.push({
    id: "profiles",
    kind: "group",
    label: "Profiles",
    collapsed: true,
    children: board.profiles.map((profile) => ({
      id: `profile:${profile.profile}`,
      kind: "profile",
      label: `${profile.badge} ${profile.shortLabel}`,
      badge: profile.badge,
      description: profile.changedStackPathCount === null
        ? `${profile.completePathCount} complete`
        : `${profile.changedStackPathCount} changed`,
    })),
  });

  const uncertainty: ScoreboardNode = {
    id: "uncertainty",
    kind: "uncertainty",
    label: "Uncertainty",
    collapsed: true,
    description: `${board.partialPathCount} partial · ${board.unknownPathCount} unknown · ${board.findingCount} findings`,
  };
  nodes.push(uncertain > 0 ? { ...uncertainty, mark: "uncertain" } : uncertainty);

  for (const node of overlayNodes({
    overlay: state.overlay,
    overlayUnavailable: state.overlayUnavailable,
    ...adjunctRenderContext(result),
  })) {
    nodes.push({ ...node, collapsed: true });
  }

  nodes.push(realityNode(state));

  if (state.explainView !== null) {
    const view = state.explainView;
    const explain: ScoreboardNode = {
      id: "explain",
      kind: "explain",
      label: `Explain ${view.path}`,
      path: view.path,
      intent: "EXPLAIN_PATH",
      collapsed: false,
      children: view.profiles.map((profile) => ({
        id: `explain:${profile.profile}`,
        kind: "profile",
        label: `${profile.badge} ${profile.shortLabel}`,
        badge: profile.badge,
        mark: profile.affected === true
          ? "affected"
          : profile.affected === false
            ? "unchanged"
            : "uncertain",
        description: profile.affected === true
          ? "affected"
          : profile.affected === false
            ? "unchanged"
            : profile.completeness.toLowerCase(),
        children: profile.sources.map((source) => sourceNode(profile.profile, source)),
      })),
    };
    nodes.push(view.relation === null ? explain : { ...explain, description: view.relation });
  }

  return nodes;
}
