import type {
  CurrentPathProjection,
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
  ImpactGroup,
} from "./model.js";
import type { ExplainResult } from "./cli-output.js";
import {
  captureTextPresentationContext,
  type CurrentTextPresentationContext,
  type DiffTextPresentationContext,
  type TextPresentationContext,
} from "./render-context.js";
import { renderExplain } from "./render-explain.js";
import {
  compareText,
  displayText,
  formatCount,
  heading,
  plural,
  repositoryPathToken,
  shellToken,
} from "./render-format.js";

export { displayText } from "./render-format.js";
export type { ShellDialect } from "./render-format.js";
export type {
  CurrentTextPresentationContext,
  DiffTextPresentationContext,
  TextPresentationContext,
} from "./render-context.js";

export type TextResult =
  | CurrentRuleBlastResult
  | DiffRuleBlastResult
  | ExplainResult;
function currentHeading(
  context: CurrentTextPresentationContext,
  color: boolean,
): string {
  const suffix = context.demoFixture
    ? "DEMO FIXTURE"
    : displayText(context.currentLabel);
  return heading(`RULEBLAST · ${suffix}`, color);
}

function diffHeading(
  context: DiffTextPresentationContext,
  color: boolean,
): string {
  const suffix = context.demoFixture
    ? "DEMO FIXTURE"
    : `${displayText(context.beforeLabel)} → ${displayText(context.afterLabel)}`;
  return heading(`RULEBLAST · ${suffix}`, color);
}

function hasInstructionSources(result: CurrentRuleBlastResult): boolean {
  return result.paths.some((path) =>
    path.projections.some((projection) => projection.sources.length > 0),
  );
}

function stableCurrentSample(
  paths: readonly CurrentPathProjection[],
): string | null {
  const split = paths.filter((path) => path.isSplit === true);
  const candidates = split.length > 0 ? split : paths;
  return [...candidates].sort((left, right) =>
    compareText(left.path, right.path),
  )[0]?.path ?? null;
}
function betterGroup(candidate: ImpactGroup, current: ImpactGroup): boolean {
  if (candidate.changedStackPathCount !== current.changedStackPathCount) {
    return candidate.changedStackPathCount > current.changedStackPathCount;
  }
  if (candidate.newlySplitPathCount !== current.newlySplitPathCount) {
    return candidate.newlySplitPathCount > current.newlySplitPathCount;
  }
  return compareText(candidate.root, current.root) < 0;
}

function largestGroup(groups: readonly ImpactGroup[]): ImpactGroup | null {
  let selected: ImpactGroup | null = null;
  for (const group of groups) {
    if (selected === null || betterGroup(group, selected)) selected = group;
  }
  return selected;
}

function stableDiffSample(
  result: DiffRuleBlastResult,
  group: ImpactGroup | null,
): string | null {
  const grouped = group === null
    ? []
    : [...group.samplePaths].sort(compareText);
  const consumer = grouped.find((path) => result.paths.some((transition) =>
    transition.path === path && !transition.causes.includes(path),
  ));
  if (consumer !== undefined) return consumer;
  if (grouped[0] !== undefined) return grouped[0];
  const newlySplit = result.paths.filter((path) =>
    path.beforePayloadRelation === "SAME" &&
    path.afterPayloadRelation === "DIFFERENT",
  );
  const changed = result.paths.filter((path) => path.changedProfiles.length > 0);
  const candidates = newlySplit.length > 0
    ? newlySplit
    : changed.length > 0
      ? changed
      : result.paths;
  return [...candidates].sort((left, right) =>
    compareText(left.path, right.path),
  )[0]?.path ?? null;
}

interface CoverageCounts {
  readonly partialPathCount: number;
  readonly unknownPathCount: number;
  readonly indeterminatePathCount: number;
}

function appendCoverageNotes(
  lines: string[],
  counts: CoverageCounts,
  binaryChangedSourceCount = 0,
): void {
  if (counts.partialPathCount === 0 && counts.unknownPathCount === 0 &&
      counts.indeterminatePathCount === 0 && binaryChangedSourceCount === 0) {
    return;
  }
  lines.push("", "Coverage notes:");
  if (counts.partialPathCount > 0) {
    const count = counts.partialPathCount;
    lines.push(count === 1
      ? "  1 path has a partial projection."
      : `  ${formatCount(count)} paths have partial projections.`);
  }
  if (counts.unknownPathCount > 0) {
    const count = counts.unknownPathCount;
    lines.push(count === 1
      ? "  1 path has an unknown projection."
      : `  ${formatCount(count)} paths have unknown projections.`);
  }
  if (counts.indeterminatePathCount > 0) {
    const count = counts.indeterminatePathCount;
    lines.push(count === 1
      ? "  1 path has an indeterminate profile relation."
      : `  ${formatCount(count)} paths have indeterminate profile relations.`);
  }
  if (binaryChangedSourceCount > 0) {
    lines.push(binaryChangedSourceCount === 1
      ? "  1 binary instruction source changed; line edits exclude it."
      : `  ${formatCount(binaryChangedSourceCount)} binary instruction sources changed; line edits exclude them.`);
  }
}

