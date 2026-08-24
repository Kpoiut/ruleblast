import { canonicalJson, sha256, sha256MovingTarget } from "../canonical.js";
import type { CompositionState, Projection } from "../model.js";

export function digestNormalizedPayload(
  units: readonly (readonly string[])[],
  composition: CompositionState,
): string {
  return sha256(canonicalJson({ composition, units }));
}

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

export function digestProjectionIdentity(projection: Projection): string {
  return sha256(canonicalJson(projectionIdentityRecord(projection)));
}

export function assertUsableProjection(projection: Projection): void {
  if (projection.status === "COMPLETE" && projection.projectionDigest === null) {
    throw new TypeError(
      `COMPLETE projectionDigest is required for ${projection.profile} at ${projection.context.targetPath}`,
    );
  }
}

export function assertNormalizedPayloadSeal(projection: Projection): void {
  if (projection.normalizedPayloadDigest === null) return;
  const expected = digestNormalizedPayload(
    projection.normalizedPayloadUnits,
    projection.composition,
  );
  if (projection.normalizedPayloadDigest !== expected) {
    throw new TypeError(
      `normalizedPayloadDigest is not the units seal for ${projection.profile} at ${projection.context.targetPath}`,
    );
  }
}

export function assertProjectionDigestSeal(projection: Projection): void {
  if (projection.projectionDigest === null) return;
  const expected = digestProjectionIdentity(projection);
  if (projection.projectionDigest !== expected) {
    throw new TypeError(
      `projectionDigest is not the identity seal for ${projection.profile} at ${projection.context.targetPath}`,
    );
  }
}

export function assertProjectionSeals(projection: Projection): void {
  assertUsableProjection(projection);
  assertNormalizedPayloadSeal(projection);
  assertProjectionDigestSeal(projection);
}
