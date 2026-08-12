import { sha256 } from "./canonical.js";
import { diffInstructionBytes } from "./line-diff.js";
import type { InstructionDiffStats, InstructionSourceChange } from "./model.js";
import type { RepositorySnapshot } from "./snapshot.js";

export interface RepositoryTransition {
  readonly before: RepositorySnapshot;
  readonly after: RepositorySnapshot;
  readonly candidatePaths: readonly string[];
  readonly sourceChanges: readonly InstructionSourceChange[];
  readonly diffStats: InstructionDiffStats;
}

function compareCodePoints(left: string, right: string): number {
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftCodePoint = left.codePointAt(leftIndex)!;
    const rightCodePoint = right.codePointAt(rightIndex)!;
    if (leftCodePoint !== rightCodePoint) return leftCodePoint < rightCodePoint ? -1 : 1;
    leftIndex += leftCodePoint > 0xffff ? 2 : 1;
    rightIndex += rightCodePoint > 0xffff ? 2 : 1;
  }
  return leftIndex === left.length && rightIndex === right.length ? 0 : leftIndex === left.length ? -1 : 1;
}

function equalBytes(left: Uint8Array | null, right: Uint8Array | null): boolean {
  if (left === right) return true;
  if (left === null || right === null || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function freezeStats(stats: InstructionDiffStats): InstructionDiffStats {
  return Object.freeze({ ...stats });
}

export async function buildTransition(
  before: RepositorySnapshot,
  after: RepositorySnapshot,
  sourceDependencyPaths: ReadonlySet<string>,
): Promise<RepositoryTransition> {
  const [beforePaths, afterPaths] = await Promise.all([before.listPaths(), after.listPaths()]);
  const beforeSet = new Set(beforePaths);
  const afterSet = new Set(afterPaths);
  const candidatePaths = Object.freeze(
    (
      await Promise.all(
        [...afterSet].map(async (path) =>
          (await after.entry(path)) === null ? null : path,
        ),
      )
    )
      .filter((path): path is string => path !== null)
      .sort(compareCodePoints),
  );
  const changedPaths = [...new Set([...beforeSet, ...afterSet])]
    .filter((path) => sourceDependencyPaths.has(path))
    .sort(compareCodePoints);
  const sourceChanges: InstructionSourceChange[] = [];
  const total = { addedLineCount: 0, deletedLineCount: 0, editedLineCount: 0, binaryChangedSourceCount: 0 };

  for (const path of changedPaths) {
    const [beforeBytes, afterBytes] = await Promise.all([before.read(path), after.read(path)]);
    if (equalBytes(beforeBytes, afterBytes)) continue;
    const stats = freezeStats(diffInstructionBytes(beforeBytes, afterBytes));
    total.addedLineCount += stats.addedLineCount;
    total.deletedLineCount += stats.deletedLineCount;
    total.editedLineCount += stats.editedLineCount;
    total.binaryChangedSourceCount += stats.binaryChangedSourceCount;
    const change: InstructionSourceChange = beforeBytes === null
      ? { kind: "ADD", beforePath: null, afterPath: path, beforeDigest: null, afterDigest: sha256(afterBytes!), stats }
      : afterBytes === null
        ? { kind: "DELETE", beforePath: path, afterPath: null, beforeDigest: sha256(beforeBytes), afterDigest: null, stats }
        : { kind: "MODIFY", beforePath: path, afterPath: path, beforeDigest: sha256(beforeBytes), afterDigest: sha256(afterBytes), stats };
    sourceChanges.push(Object.freeze(change));
  }

  return Object.freeze({
    before,
    after,
    candidatePaths,
    sourceChanges: Object.freeze(sourceChanges),
    diffStats: freezeStats(total),
  });
}
