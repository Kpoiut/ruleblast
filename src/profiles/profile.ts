import type { ProfileId, Projection } from "../model.js";
import { sha256 } from "../canonical.js";
import { digestNormalizedPayload, digestProjectionIdentity } from "../domain/payload-relation.js";
import type { RepositorySnapshot } from "../snapshot.js";

export { digestNormalizedPayload, digestProjectionIdentity };

export interface EvidenceRef {
  readonly url: string;
  readonly retrievedAt: string;
  readonly revision: string;
  readonly claim: string;
}

export interface ProfileDefinition {
  readonly id: ProfileId;
  readonly evidence: readonly EvidenceRef[];
  isInstructionPath(path: string): boolean;
  prepare(snapshot: RepositorySnapshot): Promise<PreparedProfile>;
}

export interface PreparedProfile {
  readonly id: ProfileId;
  readonly sourceDependencyPaths: readonly string[];
  project(targetPath: string): Projection;
}

const PAYLOAD_LINE_DOMAIN = "ruleblast-payload-line-v1\0";

/** Converts model-visible content contributions into vendor-neutral payload units. */
export function unitizePayloadContributions(
  contributions: readonly string[],
): string[][] {
  return contributions
    .filter((contribution) => contribution !== "")
    .map((contribution) => {
      const normalized = contribution.replace(/\r\n/g, "\n");
      const lines = normalized.split("\n");
      if (normalized.endsWith("\n")) {
        lines.pop();
      }
      return lines.map((line) => sha256(`${PAYLOAD_LINE_DOMAIN}${line}`));
    });
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isGregorianCalendarDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  const maximumDay = daysInMonth[month - 1];
  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    maximumDay !== undefined &&
    day >= 1 &&
    day <= maximumDay
  );
}

function capturedString(
  descriptors: PropertyDescriptorMap,
  field: keyof EvidenceRef,
): string {
  const descriptor = descriptors[field];
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    typeof descriptor.value !== "string"
  ) {
    throw new TypeError(`Evidence ${field} must be an own primitive string data property`);
  }

  return descriptor.value;
}

export function defineEvidenceRef(value: unknown): EvidenceRef {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Evidence reference must be an object");
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const url = capturedString(descriptors, "url");
  const retrievedAt = capturedString(descriptors, "retrievedAt");
  const revision = capturedString(descriptors, "revision");
  const claim = capturedString(descriptors, "claim");
  if (!isGregorianCalendarDate(retrievedAt)) {
    throw new TypeError(
      `Evidence retrievedAt must be a real YYYY-MM-DD date: ${JSON.stringify(retrievedAt)}`,
    );
  }

  return Object.freeze({
    url,
    retrievedAt,
    revision,
    claim,
  });
}
