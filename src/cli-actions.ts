import type { CliArgs, SnapshotSelector } from "./args.js";
import {
  captureCaseResult,
  packagedCasePresentation,
} from "./case.js";
import {
  currentExplain,
  diffExplain,
  present,
  writeLine,
} from "./cli-output.js";
import { attentionPaths } from "./domain/attention-paths.js";
import { renderResultIndex } from "./application/result-index.js";
import {
  comparePathStacks,
  formatProjectionCompare,
} from "./application/projection-compare.js";
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
import {
  isGitObjectSnapshot,
  isWorktreeIdentitySource,
  type RepositorySnapshot,
} from "./snapshot.js";
import { profilesForRealities } from "./application/authority.js";
import {
  OVERLAY_UNAVAILABLE,
  renderBlastOverlay,
} from "./application/blast-overlay.js";
import { analyzeOverlayPair } from "./application/overlay-pair.js";
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

function emitAttentionPaths(
  result: CurrentRuleBlastResult | DiffRuleBlastResult,
  io: CapturedCliIo,
): void {
  const paths = attentionPaths(result);
  if (paths.length > 0) writeLine(io.stdout, paths.join("\n"));
}

function emitIndex(
  result: CurrentRuleBlastResult | DiffRuleBlastResult,
  io: CapturedCliIo,
  context: Parameters<typeof renderResultIndex>[1] = {},
): void {
  writeLine(io.stdout, renderResultIndex(result, context).trimEnd());
}

function presentationExtras(args: {
  readonly witness: boolean;
  readonly receipt: boolean;
  readonly detail: boolean;
}): { witness: boolean; receipt: boolean; detail: boolean } {
  return { witness: args.witness, receipt: args.receipt, detail: args.detail };
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

class CliProgressTracker {
  private timer: NodeJS.Timeout | null = null;
  private printed = false;

  constructor(
    private readonly io: CapturedCliIo,
    enabled: boolean,
  ) {
    if (enabled) {
      this.timer = setTimeout(() => {
        this.io.stderr("ruleblast · analyzing…\r");
        this.printed = true;
      }, 350);
    }
  }

  public finish(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.printed) {
      this.io.stderr("\r\x1b[K");
      this.printed = false;
    }
  }
}

