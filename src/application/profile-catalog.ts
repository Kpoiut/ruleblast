import { isOptInRealityId } from "./opt-in-realities.js";
import {
  parseProfileId,
  type ProfileId,
} from "../model.js";
import { compareCodePoints } from "../domain/repository-path.js";
import { InvalidPackError } from "../packs/compile.js";
import { bundledDirectoryForPackId, loadBundledPack } from "../packs/load.js";
import { profileFromCompiledPack } from "../packs/profile.js";
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

function catalogEntry(directoryName: string, admission: ProfileAdmission): CatalogEntry {
  const compiled = loadBundledPack(directoryName);
  const expected = bundledDirectoryForPackId(compiled.pack.id);
  if (expected !== directoryName) {
    throw new InvalidPackError(
      `bundled directory ${JSON.stringify(directoryName)} does not match pack id ${JSON.stringify(compiled.pack.id)}`,
    );
  }
  return Object.freeze({
    id: parseProfileId(compiled.pack.id),
    label: compiled.pack.label,
    shortLabel: compiled.pack.shortLabel,
    badge: compiled.pack.badge,
    admission,
    definition: profileFromCompiledPack(compiled),
  });
}

export const PROFILE_CATALOG: readonly CatalogEntry[] = Object.freeze([
  catalogEntry("anthropic-claude-code-cli@1", "default"),
  catalogEntry("openai-codex-cli@1", "default"),
  catalogEntry("github-copilot-cli@1", "opt-in"),
  catalogEntry("google-gemini-cli@1", "opt-in"),
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
  return isOptInRealityId(value);
}

export function profilesForRealities(
  realities: readonly string[],
): readonly ProfileDefinition[] {
  const defaults = defaultProfileDefinitions();
  if (realities.length === 0) return defaults;
  const extras = [...new Set(realities)].sort(compareCodePoints);
  const found = extras.map((id) => {
    const extra = PROFILE_CATALOG.find(
      (entry) => entry.admission === "opt-in" && entry.id === id,
    );
    if (extra === undefined) {
      throw new TypeError(`Unknown opt-in reality: ${JSON.stringify(id)}`);
    }
    return extra.definition;
  });
  return Object.freeze(
    [...defaults, ...found].sort((left, right) =>
      compareCodePoints(left.id, right.id),
    ),
  );
}

export function profilesForReality(reality: string | null): readonly ProfileDefinition[] {
  return profilesForRealities(reality === null ? [] : [reality]);
}
