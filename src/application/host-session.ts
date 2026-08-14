import { posix, relative, resolve, sep } from "node:path";
import { canonicalJson } from "../canonical.js";
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
  readonly action: HostCommand | null;
  readonly result: RuleBlastResult | null;
  readonly explainView: ExplainView | null;
  readonly explainText: string | null;
  readonly canonicalJson: string | null;
  readonly error: { readonly code: string; readonly message: string } | null;
}

export function initialCompanionState(): CompanionState {
  return Object.freeze({
    lifecycle: "READY",
    completeness: "COMPLETE",
    dirtyBuffer: false,
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
  return Object.freeze({
    ...state,
    lifecycle: "CURRENT",
    completeness: view.completeness,
    explainView: view,
    explainText: text,
    error: null,
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
