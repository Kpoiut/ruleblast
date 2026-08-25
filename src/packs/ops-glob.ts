import { braceExpand, minimatch } from "minimatch";
import type { Projection } from "../model.js";
import { pathDirname } from "../domain/repository-path.js";
import { parseFrontmatterGlobs } from "./ops-frontmatter.js";
import type { CapturedClaudeFile } from "./ops-markdown.js";

const MAX_ALTERNATIVES = 1_000;
const MAX_EXPANDED_BYTES = 4 * 1024 * 1024;
const MAX_BRACE_NESTING = 256;
const CANONICAL_ROOT = "/__ruleblast_repo__/";
const MATCH_OPTIONS = Object.freeze({
  nobrace: true, noext: true, nocase: false, dot: false,
  windowsPathsNoEscape: false,
});
const BRACE_RANGE = /\{[^{}]*\.\.[^{}]*}/;

export class ClaudeGlobBudgetError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ClaudeGlobBudgetError";
  }
}

export interface ParsedClaudeRule {
  readonly file: CapturedClaudeFile;
  readonly body: string;
  readonly patterns: readonly string[] | null;
  readonly malformed: boolean;
  readonly globUnknown: boolean;
  readonly evidence: readonly string[];
}

export interface ClaudeRuleDecision {
  readonly applies: boolean | null;
  readonly status: Projection["status"];
  readonly evidence: readonly string[];
}

export interface ClaudeProjectSettings {
  readonly status: Projection["status"];
  readonly patterns: readonly string[];
  readonly unsupportedPatternCount: number;
  readonly evidence: readonly string[];
  exclusion(path: string): ClaudeRuleDecision;
}

interface Metrics { readonly count: number; readonly bytes: number }
interface ParsedMetrics extends Metrics { readonly index: number }

function failBudget(count: number, bytes: number): void {
  if (count > MAX_ALTERNATIVES) {
    throw new ClaudeGlobBudgetError("Claude glob expansion exceeds 1,000 alternatives");
  }
  if (bytes > MAX_EXPANDED_BYTES) {
    throw new ClaudeGlobBudgetError("Claude glob expansion exceeds 4 MiB");
  }
}

function concatenate(left: Metrics, right: Metrics): Metrics {
  const result = {
    count: left.count * right.count,
    bytes: left.bytes * right.count + right.bytes * left.count,
  };
  failBudget(result.count, result.bytes);
  return result;
}

function sequenceMetrics(value: string, start: number, stops: string): ParsedMetrics {
  let result: Metrics = { count: 1, bytes: 0 };
  let literal = "";
  let index = start;
  const flush = () => {
    if (literal !== "") {
      result = concatenate(result, { count: 1, bytes: Buffer.byteLength(literal) });
      literal = "";
    }
  };
  while (index < value.length && !stops.includes(value[index] ?? "")) {
    if (value[index] === "\\" && index + 1 < value.length) {
      literal += value.slice(index, index + 2);
      index += 2;
    } else if (value[index] === "{") {
      flush();
      const group = groupMetrics(value, index + 1);
      result = concatenate(result, group);
      index = group.index;
    } else {
      literal += value[index] ?? "";
      index += 1;
    }
  }
  flush();
  return { ...result, index };
}

function groupMetrics(value: string, start: number): ParsedMetrics {
  const alternatives: Metrics[] = [];
  let index = start;
  while (true) {
    const alternative = sequenceMetrics(value, index, ",}");
    alternatives.push(alternative);
    index = alternative.index;
    if (value[index] === ",") {
      index += 1;
      continue;
    }
    if (value[index] !== "}") {
      throw new ClaudeGlobBudgetError("Claude glob has an unclosed brace alternative");
    }
    index += 1;
    break;
  }
  if (alternatives.length === 1) {
    const withBraces = concatenate(
      concatenate({ count: 1, bytes: 1 }, alternatives[0]!),
      { count: 1, bytes: 1 },
    );
    return { ...withBraces, index };
  }
  const result = alternatives.reduce<Metrics>(
    (sum, item) => ({ count: sum.count + item.count, bytes: sum.bytes + item.bytes }),
    { count: 0, bytes: 0 },
  );
  failBudget(result.count, result.bytes);
  return { ...result, index };
}

function patternMetrics(pattern: string): Metrics {
  let depth = 0;
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern[index] === "\\") index += 1;
    else if (pattern[index] === "{" && ++depth > MAX_BRACE_NESTING) {
      throw new ClaudeGlobBudgetError(
        `Claude glob nesting exceeds ${MAX_BRACE_NESTING} levels`,
      );
    } else if (pattern[index] === "}" && depth > 0) depth -= 1;
  }
  if (BRACE_RANGE.test(pattern)) {
    return { count: 1, bytes: Buffer.byteLength(pattern) };
  }
  const result = sequenceMetrics(pattern, 0, "");
  return { count: result.count, bytes: result.bytes };
}

