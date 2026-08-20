import { presentationLabel } from "./application/profile-catalog.js";
import { rbctxForCurrent, rbctxForDiff } from "./domain/rbctx.js";
import type {
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
} from "./model.js";
import { formatCount } from "./render-format.js";

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

export function receiptForCurrent(
  result: CurrentRuleBlastResult,
  agentAllow: "yes" | "ask" = "ask",
): ReceiptCard {
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
      `unknown ${formatCount(result.counts.unknownPathCount)}`,
      `agent-allow ${agentAllow}`,
      `rbctx ${rbctx}`,
    ]),
    "",
    "Not a claim about model compliance.",
  ].join("\n");
  return { version: "RBREC1", title: "current", rbctx, markdown };
}

export function receiptForDiff(
  result: DiffRuleBlastResult,
  agentAllow: "yes" | "ask" = "ask",
): ReceiptCard {
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
      `unknown ${formatCount(result.counts.unknownPathCount)}`,
      `agent-allow ${agentAllow}`,
      `rbctx ${rbctx}`,
    ]),
    "",
    "Not a claim about model compliance.",
  ].join("\n");
  return { version: "RBREC1", title: "diff", rbctx, markdown };
}
