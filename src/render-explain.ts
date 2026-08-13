import type { ExplainResult } from "./cli-output.js";
import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
  type Finding,
  type PathTransition,
  type Projection,
} from "./model.js";
import {
  compareText,
  displayText,
  formatCount,
  heading,
} from "./render-format.js";
import type {
  DiffTextPresentationContext,
  TextPresentationContext,
} from "./render-text.js";

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

function profileName(profile: string): string {
  if (profile === OPENAI_CODEX_CLI_PROFILE_ID) return "CODEX";
  if (profile === ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID) return "CLAUDE CODE";
  return displayText(profile);
}

function renderProjection(
  lines: string[],
  phase: string,
  projection: Projection,
): void {
  lines.push(
    `  ${displayText(phase)} · ${projection.status} · ${projection.composition}`,
    `  Context: cwd=${displayText(projection.context.cwd)} · trigger=${projection.context.trigger} · target=${displayText(projection.context.targetPath)} · repository-only`,
    "  Sources:",
  );
  if (projection.sources.length === 0) {
    lines.push("    (none)");
  } else {
    for (const source of projection.sources) {
      lines.push(
        `    [${source.disposition}] ${displayText(source.path)} · digest=${displayText(source.digest)} · bytes=${formatCount(source.bytesUsed)}${source.truncated ? " · truncated" : ""}`,
      );
    }
  }
  lines.push(
    `  Projection digest: ${projection.projectionDigest === null ? "unresolved" : displayText(projection.projectionDigest)}`,
    `  Payload digest: ${projection.normalizedPayloadDigest === null ? "unresolved" : displayText(projection.normalizedPayloadDigest)}`,
    "  Evidence:",
  );
  if (projection.evidence.length === 0) {
    lines.push("    (none)");
  } else {
    for (const evidence of projection.evidence) {
      lines.push(`    ${displayText(evidence)}`);
    }
  }
}

function sortedProfiles(projections: readonly Projection[]): Projection[] {
  return [...projections].sort((left, right) =>
    compareText(left.profile, right.profile),
  );
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
      : displayText(finding.profile);
    lines.push(`  [${finding.code}] ${profile} · ${displayText(finding.detail)}`);
  }
}

function renderCurrentExplain(
  result: Extract<ExplainResult, { analysisMode: "current" }>,
  context: Extract<TextPresentationContext, { currentLabel: string }>,
  color: boolean,
): string {
  const lines = [
    explainHeading(context, color),
    "",
    displayText(result.path.path),
  ];
  for (const projection of sortedProfiles(result.path.projections)) {
    lines.push("", `${profileName(projection.profile)} · ${displayText(projection.profile)}`);
    renderProjection(lines, "CURRENT", projection);
  }
  lines.push("", `PROFILE RELATION · ${result.path.payloadRelation}`);
  appendFindings(lines, result.findings);
  lines.push(
    "",
    `Repository-only · Git-tracked sources · resolver revision ${formatCount(result.resolverRevision)}`,
  );
  return `${lines.join("\n")}\n`;
}

function projectionByProfile(
  projections: readonly Projection[],
  profile: string,
): Projection {
  const selected = projections.find((projection) => projection.profile === profile);
  if (selected === undefined) {
    throw new TypeError(`Explain transition omitted profile ${JSON.stringify(profile)}`);
  }
  return selected;
}

function transitionProfiles(path: PathTransition): string[] {
  return [...new Set([
    ...path.before.map((projection) => projection.profile),
    ...path.after.map((projection) => projection.profile),
  ])].sort(compareText);
}

function renderDiffExplain(
  result: Extract<ExplainResult, { analysisMode: "diff" }>,
  context: DiffTextPresentationContext,
  color: boolean,
): string {
  const lines = [
    explainHeading(context, color),
    "",
    displayText(result.path.path),
  ];
  for (const profile of transitionProfiles(result.path)) {
    lines.push("", `${profileName(profile)} · ${displayText(profile)}`);
    renderProjection(lines, "BEFORE", projectionByProfile(result.path.before, profile));
    renderProjection(
      lines,
      context.afterLabel,
      projectionByProfile(result.path.after, profile),
    );
  }
  const changed = result.path.changedProfiles.length > 0;
  lines.push(
    "",
    changed ? "WHY THIS PATH COUNTS" : "WHY THIS PATH DID NOT CHANGE",
  );
  const causes = [...result.path.causes].sort(compareText);
  if (changed) {
    for (const cause of causes) lines.push(`  + ${displayText(cause)}`);
  }
  const changedProfiles = [...result.path.changedProfiles].sort(compareText);
  lines.push(
    `  = changed profiles: ${changedProfiles.length === 0 ? "none" : changedProfiles.map(displayText).join(", ")}`,
    `  = profile relation: ${result.path.beforePayloadRelation} → ${result.path.afterPayloadRelation}`,
    `  = newly split: ${result.path.beforePayloadRelation === "SAME" && result.path.afterPayloadRelation === "DIFFERENT" ? "yes" : "no"}`,
  );
  appendFindings(lines, result.findings);
  lines.push(
    "",
    `Repository-only · Git-tracked sources · resolver revision ${formatCount(result.resolverRevision)}`,
  );
  return `${lines.join("\n")}\n`;
}

export function renderExplain(
  value: ExplainResult,
  context: TextPresentationContext,
  color: boolean,
): string {
  if (value.analysisMode === "current") {
    if (!("currentLabel" in context)) {
      throw new TypeError("Current explain requires current presentation context");
    }
    return renderCurrentExplain(value, context, color);
  }
  if (!("beforeLabel" in context)) {
    throw new TypeError("Diff explain requires endpoint presentation context");
  }
  return renderDiffExplain(value, context, color);
}
