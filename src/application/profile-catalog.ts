import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  GOOGLE_GEMINI_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
  parseProfileId,
  type ProfileId,
} from "../model.js";
import { compareCodePoints } from "../domain/repository-path.js";
import { claudeProfile } from "../profiles/claude.js";
import { codexProfile } from "../profiles/codex.js";
import { copilotProfile, GITHUB_COPILOT_CLI_PROFILE_ID } from "../profiles/copilot.js";
import { geminiProfile } from "../profiles/gemini.js";
import type { ProfileDefinition } from "../profiles/profile.js";

export type ProfileAdmission = "default" | "opt-in";

export type SurfaceKind = "MODELED" | "HOSTED" | "DISCOVERABLE";

export interface ProfilePresentation {
  readonly id: ProfileId;
  readonly label: string;
  readonly shortLabel: string;
  readonly badge: string;
  readonly admission: ProfileAdmission;
}

export interface CatalogEntry extends ProfilePresentation {
  readonly definition: ProfileDefinition;
}

export const PROFILE_CATALOG: readonly CatalogEntry[] = Object.freeze([
  Object.freeze({
    id: ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
    label: "Claude Code CLI",
    shortLabel: "Claude Code",
    badge: "CC",
    admission: "default",
    definition: claudeProfile,
  }),
  Object.freeze({
    id: OPENAI_CODEX_CLI_PROFILE_ID,
    label: "Codex CLI",
    shortLabel: "Codex",
    badge: "CX",
    admission: "default",
    definition: codexProfile,
  }),
  Object.freeze({
    id: GITHUB_COPILOT_CLI_PROFILE_ID,
    label: "GitHub Copilot CLI",
    shortLabel: "Copilot",
    badge: "CP",
    admission: "opt-in",
    definition: copilotProfile,
  }),
  Object.freeze({
    id: GOOGLE_GEMINI_CLI_PROFILE_ID,
    label: "Gemini CLI",
    shortLabel: "Gemini",
    badge: "GM",
    admission: "opt-in",
    definition: geminiProfile,
  }),
]);

export function presentationLabel(id: string): string {
  const presentation = presentationFor(id);
  return `${presentation.badge} ${presentation.shortLabel}`;
}

export function presentationFor(id: string): ProfilePresentation {
  const entry = PROFILE_CATALOG.find((item) => item.id === id);
  if (entry === undefined) {
    return Object.freeze({
      id: parseProfileId(id),
      label: id,
      shortLabel: id,
      badge: "??",
      admission: "opt-in",
    });
  }
  return Object.freeze({
    id: entry.id,
    label: entry.label,
    shortLabel: entry.shortLabel,
    badge: entry.badge,
    admission: entry.admission,
  });
}

export function defaultProfileDefinitions(): readonly ProfileDefinition[] {
  return Object.freeze(
    PROFILE_CATALOG
      .filter((entry) => entry.admission === "default")
      .sort((left, right) => compareCodePoints(left.id, right.id))
      .map((entry) => entry.definition),
  );
}

export function optInRealityIds(): readonly string[] {
  return Object.freeze(
    PROFILE_CATALOG
      .filter((entry) => entry.admission === "opt-in")
      .map((entry) => entry.id)
      .sort(compareCodePoints),
  );
}

export function isOptInReality(value: string): boolean {
  return optInRealityIds().includes(value);
}

export function profilesForReality(reality: string | null): readonly ProfileDefinition[] {
  const defaults = defaultProfileDefinitions();
  if (reality === null) return defaults;
  const extra = PROFILE_CATALOG.find(
    (entry) => entry.admission === "opt-in" && entry.id === reality,
  );
  if (extra === undefined) {
    throw new TypeError(`Unknown opt-in reality: ${JSON.stringify(reality)}`);
  }
  return Object.freeze(
    [...defaults, extra.definition].sort((left, right) =>
      compareCodePoints(left.id, right.id),
    ),
  );
}