export function expandClaudePatternsBounded(
  patterns: readonly string[],
): readonly string[] {
  let count = 0;
  let bytes = 0;
  for (const pattern of patterns) {
    const metrics = patternMetrics(pattern);
    count += metrics.count;
    bytes += metrics.bytes;
    failBudget(count, bytes);
  }
  try {
    return patterns.flatMap((pattern) =>
      BRACE_RANGE.test(pattern) || !pattern.includes("{") || !pattern.includes(",")
        ? [pattern]
        : braceExpand(pattern));
  } catch {
    throw new ClaudeGlobBudgetError("Claude glob exceeds pinned matcher limits");
  }
}

export function expandClaudeBracesBounded(pattern: string): readonly string[] {
  return expandClaudePatternsBounded([pattern]);
}

type Frontmatter =
  | { readonly kind: "ok"; readonly body: string; readonly paths: readonly string[] | null }
  | { readonly kind: "malformed" };

function parseFrontmatter(value: string): Frontmatter {
  const parsed = parseFrontmatterGlobs(value, "paths", true);
  if (parsed.kind === "malformed") return { kind: "malformed" };
  if (parsed.kind === "absent") {
    return { kind: "ok", body: parsed.body, paths: null };
  }
  return { kind: "ok", body: parsed.body, paths: parsed.patterns };
}

export function parseClaudeRule(file: CapturedClaudeFile): ParsedClaudeRule {
  if (file.kind === "symlink") {
    return {
      file, body: "", patterns: null, malformed: true,
      globUnknown: false,
      evidence: [`UNSUPPORTED_BOUNDARY: Claude rule symlink was not followed: ${file.path}`],
    };
  }
  const parsed = parseFrontmatter(new TextDecoder().decode(file.bytes));
  if (parsed.kind === "malformed") {
    return {
      file, body: "", patterns: null, malformed: true, globUnknown: false,
      evidence: [`MALFORMED_RULE_FRONTMATTER: ${file.path}`],
    };
  }
  try {
    return {
      file, body: parsed.body,
      patterns: parsed.paths === null
        ? null : expandClaudePatternsBounded(parsed.paths),
      malformed: false, globUnknown: false, evidence: [],
    };
  } catch (error) {
    if (!(error instanceof ClaudeGlobBudgetError)) throw error;
    return {
      file, body: parsed.body, patterns: [], malformed: false, globUnknown: true,
      evidence: [`GLOB_BUDGET_EXCEEDED: ${file.path}: ${error.message}`],
    };
  }
}

