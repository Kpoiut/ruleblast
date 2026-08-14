import type { Completeness, RuleBlastResult } from "../model.js";
import { presentationFor } from "./profile-catalog.js";

export interface ScoreboardProfileView {
  readonly profile: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly badge: string;
  readonly completePathCount: number;
  readonly partialPathCount: number;
  readonly unknownPathCount: number;
  readonly changedStackPathCount: number | null;
}

export interface ScoreboardView {
  readonly mode: RuleBlastResult["mode"];
  readonly candidatePathCount: number;
  readonly currentSplitPathCount: number;
  readonly partialPathCount: number;
  readonly unknownPathCount: number;
  readonly changedStackPathCount: number | null;
  readonly profiles: readonly ScoreboardProfileView[];
  readonly findingCount: number;
}

export function completenessFromResult(result: RuleBlastResult): Completeness {
  if (result.counts.unknownPathCount > 0) return "UNKNOWN";
  if (result.counts.partialPathCount > 0) return "PARTIAL";
  return "COMPLETE";
}

export function scoreboardView(result: RuleBlastResult): ScoreboardView {
  const changed = result.mode === "diff" ? result.counts.changedStackPathCount : null;
  return Object.freeze({
    mode: result.mode,
    candidatePathCount: result.counts.candidatePathCount,
    currentSplitPathCount: result.counts.currentSplitPathCount,
    partialPathCount: result.counts.partialPathCount,
    unknownPathCount: result.counts.unknownPathCount,
    changedStackPathCount: changed,
    profiles: result.counts.byProfile.map((row) => {
      const presentation = presentationFor(row.profile);
      return Object.freeze({
        profile: row.profile,
        label: presentation.label,
        shortLabel: presentation.shortLabel,
        badge: presentation.badge,
        completePathCount: row.completePathCount,
        partialPathCount: row.partialPathCount,
        unknownPathCount: row.unknownPathCount,
        changedStackPathCount: "changedStackPathCount" in row
          ? row.changedStackPathCount
          : null,
      });
    }),
    findingCount: result.findings.length,
  });
}

export function renderScoreboard(view: ScoreboardView): string {
  const lines = [
    `RULEBLAST · ${view.mode.toUpperCase()}`,
    `${view.candidatePathCount} tracked paths`,
  ];
  if (view.changedStackPathCount !== null) {
    lines.push(`${view.changedStackPathCount} changed stacks`);
  }
  lines.push(
    `${view.currentSplitPathCount} split · ${view.partialPathCount} partial · ${view.unknownPathCount} unknown`,
  );
  for (const profile of view.profiles) {
    const changed = profile.changedStackPathCount === null
      ? `${profile.completePathCount} complete`
      : `${profile.changedStackPathCount} changed`;
    lines.push(`${profile.badge} ${profile.shortLabel}  ${changed}`);
  }
  return `${lines.join("\n")}\n`;
}
