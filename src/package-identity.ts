import { readFileSync } from "node:fs";

export const IDENTITY_TITLE = "Git diff for AI agent repository instructions";
export const IDENTITY_BLAST =
  "Shows the blast radius of AGENTS.md and CLAUDE.md changes";

export function packageVersion(): string {
  const value = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as unknown;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("package.json must contain an object");
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, "version");
  if (descriptor === undefined || !("value" in descriptor) ||
      typeof descriptor.value !== "string" || descriptor.value === "") {
    throw new TypeError("package.json version must be a non-empty string");
  }
  return descriptor.value;
}

/** Advertised install pin for this tree. Independently verified npm is a separate receipt. */
export const PUBLISHED_PACKAGE_VERSION = "2.5.11";

export function advertisedPackage(): string {
  return `ruleblast@${PUBLISHED_PACKAGE_VERSION}`;
}
