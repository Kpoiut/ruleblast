import type {
  DiffRuleBlastResult,
  RuleBlastResult,
} from "../model.js";
import { summarizeSourceBlasts } from "../domain/source-blast.js";
import type { CompanionState } from "./host-session.js";
import { pathGlance, resourceCanCompare } from "./path-glance.js";
import { presentationLabel } from "./profile-catalog.js";
import { scoreboardView, uncertainPathCount } from "./scoreboard-view.js";

export { uncertainPathCount } from "./scoreboard-view.js";

export type ExplainFreshness = "current" | "stale";

export interface StatusGlance {
  readonly statusLineText: string;
  readonly accessibleStatusText: string;
  readonly tooltipMarkdown: string;
  readonly treeViewBadge: number | undefined;
  readonly treeViewDescription: string;
}

export interface ResourceDecoration {
  readonly badge: "Δ" | "≠" | "?";
  readonly tooltip: string;
}

export interface ResourceLens {
  readonly isInstructionSource: boolean;
  readonly changedCount: number;
  readonly liveTitle: string;
  readonly staleTitle: string;
  readonly dirtyTitle: string;
}

export interface ResourceTruth {
  readonly path: string;
  readonly decoration: ResourceDecoration | null;
  readonly lens: ResourceLens | null;
  readonly canCompare: boolean;
}

export interface CompareRefs {
  readonly beforeRef: string | null;
  readonly afterKind: "git" | "worktree" | "fixture";
  readonly afterRef: string | null;
}

export type WorkspaceTruth =
  | { readonly phase: "ready"; readonly glance: StatusGlance }
  | { readonly phase: "analyzing"; readonly glance: StatusGlance }
  | {
      readonly phase: "error";
      readonly code: string;
      readonly message: string;
      readonly glance: StatusGlance;
    }
  | { readonly phase: "stale"; readonly glance: StatusGlance }
  | {
      readonly phase: "current";
      readonly mode: "scan" | "diff";
      readonly changedCount: number | null;
      readonly newlySplitCount: number | null;
      readonly uncertainPathCount: number;
      readonly glance: StatusGlance;
    };

export interface ExplainPolicy {
  readonly freshness: ExplainFreshness;
  readonly banner: string | null;
}

export interface PresentationSnapshot {
  readonly generation: number;
  readonly workspaceTruth: WorkspaceTruth;
  readonly resourceIndex: ReadonlyMap<string, ResourceTruth>;
  readonly explainPolicy: ExplainPolicy;
  readonly compare: CompareRefs | null;
}

export const STALE_EXPLAIN_BANNER =
  "RULEBLAST · STALE\nThis explanation belongs to the previous tracked-worktree snapshot.\nRe-run Explain or Diff to refresh.\n\n────────────────────────────────\n";

export function staleExplainBanner(content: string): string {
  return `${STALE_EXPLAIN_BANNER}\n${content}`;
}

function glance(
  statusLineText: string,
  accessibleStatusText: string,
  tooltipMarkdown: string,
  treeViewDescription: string,
  treeViewBadge?: number,
): StatusGlance {
  return Object.freeze({
    statusLineText,
    accessibleStatusText,
    tooltipMarkdown,
    treeViewBadge,
    treeViewDescription,
  });
}

