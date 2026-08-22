import type {
  Completeness,
  CompositionState,
  CurrentPathProjection,
  Finding,
  PathTransition,
  PayloadRelation,
  ProfileId,
  Projection,
  SourceDisposition,
  Trigger,
} from "../model.js";
import { compareCodePoints } from "../domain/repository-path.js";
import type { CurrentExplainResult, DiffExplainResult, ExplainResult } from "../cli-output.js";
import { rbctxForExplainCurrent, rbctxForExplainDiff } from "../domain/rbctx.js";
import { presentationFor } from "./profile-catalog.js";

export interface ExplainSourceView {
  readonly path: string;
  readonly disposition: SourceDisposition;
  readonly changed: boolean;
  readonly truncated: boolean;
}

export interface ExplainProfileView {
  readonly profile: ProfileId;
  readonly label: string;
  readonly shortLabel: string;
  readonly badge: string;
  readonly trigger: Trigger;
  readonly cwd: string;
  readonly affected: boolean | null;
  readonly completeness: Completeness;
  readonly composition: CompositionState;
  readonly sources: readonly ExplainSourceView[];
  readonly reason: string;
  readonly boundaryNotes: readonly string[];
}

export interface ExplainWhyProfile {
  readonly profile: ProfileId;
  readonly badge: string;
  readonly shortLabel: string;
}

export interface ExplainWhyView {
  readonly counts: boolean;
  readonly causes: readonly string[];
  readonly changedProfiles: readonly ExplainWhyProfile[];
  readonly beforeRelation: PayloadRelation;
  readonly afterRelation: PayloadRelation;
  readonly newlySplit: boolean;
}

export interface ExplainKeepView {
  readonly rbctx: string;
  readonly relation: PayloadRelation | null;
  readonly split: boolean;
  readonly reuse: string;
}

export interface ExplainView {
  readonly path: string;
  readonly profiles: readonly ExplainProfileView[];
  readonly relation: PayloadRelation | null;
  readonly completeness: Completeness;
  readonly findings: readonly Finding[];
  readonly why: ExplainWhyView | null;
  readonly keep: ExplainKeepView;
}

function worstCompleteness(values: readonly Completeness[]): Completeness {
  if (values.includes("UNKNOWN")) return "UNKNOWN";
  if (values.includes("PARTIAL")) return "PARTIAL";
  return "COMPLETE";
}

function boundaryNotes(projection: Projection): readonly string[] {
  return projection.evidence.filter((item) =>
    item.includes("outside") ||
    item.includes("UNSPECIFIED") ||
    item.includes("RUNTIME") ||
    item.includes("UNSUPPORTED") ||
    item.includes("UNRESOLVED") ||
    item.includes("import") ||
    item.includes("external") ||
    item.includes("unknown") ||
    item.includes("drift") ||
    item.includes("downward"),
  );
}

function reasonFor(
  projection: Projection,
  affected: boolean | null,
  causes: readonly string[],
): string {
  if (affected === false) {
    return "Documented loading rules for this profile did not select a changed source.";
  }
  if (affected === true && causes.length > 0) {
    return `Changed sources entered this projection: ${causes.join(", ")}.`;
  }
  if (projection.sources.length === 0) {
    return "No documented repository instruction sources were selected.";
  }
  return `${projection.sources.length} source${projection.sources.length === 1 ? "" : "s"} · ${projection.composition}`;
}

function sourceViews(
  projection: Projection,
  causes: readonly string[],
): readonly ExplainSourceView[] {
  return projection.sources.map((source) => Object.freeze({
    path: source.path,
    disposition: source.disposition,
    changed: causes.includes(source.path),
    truncated: source.truncated,
  }));
}

