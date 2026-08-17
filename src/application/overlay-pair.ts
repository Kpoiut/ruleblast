import type { DiffRuleBlastResult } from "../model.js";
import type { ProfileDefinition } from "../profiles/profile.js";
import {
  isGitObjectSnapshot,
  isWorktreeIdentitySource,
  type GitObjectSnapshot,
  type GitStorageObjectFormat,
  type RepositorySnapshot,
} from "../snapshot.js";
import { buildOverlayP1, type BlastOverlayView } from "./blast-overlay.js";
import { analyzePreparedDiff } from "./diff-analysis.js";
import { cacheGitObjectSnapshot } from "./projection-boundary.js";

export interface OverlayPairAnalysis {
  readonly result: DiffRuleBlastResult;
  readonly overlay: BlastOverlayView | null;
  readonly unavailable: boolean;
}

export interface OverlayPairInput {
  readonly before: RepositorySnapshot;
  readonly after: RepositorySnapshot;
  readonly profiles: readonly ProfileDefinition[];
  readonly format: GitStorageObjectFormat | null;
  readonly analyzeDiff: (input: {
    readonly before: RepositorySnapshot;
    readonly after: RepositorySnapshot;
    readonly profiles: readonly ProfileDefinition[];
  }) => Promise<DiffRuleBlastResult>;
}

function canBindIdentity(snapshot: RepositorySnapshot): boolean {
  return isGitObjectSnapshot(snapshot) || isWorktreeIdentitySource(snapshot);
}

export function bindSnapshotIdentity(
  snapshot: RepositorySnapshot,
  format: GitStorageObjectFormat,
): GitObjectSnapshot | null {
  if (isGitObjectSnapshot(snapshot)) return cacheGitObjectSnapshot(snapshot, format);
  if (isWorktreeIdentitySource(snapshot)) {
    return cacheGitObjectSnapshot(snapshot.withObjectIdentity(format), format);
  }
  return null;
}

export async function analyzeOverlayPair(
  input: OverlayPairInput,
): Promise<OverlayPairAnalysis> {
  const fallback = () => input.analyzeDiff({
    before: input.before,
    after: input.after,
    profiles: input.profiles,
  });
  if (!isGitObjectSnapshot(input.before) || !canBindIdentity(input.after)) {
    return { result: await fallback(), overlay: null, unavailable: false };
  }
  if (input.format === null) {
    return { result: await fallback(), overlay: null, unavailable: true };
  }
  const before = bindSnapshotIdentity(input.before, input.format);
  const after = bindSnapshotIdentity(input.after, input.format);
  if (before === null || after === null) {
    return { result: await fallback(), overlay: null, unavailable: true };
  }
  const result = await analyzePreparedDiff({
    before,
    after,
    profiles: input.profiles,
  });
  return {
    result,
    overlay: await buildOverlayP1(before, after, result),
    unavailable: false,
  };
}
