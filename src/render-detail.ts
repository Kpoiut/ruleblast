import { presentationLabel } from "./application/profile-catalog.js";
import { renderRuntimePairLines } from "./application/scoreboard-view.js";
import type { ExplainResult } from "./cli-output.js";
import type {
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
  Finding,
  Projection,
} from "./model.js";
import {
  captureTextPresentationContext,
  type TextPresentationContext,
} from "./render-context.js";
import {
  compareText,
  displayText,
  formatCount,
  plural,
} from "./render-format.js";
import { renderConformanceLab } from "./application/conformance-lab.js";
import { renderEvidenceReveal } from "./application/evidence-revision.js";
import { renderText, type TextResult } from "./render-text.js";

function snapshotLine(
  snapshot: { readonly kind: string; readonly label: string; readonly oid: string | null },
): string {
  const identity = snapshot.oid === null ? snapshot.kind : `${snapshot.kind} ${snapshot.oid}`;
  return `  ${displayText(snapshot.label)} · ${identity}`;
}

function appendFindings(lines: string[], findings: readonly Finding[]): void {
  if (findings.length === 0) return;
  const sorted = [...findings].sort((left, right) =>
    compareText(left.path, right.path) ||
    compareText(left.profile ?? "", right.profile ?? "") ||
    compareText(left.code, right.code) ||
    compareText(left.detail, right.detail),
  );
  lines.push("", "FINDINGS");
  for (const finding of sorted) {
    const profile = finding.profile === null
      ? "repository"
      : presentationLabel(finding.profile);
    lines.push(
      `  [${finding.code}] ${profile} · ${displayText(finding.path)} · ${displayText(finding.detail)}`,
    );
  }
}

function projectionBlock(projection: Projection): string[] {
  const lines = [
    `${presentationLabel(projection.profile)} · ${projection.status} · ${projection.composition}`,
  ];
  for (const source of projection.sources) {
    lines.push(
      `  ${source.disposition} ${displayText(source.path)} · ${source.digest} · ${formatCount(source.bytesUsed)} bytes`,
    );
  }
  for (const item of projection.evidence) {
    lines.push(`  evidence ${displayText(item)}`);
  }
  if (projection.projectionDigest !== null) {
    lines.push(`  projection ${projection.projectionDigest}`);
  }
  return lines;
}

function currentDetail(result: CurrentRuleBlastResult): string[] {
  const lines = [
    "DETAIL",
    "SNAPSHOT",
    snapshotLine(result.snapshot),
  ];
  if (result.counts.byProfile.length > 0) {
    lines.push("", "BY PROFILE");
    for (const row of result.counts.byProfile) {
      lines.push(
        `  ${presentationLabel(row.profile)}  complete ${formatCount(row.completePathCount)} · partial ${formatCount(row.partialPathCount)} · unknown ${formatCount(row.unknownPathCount)}`,
      );
    }
  }
  const pairs = renderRuntimePairLines(result);
  if (pairs.length > 0) {
    lines.push("", "RUNTIME PAIRS");
    for (const line of pairs) lines.push(`  ${line}`);
  }
  const split = result.paths.filter((path) => path.isSplit === true);
  if (split.length > 0) {
    lines.push("", "SPLIT PATHS");
    for (const path of split) {
      lines.push(`  ${displayText(path.path)}  ${path.payloadRelation}`);
    }
  }
  appendFindings(lines, result.findings);
  return lines;
}

function diffDetail(result: DiffRuleBlastResult): string[] {
  const lines = [
    "DETAIL",
    "SNAPSHOT",
    snapshotLine(result.before),
    snapshotLine(result.after),
    "",
    "LINES",
    `  added ${formatCount(result.diffStats.addedLineCount)} · deleted ${formatCount(result.diffStats.deletedLineCount)} · edited ${formatCount(result.diffStats.editedLineCount)}`,
  ];
  if (result.changedInstructionSources.length > 0) {
    lines.push("", "SOURCES");
    for (const change of result.changedInstructionSources) {
      const path = change.afterPath ?? change.beforePath ?? "";
      lines.push(`  ${change.kind} ${displayText(path)}`);
      if (change.beforeDigest !== null) {
        lines.push(`    before ${change.beforeDigest}`);
      }
      if (change.afterDigest !== null) {
        lines.push(`    after ${change.afterDigest}`);
      }
    }
  }
  if (result.counts.byProfile.length > 0) {
    lines.push("", "BY PROFILE");
    for (const row of result.counts.byProfile) {
      lines.push(
        `  ${presentationLabel(row.profile)}  ${formatCount(row.changedStackPathCount)} ${plural(row.changedStackPathCount, "stack")}`,
      );
    }
  }
  const pairs = renderRuntimePairLines(result);
  if (pairs.length > 0) {
    lines.push("", "RUNTIME PAIRS");
    for (const line of pairs) lines.push(`  ${line}`);
  }
  if (result.groups.length > 0) {
    lines.push("", "GROUPS");
    for (const group of result.groups) {
      const root = group.root === "." ? "./" : `${displayText(group.root)}/`;
      lines.push(
        `  ${root}  ${formatCount(group.changedStackPathCount)} changed · ${formatCount(group.newlySplitPathCount)} newly split`,
      );
    }
  }
  const changed = result.paths.filter((path) => path.changedProfiles.length > 0);
  if (changed.length > 0) {
    lines.push("", "CHANGED PATHS");
    for (const path of changed) {
      const profiles = path.changedProfiles.map((id) => presentationLabel(id)).join(" · ");
      const causes = path.causes.length === 0
        ? ""
        : `  causes ${path.causes.map(displayText).join(", ")}`;
      lines.push(
        `  ${displayText(path.path)}  ${profiles}  ${path.beforePayloadRelation} → ${path.afterPayloadRelation}${causes}`,
      );
    }
  }
  appendFindings(lines, result.findings);
  return lines;
}

function explainDetail(value: ExplainResult): string[] {
  const lines = ["DETAIL"];
  if (value.analysisMode === "diff") {
    lines.push("", "BEFORE");
    for (const projection of value.path.before) {
      lines.push(...projectionBlock(projection));
    }
    lines.push("", "AFTER");
    for (const projection of value.path.after) {
      lines.push(...projectionBlock(projection));
    }
    return lines;
  }
  for (const projection of value.path.projections) {
    lines.push(...projectionBlock(projection));
  }
  return lines;
}

export async function renderDetail(
  value: TextResult,
  contextValue?: TextPresentationContext,
  color = false,
): Promise<string> {
  const context = captureTextPresentationContext(value, contextValue);
  const summary = renderText(value, context, color).trimEnd();
  const extra = value.mode === "current"
    ? currentDetail(value)
    : value.mode === "diff"
      ? diffDetail(value)
      : explainDetail(value);
  extra.push(
    "",
    ...renderEvidenceReveal().trimEnd().split("\n"),
    "",
    ...(await renderConformanceLab(undefined, "identity")).trimEnd().split("\n"),
  );
  return extra.length === 0 ? `${summary}\n` : `${summary}\n\n${extra.join("\n")}\n`;
}
