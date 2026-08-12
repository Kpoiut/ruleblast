import type {
  Completeness,
  Finding,
  FindingCode,
  ImpactGroup,
  PathTransition,
  PayloadRelation,
  ProfileId,
  Projection,
  ProjectionContext,
  ResolvedSource,
  SnapshotRef,
} from "./model.js";
import type { PreparedProfile } from "./profiles/profile.js";
import type {
  RepositorySnapshot,
  SnapshotEntry,
} from "./snapshot.js";

export interface AggregatePayloadRelation {
  readonly relation: PayloadRelation;
  readonly hasIndeterminateCoverage: boolean;
}

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
function equalSequence(
  left: readonly (readonly string[])[],
  right: readonly (readonly string[])[],
): boolean {
  return left.length === right.length && left.every((leftUnit, unitIndex) => {
    const rightUnit = right[unitIndex];
    return rightUnit !== undefined &&
      leftUnit.length === rightUnit.length &&
      leftUnit.every((digest, lineIndex) => digest === rightUnit[lineIndex]);
  });
}

function contributionMultiset(
  units: readonly (readonly string[])[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const contribution of units) {
    const key = JSON.stringify(contribution);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function equalMultiset(
  left: readonly (readonly string[])[],
  right: readonly (readonly string[])[],
): boolean {
  if (left.length !== right.length) return false;
  const leftCounts = contributionMultiset(left);
  const rightCounts = contributionMultiset(right);
  return leftCounts.size === rightCounts.size &&
    [...leftCounts].every(([key, count]) => rightCounts.get(key) === count);
}

function assertUsableProjection(projection: Projection): void {
  if (projection.status === "COMPLETE" && projection.projectionDigest === null) {
    throw new TypeError(
      `COMPLETE projectionDigest is required for ${projection.profile} at ${projection.context.targetPath}`,
    );
  }
}

export function comparePayloadRelation(
  left: Projection,
  right: Projection,
): PayloadRelation {
  assertUsableProjection(left);
  assertUsableProjection(right);
  if (left.status !== "COMPLETE" || right.status !== "COMPLETE") {
    return "INDETERMINATE";
  }
  if (left.composition === "RUNTIME_DECIDED" ||
      right.composition === "RUNTIME_DECIDED") {
    return "INDETERMINATE";
  }

  const sameMultiset = equalMultiset(
    left.normalizedPayloadUnits,
    right.normalizedPayloadUnits,
  );
  if (left.composition === "ORDERED" && right.composition === "ORDERED") {
    return equalSequence(left.normalizedPayloadUnits, right.normalizedPayloadUnits)
      ? "SAME"
      : "DIFFERENT";
  }
  if (left.composition === "UNORDERED" && right.composition === "UNORDERED") {
    return sameMultiset ? "SAME" : "DIFFERENT";
  }
  return sameMultiset ? "INDETERMINATE" : "DIFFERENT";
}

export function aggregatePayloadRelation(
  projections: readonly Projection[],
): AggregatePayloadRelation {
  for (const projection of projections) assertUsableProjection(projection);
  let hasDifference = false;
  let hasIndeterminateCoverage = projections.some(
    (projection) => projection.status !== "COMPLETE",
  );
  for (let left = 0; left < projections.length; left += 1) {
    for (let right = left + 1; right < projections.length; right += 1) {
      const leftProjection = projections[left];
      const rightProjection = projections[right];
      if (leftProjection === undefined || rightProjection === undefined) {
        throw new Error("Projection pair disappeared during aggregation");
      }
      const relation = comparePayloadRelation(leftProjection, rightProjection);
      hasDifference ||= relation === "DIFFERENT";
      hasIndeterminateCoverage ||= relation === "INDETERMINATE";
    }
  }
  return {
    relation: hasDifference
      ? "DIFFERENT"
      : hasIndeterminateCoverage
        ? "INDETERMINATE"
        : "SAME",
    hasIndeterminateCoverage,
  };
}

export function splitState(relation: PayloadRelation): boolean | null {
  return relation === "DIFFERENT"
    ? true
    : relation === "SAME"
      ? false
      : null;
}

function copySnapshotRef(reference: SnapshotRef): SnapshotRef {
  return {
    kind: reference.kind,
    label: reference.label,
    oid: reference.oid,
  };
}

function copyEntry(entry: SnapshotEntry | null): SnapshotEntry | null {
  return entry === null
    ? null
    : {
        path: entry.path,
        kind: entry.kind,
        executable: entry.executable,
      };
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

function captureClosedRecord(
  value: unknown,
  expectedFields: readonly string[],
  description: string,
): PropertyDescriptorMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${description} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${description} must be a plain object`);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== expectedFields.length || keys.some(
    (key) => typeof key !== "string" || !expectedFields.includes(key),
  )) {
    throw new TypeError(`${description} has missing or unknown fields`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const field of expectedFields) {
    if (!("value" in descriptors[field]!)) {
      throw new TypeError(`${description}.${field} must be an own data property`);
    }
  }
  return descriptors;
}

function dataValue(
  descriptors: PropertyDescriptorMap,
  field: string,
): unknown {
  return descriptors[field]!.value;
}

function captureDenseArray(value: unknown, description: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${description} must be an array`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const lengthValue = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isSafeInteger(lengthValue) || (lengthValue as number) < 0 ||
      typeof lengthValue !== "number" ||
      Reflect.ownKeys(value).length !== lengthValue + 1) {
    throw new TypeError(`${description} must be a dense data array`);
  }
  const result: unknown[] = [];
  for (let index = 0; index < lengthValue; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(`${description} must be a dense data array`);
    }
    result.push(descriptor.value);
  }
  return result;
}

