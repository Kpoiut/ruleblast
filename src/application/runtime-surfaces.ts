import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  GITHUB_COPILOT_CLI_PROFILE_ID,
  GOOGLE_GEMINI_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
} from "../model.js";
import {
  isModelNameSurfaceId,
  unversionedRuntimeId,
} from "../domain/runtime-id.js";
import { readCandidateInventory } from "../packs/candidate.js";
import { candidatePacksRoot } from "../packs/load.js";
import { OPT_IN_REALITY_IDS } from "./opt-in-realities.js";

const MODELED_RUNTIME_IDS = new Set([
  OPENAI_CODEX_CLI_PROFILE_ID,
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  GITHUB_COPILOT_CLI_PROFILE_ID,
  GOOGLE_GEMINI_CLI_PROFILE_ID,
]);

export type RuntimeSurfaceKind = "modeled" | "candidate" | "model-name" | "unknown";

let cachedCandidateIds: ReadonlySet<string> | undefined;

export function candidateRuntimeIds(): ReadonlySet<string> {
  cachedCandidateIds ??= new Set(
    readCandidateInventory(candidatePacksRoot()).map((item) => item.id),
  );
  return cachedCandidateIds;
}

export function classifyRuntimeSurfaceId(value: string): RuntimeSurfaceKind {
  if (MODELED_RUNTIME_IDS.has(value)) return "modeled";
  const ids = candidateRuntimeIds();
  if (ids.has(value) || ids.has(unversionedRuntimeId(value))) return "candidate";
  if (isModelNameSurfaceId(value)) return "model-name";
  return "unknown";
}

export function publicRealityRefusal(value: string): string {
  const kind = classifyRuntimeSurfaceId(value);
  if (kind === "candidate") {
    return `${value} is a not-admitted candidate runtime, not a public --reality. IDs name runtimes, not models.`;
  }
  if (kind === "model-name") {
    return `${value} is a model name, not a runtime surface id`;
  }
  return `--reality must be one of ${[...OPT_IN_REALITY_IDS].join(" | ")}; editor and hosted surfaces are distinct and unsupported`;
}
