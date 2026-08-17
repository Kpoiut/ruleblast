import { summarizeSourceBlasts } from "../domain/source-blast.js";
import {
  analysisState,
  formatAnalysisState,
} from "./analysis-state.js";
import { CONTROL_BINDINGS, CONTROL_CHORD } from "./control-keys.js";
import { adjunctRenderContext, overlayNodes } from "./overlay-tree.js";
import { presentationFor, presentationLabel } from "./profile-catalog.js";
import { scoreboardView } from "./scoreboard-view.js";
import type {
  CompanionState,
  ScoreboardNode,
} from "./host-session.js";

export function companionStatusLine(state: CompanionState): string {
  const core = formatAnalysisState(analysisState(state.lifecycle, state.completeness));
  if (state.dirtyBuffer) return `${core} · unsaved editor buffer is not in the snapshot`;
  return core;
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

function controlNodes(): ScoreboardNode {
  return {
    id: "control",
    kind: "group",
    label: "Control",
    description: CONTROL_CHORD,
    children: CONTROL_BINDINGS.map((binding) => ({
      id: `control:${binding.id}`,
      kind: "control",
      label: binding.label,
      description: binding.token,
    })),
  };
}

export function companionTree(state: CompanionState): ScoreboardNode[] {
  const result = state.result;
  const board = result === null ? null : scoreboardView(result);
  const nodes: ScoreboardNode[] = [
    { id: "status", kind: "status", label: companionStatusLine(state) },
    controlNodes(),
    {
      id: "reality",
      kind: "reality",
      label: realityLabel(state.realities),
      intent: "SELECT_REALITY",
    },
  ];
  if (result === null || board === null) {
    if (state.error !== null) {
      return [
        nodes[0]!,
        {
          id: "error",
          kind: "error",
          label: state.error.code,
          description: state.error.message,
        },
      ];
    }
    if (state.lifecycle === "ANALYZING") return [nodes[0]!];
    return [];
  }
  if (state.error !== null) {
    nodes.push({
      id: "error",
      kind: "error",
      label: state.error.code,
      description: state.error.message,
    });
  }
  nodes.push({
    id: "counts",
    kind: "counts",
    label: `${board.candidatePathCount} tracked paths`,
    description: board.changedStackPathCount === null
      ? `${board.currentSplitPathCount} split`
      : `${board.changedStackPathCount} changed`,
  });
  nodes.push({
    id: "profiles",
    kind: "group",
    label: "Profiles",
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
    description: `${board.partialPathCount} partial · ${board.unknownPathCount} unknown · ${board.findingCount} findings`,
  };
  nodes.push(
    board.partialPathCount + board.unknownPathCount > 0
      ? { ...uncertainty, mark: "uncertain" }
      : uncertainty,
  );
  nodes.push(...overlayNodes({
    overlay: state.overlay,
    overlayUnavailable: state.overlayUnavailable,
    ...adjunctRenderContext(result),
  }));
  if (result.mode === "diff") {
    const blasts = summarizeSourceBlasts(result);
    if (blasts.length > 0) {
      nodes.push({
        id: "blast",
        kind: "group",
        label: "Changed sources",
        children: blasts.map((blast) => ({
          id: `blast:${blast.sourcePath}`,
          kind: "instruction-source",
          label: blast.sourcePath,
          path: blast.sourcePath,
          intent: "OPEN_PATH",
          description: `${blast.changedStackPathCount} paths`,
          children: blast.byProfile.map((row) => ({
            id: `blast:${blast.sourcePath}:${row.profile}`,
            kind: "profile",
            label: presentationLabel(row.profile),
            description: `${row.affectedPathCount} affected`,
          })),
        })),
      });
    }
  }
  if (state.explainView !== null) {
    const view = state.explainView;
    const explain: ScoreboardNode = {
      id: "explain",
      kind: "explain",
      label: `Explain ${view.path}`,
      path: view.path,
      intent: "EXPLAIN_PATH",
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
