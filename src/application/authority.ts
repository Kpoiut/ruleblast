import { analyzeCurrent, analyzeDiff } from "../impact.js";
import type {
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
} from "../model.js";
import type { RepositorySnapshot } from "../snapshot.js";
import {
  currentExplain,
  diffExplain,
  type CurrentExplainResult,
  type DiffExplainResult,
} from "../cli-output.js";
import { explainViewFromResult, type ExplainView } from "./explain-view.js";
import { profilesForReality } from "./profile-catalog.js";

export interface AuthorityScanInput {
  readonly snapshot: RepositorySnapshot;
  readonly reality: string | null;
}

export interface AuthorityDiffInput {
  readonly before: RepositorySnapshot;
  readonly after: RepositorySnapshot;
  readonly reality: string | null;
}

export interface AuthorityExplainInput {
  readonly snapshot?: RepositorySnapshot;
  readonly before?: RepositorySnapshot;
  readonly after?: RepositorySnapshot;
  readonly path: string;
  readonly reality: string | null;
}

export async function scanRepository(
  input: AuthorityScanInput,
): Promise<CurrentRuleBlastResult> {
  return analyzeCurrent({
    snapshot: input.snapshot,
    profiles: profilesForReality(input.reality),
  });
}

export async function diffRepository(
  input: AuthorityDiffInput,
): Promise<DiffRuleBlastResult> {
  return analyzeDiff({
    before: input.before,
    after: input.after,
    profiles: profilesForReality(input.reality),
  });
}

export async function explainRepository(
  input: AuthorityExplainInput,
): Promise<{
  readonly explain: CurrentExplainResult | DiffExplainResult;
  readonly view: ExplainView;
}> {
  if (input.before !== undefined && input.after !== undefined) {
    const result = await diffRepository({
      before: input.before,
      after: input.after,
      reality: input.reality,
    });
    const explain = diffExplain(result, input.path);
    return { explain, view: explainViewFromResult(explain) };
  }
  if (input.snapshot === undefined) {
    throw new TypeError("explainRepository requires a snapshot or a before/after pair");
  }
  const result = await scanRepository({
    snapshot: input.snapshot,
    reality: input.reality,
  });
  const explain = currentExplain(result, input.path);
  return { explain, view: explainViewFromResult(explain) };
}

export type { ExplainView } from "./explain-view.js";
export {
  defaultProfileDefinitions,
  isOptInReality,
  optInRealityIds,
  presentationFor,
  profilesForReality,
} from "./profile-catalog.js";
export { analysisState, formatAnalysisState } from "./analysis-state.js";
export type { AnalysisLifecycle, AnalysisState } from "./analysis-state.js";
