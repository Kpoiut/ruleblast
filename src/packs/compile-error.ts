import type { FrontmatterApply } from "./schema.js";

export class InvalidPackError extends TypeError {
  public readonly code = "INVALID_PACK";

  public constructor(detail: string) {
    super(`INVALID_PACK: ${detail}`);
    this.name = "InvalidPackError";
  }
}

export function fail(detail: string): never {
  throw new InvalidPackError(detail);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function ownKeys(value: object): readonly string[] {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) {
    fail("object must not have symbol keys");
  }
  return keys as string[];
}

export function expectAllowedKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!isPlainObject(value)) fail(`${label} must be an object`);
  const actual = ownKeys(value);
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !actual.includes(key)) || actual.some((key) => !allowed.has(key))) {
    fail(`${label} has unknown or missing fields (${actual.join(",")})`);
  }
  return value;
}

export function expectKeys(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  return expectAllowedKeys(value, keys, [], label);
}

export function expectString(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") fail(`${label} must be a non-empty string`);
  return value;
}

export function expectBoolean(value: unknown, expected: boolean, label: string): true {
  if (value !== expected) fail(`${label} must be ${String(expected)}`);
  return true;
}

export function expectEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    fail(`${label} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

export function expectStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item === "")) {
    fail(`${label} must be a string array of non-empty strings`);
  }
  return Object.freeze([...value]);
}

export function expectSafeName(value: string, label: string): string {
  if (
    value.includes("\0") ||
    value.includes("\\") ||
    value.includes(":") ||
    /[\u0000-\u001f]/u.test(value) ||
    value.startsWith("/") ||
    value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    fail(`${label} is not a safe repository-relative name: ${JSON.stringify(value)}`);
  }
  return value;
}

export function decodeApply(value: unknown, label: string): FrontmatterApply {
  const object = expectAllowedKeys(
    value,
    ["kind", "field", "ifAbsent"],
    ["onMatch", "matcher"],
    label,
  );
  const field = expectSafeName(expectString(object.field, `${label}.field`), `${label}.field`);
  return Object.freeze({
    kind: expectEnum(object.kind, ["frontmatter-glob"], `${label}.kind`),
    field,
    ifAbsent: expectEnum(object.ifAbsent, ["exclude", "include"], `${label}.ifAbsent`),
    ...(object.onMatch === undefined ? {} : {
      onMatch: expectEnum(object.onMatch, ["SELECTED", "APPLIED_RULE"], `${label}.onMatch`),
    }),
    ...(object.matcher === undefined ? {} : {
      matcher: expectEnum(object.matcher, ["minimatch", "brace-budget"], `${label}.matcher`),
    }),
  });
}
