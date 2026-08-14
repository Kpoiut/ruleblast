import type { Completeness } from "../model.js";

export type AnalysisLifecycle =
  | "READY"
  | "ANALYZING"
  | "CURRENT"
  | "STALE"
  | "ERROR";

export interface AnalysisState {
  readonly lifecycle: AnalysisLifecycle;
  readonly completeness: Completeness;
}

export function analysisState(
  lifecycle: AnalysisLifecycle,
  completeness: Completeness,
): AnalysisState {
  return Object.freeze({ lifecycle, completeness });
}

export function formatAnalysisState(state: AnalysisState): string {
  if (state.lifecycle === "READY" || state.lifecycle === "ANALYZING" ||
      state.lifecycle === "ERROR") {
    return state.lifecycle;
  }
  return `${state.lifecycle} · ${state.completeness}`;
}