function appendScope(
  lines: string[],
  candidatePathCount: number,
  resolverRevision: number,
): void {
  lines.push(
    "",
    `Scope: ${formatCount(candidatePathCount)} tracked ${plural(candidatePathCount, "path")} · repository-only · resolver revision ${formatCount(resolverRevision)}`,
  );
}

function renderCurrent(
  result: CurrentRuleBlastResult,
  context: CurrentTextPresentationContext,
  color: boolean,
): string {
  const lines = [currentHeading(context, color), ""];
  if (!hasInstructionSources(result)) {
    lines.push(
      "No repo instructions yet.",
      "",
      "Want the 10-second reveal?",
      "  npx ruleblast@1.0.0 demo",
    );
  } else {
    const count = result.counts.currentSplitPathCount;
    if (count > 0) {
      lines.push(
        formatCount(count),
        `tracked ${plural(count, "path")} ${count === 1 ? "is" : "are"} split across profiles.`,
      );
    } else if (result.counts.partialPathCount > 0 ||
        result.counts.unknownPathCount > 0 ||
        result.counts.indeterminatePathCount > 0) {
      lines.push(
        `No proven cross-profile split across ${formatCount(result.counts.candidatePathCount)} tracked ${plural(result.counts.candidatePathCount, "path")}.`,
      );
    } else {
      lines.push(
        `One documented reality across ${formatCount(result.counts.candidatePathCount)} tracked ${plural(result.counts.candidatePathCount, "path")}.`,
      );
    }
    const sample = stableCurrentSample(result.paths);
    if (sample !== null) {
      lines.push(
        "",
        "Pick one path. See every source:",
        `  ruleblast explain ${repositoryPathToken(sample, context.shellDialect)}`,
      );
    }
  }
  appendCoverageNotes(lines, result.counts);
  appendScope(lines, result.counts.candidatePathCount, result.resolverRevision);
  return `${lines.join("\n")}\n`;
}

function groupRoot(root: string): string {
  return root === "." ? "./" : `${displayText(root)}/`;
}

function diffExplainCommand(
  sample: string,
  context: DiffTextPresentationContext,
): string {
  const path = repositoryPathToken(sample, context.shellDialect);
  if (context.demoFixture) {
    return `ruleblast demo --explain ${path}`;
  }
  const source = shellToken(context.beforeLabel, context.shellDialect);
  const target = context.afterLabel === "WORKTREE"
    ? ""
    : ` --to ${shellToken(context.afterLabel, context.shellDialect)}`;
  return `ruleblast explain ${path} --from ${source}${target}`;
}

function renderDiff(
  result: DiffRuleBlastResult,
  context: DiffTextPresentationContext,
  color: boolean,
): string {
  const lines = [diffHeading(context, color), ""];
  if (result.changedInstructionSources.length === 0) {
    lines.push("No tracked instruction sources changed.");
  } else {
    const edits = result.diffStats.editedLineCount;
    lines.push(
      `${formatCount(edits)} instruction-line ${plural(edits, "edit")}.`,
    );
  }
  const changed = result.counts.changedStackPathCount;
  lines.push(
    "",
    formatCount(changed),
    `tracked ${plural(changed, "path")} changed stack.`,
    "",
  );
  const split = result.counts.newlySplitPathCount;
  lines.push(split > 0
    ? `${formatCount(split)} ${plural(split, "path")} now ${split === 1 ? "lives" : "live"} in two AI realities.`
    : "No paths newly split across profiles.");

  const converged = result.counts.convergedPathCount;
  if (converged > 0) {
    lines.push(
      "",
      `${formatCount(converged)} ${plural(converged, "path")} converged into one documented reality.`,
    );
  }

  const group = largestGroup(result.groups);
  if (group !== null) {
    lines.push(
      "",
      `The largest fracture starts at ${groupRoot(group.root)}.`,
    );
  }
  const sample = stableDiffSample(result, group);
  if ((changed > 0 || split > 0) && sample !== null) {
    lines.push(
      "",
      "Pick one path. See every source:",
      `  ${diffExplainCommand(sample, context)}`,
    );
  }
  appendCoverageNotes(
    lines,
    result.counts,
    result.diffStats.binaryChangedSourceCount,
  );
  appendScope(lines, result.counts.candidatePathCount, result.resolverRevision);
  return `${lines.join("\n")}\n`;
}

export function renderText(
  value: TextResult,
  contextValue?: TextPresentationContext,
  color = false,
): string {
  const context = captureTextPresentationContext(value, contextValue);
  if (value.mode === "current") {
    if (!("currentLabel" in context)) {
      throw new TypeError("Current result requires current presentation context");
    }
    return renderCurrent(value, context, color);
  }
  if (value.mode === "diff") {
    if (!("beforeLabel" in context)) {
      throw new TypeError("Diff result requires endpoint presentation context");
    }
    return renderDiff(value, context, color);
  }
  return renderExplain(value, context, color);
}
