#!/usr/bin/env node

import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CliUsageError, parseArgs } from "./args.js";
import { openPackagedCase } from "./case.js";
import { displayText, writeLine } from "./cli-output.js";
import { runAnalysisAction } from "./cli-actions.js";
import {
  captureInvocation,
  CliRuntimeError,
  type CliDependencies,
  type CliIo,
} from "./cli-runtime.js";
import {
  findRepositoryRoot,
  GitSnapshotError,
  openGitSnapshot,
  openTrackedWorktree,
  type GitSnapshotErrorCode,
} from "./git.js";
import { analyzeCurrent, analyzeDiff } from "./impact.js";
import { claudeProfile } from "./profiles/claude.js";
import { codexProfile } from "./profiles/codex.js";

export {
  CliRuntimeError,
  type CliDependencies,
  type CliIo,
} from "./cli-runtime.js";
export type {
  CurrentExplainResult,
  DiffExplainResult,
  ExplainResult,
} from "./cli-output.js";

const COLOR_OPTION = "[--color=auto|always|never]";
const USAGE = `Usage:
  ruleblast [path] [--json] ${COLOR_OPTION}
  ruleblast diff [base] [--to <ref|WORKTREE>] [--json] ${COLOR_OPTION}
  ruleblast explain <path> [--from <ref>] [--to <ref|WORKTREE>] [--json] ${COLOR_OPTION}
  ruleblast case [--explain <path>] [--json] ${COLOR_OPTION}
  ruleblast --help
  ruleblast --version
`;

function packageVersion(): string {
  const value = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as unknown;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("package.json must contain an object");
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, "version");
  if (descriptor === undefined || !("value" in descriptor) ||
      typeof descriptor.value !== "string" || descriptor.value === "") {
    throw new TypeError("package.json version must be a non-empty string");
  }
  return descriptor.value;
}

const DEFAULT_PROFILES = Object.freeze([claudeProfile, codexProfile]);
const DEFAULT_DEPENDENCIES: CliDependencies = Object.freeze({
  version: packageVersion(),
  shellDialect: process.platform === "win32" ? "powershell" : "posix",
  profiles: DEFAULT_PROFILES,
  resolvePath: resolve,
  findRepositoryRoot,
  openGitSnapshot,
  openTrackedWorktree,
  analyzeCurrent,
  analyzeDiff,
  openCase: openPackagedCase,
});

const GIT_ERROR_MESSAGES: Readonly<Record<GitSnapshotErrorCode, string>> = {
  NOT_REPOSITORY: "No Git repository was found from the selected path",
  REF_NOT_FOUND: "The selected Git ref does not resolve to a commit",
  UNMERGED_INDEX: "The Git index contains unmerged entries",
  UNSUPPORTED_WORKTREE_NODE: "A tracked path has an unsupported worktree node",
  WORKTREE_CHANGED_DURING_SNAPSHOT: "The tracked worktree changed during capture",
};

interface KnownError {
  readonly code: string;
  readonly message: string;
}

const RUNTIME_RECOVERY: Readonly<Record<CliRuntimeError["code"], string>> = {
  NOT_REPOSITORY: "Run ruleblast from a Git repository.",
  REF_NOT_FOUND: "Choose a Git ref that resolves to a commit and retry.",
  INVALID_PATH: "Choose a valid repository-relative path and retry.",
  TARGET_PATH_NOT_TRACKED: "Choose a Git-tracked repository-relative path and retry.",
  IDENTICAL_ENDPOINTS: "Choose two different Git endpoints and retry.",
};

const GIT_RECOVERY: Readonly<Record<GitSnapshotErrorCode, string>> = {
  NOT_REPOSITORY: "Run ruleblast from a Git repository.",
  REF_NOT_FOUND: "Choose a Git ref that resolves to a commit and retry.",
  UNMERGED_INDEX: "Resolve the unmerged index entries and retry.",
  UNSUPPORTED_WORKTREE_NODE: "Restore the tracked path as a regular file or symlink and retry.",
  WORKTREE_CHANGED_DURING_SNAPSHOT: "Wait for repository writes to finish and retry.",
};

function knownError(error: unknown): KnownError | null {
  if (error instanceof CliRuntimeError) {
    return {
      code: error.code,
      message: `${error.message} ${RUNTIME_RECOVERY[error.code]}`,
    };
  }
  if (error instanceof GitSnapshotError) {
    return {
      code: error.code,
      message: `${GIT_ERROR_MESSAGES[error.code]} ${GIT_RECOVERY[error.code]}`,
    };
  }
  return null;
}

function unexpectedDetail(error: unknown, debug: boolean): string {
  if (debug && error instanceof Error) return error.stack ?? error.message;
  const message = error instanceof Error
    ? error.message
    : "Unknown non-Error failure";
  return displayText(message);
}

function tryWriteLine(callback: (text: string) => void, text: string): boolean {
  try {
    writeLine(callback, text);
    return true;
  } catch {
    return false;
  }
}

export function getVersionLine(version: string): string {
  return `ruleblast ${version}`;
}

export async function runCli(
  argv: readonly string[],
  ioValue: CliIo,
  dependencyValue: CliDependencies = DEFAULT_DEPENDENCIES,
): Promise<number> {
  let invocation: ReturnType<typeof captureInvocation>;
  try {
    invocation = captureInvocation(ioValue, dependencyValue);
  } catch {
    return 70;
  }
  const { io, dependencies } = invocation;
  try {
    const args = parseArgs(argv);
    if (args.action === "help") {
      io.stdout(USAGE);
      return 0;
    }
    if (args.action === "version") {
      writeLine(io.stdout, getVersionLine(dependencies.version));
      return 0;
    }
    return await runAnalysisAction(args, io, dependencies);
  } catch (error: unknown) {
    if (error instanceof CliUsageError) {
      const wroteError = tryWriteLine(
        io.stderr,
        `${error.code}: ${displayText(error.message)} Run ruleblast --help for usage.`,
      );
      return wroteError ? 1 : 70;
    }
    const known = knownError(error);
    if (known !== null) {
      return tryWriteLine(
        io.stderr,
        `${known.code}: ${displayText(known.message)}`,
      ) ? 1 : 70;
    }
    tryWriteLine(
      io.stderr,
      `Internal error: ${unexpectedDetail(error, io.env.RULEBLAST_DEBUG === "1")}`,
    );
    return 70;
  }
}

function processIo(): CliIo {
  return {
    stdout: (text) => { process.stdout.write(text); },
    stderr: (text) => { process.stderr.write(text); },
    cwd: () => process.cwd(),
    env: process.env,
    stdoutIsTTY: process.stdout.isTTY === true,
  };
}

export function isDirectEntry(moduleUrl: string, entryPath: string | undefined): boolean {
  if (entryPath === undefined) return false;
  let path = resolve(entryPath);
  try {
    path = realpathSync(path);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return moduleUrl === pathToFileURL(path).href;
}

if (isDirectEntry(import.meta.url, process.argv[1])) {
  process.exitCode = await runCli(process.argv.slice(2), processIo());
}
