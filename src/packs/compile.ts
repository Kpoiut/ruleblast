import { parseProfileId } from "../model.js";
import { defineEvidenceRef } from "../profiles/profile.js";
import {
  FINGERPRINT_BUILTINS,
  PACK_SCHEMA_ID,
  SOURCE_TYPES,
  type AssembleSpec,
  type CompiledPack,
  type DiscoverOrigin,
  type DiscoverSpec,
  type FingerprintBuiltin,
  type PackBundle,
  type PackClaim,
  type PackManifest,
  type PackSourceType,
  type ResolverSpec,
  type SelectSpec,
  type TransformSpec,
} from "./schema.js";

export class InvalidPackError extends TypeError {
  public readonly code = "INVALID_PACK";

  public constructor(detail: string) {
    super(`INVALID_PACK: ${detail}`);
    this.name = "InvalidPackError";
  }
}

function fail(detail: string): never {
  throw new InvalidPackError(detail);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ownKeys(value: object): readonly string[] {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) {
    fail("object must not have symbol keys");
  }
  return keys as string[];
}

function expectKeys(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!isPlainObject(value)) fail(`${label} must be an object`);
  const actual = ownKeys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    fail(`${label} has unknown or missing fields (${actual.join(",")})`);
  }
  return value;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") fail(`${label} must be a non-empty string`);
  return value;
}

function expectBoolean(value: unknown, expected: boolean, label: string): true {
  if (value !== expected) fail(`${label} must be ${String(expected)}`);
  return true;
}

function expectEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    fail(`${label} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function expectStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    fail(`${label} must be a string array`);
  }
  return Object.freeze([...value]);
}

function expectSafeName(value: string, label: string): string {
  if (
    value.includes("\0") ||
    value.includes("\\") ||
    value.startsWith("/") ||
    value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    fail(`${label} is not a safe repository-relative name: ${JSON.stringify(value)}`);
  }
  return value;
}

function decodeClaim(value: unknown, index: number): PackClaim {
  const object = expectKeys(value, [
    "claimId",
    "sourceType",
    "sourceUrl",
    "retrievedAt",
    "sourceRevision",
    "claim",
  ], `evidence[${index}]`);
  const claimId = expectString(object.claimId, `evidence[${index}].claimId`);
  const sourceType = expectEnum(object.sourceType, SOURCE_TYPES, `evidence[${index}].sourceType`);
  const sourceUrl = expectString(object.sourceUrl, `evidence[${index}].sourceUrl`);
  const retrievedAt = expectString(object.retrievedAt, `evidence[${index}].retrievedAt`);
  const sourceRevision = expectString(object.sourceRevision, `evidence[${index}].sourceRevision`);
  const claim = expectString(object.claim, `evidence[${index}].claim`);
  try {
    defineEvidenceRef({
      url: sourceUrl,
      retrievedAt,
      revision: sourceRevision,
      claim,
    });
  } catch (error) {
    fail(`evidence[${index}] retrievedAt/date is invalid: ${String(error)}`);
  }
  return Object.freeze({
    claimId,
    sourceType: sourceType as PackSourceType,
    sourceUrl,
    retrievedAt,
    sourceRevision,
    claim,
  });
}

function decodeOrigin(value: unknown, index: number): DiscoverOrigin {
  if (!isPlainObject(value)) fail(`discover.origins[${index}] must be an object`);
  const kind = expectString(value.kind, `discover.origins[${index}].kind`);
  if (kind === "ancestors") {
    const object = expectKeys(value, ["kind", "from", "to", "inclusive", "names"], `discover.origins[${index}]`);
    return Object.freeze({
      kind: "ancestors",
      from: expectEnum(object.from, ["repositoryRoot"], "discover.origin.from"),
      to: expectEnum(object.to, ["cwd", "dirname-target"], "discover.origin.to"),
      inclusive: expectBoolean(object.inclusive, true, "discover.origin.inclusive"),
      names: Object.freeze(
        expectStringArray(object.names, "discover.origin.names").map((name) =>
          expectSafeName(name, "discover.origin.name"),
        ),
      ),
    });
  }
  if (kind === "fixed") {
    const object = expectKeys(value, ["kind", "paths"], `discover.origins[${index}]`);
    return Object.freeze({
      kind: "fixed",
      paths: Object.freeze(
        expectStringArray(object.paths, "discover.origin.paths").map((path) =>
          expectSafeName(path, "discover.origin.path"),
        ),
      ),
    });
  }
  if (kind === "glob") {
    const object = expectKeys(value, ["kind", "pattern"], `discover.origins[${index}]`);
    return Object.freeze({
      kind: "glob",
      pattern: expectSafeName(expectString(object.pattern, "discover.origin.pattern"), "discover.origin.pattern"),
    });
  }
  fail(`unknown discover origin kind: ${kind}`);
}

function decodeDiscover(value: unknown): DiscoverSpec {
  const object = expectKeys(value, ["origins", "claimIds"], "discover");
  if (!Array.isArray(object.origins) || object.origins.length === 0) {
    fail("discover.origins must be a non-empty array");
  }
  return Object.freeze({
    origins: Object.freeze(object.origins.map((origin, index) => decodeOrigin(origin, index))),
    claimIds: expectStringArray(object.claimIds, "discover.claimIds"),
  });
}

function decodeSelect(value: unknown): SelectSpec {
  const object = expectKeys(value, ["mode", "names", "shadows", "claimIds"], "select");
  if (!isPlainObject(object.shadows)) fail("select.shadows must be an object");
  const shadows: Record<string, readonly string[]> = {};
  for (const key of ownKeys(object.shadows)) {
    shadows[expectSafeName(key, "select.shadows key")] = Object.freeze(
      expectStringArray(object.shadows[key], `select.shadows.${key}`).map((name) =>
        expectSafeName(name, "select.shadows name"),
      ),
    );
  }
  return Object.freeze({
    mode: expectEnum(object.mode, ["all", "first-per-directory"], "select.mode"),
    names: Object.freeze(
      expectStringArray(object.names, "select.names").map((name) => expectSafeName(name, "select.name")),
    ),
    shadows: Object.freeze(shadows),
    claimIds: expectStringArray(object.claimIds, "select.claimIds"),
  });
}

function decodeTransform(value: unknown, index: number): TransformSpec {
  if (!isPlainObject(value)) fail(`transform[${index}] must be an object`);
  const kind = expectEnum(
    value.kind,
    ["byte-budget", "at-path-import", "strip-html-comments"],
    `transform[${index}].kind`,
  );
  const claimIds = expectStringArray(value.claimIds, `transform[${index}].claimIds`);
  if (kind === "byte-budget") {
    expectKeys(value, ["kind", "bytes", "claimIds"], `transform[${index}]`);
    if (typeof value.bytes !== "number" || !Number.isInteger(value.bytes) || value.bytes < 1) {
      fail(`transform[${index}].bytes must be a positive integer`);
    }
    return Object.freeze({ kind, bytes: value.bytes, claimIds });
  }
  if (kind === "at-path-import") {
    const keys = ownKeys(value);
    const allowed = ["kind", "maxDepth", "lexer", "claimIds"];
    if (keys.some((key) => !allowed.includes(key))) fail(`transform[${index}] has unknown fields`);
    if (typeof value.maxDepth !== "number" || !Number.isInteger(value.maxDepth) || value.maxDepth < 1) {
      fail(`transform[${index}].maxDepth must be a positive integer`);
    }
    if (value.lexer === undefined) {
      return Object.freeze({ kind, maxDepth: value.maxDepth, claimIds });
    }
    return Object.freeze({
      kind,
      maxDepth: value.maxDepth,
      lexer: expectEnum(
        value.lexer,
        ["claude-markdown-v1", "gemini-markdown-v1"],
        `transform[${index}].lexer`,
      ),
      claimIds,
    });
  }
  expectKeys(value, ["kind", "claimIds"], `transform[${index}]`);
  return Object.freeze({ kind, claimIds });
}

function decodeAssemble(value: unknown): AssembleSpec {
  const object = expectKeys(value, ["mode", "claimIds"], "assemble");
  return Object.freeze({
    mode: expectEnum(object.mode, ["ordered", "unspecified"], "assemble.mode"),
    claimIds: expectStringArray(object.claimIds, "assemble.claimIds"),
  });
}

function decodeResolver(value: unknown): ResolverSpec {
  const object = expectKeys(value, [
    "context",
    "discover",
    "select",
    "transform",
    "assemble",
    "fingerprint",
    "onSymlink",
  ], "resolver");
  const context = expectKeys(object.context, ["cwd", "trigger", "repositoryOnly"], "resolver.context");
  if (!Array.isArray(object.transform)) fail("resolver.transform must be an array");
  return Object.freeze({
    context: Object.freeze({
      cwd: expectEnum(context.cwd, ["dirname-target", "repository-root"], "context.cwd"),
      trigger: expectEnum(context.trigger, ["STARTUP", "READ_TARGET"], "context.trigger"),
      repositoryOnly: expectBoolean(context.repositoryOnly, true, "context.repositoryOnly"),
    }),
    discover: decodeDiscover(object.discover),
    select: decodeSelect(object.select),
    transform: Object.freeze(object.transform.map((item, index) => decodeTransform(item, index))),
    assemble: decodeAssemble(object.assemble),
    fingerprint: expectEnum(object.fingerprint, FINGERPRINT_BUILTINS, "resolver.fingerprint") as FingerprintBuiltin,
    onSymlink: expectEnum(
      object.onSymlink,
      ["unknown-unfollowed", "partial-unfollowed"],
      "resolver.onSymlink",
    ),
  });
}

function decodeManifest(value: unknown): PackManifest {
  const object = expectKeys(value, ["schema", "id", "label", "shortLabel", "badge"], "pack");
  const schema = expectString(object.schema, "pack.schema");
  if (schema !== PACK_SCHEMA_ID) fail(`unsupported pack schema: ${schema}`);
  const id = parseProfileId(expectString(object.id, "pack.id"));
  return Object.freeze({
    schema: PACK_SCHEMA_ID,
    id,
    label: expectString(object.label, "pack.label"),
    shortLabel: expectString(object.shortLabel, "pack.shortLabel"),
    badge: expectString(object.badge, "pack.badge"),
  });
}

export function decodePackBundle(value: unknown): PackBundle {
  const object = expectKeys(value, ["pack", "evidence", "resolver"], "bundle");
  if (!Array.isArray(object.evidence) || object.evidence.length === 0) {
    fail("evidence must be a non-empty array");
  }
  return Object.freeze({
    pack: decodeManifest(object.pack),
    evidence: Object.freeze(object.evidence.map((item, index) => decodeClaim(item, index))),
    resolver: decodeResolver(object.resolver),
  });
}

function collectClaimIds(resolver: ResolverSpec): readonly string[] {
  const ids = [
    ...resolver.discover.claimIds,
    ...resolver.select.claimIds,
    ...resolver.assemble.claimIds,
    ...resolver.transform.flatMap((item) => item.claimIds),
  ];
  return ids;
}

export function compilePack(bundle: PackBundle): CompiledPack {
  const claims = new Set(bundle.evidence.map((item) => item.claimId));
  if (claims.size !== bundle.evidence.length) fail("evidence claimId values must be unique");
  for (const claimId of collectClaimIds(bundle.resolver)) {
    if (!claims.has(claimId)) fail(`dangling claimId: ${claimId}`);
  }
  if (bundle.resolver.discover.claimIds.length === 0) fail("discover.claimIds must not be empty");
  if (bundle.resolver.select.claimIds.length === 0) fail("select.claimIds must not be empty");
  if (bundle.resolver.assemble.claimIds.length === 0) fail("assemble.claimIds must not be empty");
  for (const transform of bundle.resolver.transform) {
    if (transform.claimIds.length === 0) fail("transform.claimIds must not be empty");
    if (transform.kind === "byte-budget" && (transform.bytes ?? 0) > 1024 * 1024) {
      fail("byte-budget exceeds hard safety cap");
    }
    if (transform.kind === "at-path-import" && (transform.maxDepth ?? 0) > 32) {
      fail("import maxDepth exceeds hard safety cap");
    }
  }
  return Object.freeze({
    pack: bundle.pack,
    evidence: bundle.evidence,
    resolver: bundle.resolver,
    claims,
  });
}
