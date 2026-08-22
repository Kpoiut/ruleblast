export type ColorMode = "auto" | "always" | "never";

export type CliOutput = Readonly<{
  kind: "json" | "text";
  color: ColorMode;
}>;

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

export interface ParsedTokens {
  readonly positionals: readonly string[];
  readonly output: CliOutput;
  readonly options: ReadonlyMap<string, string>;
  readonly realities: readonly string[];
  readonly witness: boolean;
  readonly receipt: boolean;
  readonly pathsOnly: boolean;
  readonly compare: boolean;
  readonly detail: boolean;
  readonly index: boolean;
}

const NO_VALUE_OPTIONS = new Set([
  "--json",
  "--witness",
  "--receipt",
  "--paths-only",
  "--compare",
  "--detail",
  "--index",
]);

export function usage(code: CliUsageErrorCode, message: string): never {
  throw new CliUsageError(code, message);
}

export function quoted(value: string): string {
  return JSON.stringify(value);
}

export function captureArgv(argv: readonly string[]): readonly string[] {
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

export function parseTokens(
  tokens: readonly string[],
  valueOptions: ReadonlySet<string>,
): ParsedTokens {
  const positionals: string[] = [];
  const options = new Map<string, string>();
  const realities: string[] = [];
  let json = false;
  let witness = false;
  let receipt = false;
  let pathsOnly = false;
  let compare = false;
  let detail = false;
  let asIndex = false;
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
    if (token === "--paths-only") {
      if (pathsOnly) return usage("DUPLICATE_OPTION", "--paths-only may be specified only once");
      pathsOnly = true;
      continue;
    }
    if (token === "--compare") {
      if (compare) return usage("DUPLICATE_OPTION", "--compare may be specified only once");
      compare = true;
      continue;
    }
    if (token === "--index") {
      if (asIndex) return usage("DUPLICATE_OPTION", "--index may be specified only once");
      asIndex = true;
      continue;
    }
    if (token === "--detail") {
      if (detail) return usage("DUPLICATE_OPTION", "--detail may be specified only once");
      detail = true;
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
  if (pathsOnly && (json || witness || receipt || compare || detail || asIndex)) {
    return usage(
      "OPTION_CONFLICT",
      "--paths-only cannot combine with --json, --witness, --receipt, --compare, --detail, or --index",
    );
  }
  if (asIndex && (json || witness || receipt || compare || detail)) {
    return usage(
      "OPTION_CONFLICT",
      "--index cannot combine with --json, --witness, --receipt, --compare, or --detail",
    );
  }
  if (compare && json) {
    return usage("OPTION_CONFLICT", "--compare cannot be combined with --json");
  }
  if (detail && (json || compare || receipt)) {
    return usage(
      "OPTION_CONFLICT",
      "--detail cannot combine with --json, --compare, or --receipt",
    );
  }
  return Object.freeze({
    positionals: Object.freeze(positionals),
    output: Object.freeze({ kind: json ? "json" : "text", color }),
    options,
    realities: Object.freeze(realities),
    witness,
    receipt,
    pathsOnly,
    compare,
    detail,
    index: asIndex,
  });
}
