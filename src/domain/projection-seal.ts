/**
 * @fileoverview Projection identity and units seals.
 *
 * `projectionDigest` is the semantic stack identity (profile, context, status,
 * composition, source path/disposition/truncated, units, evidence — not unused
 * file bytes). `normalizedPayloadDigest` is the units seal. Forged seals fail
 * closed. COMPLETE requires a non-null `projectionDigest`.
 */
import { canonicalJson, sha256, sha256MovingTarget } from "../canonical.js";
import type { CompositionState, Projection } from "../model.js";

/** SHA-256 of canonical `{ composition, units }`. */
export function digestNormalizedPayload(
  units: readonly (readonly string[])[],
  composition: CompositionState,
): string {
  return sha256(canonicalJson({ composition, units }));
}

/**
 * Identity record hashed into `projectionDigest`. Omits unused source bytes
 * and the digest fields themselves so the seal is not a hash of a digest.
 */
export function projectionIdentityRecord(projection: {
  readonly profile: Projection["profile"];
  readonly context: Projection["context"];
  readonly status: Projection["status"];
  readonly composition: Projection["composition"];
  readonly sources: readonly Projection["sources"][number][];
  readonly normalizedPayloadUnits: readonly (readonly string[])[];
  readonly evidence: readonly string[];
}) {
  return {
    profile: projection.profile,
    context: projection.context,
    status: projection.status,
    composition: projection.composition,
    sources: projection.sources.map((source) => ({
      path: source.path,
      disposition: source.disposition,
      truncated: source.truncated,
    })),
    normalizedPayloadUnits: projection.normalizedPayloadUnits,
    evidence: projection.evidence,
  };
}

/**
 * Same digest as {@link digestProjectionIdentity} when only `targetPath` moves.
 * Used so same-directory 10k projections do not reserialize a stable payload.
 */
export function movingProjectionDigest(input: {
  readonly profile: Projection["profile"];
  readonly cwd: string;
  readonly trigger: Projection["context"]["trigger"];
  readonly status: Projection["status"];
  readonly composition: Projection["composition"];
  readonly sources: readonly Projection["sources"][number][];
  readonly units: readonly (readonly string[])[];
  readonly evidence: readonly string[];
}): (targetPath: string) => string {
  return sha256MovingTarget((path) => projectionIdentityRecord({
    profile: input.profile,
    context: {
      cwd: input.cwd,
      trigger: input.trigger,
      targetPath: path,
      repositoryOnly: true,
    },
    status: input.status,
    composition: input.composition,
    sources: input.sources,
    normalizedPayloadUnits: input.units,
    evidence: input.evidence,
  }));
}

/** SHA-256 of {@link projectionIdentityRecord}. */
export function digestProjectionIdentity(projection: Projection): string {
  return sha256(canonicalJson(projectionIdentityRecord(projection)));
}

interface InternedIdentity {
  readonly profile: Projection["profile"];
  readonly cwd: string;
  readonly trigger: Projection["context"]["trigger"];
  readonly status: Projection["status"];
  readonly composition: Projection["composition"];
  readonly sources: readonly Projection["sources"][number][];
  readonly units: readonly (readonly string[])[];
  readonly evidence: readonly string[];
  readonly digestFor: (targetPath: string) => string;
}

interface InternedUnitsSeal {
  readonly composition: Projection["composition"];
  readonly digest: string;
}

const internedIdentity = new WeakMap<object, InternedIdentity>();
const internedUnitsSeal = new WeakMap<object, InternedUnitsSeal>();
const sealedPayloads = new WeakSet<object>();

function identityInternHit(
  interned: InternedIdentity,
  projection: Projection,
): boolean {
  return interned.profile === projection.profile &&
    interned.cwd === projection.context.cwd &&
    interned.trigger === projection.context.trigger &&
    interned.status === projection.status &&
    interned.composition === projection.composition &&
    interned.sources === projection.sources &&
    interned.units === projection.normalizedPayloadUnits &&
    interned.evidence === projection.evidence;
}

