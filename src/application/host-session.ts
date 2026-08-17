import { posix, relative, resolve, sep } from "node:path";
import { canonicalJson } from "../canonical.js";
import {
  explainExistingResult,
  type CurrentExplainResult,
  type DiffExplainResult,
} from "../cli-output.js";
import type {
  Completeness,
  RuleBlastResult,
} from "../model.js";
import type { ExplainView } from "./explain-view.js";
import {
  type AnalysisLifecycle,
} from "./analysis-state.js";
import { isOptInReality } from "./profile-catalog.js";
import { completenessFromResult, scoreboardView } from "./scoreboard-view.js";
import type { BlastOverlayView } from "./blast-overlay.js";
import type { ControlIntent } from "./control-keys.js";
import { companionStatusLine, companionTree } from "./scoreboard-tree.js";

export { companionStatusLine, companionTree };

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
  readonly realities: readonly string[];
  readonly action: HostCommand | null;
  readonly result: RuleBlastResult | null;
  readonly overlay: BlastOverlayView | null;
  readonly overlayUnavailable: boolean;
  readonly explainView: ExplainView | null;
  readonly explainText: string | null;
  readonly canonicalJson: string | null;
  readonly error: { readonly code: string; readonly message: string } | null;
}

export type ScoreboardKind =
  | "status"
  | "control"
  | "reality"
  | "error"
  | "counts"
  | "profile"
  | "uncertainty"
  | "instruction-source"
  | "affected-path"
  | "explain"
  | "observation"
  | "group";

export type ScoreboardIntent = ControlIntent | "EXPLAIN_PATH" | "OPEN_PATH" | "SELECT_REALITY";

export type ScoreboardMark =
  | "affected"
  | "unchanged"
  | "split"
  | "uncertain"
  | "inherited"
  | "independent"
  | "unclassified";

export interface ScoreboardNode {
  readonly id: string;
  readonly kind: ScoreboardKind;
  readonly label: string;
  readonly description?: string;
  readonly path?: string;
  readonly intent?: ScoreboardIntent;
  readonly mark?: ScoreboardMark;
  readonly badge?: string;
  readonly children?: readonly ScoreboardNode[];
}

export function initialCompanionState(): CompanionState {
  return Object.freeze({
    lifecycle: "READY",
    completeness: "COMPLETE",
    dirtyBuffer: false,
    realities: Object.freeze([]),
    action: null,
    result: null,
    overlay: null,
    overlayUnavailable: false,
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
  adjunct: {
    readonly overlay?: BlastOverlayView | null;
    readonly overlayUnavailable?: boolean;
  } = {},
): CompanionState {
  return Object.freeze({
    ...state,
    lifecycle: "CURRENT",
    completeness: completenessFromResult(result),
    result,
    overlay: adjunct.overlay ?? null,
    overlayUnavailable: adjunct.overlayUnavailable === true,
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

export function companionSetRealities(
  state: CompanionState,
  realities: readonly string[],
): CompanionState {
  const unique = [...new Set(realities)].sort();
  for (const reality of unique) {
    if (!isOptInReality(reality)) {
      throw new TypeError(`Unknown opt-in reality: ${JSON.stringify(reality)}`);
    }
  }
  if (state.realities.length === unique.length &&
      state.realities.every((id, index) => id === unique[index])) {
    return state;
  }
  const stale = state.result !== null &&
    (state.lifecycle === "CURRENT" || state.lifecycle === "STALE");
  return Object.freeze({
    ...state,
    realities: Object.freeze(unique),
    lifecycle: stale ? "STALE" : state.lifecycle,
  });
}

export function companionSetReality(
  state: CompanionState,
  reality: string | null,
): CompanionState {
  return companionSetRealities(state, reality === null ? [] : [reality]);
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

export function companionScoreboard(state: CompanionState) {
  return state.result === null ? null : scoreboardView(state.result);
}
