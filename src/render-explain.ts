import type { ExplainResult } from "./cli-output.js";
import { presentationLabel } from "./application/profile-catalog.js";
import {
  explainViewFromResult,
  type ExplainKeepView,
  type ExplainProfileView,
  type ExplainSourceView,
  type ExplainWhyView,
} from "./application/explain-view.js";
import type { Finding } from "./model.js";
import {
  compareText,
  displayText,
  formatCount,
  heading,
} from "./render-format.js";
import type { TextPresentationContext } from "./render-text.js";

function explainHeading(
  context: TextPresentationContext,
  color: boolean,
): string {
  const suffix = context.caseLabel !== null
    ? "beforeLabel" in context
      ? `VERIFIED CASE · ${displayText(context.caseLabel)} · ${displayText(context.beforeLabel)} → ${displayText(context.afterLabel)}`
      : `VERIFIED CASE · ${displayText(context.caseLabel)}`
    : "currentLabel" in context
      ? displayText(context.currentLabel)
      : `${displayText(context.beforeLabel)} → ${displayText(context.afterLabel)}`;
  return heading(`RULEBLAST EXPLAIN · ${suffix}`, color);
}

function sourceLine(source: ExplainSourceView, last: boolean): string {
  const branch = last ? "└" : "├";
  const truncated = source.truncated ? " · truncated" : "";
  const marker = source.changed ? " ← changed" : "";
  return `  ${branch} ${source.disposition} ${displayText(source.path)}${truncated}${marker}`;
}

function affectMark(profile: ExplainProfileView): string {
  if (profile.affected === true) return "affected";
  if (profile.affected === false) return "unchanged";
  return profile.completeness.toLowerCase();
}

function renderProfile(profile: ExplainProfileView): string[] {
  const lines = [
    `${profile.badge} ${profile.label}`,
    `${profile.trigger} · cwd=${displayText(profile.cwd)} · ${profile.completeness} · ${affectMark(profile)}`,
  ];
  if (profile.sources.length === 0) {
    lines.push("  (no sources)");
  } else {
    profile.sources.forEach((source, index) => {
      lines.push(sourceLine(source, index === profile.sources.length - 1));
    });
  }
  lines.push(profile.reason);
  for (const note of profile.boundaryNotes) lines.push(displayText(note));
  return lines;
}

function renderNow(keep: ExplainKeepView, hasDiffWhy: boolean): string[] {
  if (hasDiffWhy) return [];
  return [
    "",
    "WHY THIS PATH NOW",
    `  relation ${keep.relation ?? "INDETERMINATE"}`,
    `  split ${keep.split ? "yes" : "no"}`,
  ];
}

function renderKeep(keep: ExplainKeepView): string[] {
  return [
    "",
    "KEEP",
    `  rbctx ${keep.rbctx}`,
    `  ${keep.reuse}`,
  ];
}

function renderWhy(why: ExplainWhyView): string[] {
  const lines = [
    "",
    why.counts ? "WHY THIS PATH COUNTS" : "WHY THIS PATH DID NOT CHANGE",
  ];
  if (why.counts) {
    for (const cause of [...why.causes].sort(compareText)) {
      lines.push(`  + ${displayText(cause)}`);
    }
  }
  const changed = why.changedProfiles.length === 0
    ? "none"
    : why.changedProfiles
      .map((profile) => `${profile.badge} ${profile.shortLabel}`)
      .join(", ");
  lines.push(
    `  = changed profiles: ${changed}`,
    `  = profile relation: ${why.beforeRelation} → ${why.afterRelation}`,
    `  = newly split: ${why.newlySplit ? "yes" : "no"}`,
  );
  return lines;
}

function appendFindings(lines: string[], findings: readonly Finding[]): void {
  if (findings.length === 0) return;
  const sorted = [...findings].sort((left, right) =>
    compareText(left.path, right.path) ||
    compareText(left.profile ?? "", right.profile ?? "") ||
    compareText(left.code, right.code) ||
    compareText(left.detail, right.detail),
  );
  lines.push("", "UNRESOLVED");
  for (const finding of sorted) {
    const profile = finding.profile === null
      ? "repository"
      : presentationLabel(finding.profile);
    lines.push(`  [${finding.code}] ${profile} · ${displayText(finding.detail)}`);
  }
}

function renderProof(value: ExplainResult): readonly string[] {
  const view = explainViewFromResult(value);
  const chain = view.why !== null && view.why.causes.length > 0
    ? [...view.why.causes].sort(compareText)
    : view.profiles[0]?.sources.map((source) => source.path) ?? [];
  if (chain.length === 0) return [];
  return ["PROOF", `  ${chain.map(displayText).join(" → ")}`, ""];
}

export function renderExplainView(value: ExplainResult): string {
  const view = explainViewFromResult(value);
  const lines = [displayText(view.path)];
  for (const profile of view.profiles) {
    lines.push("", ...renderProfile(profile));
  }
  if (view.why !== null) lines.push(...renderWhy(view.why));
  lines.push(...renderNow(view.keep, view.why !== null));
  if (view.relation !== null) lines.push("", `RELATION · ${view.relation}`);
  appendFindings(lines, view.findings);
  lines.push(...renderKeep(view.keep));
  return `${lines.join("\n")}\n`;
}

export function renderExplain(
  value: ExplainResult,
  context: TextPresentationContext,
  color: boolean,
): string {
  if (value.analysisMode === "current" && !("currentLabel" in context)) {
    throw new TypeError("Current explain requires current presentation context");
  }
  if (value.analysisMode === "diff" && !("beforeLabel" in context)) {
    throw new TypeError("Diff explain requires endpoint presentation context");
  }
  return [
    explainHeading(context, color),
    "",
    ...renderProof(value),
    renderExplainView(value).trimEnd(),
    "",
    `Repository-only · Git-tracked sources · resolver revision ${formatCount(value.resolverRevision)}`,
    "",
  ].join("\n");
}

export function explainPresentationContext(
  value: ExplainResult,
): TextPresentationContext {
  if (value.analysisMode === "current") {
    return {
      currentLabel: value.snapshot.label,
      caseLabel: null,
      shellDialect: "posix",
    };
  }
  return {
    beforeLabel: value.before.label,
    afterLabel: value.after.label,
    caseLabel: null,
    shellDialect: "posix",
  };
}