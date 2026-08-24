import { renderConformanceLab } from "./application/conformance-lab.js";
import { renderEvidenceReveal } from "./application/evidence-revision.js";
import { presentationLabel } from "./application/profile-catalog.js";
import { renderRuntimePairLines } from "./application/scoreboard-view.js";
import type { ExplainResult } from "./cli-output.js";
import {
  rbctxForCurrent,
  rbctxForDiff,
  rbctxForExplainCurrent,
  rbctxForExplainDiff,
} from "./domain/rbctx.js";
import type {
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
  Projection,
} from "./model.js";
import { displayText, formatCount } from "./render-format.js";

function receiptProfileLine(profile: string, count: number, word: string): string {
  return `${presentationLabel(profile)}  ${formatCount(count)} ${word}`;
}

export interface ReceiptCard {
  readonly version: "RBREC1";
  readonly title: string;
  readonly rbctx: string;
  readonly markdown: string;
}

function box(lines: readonly string[]): string {
  const width = Math.max(28, ...lines.map((line) => line.length));
  const pad = (line: string): string => `| ${line.padEnd(width, " ")} |`;
  return [
    `+-- scoreboard ${"-".repeat(Math.max(0, width - 11))}--+`,
    ...lines.map(pad),
    `+${"-".repeat(width + 2)}+`,
  ].join("\n");
}

export async function receiptForCurrent(
  result: CurrentRuleBlastResult,
  agentAllow: "yes" | "ask" = "ask",
): Promise<ReceiptCard> {
  const rbctx = rbctxForCurrent(result);
  const markdown = [
    "RULEBLAST PROOF",
    box([
      result.snapshot.label,
      `${formatCount(result.counts.candidatePathCount)} candidate paths`,
      `${formatCount(result.counts.currentSplitPathCount)} path stacks already split`,
      ...result.counts.byProfile.map((profile) =>
        receiptProfileLine(profile.profile, profile.completePathCount, "complete")
      ),
      ...renderRuntimePairLines(result),
      `unknown ${formatCount(result.counts.unknownPathCount)}`,
      `agent-allow ${agentAllow}`,
      `rbctx ${rbctx}`,
    ]),
    "",
    "Not a claim about model compliance.",
    "",
    renderEvidenceReveal().trimEnd(),
    "",
    (await renderConformanceLab()).trimEnd(),
  ].join("\n");
  return { version: "RBREC1", title: "current", rbctx, markdown };
}

export async function receiptForDiff(
  result: DiffRuleBlastResult,
  agentAllow: "yes" | "ask" = "ask",
): Promise<ReceiptCard> {
  const rbctx = rbctxForDiff(result);
  const instructionLines = result.diffStats.editedLineCount;
  const markdown = [
    "RULEBLAST PROOF",
    box([
      `${result.before.label} → ${result.after.label}`,
      `${formatCount(instructionLines)} instruction lines`,
      `${formatCount(result.counts.changedStackPathCount)} path stacks moved`,
      ...result.counts.byProfile.map((profile) =>
        receiptProfileLine(profile.profile, profile.changedStackPathCount, "changed")
      ),
      ...renderRuntimePairLines(result),
      `unknown ${formatCount(result.counts.unknownPathCount)}`,
      `agent-allow ${agentAllow}`,
      `rbctx ${rbctx}`,
    ]),
    "",
    "Not a claim about model compliance.",
    "",
    renderEvidenceReveal().trimEnd(),
    "",
    (await renderConformanceLab()).trimEnd(),
  ].join("\n");
  return { version: "RBREC1", title: "diff", rbctx, markdown };
}

function projectionLine(projection: Projection): string {
  return `${presentationLabel(projection.profile)}  ${projection.status}  ${projection.composition}`;
}

export async function receiptForExplain(
  value: ExplainResult,
  agentAllow: "yes" | "ask" = "ask",
): Promise<ReceiptCard> {
  const lines = value.analysisMode === "current"
    ? [
        displayText(value.snapshot.label),
        displayText(value.path.path),
        ...value.path.projections.map(projectionLine),
        value.path.payloadRelation,
      ]
    : [
        `${displayText(value.before.label)} → ${displayText(value.after.label)}`,
        displayText(value.path.path),
        `${value.path.beforePayloadRelation} → ${value.path.afterPayloadRelation}`,
        ...value.path.after.map(projectionLine),
      ];
  const rbctx = value.analysisMode === "current"
    ? rbctxForExplainCurrent(value.snapshot.label, value.path.path, value.path.projections)
    : rbctxForExplainDiff(
        `${value.before.label}>${value.after.label}`,
        value.path.path,
        value.path.before,
        value.path.after,
      );
  const markdown = [
    "RULEBLAST PROOF",
    box([
      ...lines,
      `agent-allow ${agentAllow}`,
      `rbctx ${rbctx}`,
    ]),
    "",
    "Not a claim about model compliance.",
    "",
    renderEvidenceReveal().trimEnd(),
    "",
    (await renderConformanceLab()).trimEnd(),
  ].join("\n");
  return { version: "RBREC1", title: "explain", rbctx, markdown };
}
