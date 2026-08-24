import { compareCodePoints } from "../domain/repository-path.js";
import { attentionPaths } from "../domain/attention-paths.js";
import { pairTopologyFor } from "../domain/payload-relation.js";
import { sourcePathOf } from "../domain/source-blast.js";
import type { RuleBlastResult } from "../model.js";
import {
  classifyChangeAlignment,
  type BlastOverlayView,
} from "./blast-overlay.js";

export interface ResultIndexContext {
  readonly overlay?: BlastOverlayView | null;
  readonly from?: string;
  readonly to?: string;
}

const HEADER = "# ruleblast.index v1";

function emit(kind: string, value: string): string {
  return `${kind}\t${value}`;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value !== ""))].sort(compareCodePoints);
}

function emitPairTopology(result: RuleBlastResult): readonly string[] {
  const { events, splits } = pairTopologyFor(result);
  const lines: string[] = [];
  for (const pair of splits) {
    if (pair.differentPathCount > 0) {
      lines.push(emit("PAIR", `${pair.left}\t${pair.right}\t${pair.differentPathCount}`));
    }
    if (pair.newlyDifferentPathCount > 0) {
      lines.push(emit("NEWPAIR", `${pair.left}\t${pair.right}\t${pair.newlyDifferentPathCount}`));
    }
    if (pair.convergedPathCount > 0) {
      lines.push(emit("CONVPAIR", `${pair.left}\t${pair.right}\t${pair.convergedPathCount}`));
    }
    if (pair.indeterminatePathCount > 0) {
      lines.push(emit("INDPAIR", `${pair.left}\t${pair.right}\t${pair.indeterminatePathCount}`));
    }
  }
  for (const event of events) {
    if (event.different) {
      lines.push(emit("PAIRPATH", `${event.left}\t${event.right}\t${event.path}`));
    }
    if (event.newlyDifferent) {
      lines.push(emit("NEWPAIRPATH", `${event.left}\t${event.right}\t${event.path}`));
    }
    if (event.converged) {
      lines.push(emit("CONVPAIRPATH", `${event.left}\t${event.right}\t${event.path}`));
    }
    if (event.indeterminate) {
      lines.push(emit("INDPAIRPATH", `${event.left}\t${event.right}\t${event.path}`));
    }
  }
  return lines;
}

export function renderResultIndex(
  result: RuleBlastResult,
  context: ResultIndexContext = {},
): string {
  const lines = [HEADER];
  if (result.mode === "current") {
    lines.push(emit("MODE", "scan"));
    lines.push(...emitPairTopology(result));
    for (const path of attentionPaths(result)) lines.push(emit("SPLIT", path));
    return `${lines.join("\n")}\n`;
  }

  lines.push(emit("MODE", "diff"));
  const from = context.from !== undefined && context.from !== ""
    ? context.from
    : result.before.label;
  const to = context.to !== undefined && context.to !== ""
    ? context.to
    : result.after.kind === "worktree" ? "WORKTREE" : result.after.label;
  if (from !== "") lines.push(emit("FROM", from));
  if (to !== "") lines.push(emit("TO", to));
  const overlay = context.overlay ?? null;
  if (overlay !== null) {
    const alignment = classifyChangeAlignment(overlay);
    if (alignment !== null) lines.push(emit("ALIGN", alignment));
    const law = result.after.kind === "worktree"
      ? "worktree-captured"
      : result.before.kind === "git" && result.after.kind === "git"
        ? "git-storage"
        : null;
    if (law !== null) lines.push(emit("LAW", law));
  }
  lines.push(emit("STACK", String(result.counts.changedStackPathCount)));
  lines.push(...emitPairTopology(result));
  const sources = uniqueSorted(
    result.changedInstructionSources.map((change) => sourcePathOf(change)),
  );
  for (const path of sources) lines.push(emit("SOURCE", path));
  for (const path of attentionPaths(result)) lines.push(emit("CONTINUE", path));
  if (overlay !== null) {
    const continueSet = new Set(attentionPaths(result));
    const reject = uniqueSorted(
      overlay.observedPaths
        .filter((row) => row.relation === "OUTSIDE_BLAST")
        .map((row) => row.path),
    );
    const unresolved = uniqueSorted(
      overlay.observedPaths
        .filter((row) => row.relation === "UNRESOLVED")
        .map((row) => row.path),
    );
    for (const path of reject) {
      if (!continueSet.has(path)) lines.push(emit("REJECT", path));
    }
    for (const path of unresolved) {
      if (!continueSet.has(path)) lines.push(emit("UNRESOLVED", path));
    }
  }
  const splits = uniqueSorted(
    result.paths.filter((row) => row.isSplit === true).map((row) => row.path),
  );
  const continueSet = new Set(attentionPaths(result));
  for (const path of splits) {
    if (!continueSet.has(path)) lines.push(emit("SPLIT", path));
  }
  return `${lines.join("\n")}\n`;
}
