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
