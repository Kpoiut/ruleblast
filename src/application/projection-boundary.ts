import {
  assertNormalizedPayloadSeal,
  assertProjectionDigestSeal,
  assertUsableProjection,
} from "../domain/payload-relation.js";
import { assertCanonicalRepositoryPath } from "../domain/repository-path.js";
import type {
  Projection,
  ProjectionContext,
  ResolvedSource,
  SnapshotRef,
} from "../model.js";
import type { PreparedProfile } from "../profiles/profile.js";
import type {
  GitObjectSnapshot,
  GitStorageObjectFormat,
  RepositorySnapshot,
  SnapshotEntry,
} from "../snapshot.js";

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

const OID_LENGTH: Readonly<Record<GitStorageObjectFormat, number>> = {
  sha1: 40,
  sha256: 64,
};

function captureBlobOid(
  value: string | null,
  format: GitStorageObjectFormat,
  path: string,
): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new TypeError(`Git blob oid for ${JSON.stringify(path)} must be a string`);
  }
  const oid = value.toLowerCase();
  const expected = OID_LENGTH[format];
  if (oid.length !== expected || !/^[0-9a-f]+$/u.test(oid)) {
    throw new TypeError(`Git blob oid for ${JSON.stringify(path)} is not a ${format} object name`);
  }
  return oid;
}

export function cacheGitObjectSnapshot(
  source: GitObjectSnapshot,
  storageFormat: GitStorageObjectFormat,
): GitObjectSnapshot {
  const base = cacheRepositorySnapshot(source);
  const oids = new Map<string, string | null>();
  return Object.freeze({
    get ref() {
      return base.ref;
    },
    listPaths: () => base.listPaths(),
    entry: (path: string) => base.entry(path),
    read: (path: string) => base.read(path),
    blobOid(path: string): string | null {
      const canonicalPath = assertCanonicalRepositoryPath(path, "snapshot blob oid path");
      let cached = oids.get(canonicalPath);
      if (cached === undefined && !oids.has(canonicalPath)) {
        cached = captureBlobOid(source.blobOid(canonicalPath), storageFormat, canonicalPath);
        oids.set(canonicalPath, cached);
      }
      return cached ?? null;
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
    assertNormalizedPayloadSeal(projection);
    assertProjectionDigestSeal(projection);
    return projection;
  });
}
