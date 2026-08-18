import { compareCodePoints } from "./repository-path.js";
import type {
  DiffRuleBlastResult,
  InstructionSourceChange,
  ProfileId,
} from "../model.js";

export interface SourceBlastProfileCount {
  readonly profile: ProfileId;
  readonly affectedPathCount: number;
}

export interface SourceBlastSummary {
  readonly sourcePath: string;
  readonly kind: InstructionSourceChange["kind"];
  readonly byProfile: readonly SourceBlastProfileCount[];
  readonly examplePaths: readonly string[];
  readonly changedStackPathCount: number;
}

const RENDER_LIMIT = 3;
const EXAMPLE_LIMIT = 3;

export function sourcePathOf(change: InstructionSourceChange): string {
  return change.afterPath ?? change.beforePath ?? "";
}

export function summarizeSourceBlasts(
  result: DiffRuleBlastResult,
  profiles?: readonly ProfileId[],
  options?: { readonly limit?: number },
): SourceBlastSummary[] {
  const known = new Set<ProfileId>(profiles ?? []);
  if (profiles === undefined) {
    for (const path of result.paths) {
      for (const profile of path.changedProfiles) known.add(profile);
    }
    for (const row of result.counts.byProfile) known.add(row.profile);
  }
  const orderedProfiles = [...known].sort(compareCodePoints);
  const summaries: SourceBlastSummary[] = [];
  for (const change of result.changedInstructionSources) {
    const sourcePath = sourcePathOf(change);
    if (sourcePath === "") continue;
    const hits = result.paths.filter((path) =>
      path.changedProfiles.length > 0 && path.causes.includes(sourcePath)
    );
    const byProfile = orderedProfiles.map((profile) => ({
      profile,
      affectedPathCount: hits.filter((path) => path.changedProfiles.includes(profile))
        .length,
    }));
    summaries.push({
      sourcePath,
      kind: change.kind,
      byProfile,
      examplePaths: [...hits.map((path) => path.path)].sort(compareCodePoints)
        .slice(0, EXAMPLE_LIMIT),
      changedStackPathCount: hits.length,
    });
  }
  const ordered = summaries.sort((left, right) =>
    right.changedStackPathCount - left.changedStackPathCount ||
    compareCodePoints(left.sourcePath, right.sourcePath)
  );
  const limit = options?.limit ?? RENDER_LIMIT;
  return Number.isFinite(limit) ? ordered.slice(0, limit) : ordered;
}
