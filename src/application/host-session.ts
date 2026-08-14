import { posix, relative, resolve, sep } from "node:path";
import { canonicalJson } from "../canonical.js";
import {
  explainExistingResult,
  type CurrentExplainResult,
  type DiffExplainResult,
} from "../cli-output.js";
import { summarizeSourceBlasts } from "../domain/source-blast.js";
import type {
  Completeness,
  RuleBlastResult,
} from "../model.js";
import type { ExplainView } from "./explain-view.js";
import {
  analysisState,
  formatAnalysisState,
  type AnalysisLifecycle,
} from "./analysis-state.js";
import { isOptInReality, presentationFor, presentationLabel } from "./profile-catalog.js";
import { completenessFromResult, scoreboardView } from "./scoreboard-view.js";

export type HostCommand = "scan" | "diff" | "explain" | "case";

export type HostGateCode = "UNTRUSTED" | "NO_FOLDER" | "MULTI_ROOT";

export interface HostWorkspace {
  readonly trusted: boolean;
  readonly folders: readonly string[];
  readonly selectedFolder?: string;
}

export interface CompanionState {
  readonly lifecycle: AnalysisLifecycle;
  readonly completeness: Completeness;
  readonly dirtyBuffer: boolean;
  readonly reality: string | null;
  readonly action: HostCommand | null;
  readonly result: RuleBlastResult | null;
  readonly explainView: ExplainView | null;
  readonly explainText: string | null;
  readonly canonicalJson: string | null;
  readonly error: { readonly code: string; readonly message: string } | null;
}

export interface ScoreboardNode {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly children?: readonly ScoreboardNode[];
}

export function initialCompanionState(): CompanionState {
  return Object.freeze({
    lifecycle: "READY",
    completeness: "COMPLETE",
    dirtyBuffer: false,
    reality: null,
    action: null,
    result: null,
    explainView: null,
    explainText: null,
    canonicalJson: null,
    error: null,
  });
}

export function gateWorkspace(workspace: HostWorkspace):
  | { readonly ok: true; readonly root: string }
  | { readonly ok: false; readonly code: HostGateCode; readonly message: string } {
  if (!workspace.trusted) {
    return {
      ok: false,
      code: "UNTRUSTED",
      message: "RuleBlast does not run in an untrusted workspace.",
    };
  }
  if (workspace.folders.length === 0 && workspace.selectedFolder === undefined) {
    return {
      ok: false,
      code: "NO_FOLDER",
      message: "Open one Git folder before running RuleBlast.",
    };
  }
  if (workspace.selectedFolder !== undefined) {
    const selected = resolve(workspace.selectedFolder);
    if (workspace.folders.length > 0 &&
        !workspace.folders.some((folder) => resolve(folder) === selected)) {
      return {
        ok: false,
        code: "MULTI_ROOT",
        message: "Select one workspace folder. RuleBlast does not merge multi-root workspaces.",
      };
    }
    return { ok: true, root: selected };
  }
  if (workspace.folders.length !== 1) {
    return {
      ok: false,
      code: "MULTI_ROOT",
      message: "Select one workspace folder. RuleBlast does not merge multi-root workspaces.",
    };
  }
  return { ok: true, root: resolve(workspace.folders[0]!) };
}

export function toRepositoryRelativePath(
  root: string,
  absolutePath: string,
): string | null {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(absolutePath);
  const rel = relative(resolvedRoot, resolvedPath);
  if (rel === "" || rel.startsWith("..") || rel === "..") return null;
  const normalized = rel.split(sep).join(posix.sep);
  if (normalized.startsWith("/") || normalized.includes("\0")) return null;
  return normalized;
}

export function companionMarkStale(state: CompanionState): CompanionState {
  if (state.lifecycle !== "CURRENT" && state.lifecycle !== "STALE") return state;
  return Object.freeze({ ...state, lifecycle: "STALE" });
}

export function companionNoteDirty(
  state: CompanionState,
  dirty: boolean,
): CompanionState {
  return Object.freeze({ ...state, dirtyBuffer: dirty });
}

export function companionBegin(
  state: CompanionState,
  action: HostCommand,
): CompanionState {
  return Object.freeze({
    ...state,
    lifecycle: "ANALYZING",
    action,
    error: null,
  });
}

export function companionSucceed(
  state: CompanionState,
  result: RuleBlastResult,
): CompanionState {
  return Object.freeze({
    ...state,
    lifecycle: "CURRENT",
    completeness: completenessFromResult(result),
    result,
    explainView: null,
    explainText: null,
    canonicalJson: canonicalJson(result),
    error: null,
  });
}

export function companionExplain(
  state: CompanionState,
  view: ExplainView,
  text: string,
): CompanionState {
  const lifecycle = state.lifecycle === "STALE" ? "STALE" : "CURRENT";
  return Object.freeze({
    ...state,
    lifecycle,
    completeness: state.result === null
      ? view.completeness
      : completenessFromResult(state.result),
    explainView: view,
    explainText: text,
    error: null,
  });
}