export function captureCanonicalRepositoryPaths(
  value: unknown,
  description: string,
): string[] {
  return captureDenseArray(value, description).map((path, index) =>
    assertCanonicalRepositoryPath(path, `${description}[${index}]`),
  );
}

function captureSnapshotEntry(
  value: SnapshotEntry | null,
  expectedPath: string,
): SnapshotEntry | null {
  if (value === null) return null;
  const descriptors = captureClosedRecord(
    value,
    ["path", "kind", "executable"],
    "snapshot entry",
  );
  const path = assertCanonicalRepositoryPath(
    dataValue(descriptors, "path"),
    "snapshot entry.path",
  );
  const kind = dataValue(descriptors, "kind");
  const executable = dataValue(descriptors, "executable");
  if (path !== expectedPath || (kind !== "file" && kind !== "symlink") ||
      typeof executable !== "boolean") {
    throw new TypeError(`Snapshot entry does not match requested path: ${expectedPath}`);
  }
  return { path, kind, executable };
}

/** Shares one immutable capture across profile preparation and transition building. */
export function cacheRepositorySnapshot(
  source: RepositorySnapshot,
): RepositorySnapshot {
  const reference = copySnapshotRef(source.ref);
  const listPaths = source.listPaths;
  const entry = source.entry;
  const read = source.read;
  let pathsPromise: Promise<readonly string[]> | undefined;
  const entries = new Map<string, Promise<SnapshotEntry | null>>();
  const blobs = new Map<string, Promise<Uint8Array | null>>();
  return Object.freeze({
    get ref(): SnapshotRef {
      return copySnapshotRef(reference);
    },
    async listPaths(): Promise<readonly string[]> {
      pathsPromise ??= listPaths.call(source).then((paths) =>
        Object.freeze(captureCanonicalRepositoryPaths(paths, "snapshot paths")),
      );
      return [...await pathsPromise];
    },
    async entry(path: string): Promise<SnapshotEntry | null> {
      const canonicalPath = assertCanonicalRepositoryPath(path, "snapshot entry path");
      let pending = entries.get(path);
      if (pending === undefined) {
        pending = entry.call(source, canonicalPath).then((value) =>
          captureSnapshotEntry(value, canonicalPath),
        );
        entries.set(path, pending);
      }
      return copyEntry(await pending);
    },
    async read(path: string): Promise<Uint8Array | null> {
      const canonicalPath = assertCanonicalRepositoryPath(path, "snapshot read path");
      let pending = blobs.get(path);
      if (pending === undefined) {
        pending = read.call(source, canonicalPath).then((bytes) => {
          if (bytes !== null && !(bytes instanceof Uint8Array)) {
            throw new TypeError("Snapshot bytes must be Uint8Array or null");
          }
          return bytes === null ? null : new Uint8Array(bytes);
        });
        blobs.set(path, pending);
      }
      const bytes = await pending;
      return bytes === null ? null : new Uint8Array(bytes);
    },
  });
}

const PROJECTION_FIELDS = [
  "profile", "context", "status", "composition", "sources",
  "normalizedPayloadUnits", "projectionDigest", "normalizedPayloadDigest",
  "evidence",
] as const;
const CONTEXT_FIELDS = ["cwd", "trigger", "targetPath", "repositoryOnly"] as const;
const SOURCE_FIELDS = ["path", "disposition", "digest", "bytesUsed", "truncated"] as const;
const STATUSES = new Set(["COMPLETE", "PARTIAL", "UNKNOWN"]);
const COMPOSITIONS = new Set(["ORDERED", "UNORDERED", "UNSPECIFIED", "RUNTIME_DECIDED"]);
const DISPOSITIONS = new Set([
  "SELECTED", "SELECTED_EMPTY", "IMPORTED", "APPLIED_RULE", "SHADOWED",
  "EXCLUDED", "UNRESOLVED_IMPORT",
]);

