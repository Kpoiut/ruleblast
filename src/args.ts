import { isOptInRealityId, OPT_IN_REALITY_IDS } from "./application/opt-in-realities.js";
import {
  captureArgv,
  parseTokens,
  quoted,
  usage,
  type CliOutput,
  type ParsedTokens,
} from "./args-tokens.js";

export type { CliOutput, ColorMode } from "./args-tokens.js";
export { CliUsageError, type CliUsageErrorCode } from "./args-tokens.js";

export interface GitSelector {
  readonly kind: "git";
  readonly ref: string;
}

export interface WorktreeSelector {
  readonly kind: "worktree";
}

export type SnapshotSelector = GitSelector | WorktreeSelector;

export const COPILOT_REALITY = "github/copilot-cli@1";
export const GEMINI_REALITY = "google/gemini-cli@1";

interface CommonArgs {
  readonly output: CliOutput;
  readonly witness: boolean;
  readonly receipt: boolean;
  readonly realities: readonly string[];
  readonly pathsOnly: boolean;
  readonly detail: boolean;
}

export interface ScanArgs extends CommonArgs {
  readonly action: "scan";
  readonly startPath: string;
}

export interface DiffArgs extends CommonArgs {
  readonly action: "diff";
  readonly base: GitSelector;
  readonly target: SnapshotSelector;
}

export interface ExplainArgs extends CommonArgs {
  readonly action: "explain";
  readonly path: string;
  readonly from: GitSelector | null;
  readonly target: SnapshotSelector;
  readonly compare: boolean;
}

export interface CaseArgs extends CommonArgs {
  readonly action: "case";
  readonly explainPath: string | null;
}

export interface HelpArgs { readonly action: "help"; }
export interface VersionArgs { readonly action: "version"; }
export interface McpArgs { readonly action: "mcp"; }

export type CliArgs =
  | ScanArgs
  | DiffArgs
  | ExplainArgs
  | CaseArgs
  | HelpArgs
  | VersionArgs
  | McpArgs;

const WINDOWS_DRIVE_PATH = /^[A-Za-z]:/;

function scanPath(value: string | undefined): string {
  const path = value ?? ".";
  if (path === "" || path.includes("\0")) {
    return usage("INVALID_PATH", "Scan path must be a usable filesystem path");
  }
  return path;
}

function repositoryPath(value: string | undefined): string {
  if (value === undefined) return usage("MISSING_PATH", "A tracked path is required");
  if (value === "" || value.includes("\0") || value.startsWith("/") ||
      value.startsWith("\\") || WINDOWS_DRIVE_PATH.test(value)) {
    return usage("INVALID_PATH", "Path must be repository-relative");
  }
  const segments = value.replace(/\\/g, "/").split("/");
  if (segments.some((segment) => segment === "..")) {
    return usage("INVALID_PATH", "Path must not traverse outside the repository");
  }
  const normalized = segments.filter(
    (segment) => segment !== "" && segment !== ".",
  ).join("/");
  if (normalized === "" || WINDOWS_DRIVE_PATH.test(normalized)) {
    return usage("INVALID_PATH", "Path must identify a tracked repository blob");
  }
  return normalized;
}

function gitSelector(value: string, description: string): GitSelector {
  if (value === "" || value === "WORKTREE" || value.includes("\0")) {
    return usage("INVALID_REF", `${description} must be an opaque Git ref`);
  }
  return Object.freeze({ kind: "git", ref: value });
}

function targetSelector(value: string): SnapshotSelector {
  return value === "WORKTREE"
    ? Object.freeze({ kind: "worktree" })
    : gitSelector(value, "Target ref");
}

function onlyPositionals(parsed: ParsedTokens, maximum: number): void {
  if (parsed.positionals.length > maximum) {
    usage(
      "EXTRA_POSITIONAL",
      `Unexpected argument: ${quoted(parsed.positionals[maximum] ?? "")}`,
    );
  }
}

function parsedRealities(
  parsed: ParsedTokens,
  allow: boolean,
): readonly string[] {
  if (parsed.realities.length === 0) return Object.freeze([]);
  if (!allow) {
    return usage(
      "OPTION_CONFLICT",
      "--reality cannot be used with the packaged case; that receipt remains two-profile",
    );
  }
  const allowed = OPT_IN_REALITY_IDS;
  for (const value of parsed.realities) {
    if (value === "all" || !isOptInRealityId(value)) {
      return usage(
        "OPTION_CONFLICT",
        `--reality must be one of ${allowed.join(" | ")}; editor and hosted surfaces are distinct and unsupported`,
      );
    }
  }
  return Object.freeze([...parsed.realities].sort());
}