function currentGlance(
  mode: "scan" | "diff",
  changedCount: number | null,
  newlySplitCount: number | null,
  uncertainPathCountValue: number,
  candidatePathCount: number,
  labels: string,
): StatusGlance {
  let statusLineText = "RB · CURRENT";
  let accessibleStatusText = "RuleBlast: workspace projections are current";
  if (uncertainPathCountValue > 0) {
    statusLineText = `RB · ?${uncertainPathCountValue}`;
    accessibleStatusText =
      `RuleBlast: ${uncertainPathCountValue} paths have incomplete projections`;
  } else if (mode === "diff" && changedCount !== null && changedCount > 0) {
    statusLineText = `RB · Δ${changedCount}`;
    accessibleStatusText =
      `RuleBlast: ${changedCount} paths have changed instruction stacks`;
  } else if (mode === "diff" && newlySplitCount !== null && newlySplitCount > 0) {
    statusLineText = `RB · ≠${newlySplitCount}`;
    accessibleStatusText =
      `RuleBlast: ${newlySplitCount} paths newly split across profiles`;
  }
  const badge = mode === "diff" && changedCount !== null && changedCount > 0
    ? changedCount
    : undefined;
  const treeViewDescription = mode === "diff"
    ? `${changedCount ?? 0} changed · ${newlySplitCount ?? 0} split`
    : "CURRENT";
  return glance(
    statusLineText,
    accessibleStatusText,
    `${candidatePathCount} tracked paths · ${labels}\n\nCtrl+Alt+R then S to re-scan`,
    treeViewDescription,
    badge,
  );
}

function compareRefs(result: RuleBlastResult | null): CompareRefs | null {
  if (result === null || result.mode !== "diff") return null;
  const beforeRef = result.before.kind === "git"
    ? result.before.oid ?? result.before.label
    : null;
  const afterRef = result.after.kind === "git"
    ? result.after.oid ?? result.after.label
    : null;
  return {
    beforeRef,
    afterKind: result.after.kind,
    afterRef,
  };
}

function buildResourceIndex(
  result: RuleBlastResult | null,
  live: boolean,
): ReadonlyMap<string, ResourceTruth> {
  const map = new Map<string, ResourceTruth>();
  if (result === null) return map;

  if (result.mode === "diff") {
    const diffResult = result as DiffRuleBlastResult;
    for (const blast of summarizeSourceBlasts(diffResult, undefined, { limit: Infinity })) {
      const profileSummary = blast.byProfile
        .map((row) => `${presentationLabel(row.profile)} ${row.affectedPathCount}`)
        .join(" · ");
      map.set(blast.sourcePath, {
        path: blast.sourcePath,
        decoration: null,
        canCompare: false,
        lens: {
          isInstructionSource: true,
          changedCount: blast.changedStackPathCount,
          liveTitle:
            `RuleBlast · Δ${blast.changedStackPathCount} affected paths · ${profileSummary}`,
          staleTitle: "RuleBlast · STALE · rerun Diff",
          dirtyTitle: "RuleBlast · UNSAVED · buffer not analyzed",
        },
      });
    }
    for (const path of diffResult.paths) {
      let decoration: ResourceDecoration | null = null;
      if (live) {
        const uncertain = path.before.some((row) => row.status !== "COMPLETE") ||
          path.after.some((row) => row.status !== "COMPLETE");
        const split = path.beforePayloadRelation === "SAME" &&
          path.afterPayloadRelation === "DIFFERENT";
        const changed = path.changedProfiles.length > 0;
        if (uncertain) {
          decoration = { badge: "?", tooltip: "RuleBlast — projection incomplete" };
        } else if (split) {
          decoration = { badge: "≠", tooltip: "RuleBlast — realities newly diverged" };
        } else if (changed) {
          const profiles = path.changedProfiles.map(presentationLabel).join(", ");
          const causes = path.causes.join(", ");
          decoration = {
            badge: "Δ",
            tooltip: `RuleBlast — stack changed: ${profiles}\nCause: ${causes || "instruction edit"}`,
          };
        }
      }
      const existing = map.get(path.path);
      map.set(path.path, {
        path: path.path,
        decoration,
        lens: existing?.lens ?? null,
        canCompare: resourceCanCompare(path),
      });
    }
    return map;
  }

  for (const path of result.paths) {
    let decoration: ResourceDecoration | null = null;
    if (live) {
      const uncertain = path.projections.some((row) => row.status !== "COMPLETE");
      if (uncertain) {
        decoration = { badge: "?", tooltip: "RuleBlast — projection incomplete" };
      }
    }
    map.set(path.path, {
      path: path.path,
      decoration,
      lens: null,
      canCompare: resourceCanCompare(path),
    });
  }
  return map;
}

