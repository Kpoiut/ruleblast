import type { CliOutput } from "./args.js";
import { canonicalJson } from "./canonical.js";
import type {
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
  Finding,
} from "./model.js";

export interface OutputIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly stdoutIsTTY: boolean;
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
type PresentedResult = CurrentRuleBlastResult | DiffRuleBlastResult | ExplainResult;

export function writeLine(callback: (text: string) => void, text: string): void {
  callback(`${text.replace(/[\r\n]+$/g, "")}\n`);
}

export function displayText(value: string): string {
  return JSON.stringify(value).slice(1, -1).replace(
    /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu,
    (character) => `\\u${character.codePointAt(0)!.toString(16).padStart(4, "0")}`,
  );
}

function effectiveColor(output: CliOutput, io: OutputIo): boolean {
  if (io.env.NO_COLOR !== undefined || output.kind === "json") return false;
  if (output.color === "always") return true;
  if (output.color === "never") return false;
  return io.stdoutIsTTY;
}

function temporaryText(result: PresentedResult, color: boolean): string {
  const label = result.mode === "explain"
    ? `EXPLAIN · ${displayText(result.path.path)}`
    : result.mode === "current"
      ? `CURRENT · ${result.counts.candidatePathCount} tracked paths`
      : `DIFF · ${result.counts.changedStackPathCount} paths changed stack`;
  const text = `RULEBLAST · ${label}`;
  return color ? `\u001b[36m${text}\u001b[0m` : text;
}

export function present(
  value: PresentedResult,
  output: CliOutput,
  io: OutputIo,
): void {
  writeLine(
    io.stdout,
    output.kind === "json"
      ? canonicalJson(value)
      : temporaryText(value, effectiveColor(output, io)),
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
