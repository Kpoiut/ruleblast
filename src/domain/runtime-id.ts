/**
 * @fileoverview Runtime surface IDs, not model names.
 *
 * Shape is `owner/name` or `owner/name@N` with N ≥ 1. A model product string
 * such as `grok-4` is not a runtime. Forming candidates are unversioned;
 * bundled realities are versioned `@1`.
 */
const CANDIDATE_ID_PATTERN =
  /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*(@[1-9][0-9]*)?$/u;

/** Exact-match allowlist shape. The whole string must match; no prefix. */
export function isCandidateIdShape(value: string): boolean {
  return CANDIDATE_ID_PATTERN.exec(value)?.[0] === value;
}

/** Forming candidate id without `@N`. */
export function isUnversionedRuntimeId(value: string): boolean {
  return isCandidateIdShape(value) && !value.includes("@");
}

/** Modeled / bundled id with a positive integer revision suffix. */
export function isVersionedRuntimeId(value: string): boolean {
  return isCandidateIdShape(value) && /@[1-9][0-9]*$/u.test(value);
}
