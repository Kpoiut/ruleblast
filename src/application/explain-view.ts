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

export interface ExplainView {
  readonly path: string;
  readonly profiles: readonly ExplainProfileView[];
  readonly relation: PayloadRelation | null;
  readonly completeness: Completeness;
  readonly findings: readonly Finding[];
  readonly why: ExplainWhyView | null;
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

export function explainViewFromCurrent(path: CurrentPathProjection): ExplainView {
  return Object.freeze({
    path: path.path,
    profiles: path.projections.map((projection) =>
      profileView(projection, null, []),
    ),
    relation: path.payloadRelation,
    completeness: worstCompleteness(path.projections.map((item) => item.status)),
    findings: [],
    why: null,
  });
}

export function explainViewFromTransition(path: PathTransition): ExplainView {
  const profiles = path.after.map((after) =>
    profileView(after, path.changedProfiles.includes(after.profile), path.causes),
  );
  if (path.after.length === 0) {
    return Object.freeze({
      path: path.path,
      profiles: path.before.map((before) => profileView(before, false, path.causes)),
      relation: path.afterPayloadRelation,
      completeness: worstCompleteness(path.before.map((item) => item.status)),
      findings: [],
      why: whyFromTransition(path),
    });
  }
  return Object.freeze({
    path: path.path,
    profiles,
    relation: path.afterPayloadRelation,
    completeness: worstCompleteness(path.after.map((item) => item.status)),
    findings: [],
    why: whyFromTransition(path),
  });
}

export function explainViewFromResult(result: ExplainResult): ExplainView {
  if (result.analysisMode === "current") {
    const view = explainViewFromCurrent(result.path);
    return Object.freeze({ ...view, findings: result.findings });
  }
  const view = explainViewFromTransition(result.path);
  return Object.freeze({ ...view, findings: result.findings });
}

export function explainViewFromExplain(
  result: CurrentExplainResult | DiffExplainResult,
): ExplainView {
  return explainViewFromResult(result);
}