function captureProjectionContext(value: unknown): ProjectionContext {
  const descriptors = captureClosedRecord(value, CONTEXT_FIELDS, "projection.context");
  const cwdValue = dataValue(descriptors, "cwd");
  const cwd = cwdValue === "."
    ? "."
    : assertCanonicalRepositoryPath(cwdValue, "projection.context.cwd");
  const trigger = dataValue(descriptors, "trigger");
  const targetPath = assertCanonicalRepositoryPath(
    dataValue(descriptors, "targetPath"),
    "projection.context.targetPath",
  );
  if ((trigger !== "STARTUP" && trigger !== "READ_TARGET") ||
      dataValue(descriptors, "repositoryOnly") !== true) {
    throw new TypeError("Projection context has invalid fields");
  }
  return { cwd, trigger, targetPath, repositoryOnly: true };
}

function captureResolvedSource(value: unknown, index: number): ResolvedSource {
  const description = `projection.sources[${index}]`;
  const descriptors = captureClosedRecord(value, SOURCE_FIELDS, description);
  const path = assertCanonicalRepositoryPath(dataValue(descriptors, "path"), `${description}.path`);
  const disposition = dataValue(descriptors, "disposition");
  const digest = dataValue(descriptors, "digest");
  const bytesUsed = dataValue(descriptors, "bytesUsed");
  const truncated = dataValue(descriptors, "truncated");
  if (typeof disposition !== "string" || !DISPOSITIONS.has(disposition) ||
      typeof digest !== "string" || !Number.isSafeInteger(bytesUsed) ||
      (bytesUsed as number) < 0 || typeof truncated !== "boolean") {
    throw new TypeError(`${description} has invalid fields`);
  }
  return {
    path,
    disposition: disposition as ResolvedSource["disposition"],
    digest,
    bytesUsed: bytesUsed as number,
    truncated,
  };
}

function captureProjection(value: unknown): Projection {
  const descriptors = captureClosedRecord(value, PROJECTION_FIELDS, "projection");
  const profile = dataValue(descriptors, "profile");
  const status = dataValue(descriptors, "status");
  const composition = dataValue(descriptors, "composition");
  const projectionDigest = dataValue(descriptors, "projectionDigest");
  const normalizedPayloadDigest = dataValue(descriptors, "normalizedPayloadDigest");
  if (typeof profile !== "string" || typeof status !== "string" || !STATUSES.has(status) ||
      typeof composition !== "string" || !COMPOSITIONS.has(composition) ||
      (projectionDigest !== null && typeof projectionDigest !== "string") ||
      (normalizedPayloadDigest !== null && typeof normalizedPayloadDigest !== "string") ||
      (status === "COMPLETE" && typeof projectionDigest !== "string")) {
    throw new TypeError("Projection has invalid fields");
  }
  const sources = captureDenseArray(dataValue(descriptors, "sources"), "projection.sources")
    .map(captureResolvedSource);
  const normalizedPayloadUnits = captureDenseArray(
    dataValue(descriptors, "normalizedPayloadUnits"),
    "projection.normalizedPayloadUnits",
  ).map((unit, index) => captureDenseArray(
    unit,
    `projection.normalizedPayloadUnits[${index}]`,
  ).map((digest) => {
    if (typeof digest !== "string") {
      throw new TypeError("Projection normalized payload digest must be a string");
    }
    return digest;
  }));
  const evidence = captureDenseArray(dataValue(descriptors, "evidence"), "projection.evidence")
    .map((item) => {
      if (typeof item !== "string") throw new TypeError("Projection evidence must be strings");
      return item;
    });
  return {
    profile,
    context: captureProjectionContext(dataValue(descriptors, "context")),
    status: status as Projection["status"],
    composition: composition as Projection["composition"],
    sources,
    normalizedPayloadUnits,
    projectionDigest,
    normalizedPayloadDigest,
    evidence,
  };
}

export function projectPreparedProfiles(
  preparedProfiles: readonly PreparedProfile[],
  targetPath: string,
): Projection[] {
  return preparedProfiles.map((prepared) => {
    const projection = captureProjection(prepared.project(targetPath));
    if (projection.profile !== prepared.id) {
      throw new TypeError(
        `Projected profile id ${projection.profile} does not match prepared id ${prepared.id}`,
      );
    }
    if (projection.context.targetPath !== targetPath) {
      throw new TypeError(
        `Projection target ${projection.context.targetPath} does not match ${targetPath}`,
      );
    }
    assertUsableProjection(projection);
    return projection;
  });
}

