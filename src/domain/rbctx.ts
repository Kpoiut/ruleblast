import { canonicalJson, sha256 } from "../canonical.js";
import type {
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
  Projection,
} from "../model.js";

export const RBCTX_VERSION = "RBCTX1";

export function rbctxForProjection(projection: Projection): string {
  const digest = sha256(canonicalJson({
    v: RBCTX_VERSION,
    profile: projection.profile,
    resolver: 1,
    context: projection.context,
    status: projection.status,
    composition: projection.composition,
    sources: projection.sources.map((source) => ({
      path: source.path,
      disposition: source.disposition,
      digest: source.digest,
      bytesUsed: source.bytesUsed,
      truncated: source.truncated,
    })),
    payload: projection.normalizedPayloadDigest,
    evidence: [...projection.evidence].sort(),
  }));
  return `${RBCTX_VERSION}:${digest.slice(0, 12)}`;
}

export function rbctxForCurrent(result: CurrentRuleBlastResult): string {
  return fingerprint("current", result.snapshot.label, result.paths.map((path) => ({
    path: path.path,
    identities: path.projections.map(rbctxForProjection),
  })));
}

export function rbctxForExplainCurrent(
  label: string,
  path: string,
  projections: readonly Projection[],
): string {
  return fingerprint("explain-current", `${label}:${path}`, [{
    path,
    identities: projections.map(rbctxForProjection),
  }]);
}

export function rbctxForExplainDiff(
  bound: string,
  path: string,
  before: readonly Projection[],
  after: readonly Projection[],
): string {
  return fingerprint("explain-diff", `${bound}:${path}`, [{
    path,
    identities: [
      ...before.map(rbctxForProjection),
      ...after.map(rbctxForProjection),
    ],
  }]);
}

export function rbctxForDiff(result: DiffRuleBlastResult): string {
  return fingerprint(
    "diff",
    `${result.before.label}>${result.after.label}`,
    result.paths.map((path) => ({
      path: path.path,
      identities: [
        ...path.before.map(rbctxForProjection),
        ...path.after.map(rbctxForProjection),
      ],
    })),
  );
}

function fingerprint(
  mode: string,
  bound: string,
  paths: readonly { readonly path: string; readonly identities: readonly string[] }[],
): string {
  const digest = sha256(canonicalJson({
    v: RBCTX_VERSION,
    mode,
    bound,
    paths,
  }));
  return `${RBCTX_VERSION}:${digest.slice(0, 12)}`;
}
