import type { SnapshotRef } from "./model.js";
import { referenceLabel, type ShellDialect } from "./render-format.js";

export interface CurrentTextPresentationContext {
  readonly currentLabel: string;
  readonly demoFixture: boolean;
  readonly shellDialect: ShellDialect;
}

export interface DiffTextPresentationContext {
  readonly beforeLabel: string;
  readonly afterLabel: string;
  readonly demoFixture: boolean;
  readonly shellDialect: ShellDialect;
}

export type TextPresentationContext =
  | CurrentTextPresentationContext
  | DiffTextPresentationContext;

type TextPresentationSubject =
  | { readonly mode: "current"; readonly snapshot: SnapshotRef }
  | {
      readonly mode: "diff";
      readonly before: SnapshotRef;
      readonly after: SnapshotRef;
    }
  | {
      readonly mode: "explain";
      readonly analysisMode: "current";
      readonly snapshot: SnapshotRef;
    }
  | {
      readonly mode: "explain";
      readonly analysisMode: "diff";
      readonly before: SnapshotRef;
      readonly after: SnapshotRef;
    };

const CURRENT_CONTEXT_FIELDS = [
  "currentLabel",
  "demoFixture",
  "shellDialect",
] as const;
const DIFF_CONTEXT_FIELDS = [
  "beforeLabel",
  "afterLabel",
  "demoFixture",
  "shellDialect",
] as const;

function isCurrentSubject(value: TextPresentationSubject): boolean {
  return value.mode === "current" ||
    (value.mode === "explain" && value.analysisMode === "current");
}

function defaultContext(
  value: TextPresentationSubject,
): TextPresentationContext {
  if (value.mode === "current") {
    return {
      currentLabel: referenceLabel(value.snapshot),
      demoFixture: false,
      shellDialect: "posix",
    };
  }
  if (value.mode === "diff") {
    return {
      beforeLabel: referenceLabel(value.before),
      afterLabel: referenceLabel(value.after),
      demoFixture: false,
      shellDialect: "posix",
    };
  }
  return value.analysisMode === "current"
    ? {
        currentLabel: referenceLabel(value.snapshot),
        demoFixture: false,
        shellDialect: "posix",
      }
    : {
        beforeLabel: referenceLabel(value.before),
        afterLabel: referenceLabel(value.after),
        demoFixture: false,
        shellDialect: "posix",
      };
}

export function captureTextPresentationContext(
  value: TextPresentationSubject,
  context: TextPresentationContext | undefined,
): TextPresentationContext {
  if (context === undefined) return defaultContext(value);
  if (typeof context !== "object" || context === null || Array.isArray(context)) {
    throw new TypeError("TextPresentationContext must be a plain object");
  }
  const prototype = Object.getPrototypeOf(context);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("TextPresentationContext must be a plain object");
  }
  const expected = isCurrentSubject(value)
    ? CURRENT_CONTEXT_FIELDS
    : DIFF_CONTEXT_FIELDS;
  const keys = Reflect.ownKeys(context);
  const descriptors = Object.getOwnPropertyDescriptors(context);
  if (keys.length !== expected.length || keys.some(
    (key) => typeof key !== "string" || !expected.includes(key as never),
  )) {
    throw new TypeError("TextPresentationContext has missing or unknown fields");
  }
  const captured = Object.create(null) as Record<string, unknown>;
  for (const field of expected) {
    const descriptor = descriptors[field];
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(`TextPresentationContext.${field} must be data`);
    }
    captured[field] = descriptor.value;
  }
  if (typeof captured.demoFixture !== "boolean") {
    throw new TypeError("TextPresentationContext.demoFixture must be boolean");
  }
  if (captured.shellDialect !== "posix" &&
      captured.shellDialect !== "powershell") {
    throw new TypeError(
      "TextPresentationContext.shellDialect must be posix or powershell",
    );
  }
  if (isCurrentSubject(value)) {
    if (typeof captured.currentLabel !== "string" || captured.currentLabel === "") {
      throw new TypeError("TextPresentationContext.currentLabel must be non-empty");
    }
    return {
      currentLabel: captured.currentLabel,
      demoFixture: captured.demoFixture,
      shellDialect: captured.shellDialect,
    };
  }
  if (typeof captured.beforeLabel !== "string" || captured.beforeLabel === "" ||
      typeof captured.afterLabel !== "string" || captured.afterLabel === "") {
    throw new TypeError("TextPresentationContext endpoint labels must be non-empty");
  }
  return {
    beforeLabel: captured.beforeLabel,
    afterLabel: captured.afterLabel,
    demoFixture: captured.demoFixture,
    shellDialect: captured.shellDialect,
  };
}
