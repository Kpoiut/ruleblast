import { rbctxForCurrent, rbctxForDiff } from "./domain/rbctx.js";
import type {
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
} from "./model.js";
import { formatCount } from "./render-format.js";

export interface ReceiptCard {
  readonly version: "RBREC1";
  readonly title: string;
  readonly rbctx: string;
  readonly markdown: string;
}

export function receiptForCurrent(result: CurrentRuleBlastResult): ReceiptCard {
  const rbctx = rbctxForCurrent(result);
  const markdown = [
    "RULEBLAST PROOF",
    result.snapshot.label,
    `${formatCount(result.counts.candidatePathCount)} candidate paths`,
    `${formatCount(result.counts.currentSplitPathCount)} path stacks already split`,
    ...result.counts.byProfile.map((profile) =>
      `${profile.profile}  ${formatCount(profile.completePathCount)} complete`
    ),
    `Unknown        ${formatCount(result.counts.unknownPathCount)}`,
    `rbctx: ${rbctx}`,
    "",
    "Not a claim about model compliance.",
  ].join("\n");
  return { version: "RBREC1", title: "current", rbctx, markdown };
}

export function receiptForDiff(result: DiffRuleBlastResult): ReceiptCard {
  const rbctx = rbctxForDiff(result);
  const instructionLines = result.diffStats.deletedLineCount +
    result.diffStats.addedLineCount + result.diffStats.editedLineCount;
  const markdown = [
    "RULEBLAST PROOF",
    `${result.before.label} → ${result.after.label}`,
    `${formatCount(instructionLines)} instruction lines`,
    `${formatCount(result.counts.changedStackPathCount)} path stacks moved`,
    ...result.counts.byProfile.map((profile) =>
      `${profile.profile}  ${formatCount(profile.changedStackPathCount)} changed`
    ),
    `Unknown        ${formatCount(result.counts.unknownPathCount)}`,
    `rbctx: ${rbctx}`,
    "",
    "Not a claim about model compliance.",
  ].join("\n");
  return { version: "RBREC1", title: "diff", rbctx, markdown };
}
