export function compareCodePoints(left: string, right: string): number {
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftPoint = left.codePointAt(leftIndex);
    const rightPoint = right.codePointAt(rightIndex);
    if (leftPoint === undefined || rightPoint === undefined) {
      throw new Error("Unable to compare repository paths");
    }
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
    leftIndex += leftPoint > 0xffff ? 2 : 1;
    rightIndex += rightPoint > 0xffff ? 2 : 1;
  }
  if (leftIndex === left.length && rightIndex === right.length) return 0;
  return leftIndex === left.length ? -1 : 1;
}

/** Merge two code-point-sorted path lists. Duplicate names appear once. */
export function unionSortedPaths(
  left: readonly string[],
  right: readonly string[],
): string[] {
  const merged: string[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftPath = left[leftIndex]!;
    const rightPath = right[rightIndex]!;
    const order = compareCodePoints(leftPath, rightPath);
    if (order === 0) {
      merged.push(leftPath);
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    if (order < 0) {
      merged.push(leftPath);
      leftIndex += 1;
      continue;
    }
    merged.push(rightPath);
    rightIndex += 1;
  }
  while (leftIndex < left.length) {
    merged.push(left[leftIndex]!);
    leftIndex += 1;
  }
  while (rightIndex < right.length) {
    merged.push(right[rightIndex]!);
    rightIndex += 1;
  }
  return merged;
}

const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:/;

export function assertCanonicalRepositoryPath(
  value: unknown,
  description: string,
): string {
  if (typeof value !== "string" || value === "" || value.includes("\0") ||
      value.includes("\\") || value.startsWith("/") ||
      WINDOWS_DRIVE_PATTERN.test(value)) {
    throw new TypeError(`${description} must be a canonical repository-relative path`);
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new TypeError(`${description} must be a canonical repository-relative path`);
  }
  return value;
}