function unsupportedReason(pattern: string, targetPath: string): string | null {
  if (pattern.startsWith("!") || pattern.startsWith("#")) {
    return "leading negation/comment matching is not pinned";
  }
  if (targetPath.split("/").some((segment) => segment.startsWith(".")) &&
      !targetPath.startsWith(CANONICAL_ROOT) ||
      (pattern.split("/").some((segment) => segment.startsWith(".")) &&
       !pattern.startsWith("**/"))) {
    return "dotfile matching is not pinned";
  }
  if (pattern.includes("[") || pattern.includes("]")) {
    return "bracket and escape matching is not pinned";
  }
  if (pattern.includes("\\")) return "backslash escape matching is not pinned";
  if (/(?:^|[^\\])[?*+@!]\(/.test(pattern)) return "extglob matching is not pinned";
  if (BRACE_RANGE.test(pattern)) return "brace range matching is not pinned";
  return null;
}

function matchClaudeGlob(
  targetPath: string, pattern: string, dot: boolean,
): { readonly matched: boolean; readonly reason: string | null } {
  let reason = unsupportedReason(pattern, targetPath);
  let matched = false;
  try {
    matched = reason === null && minimatch(targetPath, pattern, { ...MATCH_OPTIONS, dot });
    if (reason === null && !matched && minimatch(
      targetPath.toLowerCase(), pattern.toLowerCase(), { ...MATCH_OPTIONS, dot },
    )) reason = "case-fold matching is not pinned";
  } catch {
    reason = "glob exceeds pinned matcher limits";
  }
  return { matched, reason };
}

export function decideClaudeRule(
  rule: ParsedClaudeRule,
  targetPath: string,
): ClaudeRuleDecision {
  if (rule.malformed) return { applies: null, status: "UNKNOWN", evidence: rule.evidence };
  if (rule.globUnknown) return { applies: null, status: "UNKNOWN", evidence: rule.evidence };
  if (rule.patterns === null) return { applies: true, status: "COMPLETE", evidence: [] };
  if (rule.patterns.length === 0) return { applies: false, status: "COMPLETE", evidence: [] };
  let matched = false;
  const unsupported = new Set<string>();
  for (const pattern of rule.patterns) {
    const { matched: exact, reason } = matchClaudeGlob(targetPath, pattern, false);
    if (reason === null) matched ||= exact;
    else unsupported.add(reason);
  }
  const evidence = [...unsupported].map(
    (reason) => `UNSUPPORTED_GLOB_SEMANTIC: ${rule.file.path}: ${reason}`);
  if (matched) return { applies: true, status: evidence.length ? "PARTIAL" : "COMPLETE", evidence };
  return evidence.length
    ? { applies: null, status: "UNKNOWN", evidence }
    : { applies: false, status: "COMPLETE", evidence: [] };
}

export function isClaudeRulePath(path: string): boolean {
  return path.endsWith(".md") &&
    (path.startsWith(".claude/rules/") || path.includes("/.claude/rules/"));
}

/** Nested `.claude/rules` load on demand in the directory that contains `.claude`. */
export function claudeRuleSubtree(path: string): string {
  const nested = "/.claude/rules/";
  const index = path.indexOf(nested);
  if (index > 0) return path.slice(0, index);
  if (path.startsWith(".claude/rules/")) return ".";
  return pathDirname(path);
}

export function isUnderSubtree(scope: string, targetPath: string): boolean {
  return scope === "." || targetPath === scope || targetPath.startsWith(`${scope}/`);
}

function emptySettings(
  status: Projection["status"], evidence: readonly string[],
): ClaudeProjectSettings {
  return Object.freeze({
    status, patterns: Object.freeze([]), unsupportedPatternCount: 0,
    evidence: Object.freeze([...evidence]),
    exclusion: () => ({ applies: false, status, evidence }),
  });
}

export function parseClaudeProjectSettings(
  file: CapturedClaudeFile | undefined,
): ClaudeProjectSettings {
  if (file === undefined) return emptySettings("COMPLETE", []);
  if (file.kind === "symlink") return emptySettings("UNKNOWN", [
    "UNSUPPORTED_BOUNDARY: .claude/settings.json symlink was not followed",
  ]);
  let data: unknown;
  try { data = JSON.parse(new TextDecoder().decode(file.bytes)); }
  catch { return emptySettings("UNKNOWN", [
    "MALFORMED_PROJECT_SETTINGS: .claude/settings.json is not valid JSON",
  ]); }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return emptySettings("UNKNOWN", [
      "MALFORMED_PROJECT_SETTINGS: .claude/settings.json must be an object",
    ]);
  }
  const value = Object.getOwnPropertyDescriptor(data, "claudeMdExcludes")?.value;
  if (value === undefined) return emptySettings("COMPLETE", []);
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return emptySettings("UNKNOWN", [
      "MALFORMED_PROJECT_SETTINGS: claudeMdExcludes must be an array of strings",
    ]);
  }
  const supported = value.filter((pattern): pattern is string =>
    pattern.startsWith("**/") && !/(?:^|\/)[A-Za-z]:[\\/]/.test(pattern));
  const unsupportedPatternCount = value.length - supported.length;
  let patterns: readonly string[];
  try { patterns = Object.freeze([...expandClaudePatternsBounded(supported)]); }
  catch (error) {
    if (!(error instanceof ClaudeGlobBudgetError)) throw error;
    return emptySettings("UNKNOWN", [
      `GLOB_BUDGET_EXCEEDED: claudeMdExcludes: ${error.message}`,
    ]);
  }
  const evidence = unsupportedPatternCount === 0 ? [] : [
    `UNSUPPORTED_EXCLUDE_PATTERN: ${unsupportedPatternCount} absolute or drive-prefixed project exclusions were not applied`,
  ];
  const baseStatus: Projection["status"] = unsupportedPatternCount
    ? "PARTIAL" : "COMPLETE";
  return Object.freeze({
    status: baseStatus,
    patterns, unsupportedPatternCount, evidence: Object.freeze(evidence),
    exclusion(path: string): ClaudeRuleDecision {
      const target = `${CANONICAL_ROOT}${path}`;
      const unsupported: string[] = [];
      let matched = false;
      for (const pattern of patterns) {
        const result = matchClaudeGlob(target, pattern, true);
        const { reason } = result;
        if (reason !== null) {
          unsupported.push(
            `UNSUPPORTED_GLOB_SEMANTIC: claudeMdExcludes: ${reason}`);
          continue;
        }
        matched ||= result.matched;
      }
      const decisionStatus: Projection["status"] = unsupported.length > 0
        ? matched ? "PARTIAL" : "UNKNOWN" : baseStatus;
      return {
        applies: matched,
        status: decisionStatus,
        evidence: [...evidence, ...new Set(unsupported)],
      };
    },
  });
}
