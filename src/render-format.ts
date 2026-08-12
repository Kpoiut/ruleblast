import type { SnapshotRef } from "./model.js";

const SAFE_SHELL_TOKEN = /^[A-Za-z0-9_./@:+~-]+$/;

export type ShellDialect = "posix" | "powershell";

function quotedShellToken(value: string, shellDialect: ShellDialect): string {
  const escaped = shellDialect === "posix"
    ? value.replace(/'/g, `'"'"'`)
    : value.replace(/'/g, "''");
  return `'${escaped}'`;
}

function isSafeShellToken(
  value: string,
  shellDialect: ShellDialect,
): boolean {
  return SAFE_SHELL_TOKEN.test(value) &&
    !(shellDialect === "powershell" && value.startsWith("@"));
}

export function displayText(value: string): string {
  return JSON.stringify(value).slice(1, -1).replace(
    /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu,
    (character) => `\\u${character.codePointAt(0)!.toString(16).padStart(4, "0")}`,
  );
}

export function compareText(left: string, right: string): number {
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftPoint = left.codePointAt(leftIndex)!;
    const rightPoint = right.codePointAt(rightIndex)!;
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
    leftIndex += leftPoint > 0xffff ? 2 : 1;
    rightIndex += rightPoint > 0xffff ? 2 : 1;
  }
  if (leftIndex === left.length && rightIndex === right.length) return 0;
  return leftIndex === left.length ? -1 : 1;
}

export function formatCount(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Rendered counts must be non-negative safe integers");
  }
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return count === 1 ? singular : pluralForm;
}

export function shellToken(value: string, shellDialect: ShellDialect): string {
  const escaped = displayText(value);
  return isSafeShellToken(value, shellDialect)
    ? escaped
    : quotedShellToken(escaped, shellDialect);
}

export function repositoryPathToken(
  value: string,
  shellDialect: ShellDialect,
): string {
  const optionSafe = value.startsWith("-") ? `./${value}` : value;
  const escaped = displayText(optionSafe);
  if (value.startsWith("~")) return quotedShellToken(escaped, shellDialect);
  return isSafeShellToken(optionSafe, shellDialect)
    ? escaped
    : quotedShellToken(escaped, shellDialect);
}

export function referenceLabel(reference: SnapshotRef): string {
  if (reference.kind === "worktree") return "WORKTREE";
  if (reference.kind === "git") {
    return (reference.oid ?? reference.label).slice(0, 12);
  }
  return reference.label;
}

export function heading(text: string, color: boolean): string {
  return color ? `\u001b[36m${text}\u001b[0m` : text;
}
