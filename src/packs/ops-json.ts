import type { Projection } from "../model.js";

function normalizeFileName(value: string): string | null {
  const trimmed = value.trim().replace(/\\/g, "/");
  if (trimmed === "" || trimmed.startsWith("/") || trimmed.includes("\0")) return null;
  const parts = trimmed.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) return null;
  return parts.join("/");
}

function unionNames(configured: readonly string[], defaults: readonly string[]): readonly string[] {
  const names: string[] = [];
  for (const name of [...configured, ...defaults]) {
    if (!names.includes(name)) names.push(name);
  }
  return Object.freeze(names);
}

function readDotted(root: unknown, field: string): unknown {
  let current: unknown = root;
  for (const part of field.split(".")) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function parseJsonUnionNames(
  text: string,
  path: string,
  field: string,
  defaults: readonly string[],
): {
  readonly names: readonly string[];
  readonly status: Projection["status"];
  readonly evidence: readonly string[];
} {
  const fallback = Object.freeze([...defaults]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      names: fallback,
      status: "PARTIAL",
      evidence: [`Tracked ${path} is not strict JSON; ${field} was not applied.`],
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      names: fallback,
      status: "PARTIAL",
      evidence: [`Tracked ${path} is not an object; ${field} was not applied.`],
    };
  }
  const parentField = field.includes(".") ? field.slice(0, field.lastIndexOf(".")) : undefined;
  if (parentField !== undefined) {
    const parent = readDotted(parsed, parentField);
    if (parent === undefined) return { names: fallback, status: "COMPLETE", evidence: [] };
    if (typeof parent !== "object" || parent === null || Array.isArray(parent)) {
      return {
        names: fallback,
        status: "PARTIAL",
        evidence: [`Tracked ${parentField} is not an object; ${field} was not applied.`],
      };
    }
  }
  const value = readDotted(parsed, field);
  if (value === undefined) return { names: fallback, status: "COMPLETE", evidence: [] };
  const raw = typeof value === "string" ? [value] : value;
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    return {
      names: fallback,
      status: "PARTIAL",
      evidence: [`Tracked ${field} is not a string or string array.`],
    };
  }
  const configured = raw
    .map((item) => normalizeFileName(item))
    .filter((item): item is string => item !== null);
  return {
    names: unionNames(configured, defaults),
    status: "COMPLETE",
    evidence: [
      `Tracked ${field} is unioned with default ${defaults.join(", ")}.`,
    ],
  };
}