/**
 * Mark a captured projection whose units seal has already been checked.
 * Later {@link assertNormalizedPayloadSeal} on the same object is a no-op.
 * A spread-forged copy is a new object and still full-verifies.
 */
export function markPayloadSealed(projection: Projection): void {
  sealedPayloads.add(projection);
}

/** COMPLETE projections must carry a `projectionDigest`. */
export function assertUsableProjection(projection: Projection): void {
  if (projection.status === "COMPLETE" && projection.projectionDigest === null) {
    throw new TypeError(
      `COMPLETE projectionDigest is required for ${projection.profile} at ${projection.context.targetPath}`,
    );
  }
}

/**
 * Recompute the units seal when `normalizedPayloadDigest` is present.
 * Null digest is allowed (no seal to check). Marked objects skip the rehash.
 * Later paths that share the same units array skip canonicalize when the
 * composition and digest still match; a forged digest still fails closed.
 */
export function assertNormalizedPayloadSeal(projection: Projection): void {
  if (projection.normalizedPayloadDigest === null) return;
  if (sealedPayloads.has(projection)) return;
  const units = projection.normalizedPayloadUnits;
  const interned = internedUnitsSeal.get(units);
  if (interned !== undefined && interned.composition === projection.composition) {
    if (projection.normalizedPayloadDigest !== interned.digest) {
      throw new TypeError(
        `normalizedPayloadDigest is not the units seal for ${projection.profile} at ${projection.context.targetPath}`,
      );
    }
    return;
  }
  const expected = digestNormalizedPayload(units, projection.composition);
  if (projection.normalizedPayloadDigest !== expected) {
    throw new TypeError(
      `normalizedPayloadDigest is not the units seal for ${projection.profile} at ${projection.context.targetPath}`,
    );
  }
  internedUnitsSeal.set(units, {
    composition: projection.composition,
    digest: expected,
  });
}

/**
 * Recompute the identity seal when `projectionDigest` is present.
 *
 * @param internKey Shared sources array from the producer. First use full-
 *   verifies and stores a moving-target checker; later paths only splice
 *   `targetPath`. Omit for a one-shot full canonicalize.
 */
export function assertProjectionDigestSeal(
  projection: Projection,
  internKey?: object,
): void {
  if (projection.projectionDigest === null) return;
  if (internKey !== undefined) {
    const interned = internedIdentity.get(internKey);
    if (interned !== undefined && identityInternHit(interned, projection)) {
      if (interned.digestFor(projection.context.targetPath) !== projection.projectionDigest) {
        throw new TypeError(
          `projectionDigest is not the identity seal for ${projection.profile} at ${projection.context.targetPath}`,
        );
      }
      return;
    }
  }
  const expected = digestProjectionIdentity(projection);
  if (projection.projectionDigest !== expected) {
    throw new TypeError(
      `projectionDigest is not the identity seal for ${projection.profile} at ${projection.context.targetPath}`,
    );
  }
  if (internKey !== undefined) {
    internedIdentity.set(internKey, {
      profile: projection.profile,
      cwd: projection.context.cwd,
      trigger: projection.context.trigger,
      status: projection.status,
      composition: projection.composition,
      sources: projection.sources,
      units: projection.normalizedPayloadUnits,
      evidence: projection.evidence,
      digestFor: movingProjectionDigest({
        profile: projection.profile,
        cwd: projection.context.cwd,
        trigger: projection.context.trigger,
        status: projection.status,
        composition: projection.composition,
        sources: projection.sources,
        units: projection.normalizedPayloadUnits,
        evidence: projection.evidence,
      }),
    });
  }
}

/** Usable + units + identity seals. */
export function assertProjectionSeals(projection: Projection): void {
  assertUsableProjection(projection);
  assertNormalizedPayloadSeal(projection);
  assertProjectionDigestSeal(projection);
}