export function derivePresentationTruth(
  state: CompanionState,
  activeEditorRelativePath: string | null = null,
  _activeEditorDirty = false,
  generation = 0,
): PresentationSnapshot {
  const board = state.result === null ? null : scoreboardView(state.result);
  const labels = board === null
    ? ""
    : board.profiles.map((profile) => profile.shortLabel).join(", ");
  const uncertain = state.result === null ? 0 : uncertainPathCount(state.result);

  let workspaceTruth: WorkspaceTruth;
  if (state.lifecycle === "ANALYZING") {
    workspaceTruth = {
      phase: "analyzing",
      glance: glance(
        "RB · $(sync~spin)",
        "RuleBlast: analysis in progress",
        "RuleBlast: Analyzing…",
        "Analyzing…",
      ),
    };
  } else if (state.lifecycle === "ERROR") {
    const code = state.error?.code ?? "ERROR";
    const message = state.error?.message ?? "An error occurred";
    workspaceTruth = {
      phase: "error",
      code,
      message,
      glance: glance(`RB · ${code}`, `RuleBlast error: ${message}`, message, code),
    };
  } else if (state.lifecycle === "STALE") {
    workspaceTruth = {
      phase: "stale",
      glance: glance(
        "RB · STALE",
        "RuleBlast: last result is stale because the workspace changed",
        "Last result is stale. [Diff again](command:ruleblast.diffFrom)",
        "STALE",
      ),
    };
  } else if (state.lifecycle === "CURRENT" && board !== null && state.result !== null) {
    const glance = currentGlance(
      state.result.mode === "diff" ? "diff" : "scan",
      board.changedStackPathCount,
      board.newlySplitPathCount,
      uncertain,
      board.candidatePathCount,
      labels,
    );
    const focused = activeEditorRelativePath === null
      ? null
      : pathGlance(state.result, activeEditorRelativePath);
    workspaceTruth = {
      phase: "current",
      mode: state.result.mode === "diff" ? "diff" : "scan",
      changedCount: board.changedStackPathCount,
      newlySplitCount: board.newlySplitPathCount,
      uncertainPathCount: uncertain,
      glance: focused === null ? glance : {
        ...glance,
        statusLineText: focused.statusLineText,
        accessibleStatusText: focused.accessibleStatusText,
      },
    };
  } else {
    workspaceTruth = {
      phase: "ready",
      glance: glance(
        "RB · READY",
        "RuleBlast: ready to scan or diff",
        "RuleBlast: Ready. Press Ctrl+Alt+R then S to scan.",
        "",
      ),
    };
  }

  const live = workspaceTruth.phase === "current";
  const stale = workspaceTruth.phase === "stale";
  const explainFreshness: ExplainFreshness = stale ? "stale" : "current";

  return Object.freeze({
    generation,
    workspaceTruth,
    resourceIndex: buildResourceIndex(state.result, live),
    explainPolicy: Object.freeze({
      freshness: explainFreshness,
      banner: stale ? STALE_EXPLAIN_BANNER : null,
    }),
    compare: compareRefs(state.result),
  });
}

export class PresentationSession {
  #generation = 0;
  #snapshot: PresentationSnapshot | null = null;

  public get generation(): number { return this.#generation; }
  public get snapshot(): PresentationSnapshot | null { return this.#snapshot; }

  public begin(): number {
    this.#generation += 1;
    return this.#generation;
  }

  public replace(
    state: CompanionState,
    relativePath: string | null = null,
    dirty = false,
  ): PresentationSnapshot {
    this.#snapshot = derivePresentationTruth(
      state,
      relativePath,
      dirty,
      this.#generation,
    );
    return this.#snapshot;
  }

  public commit(
    state: CompanionState,
    generation: number,
    relativePath: string | null = null,
    dirty = false,
  ): PresentationSnapshot | null {
    if (generation !== this.#generation) return null;
    return this.replace(state, relativePath, dirty);
  }
}