export function worstCompleteness(
  before: Completeness,
  after: Completeness,
): Completeness {
  if (before === "UNKNOWN" || after === "UNKNOWN") return "UNKNOWN";
  if (before === "PARTIAL" || after === "PARTIAL") return "PARTIAL";
  return "COMPLETE";
}

function findingCode(evidence: string): FindingCode | null {
  if (evidence.startsWith("UNSUPPORTED_GLOB_SEMANTIC:")) {
    return "UNSUPPORTED_GLOB_SEMANTIC";
  }
  if (evidence.startsWith("UNSUPPORTED_BOUNDARY:")) {
    return "UNSUPPORTED_BOUNDARY";
  }
  return null;
}

export function projectionFindings(
  projection: Projection,
  phase: "before" | "after" | null,
): Finding[] {
  const prefix = phase === null ? "" : `${phase}: `;
  const findings: Finding[] = [];
  if (projection.status === "PARTIAL") {
    findings.push({
      code: "PARTIAL_PROJECTION",
      profile: projection.profile,
      path: projection.context.targetPath,
      detail: `${prefix}projection is partial`,
    });
  } else if (projection.status === "UNKNOWN") {
    findings.push({
      code: "UNKNOWN_PROJECTION",
      profile: projection.profile,
      path: projection.context.targetPath,
      detail: `${prefix}projection is unknown`,
    });
  }
  if (projection.composition === "UNSPECIFIED") {
    findings.push({
      code: "UNSPECIFIED_COMPOSITION",
      profile: projection.profile,
      path: projection.context.targetPath,
      detail: `${prefix}composition order is unspecified`,
    });
  }
  for (const evidence of projection.evidence) {
    const code = findingCode(evidence);
    if (code !== null) {
      findings.push({
        code,
        profile: projection.profile,
        path: projection.context.targetPath,
        detail: `${prefix}${evidence}`,
      });
    }
  }
  return findings;
}

function compareNullableProfile(
  left: ProfileId | null,
  right: ProfileId | null,
): number {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  return compareCodePoints(left, right);
}

export function sortAndDedupeFindings(
  findings: readonly Finding[],
): Finding[] {
  const unique = new Map<string, Finding>();
  for (const finding of findings) {
    const key = JSON.stringify([
      finding.code,
      finding.profile,
      finding.path,
      finding.detail,
    ]);
    if (!unique.has(key)) unique.set(key, { ...finding });
  }
  return [...unique.values()].sort((left, right) =>
    compareCodePoints(left.path, right.path) ||
    compareNullableProfile(left.profile, right.profile) ||
    compareCodePoints(left.code, right.code) ||
    compareCodePoints(left.detail, right.detail),
  );
}

export function effectiveSourcePaths(
  projections: readonly Projection[],
): Set<string> {
  const paths = new Set<string>();
  for (const projection of projections) {
    for (const source of projection.sources) {
      if (source.disposition !== "SHADOWED") paths.add(source.path);
    }
  }
  return paths;
}

function dirname(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "." : path.slice(0, slash);
}

function directoryDepth(path: string): number {
  return path === "." ? 0 : path.split("/").length;
}

function nearestCause(causes: readonly string[]): string | null {
  const sorted = [...causes].sort((left, right) => {
    const depth = directoryDepth(dirname(right)) - directoryDepth(dirname(left));
    return depth || compareCodePoints(left, right);
  });
  return sorted[0] ?? null;
}

export function buildImpactGroups(
  paths: readonly PathTransition[],
): ImpactGroup[] {
  const groups = new Map<string, {
    changedStackPathCount: number;
    newlySplitPathCount: number;
    samplePaths: string[];
  }>();
  for (const path of paths) {
    const cause = nearestCause(path.causes);
    if (cause === null) continue;
    const root = dirname(cause);
    let group = groups.get(root);
    if (group === undefined) {
      group = {
        changedStackPathCount: 0,
        newlySplitPathCount: 0,
        samplePaths: [],
      };
      groups.set(root, group);
    }
    group.changedStackPathCount += path.changedProfiles.length > 0 ? 1 : 0;
    group.newlySplitPathCount += path.beforePayloadRelation === "SAME" &&
      path.afterPayloadRelation === "DIFFERENT" ? 1 : 0;
    group.samplePaths.push(path.path);
  }
  return [...groups].map(([root, group]) => ({
    root,
    changedStackPathCount: group.changedStackPathCount,
    newlySplitPathCount: group.newlySplitPathCount,
    samplePaths: group.samplePaths.sort(compareCodePoints).slice(0, 3),
  })).sort((left, right) => compareCodePoints(left.root, right.root));
}
