import type { CliArgs, SnapshotSelector } from "./args.js";
import {
  currentExplain,
  diffExplain,
  present,
} from "./cli-output.js";
import {
  CliRuntimeError,
  type CapturedCliIo,
  type CliDependencies,
  type DemoSnapshots,
} from "./cli-runtime.js";
import type {
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
} from "./model.js";
import type { RepositorySnapshot } from "./snapshot.js";

function captureDemoSnapshots(value: unknown): DemoSnapshots {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("DemoSnapshots must be a plain object");
  }
  const prototype = Object.getPrototypeOf(value);
  const keys = Reflect.ownKeys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if ((prototype !== Object.prototype && prototype !== null) ||
      keys.length !== 2 || !keys.includes("before") || !keys.includes("after") ||
      !("value" in descriptors.before!) || !("value" in descriptors.after!)) {
    throw new TypeError("DemoSnapshots must contain only before/after data");
  }
  const before = descriptors.before!.value as unknown;
  const after = descriptors.after!.value as unknown;
  if (typeof before !== "object" || before === null ||
      typeof after !== "object" || after === null) {
    throw new TypeError("DemoSnapshots endpoints must be snapshot objects");
  }
  return Object.freeze({
    before: before as RepositorySnapshot,
    after: after as RepositorySnapshot,
  });
}

function noDefensibleResult(
  result: CurrentRuleBlastResult | DiffRuleBlastResult,
): boolean {
  if (result.paths.length === 0) return false;
  return result.mode === "current"
    ? result.paths.every(noDefensibleCurrentPath)
    : result.paths.every(noDefensibleDiffPath);
}

function noDefensibleCurrentPath(
  path: CurrentRuleBlastResult["paths"][number],
): boolean {
  return path.projections.every(
    (projection) => projection.status !== "COMPLETE",
  );
}

function noDefensibleDiffPath(
  path: DiffRuleBlastResult["paths"][number],
): boolean {
  return path.before.every((before, index) =>
    before.status !== "COMPLETE" || path.after[index]?.status !== "COMPLETE",
  );
}

function selectedPath<T extends { readonly path: string }>(
  paths: readonly T[],
  path: string,
): T {
  const selected = paths.find((candidate) => candidate.path === path);
  if (selected === undefined) {
    throw new Error(`Analysis omitted its prevalidated target path: ${JSON.stringify(path)}`);
  }
  return selected;
}

async function openSelector(
  root: string,
  selector: SnapshotSelector,
  dependencies: CliDependencies,
): Promise<RepositorySnapshot> {
  return selector.kind === "worktree"
    ? dependencies.openTrackedWorktree(root)
    : dependencies.openGitSnapshot(root, selector.ref);
}

function assertDistinct(
  before: RepositorySnapshot,
  after: RepositorySnapshot,
): void {
  const beforeOid = before.ref.oid;
  const afterOid = after.ref.oid;
  if (beforeOid !== null && afterOid !== null && beforeOid === afterOid) {
    throw new CliRuntimeError(
      "IDENTICAL_ENDPOINTS",
      "Both endpoints resolve to the same Git commit",
    );
  }
}

async function requireTrackedPath(
  snapshot: RepositorySnapshot,
  path: string,
): Promise<void> {
  if (await snapshot.entry(path) === null) {
    throw new CliRuntimeError(
      "TARGET_PATH_NOT_TRACKED",
      `Tracked target path not found: ${JSON.stringify(path)}`,
    );
  }
}

export async function runAnalysisAction(
  args: Exclude<CliArgs, { action: "help" | "version" }>,
  io: CapturedCliIo,
  dependencies: CliDependencies,
): Promise<number> {
  if (args.action === "demo") {
    const pair = captureDemoSnapshots(await dependencies.openDemo());
    assertDistinct(pair.before, pair.after);
    if (args.explainPath !== null) {
      await requireTrackedPath(pair.after, args.explainPath);
    }
    const result = await dependencies.analyzeDiff({
      before: pair.before,
      after: pair.after,
      profiles: dependencies.profiles,
    });
    if (args.explainPath === null) {
      present(result, args.output, io);
      return noDefensibleResult(result) ? 2 : 0;
    }
    const selected = selectedPath(result.paths, args.explainPath);
    present(diffExplain(result, args.explainPath), args.output, io);
    return noDefensibleDiffPath(selected) ? 2 : 0;
  }

  const start = args.action === "scan"
    ? dependencies.resolvePath(io.cwd(), args.startPath)
    : io.cwd();
  const root = await dependencies.findRepositoryRoot(start);
  if (args.action === "scan") {
    const snapshot = await dependencies.openTrackedWorktree(root);
    const result = await dependencies.analyzeCurrent({
      snapshot,
      profiles: dependencies.profiles,
    });
    present(result, args.output, io);
    return noDefensibleResult(result) ? 2 : 0;
  }
  if (args.action === "diff") {
    const before = await dependencies.openGitSnapshot(root, args.base.ref);
    const after = await openSelector(root, args.target, dependencies);
    assertDistinct(before, after);
    const result = await dependencies.analyzeDiff({
      before,
      after,
      profiles: dependencies.profiles,
    });
    present(result, args.output, io);
    return noDefensibleResult(result) ? 2 : 0;
  }

  const after = await openSelector(root, args.target, dependencies);
  await requireTrackedPath(after, args.path);
  if (args.from === null) {
    const result = await dependencies.analyzeCurrent({
      snapshot: after,
      profiles: dependencies.profiles,
    });
    const selected = selectedPath(result.paths, args.path);
    present(currentExplain(result, args.path), args.output, io);
    return noDefensibleCurrentPath(selected) ? 2 : 0;
  }
  const before = await dependencies.openGitSnapshot(root, args.from.ref);
  assertDistinct(before, after);
  const result = await dependencies.analyzeDiff({
    before,
    after,
    profiles: dependencies.profiles,
  });
  const selected = selectedPath(result.paths, args.path);
  present(diffExplain(result, args.path), args.output, io);
  return noDefensibleDiffPath(selected) ? 2 : 0;
}
