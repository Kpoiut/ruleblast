import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  GITHUB_COPILOT_CLI_PROFILE_ID,
  GOOGLE_GEMINI_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
} from "../model.js";

export const DEFAULT_REALITY_IDS = Object.freeze([
  OPENAI_CODEX_CLI_PROFILE_ID,
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
] as const);

export const OPT_IN_REALITY_IDS = Object.freeze([
  GITHUB_COPILOT_CLI_PROFILE_ID,
  GOOGLE_GEMINI_CLI_PROFILE_ID,
] as const);

export const MODELED_REALITY_IDS = Object.freeze([
  ...DEFAULT_REALITY_IDS,
  ...OPT_IN_REALITY_IDS,
]);

export function isOptInRealityId(value: string): boolean {
  return (OPT_IN_REALITY_IDS as readonly string[]).includes(value);
}
