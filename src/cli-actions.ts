import type { CliArgs, SnapshotSelector } from "./args.js";
import {
  captureCaseResult,
  packagedCasePresentation,
} from "./case.js";
import {
  currentExplain,
  diffExplain,
  present,
} from "./cli-output.js";
import {
  CliRuntimeError,
  type CapturedCliIo,
  type CliDependencies,
} from "./cli-runtime.js";
import type {
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
} from "./model.js";
import type {
  DiffTextPresentationContext,
  ShellDialect,
} from "./render-text.js";
import { isGitObjectSnapshot, type RepositorySnapshot } from "./snapshot.js";
import { profilesForRealities } from "./application/authority.js";
import { analyzePreparedDiff } from "./application/diff-analysis.js";
import { cacheGitObjectSnapshot } from "./application/projection-boundary.js";
import {
  buildOverlayP1,
  OVERLAY_UNAVAILABLE,
  renderBlastOverlay,
} from "./application/blast-overlay.js";
import { probeGitStorageFormat } from "./git.js";
import type { ProfileDefinition } from "./profiles/profile.js";

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

function selectorLabel(selector: SnapshotSelector): string {
  return selector.kind === "worktree" ? "WORKTREE" : selector.ref;
}

function presentationExtras(args: {
  readonly witness: boolean;
  readonly receipt: boolean;
}): { witness: boolean; receipt: boolean } {
  return { witness: args.witness, receipt: args.receipt };
}

function analysisProfiles(
  args: { readonly realities: readonly string[] },
  dependencies: CliDependencies,
): readonly ProfileDefinition[] {
  if (args.realities.length === 0) return dependencies.profiles;
  return profilesForRealities(args.realities);
}

function diffTextContext(
  beforeLabel: string,
  target: SnapshotSelector,
  shellDialect: ShellDialect,
): DiffTextPresentationContext {
  return Object.freeze({
    beforeLabel,
    afterLabel: selectorLabel(target),
    caseLabel: null,
    shellDialect,
  });
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
  args: Exclude<CliArgs, { action: "help" | "version" | "mcp" }>,
  io: CapturedCliIo,
  dependencies: CliDependencies,
): Promise<number> {
  if (args.action === "case") {
    const result = captureCaseResult(await dependencies.openCase());
    const presentation = packagedCasePresentation();
    if (args.explainPath === null) {
      present(result, args.output, io, {
        beforeLabel: presentation.beforeLabel,
        afterLabel: presentation.afterLabel,
        caseLabel: presentation.label,
        shellDialect: dependencies.shellDialect,
      }, presentationExtras(args));
      return noDefensibleResult(result) ? 2 : 0;
    }
    const selected = result.paths.find((path) => path.path === args.explainPath);
    if (selected === undefined) {
      throw new CliRuntimeError(
        "TARGET_PATH_NOT_TRACKED",
        `Recorded case target path not found: ${JSON.stringify(args.explainPath)}`,
      );
    }
    present(diffExplain(result, args.explainPath), args.output, io, {
      beforeLabel: presentation.beforeLabel,
      afterLabel: presentation.afterLabel,
      caseLabel: presentation.label,
      shellDialect: dependencies.shellDialect,
    }, presentationExtras(args));
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
      profiles: analysisProfiles(args, dependencies),
    });
    present(result, args.output, io, {
      currentLabel: "WORKTREE",
      caseLabel: null,
      shellDialect: dependencies.shellDialect,
    }, presentationExtras(args));
    return noDefensibleResult(result) ? 2 : 0;
  }
  if (args.action === "diff") {
    const before = await dependencies.openGitSnapshot(root, args.base.ref);
    const after = await openSelector(root, args.target, dependencies);
    assertDistinct(before, after);
    const profiles = analysisProfiles(args, dependencies);
    const admitP1 = args.output.kind !== "json" &&
      isGitObjectSnapshot(before) &&
      isGitObjectSnapshot(after);
    const format = admitP1 ? await probeGitStorageFormat(root) : null;
    const wrappedBefore = admitP1 && format !== null
      ? cacheGitObjectSnapshot(before, format)
      : null;
    const wrappedAfter = admitP1 && format !== null && isGitObjectSnapshot(after)
      ? cacheGitObjectSnapshot(after, format)
      : null;
    const result = wrappedBefore !== null && wrappedAfter !== null
      ? await analyzePreparedDiff({
          before: wrappedBefore,
          after: wrappedAfter,
          profiles,
        })
      : await dependencies.analyzeDiff({ before, after, profiles });
    present(
      result,
      args.output,
      io,
      diffTextContext(args.base.ref, args.target, dependencies.shellDialect),
      presentationExtras(args),
    );
    if (admitP1 && format === null) io.stdout(OVERLAY_UNAVAILABLE);
    if (wrappedBefore !== null && wrappedAfter !== null) {
      io.stdout(renderBlastOverlay(
        await buildOverlayP1(wrappedBefore, wrappedAfter, result),
      ));
    }
    return noDefensibleResult(result) ? 2 : 0;
  }

  const after = await openSelector(root, args.target, dependencies);
  await requireTrackedPath(after, args.path);
  if (args.from === null) {
    const result = await dependencies.analyzeCurrent({
      snapshot: after,
      profiles: analysisProfiles(args, dependencies),
    });
    const selected = selectedPath(result.paths, args.path);
    present(currentExplain(result, args.path), args.output, io, {
      currentLabel: selectorLabel(args.target),
      caseLabel: null,
      shellDialect: dependencies.shellDialect,
    }, presentationExtras(args));
    return noDefensibleCurrentPath(selected) ? 2 : 0;
  }
  const before = await dependencies.openGitSnapshot(root, args.from.ref);
  assertDistinct(before, after);
  const result = await dependencies.analyzeDiff({
    before,
    after,
    profiles: analysisProfiles(args, dependencies),
  });
  const selected = selectedPath(result.paths, args.path);
  present(
    diffExplain(result, args.path),
    args.output,
    io,
    diffTextContext(args.from.ref, args.target, dependencies.shellDialect),
    presentationExtras(args),
  );
  return noDefensibleDiffPath(selected) ? 2 : 0;
}