function parseScan(tokens: readonly string[]): ScanArgs {
  const parsed = parseTokens(tokens, new Set(["--reality"]));
  onlyPositionals(parsed, 1);
  if (parsed.compare) {
    return usage("OPTION_CONFLICT", "--compare applies only to explain");
  }
  return Object.freeze({
    action: "scan",
    startPath: scanPath(parsed.positionals[0]),
    output: parsed.output,
    witness: parsed.witness,
    receipt: parsed.receipt,
    realities: parsedRealities(parsed, true),
    pathsOnly: parsed.pathsOnly,
    detail: parsed.detail,
  });
}

function parseDiff(tokens: readonly string[]): DiffArgs {
  const parsed = parseTokens(tokens, new Set(["--to", "--reality"]));
  onlyPositionals(parsed, 1);
  const base = gitSelector(parsed.positionals[0] ?? "HEAD", "Base ref");
  const target = targetSelector(parsed.options.get("--to") ?? "WORKTREE");
  if (target.kind === "git" && base.ref === target.ref) {
    return usage("IDENTICAL_ENDPOINTS", "Diff endpoints must be different");
  }
  if (parsed.compare) {
    return usage("OPTION_CONFLICT", "--compare applies only to explain");
  }
  return Object.freeze({
    action: "diff", base, target, output: parsed.output,
    witness: parsed.witness, receipt: parsed.receipt,
    realities: parsedRealities(parsed, true),
    pathsOnly: parsed.pathsOnly,
    detail: parsed.detail,
  });
}

function parseExplain(tokens: readonly string[]): ExplainArgs {
  const parsed = parseTokens(tokens, new Set(["--from", "--to", "--reality"]));
  onlyPositionals(parsed, 1);
  const path = repositoryPath(parsed.positionals[0]);
  const fromValue = parsed.options.get("--from");
  const from = fromValue === undefined ? null : gitSelector(fromValue, "--from ref");
  const target = targetSelector(parsed.options.get("--to") ?? "WORKTREE");
  if (from !== null && target.kind === "git" && from.ref === target.ref) {
    return usage("IDENTICAL_ENDPOINTS", "Explain endpoints must be different");
  }
  if (parsed.pathsOnly) {
    return usage("OPTION_CONFLICT", "--paths-only cannot be used with explain");
  }
  return Object.freeze({
    action: "explain", path, from, target, output: parsed.output,
    witness: parsed.witness, receipt: parsed.receipt,
    realities: parsedRealities(parsed, true),
    pathsOnly: false,
    compare: parsed.compare,
    detail: parsed.detail,
  });
}

function parseCase(tokens: readonly string[]): CaseArgs {
  const parsed = parseTokens(tokens, new Set(["--explain", "--reality"]));
  onlyPositionals(parsed, 0);
  const explainValue = parsed.options.get("--explain");
  if (parsed.compare) {
    return usage("OPTION_CONFLICT", "--compare applies only to explain");
  }
  if (parsed.pathsOnly && explainValue !== undefined) {
    return usage("OPTION_CONFLICT", "--paths-only cannot combine with case --explain");
  }
  return Object.freeze({
    action: "case",
    explainPath: explainValue === undefined ? null : repositoryPath(explainValue),
    output: parsed.output,
    witness: parsed.witness,
    receipt: parsed.receipt,
    realities: parsedRealities(parsed, false),
    pathsOnly: parsed.pathsOnly,
    detail: parsed.detail,
  });
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const tokens = captureArgv(argv);
  const first = tokens[0];
  if (first === "--help" && tokens.length === 1) {
    return Object.freeze({ action: "help" });
  }
  if (first === "--version" && tokens.length === 1) {
    return Object.freeze({ action: "version" });
  }
  if (first === "--mcp") {
    if (tokens.length !== 1) {
      return usage("OPTION_CONFLICT", "--mcp is a stdio transport and cannot combine with an action");
    }
    return Object.freeze({ action: "mcp" });
  }
  if (tokens.includes("--mcp")) {
    return usage("OPTION_CONFLICT", "--mcp is a stdio transport and cannot combine with an action");
  }
  if (first === "diff") return parseDiff(tokens.slice(1));
  if (first === "explain") return parseExplain(tokens.slice(1));
  if (first === "case" || first === "demo") return parseCase(tokens.slice(1));
  return parseScan(tokens);
}
