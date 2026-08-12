import type { OutputIo } from "./cli-output.js";
import type {
  AnalysisInput,
  DiffAnalysisInput,
} from "./impact.js";
import type {
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
} from "./model.js";
import type { ProfileDefinition } from "./profiles/profile.js";
import type { RepositorySnapshot } from "./snapshot.js";

export interface CliIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly cwd: () => string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly stdoutIsTTY: boolean;
}

export interface DemoSnapshots {
  readonly before: RepositorySnapshot;
  readonly after: RepositorySnapshot;
}

export interface CliDependencies {
  readonly version: string;
  readonly profiles: readonly ProfileDefinition[];
  readonly resolvePath: (...parts: readonly string[]) => string;
  readonly findRepositoryRoot: (start: string) => Promise<string>;
  readonly openGitSnapshot: (
    root: string,
    ref: string,
  ) => Promise<RepositorySnapshot>;
  readonly openTrackedWorktree: (root: string) => Promise<RepositorySnapshot>;
  readonly analyzeCurrent: (
    input: AnalysisInput,
  ) => Promise<CurrentRuleBlastResult>;
  readonly analyzeDiff: (
    input: DiffAnalysisInput,
  ) => Promise<DiffRuleBlastResult>;
  readonly openDemo: () => Promise<DemoSnapshots>;
}

export type CliRuntimeErrorCode =
  | "NOT_REPOSITORY"
  | "REF_NOT_FOUND"
  | "INVALID_PATH"
  | "TARGET_PATH_NOT_TRACKED"
  | "IDENTICAL_ENDPOINTS"
  | "DEMO_NOT_AVAILABLE";

export class CliRuntimeError extends Error {
  public constructor(
    public readonly code: CliRuntimeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CliRuntimeError";
  }
}

export interface CapturedCliIo extends OutputIo {
  readonly cwd: () => string;
}

export interface CapturedInvocation {
  readonly io: CapturedCliIo;
  readonly dependencies: CliDependencies;
}

const DEPENDENCY_FIELDS = [
  "version", "profiles", "resolvePath", "findRepositoryRoot",
  "openGitSnapshot", "openTrackedWorktree", "analyzeCurrent", "analyzeDiff",
  "openDemo",
] as const;

function captureDataRecord(
  value: unknown,
  fields: readonly string[],
  description: string,
): PropertyDescriptorMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${description} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${description} must be a plain object`);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || keys.some(
    (key) => typeof key !== "string" || !fields.includes(key),
  )) {
    throw new TypeError(`${description} has missing or unknown fields`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const field of fields) {
    const descriptor = descriptors[field];
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(`${description}.${field} must be an own data property`);
    }
  }
  return descriptors;
}

function dataValue(
  descriptors: PropertyDescriptorMap,
  field: string,
): unknown {
  return descriptors[field]!.value;
}

function captureEnvironment(
  value: unknown,
): Readonly<Record<string, string | undefined>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("CliIo.env must be a record");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const captured = Object.create(null) as Record<string, string | undefined>;
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!("value" in descriptor) ||
        (typeof descriptor.value !== "string" && descriptor.value !== undefined)) {
      throw new TypeError(`CliIo.env.${key} must be string or undefined data`);
    }
    captured[key] = descriptor.value;
  }
  if (Object.getOwnPropertySymbols(value).length !== 0) {
    throw new TypeError("CliIo.env must not contain symbol keys");
  }
  return Object.freeze(captured);
}

function captureIo(value: CliIo): CapturedCliIo {
  const descriptors = captureDataRecord(
    value,
    ["stdout", "stderr", "cwd", "env", "stdoutIsTTY"],
    "CliIo",
  );
  const stdout = dataValue(descriptors, "stdout");
  const stderr = dataValue(descriptors, "stderr");
  const cwd = dataValue(descriptors, "cwd");
  const stdoutIsTTY = dataValue(descriptors, "stdoutIsTTY");
  if (typeof stdout !== "function" || typeof stderr !== "function" ||
      typeof cwd !== "function" || typeof stdoutIsTTY !== "boolean") {
    throw new TypeError("CliIo callbacks and stdoutIsTTY have invalid types");
  }
  return Object.freeze({
    stdout: (text: string) => stdout.call(value, text),
    stderr: (text: string) => stderr.call(value, text),
    cwd: () => {
      const result = cwd.call(value);
      if (typeof result !== "string" || result === "" || result.includes("\0")) {
        throw new TypeError("CliIo.cwd() must return a usable path string");
      }
      return result;
    },
    env: captureEnvironment(dataValue(descriptors, "env")),
    stdoutIsTTY,
  });
}

function denseProfiles(value: unknown): readonly ProfileDefinition[] {
  if (!Array.isArray(value)) {
    throw new TypeError("CliDependencies.profiles must be an array");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value as unknown;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 ||
      Reflect.ownKeys(value).length !== length + 1) {
    throw new TypeError("CliDependencies.profiles must be a dense array");
  }
  const profiles: ProfileDefinition[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) ||
        typeof descriptor.value !== "object" || descriptor.value === null) {
      throw new TypeError("CliDependencies.profiles must contain data elements");
    }
    profiles.push(descriptor.value as ProfileDefinition);
  }
  return Object.freeze(profiles);
}

function captureDependencies(value: CliDependencies): CliDependencies {
  const descriptors = captureDataRecord(
    value,
    DEPENDENCY_FIELDS,
    "CliDependencies",
  );
  const version = dataValue(descriptors, "version");
  const resolvePath = dataValue(descriptors, "resolvePath");
  const findRoot = dataValue(descriptors, "findRepositoryRoot");
  const openGit = dataValue(descriptors, "openGitSnapshot");
  const openWorktree = dataValue(descriptors, "openTrackedWorktree");
  const current = dataValue(descriptors, "analyzeCurrent");
  const diff = dataValue(descriptors, "analyzeDiff");
  const demo = dataValue(descriptors, "openDemo");
  if (typeof version !== "string" || typeof resolvePath !== "function" ||
      typeof findRoot !== "function" || typeof openGit !== "function" ||
      typeof openWorktree !== "function" || typeof current !== "function" ||
      typeof diff !== "function" || typeof demo !== "function") {
    throw new TypeError("CliDependencies fields have invalid types");
  }
  const profiles = denseProfiles(dataValue(descriptors, "profiles"));
  return Object.freeze({
    version,
    profiles,
    resolvePath: (...parts: readonly string[]) =>
      resolvePath.call(value, ...parts) as string,
    findRepositoryRoot: (start: string) =>
      findRoot.call(value, start) as Promise<string>,
    openGitSnapshot: (root: string, ref: string) =>
      openGit.call(value, root, ref) as Promise<RepositorySnapshot>,
    openTrackedWorktree: (root: string) =>
      openWorktree.call(value, root) as Promise<RepositorySnapshot>,
    analyzeCurrent: (input: AnalysisInput) =>
      current.call(value, input) as Promise<CurrentRuleBlastResult>,
    analyzeDiff: (input: DiffAnalysisInput) =>
      diff.call(value, input) as Promise<DiffRuleBlastResult>,
    openDemo: () => demo.call(value) as Promise<DemoSnapshots>,
  });
}

export function captureInvocation(
  io: CliIo,
  dependencies: CliDependencies,
): CapturedInvocation {
  return Object.freeze({
    io: captureIo(io),
    dependencies: captureDependencies(dependencies),
  });
}