function profileView(
  projection: Projection,
  affected: boolean | null,
  causes: readonly string[],
): ExplainProfileView {
  const presentation = presentationFor(projection.profile);
  return Object.freeze({
    profile: projection.profile,
    label: presentation.label,
    shortLabel: presentation.shortLabel,
    badge: presentation.badge,
    trigger: projection.context.trigger,
    cwd: projection.context.cwd,
    affected,
    completeness: projection.status,
    composition: projection.composition,
    sources: sourceViews(projection, causes),
    reason: reasonFor(projection, affected, causes),
    boundaryNotes: boundaryNotes(projection),
  });
}

function whyFromTransition(path: PathTransition): ExplainWhyView {
  return Object.freeze({
    counts: path.changedProfiles.length > 0,
    causes: Object.freeze([...path.causes]),
    changedProfiles: Object.freeze(
      [...path.changedProfiles]
        .sort(compareCodePoints)
        .map((profile) => {
          const presentation = presentationFor(profile);
          return Object.freeze({
            profile: presentation.id,
            badge: presentation.badge,
            shortLabel: presentation.shortLabel,
          });
        }),
    ),
    beforeRelation: path.beforePayloadRelation,
    afterRelation: path.afterPayloadRelation,
    newlySplit: path.beforePayloadRelation === "SAME" &&
      path.afterPayloadRelation === "DIFFERENT",
  });
}

const KEEP_REUSE =
  "next agent: reuse this explanation unless rbctx moves; do not repeat the same path work";

function keepView(
  rbctx: string,
  relation: PayloadRelation | null,
  split: boolean,
): ExplainKeepView {
  return Object.freeze({
    rbctx,
    relation,
    split,
    reuse: KEEP_REUSE,
  });
}

export function explainViewFromCurrent(path: CurrentPathProjection): ExplainView {
  const relation = path.payloadRelation;
  return Object.freeze({
    path: path.path,
    profiles: path.projections.map((projection) =>
      profileView(projection, null, []),
    ),
    relation,
    completeness: worstCompleteness(path.projections.map((item) => item.status)),
    findings: [],
    why: null,
    keep: keepView("", relation, path.isSplit === true),
  });
}

export function explainViewFromTransition(path: PathTransition): ExplainView {
  const profiles = path.after.map((after) =>
    profileView(after, path.changedProfiles.includes(after.profile), path.causes),
  );
  const split = path.afterPayloadRelation === "DIFFERENT";
  if (path.after.length === 0) {
    return Object.freeze({
      path: path.path,
      profiles: path.before.map((before) => profileView(before, false, path.causes)),
      relation: path.afterPayloadRelation,
      completeness: worstCompleteness(path.before.map((item) => item.status)),
      findings: [],
      why: whyFromTransition(path),
      keep: keepView("", path.afterPayloadRelation, split),
    });
  }
  return Object.freeze({
    path: path.path,
    profiles,
    relation: path.afterPayloadRelation,
    completeness: worstCompleteness(path.after.map((item) => item.status)),
    findings: [],
    why: whyFromTransition(path),
    keep: keepView("", path.afterPayloadRelation, split),
  });
}

export function explainViewFromResult(result: ExplainResult): ExplainView {
  if (result.analysisMode === "current") {
    const view = explainViewFromCurrent(result.path);
    const rbctx = rbctxForExplainCurrent(
      result.snapshot.label,
      result.path.path,
      result.path.projections,
    );
    return Object.freeze({
      ...view,
      findings: result.findings,
      keep: keepView(rbctx, view.relation, view.keep.split),
    });
  }
  const view = explainViewFromTransition(result.path);
  const rbctx = rbctxForExplainDiff(
    `${result.before.label}>${result.after.label}`,
    result.path.path,
    result.path.before,
    result.path.after,
  );
  return Object.freeze({
    ...view,
    findings: result.findings,
    keep: keepView(rbctx, view.relation, view.keep.split),
  });
}

export function explainViewFromExplain(
  result: CurrentExplainResult | DiffExplainResult,
): ExplainView {
  return explainViewFromResult(result);
}
