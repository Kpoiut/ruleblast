import { isOptInReality, optInRealityIds } from "./application/profile-catalog.js";

export type ColorMode = "auto" | "always" | "never";

export type CliOutput = Readonly<{
  kind: "json" | "text";
  color: ColorMode;
}>;

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

export type CliUsageErrorCode =
  | "INVALID_ARGUMENT_VECTOR"
  | "UNKNOWN_OPTION"
  | "MISSING_OPTION_VALUE"
  | "DUPLICATE_OPTION"
  | "EXTRA_POSITIONAL"
  | "MISSING_PATH"
  | "INVALID_PATH"
  | "INVALID_REF"
  | "OPTION_CONFLICT"
  | "IDENTICAL_ENDPOINTS";

export class CliUsageError extends Error {
  public constructor(
    public readonly code: CliUsageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CliUsageError";
  }
}

interface ParsedTokens {
  readonly positionals: readonly string[];
  readonly output: CliOutput;
  readonly options: ReadonlyMap<string, string>;
  readonly realities: readonly string[];
  readonly witness: boolean;
  readonly receipt: boolean;
}

const NO_VALUE_OPTIONS = new Set(["--json", "--witness", "--receipt"]);
const WINDOWS_DRIVE_PATH = /^[A-Za-z]:/;

function usage(code: CliUsageErrorCode, message: string): never {
  throw new CliUsageError(code, message);
}

function quoted(value: string): string {
  return JSON.stringify(value);
}

function captureArgv(argv: readonly string[]): readonly string[] {
  if (!Array.isArray(argv) || Object.getPrototypeOf(argv) !== Array.prototype) {
    return usage("INVALID_ARGUMENT_VECTOR", "Arguments must be a plain array");
  }
  const descriptors = Object.getOwnPropertyDescriptors(argv);
  const lengthValue = Object.getOwnPropertyDescriptor(argv, "length")?.value as unknown;
  if (typeof lengthValue !== "number" ||
      !Number.isSafeInteger(lengthValue) || lengthValue < 0) {
    return usage("INVALID_ARGUMENT_VECTOR", "Arguments must have a valid data length");
  }
  const length = lengthValue;
  if (Reflect.ownKeys(argv).length !== length + 1) {
    return usage("INVALID_ARGUMENT_VECTOR", "Arguments must be a dense closed array");
  }
  const captured: string[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) ||
        typeof descriptor.value !== "string") {
      return usage(
        "INVALID_ARGUMENT_VECTOR",
        `Argument ${index} must be a string data element`,
      );
    }
    captured.push(descriptor.value);
  }
  return Object.freeze(captured);
}

function parseColor(token: string): ColorMode {
  const value = token.slice("--color=".length);
  if (value === "auto" || value === "always" || value === "never") return value;
  return usage(
    "OPTION_CONFLICT",
    "--color must be one of auto, always, or never",
  );
}

function isOptionToken(value: string): boolean {
  return value.startsWith("-");
}

function isRecognizedOptionToken(
  value: string,
  valueOptions: ReadonlySet<string>,
): boolean {
  return NO_VALUE_OPTIONS.has(value) || value.startsWith("--color=") ||
    valueOptions.has(value);
}

function parseTokens(
  tokens: readonly string[],
  valueOptions: ReadonlySet<string>,
): ParsedTokens {
  const positionals: string[] = [];
  const options = new Map<string, string>();
  const realities: string[] = [];
  let json = false;
  let witness = false;
  let receipt = false;
  let color: ColorMode = "auto";
  let colorSeen = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      return usage("INVALID_ARGUMENT_VECTOR", "Argument disappeared during parsing");
    }
    if (token === "--json") {
      if (json) return usage("DUPLICATE_OPTION", "--json may be specified only once");
      json = true;
      continue;
    }
    if (token === "--witness") {
      if (witness) return usage("DUPLICATE_OPTION", "--witness may be specified only once");
      witness = true;
      continue;
    }
    if (token === "--receipt") {
      if (receipt) return usage("DUPLICATE_OPTION", "--receipt may be specified only once");
      receipt = true;
      continue;
    }
    if (token.startsWith("--color=")) {
      if (colorSeen) return usage("DUPLICATE_OPTION", "--color may be specified only once");
      color = parseColor(token);
      colorSeen = true;
      continue;
    }
    if (token === "--reality" && valueOptions.has(token)) {
      const value = tokens[index + 1];
      if (value === undefined || isRecognizedOptionToken(value, valueOptions)) {
        return usage("MISSING_OPTION_VALUE", "--reality requires a value");
      }
      if (realities.includes(value)) {
        return usage("DUPLICATE_OPTION", "--reality may name each surface only once");
      }
      realities.push(value);
      index += 1;
      continue;
    }
    if (valueOptions.has(token)) {
      if (options.has(token)) {
        return usage("DUPLICATE_OPTION", `${token} may be specified only once`);
      }
      const value = tokens[index + 1];
      if (value === undefined || isRecognizedOptionToken(value, valueOptions)) {
        return usage("MISSING_OPTION_VALUE", `${token} requires a value`);
      }
      options.set(token, value);
      index += 1;
      continue;
    }
    if (isOptionToken(token)) {
      return usage("UNKNOWN_OPTION", `Unknown option: ${quoted(token)}`);
    }
    positionals.push(token);
  }
  if (json && color === "always") {
    return usage(
      "OPTION_CONFLICT",
      "--json cannot be combined with --color=always",
    );
  }
  return Object.freeze({
    positionals: Object.freeze(positionals),
    output: Object.freeze({ kind: json ? "json" : "text", color }),
    options,
    realities: Object.freeze(realities),
    witness,
    receipt,
  });
}

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
  const allowed = optInRealityIds();
  for (const value of parsed.realities) {
    if (value === "all" || !isOptInReality(value)) {
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
  return Object.freeze({
    action: "scan",
    startPath: scanPath(parsed.positionals[0]),
    output: parsed.output,
    witness: parsed.witness,
    receipt: parsed.receipt,
    realities: parsedRealities(parsed, true),
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
  return Object.freeze({
    action: "diff", base, target, output: parsed.output,
    witness: parsed.witness, receipt: parsed.receipt,
    realities: parsedRealities(parsed, true),
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
  return Object.freeze({
    action: "explain", path, from, target, output: parsed.output,
    witness: parsed.witness, receipt: parsed.receipt,
    realities: parsedRealities(parsed, true),
  });
}

function parseCase(tokens: readonly string[]): CaseArgs {
  const parsed = parseTokens(tokens, new Set(["--explain", "--reality"]));
  onlyPositionals(parsed, 0);
  const explainValue = parsed.options.get("--explain");
  return Object.freeze({
    action: "case",
    explainPath: explainValue === undefined ? null : repositoryPath(explainValue),
    output: parsed.output,
    witness: parsed.witness,
    receipt: parsed.receipt,
    realities: parsedRealities(parsed, false),
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