export async function runAnalysisAction(
  args: Exclude<CliArgs, { action: "help" | "version" | "mcp" }>,
  io: CapturedCliIo,
  dependencies: CliDependencies,
): Promise<number> {
  const progress = new CliProgressTracker(
    io,
    args.output.kind !== "json" && io.stderrIsTTY === true,
  );
  try {
    if (args.action === "case") {
      const result = captureCaseResult(await dependencies.openCase());
      const presentation = packagedCasePresentation();
      if (args.explainPath === null) {
        if (args.pathsOnly) {
          emitAttentionPaths(result, io);
          return noDefensibleResult(result) ? 2 : 0;
        }
        if (args.index) {
          emitIndex(result, io, {
            from: presentation.beforeLabel,
            to: presentation.afterLabel,
          });
          return noDefensibleResult(result) ? 2 : 0;
        }
        await present(result, args.output, io, {
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
      await present(diffExplain(result, args.explainPath), args.output, io, {
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
      if (args.pathsOnly) {
        emitAttentionPaths(result, io);
        return noDefensibleResult(result) ? 2 : 0;
      }
      if (args.index) {
        emitIndex(result, io);
        return noDefensibleResult(result) ? 2 : 0;
      }
      await present(result, args.output, io, {
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
      const admitOverlay = args.output.kind !== "json" &&
        isGitObjectSnapshot(before) &&
        (isGitObjectSnapshot(after) || isWorktreeIdentitySource(after));
      const format = admitOverlay
        ? await dependencies.probeGitStorageFormat(root)
        : null;
      const pair = admitOverlay
        ? await analyzeOverlayPair({
            before,
            after,
            profiles,
            format,
            analyzeDiff: dependencies.analyzeDiff,
          })
        : {
            result: await dependencies.analyzeDiff({ before, after, profiles }),
            overlay: null,
            unavailable: false,
          };
      if (args.pathsOnly) {
        emitAttentionPaths(pair.result, io);
        return noDefensibleResult(pair.result) ? 2 : 0;
      }
      if (args.index) {
        emitIndex(pair.result, io, {
          overlay: pair.overlay,
          from: args.base.ref,
          to: selectorLabel(args.target),
        });
        return noDefensibleResult(pair.result) ? 2 : 0;
      }
      await present(
        pair.result,
        args.output,
        io,
        diffTextContext(args.base.ref, args.target, dependencies.shellDialect),
        presentationExtras(args),
      );
      if (pair.unavailable) io.stdout(OVERLAY_UNAVAILABLE);
      if (pair.overlay !== null) {
        io.stdout(renderBlastOverlay(pair.overlay, {
          from: args.base.ref,
          to: selectorLabel(args.target),
          instructionLineEdits: pair.result.diffStats.editedLineCount,
          changedStackPathCount: pair.result.counts.changedStackPathCount,
          identityLaw: isWorktreeIdentitySource(after)
            ? "worktree-captured"
            : "git-storage",
          ...(args.detail ? { sampleCap: Number.POSITIVE_INFINITY } : {}),
        }));
      }
      return noDefensibleResult(pair.result) ? 2 : 0;
    }

    const after = await openSelector(root, args.target, dependencies);
    await requireTrackedPath(after, args.path);
    if (args.from === null) {
      const result = await dependencies.analyzeCurrent({
        snapshot: after,
        profiles: analysisProfiles(args, dependencies),
      });
      const selected = selectedPath(result.paths, args.path);
      if (args.compare) {
        writeLine(io.stdout, formatProjectionCompare(comparePathStacks(selected)));
        return noDefensibleCurrentPath(selected) ? 2 : 0;
      }
      await present(currentExplain(result, args.path), args.output, io, {
        currentLabel: selectorLabel(args.target),
        caseLabel: null,
        shellDialect: dependencies.shellDialect,
      }, presentationExtras(args));
      return noDefensibleCurrentPath(selected) ? 2 : 0;
    }
    const before = await dependencies.openGitSnapshot(root, args.from.ref);
    assertDistinct(before, after);
    const profiles = analysisProfiles(args, dependencies);
    const admitOverlay = args.output.kind !== "json" &&
      isGitObjectSnapshot(before) &&
      (isGitObjectSnapshot(after) || isWorktreeIdentitySource(after));
    const format = admitOverlay
      ? await dependencies.probeGitStorageFormat(root)
      : null;
    const pair = admitOverlay
      ? await analyzeOverlayPair({
          before,
          after,
          profiles,
          format,
          analyzeDiff: dependencies.analyzeDiff,
        })
      : {
          result: await dependencies.analyzeDiff({ before, after, profiles }),
          overlay: null,
          unavailable: false,
        };
    const selected = selectedPath(pair.result.paths, args.path);
    if (args.compare) {
      writeLine(io.stdout, formatProjectionCompare(comparePathStacks(selected)));
      return noDefensibleDiffPath(selected) ? 2 : 0;
    }
    await present(
      diffExplain(pair.result, args.path),
      args.output,
      io,
      diffTextContext(args.from.ref, args.target, dependencies.shellDialect),
      presentationExtras(args),
    );
    if (pair.overlay !== null) {
      const row = pair.overlay.observedPaths.find((item) => item.path === args.path);
      if (row !== undefined) {
        const intent = row.relation === "IN_BLAST"
          ? "CONTINUE"
          : row.relation === "OUTSIDE_BLAST"
            ? "REJECT"
            : "UNRESOLVED";
        writeLine(io.stdout, [
          "LATER WORK",
          `  ${intent}  ${row.relation}  ${row.kind}`,
          "  next agent: Git membership is not a recommendation to discard the change",
        ].join("\n"));
      }
    }
    return noDefensibleDiffPath(selected) ? 2 : 0;
  } finally {
    progress.finish();
  }
}