export function companionExplainFromResult(
  state: CompanionState,
  path: string,
  present: (explain: CurrentExplainResult | DiffExplainResult) => string,
): CompanionState {
  if (state.result === null) {
    return companionFail(
      state,
      "NO_RESULT",
      "Scan, diff, or open the verified case before explaining from the last result.",
    );
  }
  try {
    const { explain, view } = explainExistingResult(state.result, path);
    return companionExplain(state, view, present(explain));
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : `Last result has no path ${JSON.stringify(path)}.`;
    return companionFail(state, "PATH_NOT_IN_RESULT", message);
  }
}

export function companionSetReality(
  state: CompanionState,
  reality: string | null,
): CompanionState {
  if (reality !== null && !isOptInReality(reality)) {
    throw new TypeError(`Unknown opt-in reality: ${JSON.stringify(reality)}`);
  }
  if (state.reality === reality) return state;
  const stale = state.result !== null &&
    (state.lifecycle === "CURRENT" || state.lifecycle === "STALE");
  return Object.freeze({
    ...state,
    reality,
    lifecycle: stale ? "STALE" : state.lifecycle,
  });
}

export function companionFail(
  state: CompanionState,
  code: string,
  message: string,
): CompanionState {
  return Object.freeze({
    ...state,
    lifecycle: "ERROR",
    error: Object.freeze({ code, message }),
  });
}

export function companionStatusLine(state: CompanionState): string {
  const core = formatAnalysisState(analysisState(state.lifecycle, state.completeness));
  if (state.dirtyBuffer) return `${core} · unsaved editor buffer is not in the snapshot`;
  return core;
}

export function companionScoreboard(state: CompanionState) {
  return state.result === null ? null : scoreboardView(state.result);
}

function realityLabel(reality: string | null): string {
  return reality === null
    ? "Reality default (Codex + Claude Code)"
    : `Reality + ${presentationFor(reality).shortLabel}`;
}

function sourceNode(
  profile: string,
  source: { readonly path: string; readonly disposition: string; readonly changed: boolean },
): ScoreboardNode {
  const node: ScoreboardNode = {
    id: `source:${profile}:${source.path}`,
    label: `${source.disposition} ${source.path}`,
  };
  return source.changed ? { ...node, description: "changed" } : node;
}

export function companionTree(state: CompanionState): ScoreboardNode[] {
  const result = state.result;
  const board = result === null ? null : scoreboardView(result);
  const nodes: ScoreboardNode[] = [
    { id: "status", label: companionStatusLine(state) },
    { id: "reality", label: realityLabel(state.reality) },
  ];
  if (state.error !== null) {
    nodes.push({ id: "error", label: state.error.code, description: state.error.message });
  }
  if (result === null || board === null) {
    nodes.push({ id: "empty", label: "Run Scan Workspace, Diff From…, or Open Verified Case" });
    return nodes;
  }
  nodes.push({
    id: "counts",
    label: `${board.candidatePathCount} tracked paths`,
    description: board.changedStackPathCount === null
      ? `${board.currentSplitPathCount} split`
      : `${board.changedStackPathCount} changed`,
  });
  nodes.push({
    id: "profiles",
    label: "Profiles",
    children: board.profiles.map((profile) => ({
      id: `profile:${profile.profile}`,
      label: `${profile.badge} ${profile.shortLabel}`,
      description: profile.changedStackPathCount === null
        ? `${profile.completePathCount} complete`
        : `${profile.changedStackPathCount} changed`,
    })),
  });
  nodes.push({
    id: "uncertainty",
    label: "Uncertainty",
    description: `${board.partialPathCount} partial · ${board.unknownPathCount} unknown · ${board.findingCount} findings`,
  });
  if (state.explainView !== null) {
    const view = state.explainView;
    const explain: ScoreboardNode = {
      id: "explain",
      label: `Explain ${view.path}`,
      children: view.profiles.map((profile) => ({
        id: `explain:${profile.profile}`,
        label: `${profile.badge} ${profile.shortLabel}`,
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
  if (result.mode === "diff") {
    const blasts = summarizeSourceBlasts(result);
    if (blasts.length > 0) {
      nodes.push({
        id: "blast",
        label: "Changed sources",
        children: blasts.map((blast) => ({
          id: `blast:${blast.sourcePath}`,
          label: blast.sourcePath,
          description: `${blast.changedStackPathCount} paths`,
          children: blast.byProfile.map((row) => ({
            id: `blast:${blast.sourcePath}:${row.profile}`,
            label: presentationLabel(row.profile),
            description: `${row.affectedPathCount} affected`,
          })),
        })),
      });
    }
  }
  return nodes;
}
