import type { CliOutput } from "./args.js";
import { canonicalJson } from "./canonical.js";
import { renderWitness, witnessForProjection, type WitnessGraph } from "./domain/witness.js";
import { packWitnessHint } from "./packs/witness-hints.js";
import type { Projection } from "./model.js";
import { resolveAgentAllow } from "./domain/agent-allow.js";
import { receiptForCurrent, receiptForDiff } from "./render-receipt.js";
import {
  displayText,
  renderText,
  type TextPresentationContext,
} from "./render-text.js";
import type {
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
  Finding,
  RuleBlastResult,
} from "./model.js";
import { explainViewFromResult, type ExplainView } from "./application/explain-view.js";

export interface OutputIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly stdoutIsTTY: boolean;
  readonly cwd?: () => string;
}

export interface CurrentExplainResult {
  readonly mode: "explain";
  readonly analysisMode: "current";
  readonly schemaVersion: 1;
  readonly resolverRevision: 1;
  readonly snapshot: CurrentRuleBlastResult["snapshot"];
  readonly path: CurrentRuleBlastResult["paths"][number];
  readonly findings: Finding[];
}

export interface DiffExplainResult {
  readonly mode: "explain";
  readonly analysisMode: "diff";
  readonly schemaVersion: 1;
  readonly resolverRevision: 1;
  readonly before: DiffRuleBlastResult["before"];
  readonly after: DiffRuleBlastResult["after"];
  readonly path: DiffRuleBlastResult["paths"][number];
  readonly findings: Finding[];
}

export type ExplainResult = CurrentExplainResult | DiffExplainResult;
export type PresentedResult = CurrentRuleBlastResult | DiffRuleBlastResult | ExplainResult;

export { displayText } from "./render-text.js";

export function writeLine(callback: (text: string) => void, text: string): void {
  callback(`${text.replace(/[\r\n]+$/g, "")}\n`);
}

function effectiveColor(output: CliOutput, io: OutputIo): boolean {
  if (io.env.NO_COLOR !== undefined || output.kind === "json") return false;
  if (output.color === "always") return true;
  if (output.color === "never") return false;
  return io.stdoutIsTTY;
}

export interface PresentationExtras {
  readonly witness?: boolean;
  readonly receipt?: boolean;
}

function projectionsOf(value: PresentedResult): Projection[] {
  if (value.mode === "explain") {
    const path = value.path;
    if ("projections" in path) return path.projections;
    return [...path.before, ...path.after];
  }
  if (value.mode === "current") {
    return value.paths.flatMap((path) => path.projections);
  }
  return value.paths.flatMap((path) => [...path.before, ...path.after]);
}

function witnessGraphs(value: PresentedResult): WitnessGraph[] {
  return projectionsOf(value).map((projection) =>
    witnessForProjection(projection, packWitnessHint),
  );
}

export function present(
  value: PresentedResult,
  output: CliOutput,
  io: OutputIo,
  context?: TextPresentationContext,
  extras: PresentationExtras = {},
): void {
  if (extras.receipt === true && (value.mode === "current" || value.mode === "diff")) {
    const allow = resolveAgentAllow({
      env: io.env,
      cwd: io.cwd?.() ?? "",
    });
    const card = value.mode === "diff"
      ? receiptForDiff(value, allow)
      : receiptForCurrent(value, allow);
    writeLine(io.stdout, output.kind === "json" ? canonicalJson(card) : card.markdown);
    return;
  }
  if (extras.receipt === true && value.mode === "explain") {
    writeLine(
      io.stdout,
      output.kind === "json"
        ? canonicalJson({
          version: "RBREC1",
          title: "explain",
          path: value.path.path,
        })
        : `RULEBLAST PROOF\nexplain ${value.path.path}\n\nNot a claim about model compliance.`,
    );
    return;
  }
  if (extras.witness === true) {
    const graphs = witnessGraphs(value);
    if (output.kind === "json") {
      writeLine(io.stdout, canonicalJson({
        envelope: "ruleblast.witness.v1",
        result: value,
        witness: graphs,
      }));
      return;
    }
    writeLine(
      io.stdout,
      `${renderText(value, context, effectiveColor(output, io))}\n\n${renderWitness(graphs)}`,
    );
    return;
  }
  writeLine(
    io.stdout,
    output.kind === "json"
      ? canonicalJson(value)
      : renderText(value, context, effectiveColor(output, io)),
  );
}

function selectedFindings(
  findings: readonly Finding[],
  path: string,
): Finding[] {
  return findings.filter((finding) => finding.path === path).map((finding) => ({
    code: finding.code,
    profile: finding.profile,
    path: finding.path,
    detail: finding.detail,
  }));
}

export function currentExplain(
  result: CurrentRuleBlastResult,
  path: string,
): CurrentExplainResult {
  const pathResult = result.paths.find((candidate) => candidate.path === path);
  if (pathResult === undefined) {
    throw new Error(`Analysis omitted its prevalidated target path: ${JSON.stringify(path)}`);
  }
  return {
    mode: "explain",
    analysisMode: "current",
    schemaVersion: result.schemaVersion,
    resolverRevision: result.resolverRevision,
    snapshot: { ...result.snapshot },
    path: pathResult,
    findings: selectedFindings(result.findings, path),
  };
}

export function diffExplain(
  result: DiffRuleBlastResult,
  path: string,
): DiffExplainResult {
  const pathResult = result.paths.find((candidate) => candidate.path === path);
  if (pathResult === undefined) {
    throw new Error(`Analysis omitted its prevalidated target path: ${JSON.stringify(path)}`);
  }
  return {
    mode: "explain",
    analysisMode: "diff",
    schemaVersion: result.schemaVersion,
    resolverRevision: result.resolverRevision,
    before: { ...result.before },
    after: { ...result.after },
    path: pathResult,
    findings: selectedFindings(result.findings, path),
  };
}

export function explainExistingResult(
  result: RuleBlastResult,
  path: string,
): {
  readonly explain: CurrentExplainResult | DiffExplainResult;
  readonly view: ExplainView;
} {
  const explain = result.mode === "diff"
    ? diffExplain(result, path)
    : currentExplain(result, path);
  return { explain, view: explainViewFromResult(explain) };
}
