export const CALIBRATION_PACK_IDS = Object.freeze([
  "openai/codex-cli@1",
  "anthropic/claude-code-cli@1",
  "google/gemini-cli@1",
  "github/copilot-cli@1",
] as const);

export type CalibrationPackId = (typeof CALIBRATION_PACK_IDS)[number];

export interface LoadedFile {
  readonly path: string;
  readonly text: string;
}

export interface TargetObservation {
  readonly loadedPaths: readonly string[];
  readonly loadedTexts: readonly string[];
  readonly vendorAssembly: string;
  readonly truncated: boolean;
}

export function assembleObservation(
  packId: CalibrationPackId,
  loaded: readonly LoadedFile[],
): string {
  if (packId === "google/gemini-cli@1") {
    return loaded
      .map((item) => {
        const trimmed = item.text.trim();
        if (trimmed.length === 0) return null;
        return `--- Context from: ${item.path} ---\n${trimmed}\n--- End of Context from: ${item.path} ---`;
      })
      .filter((block): block is string => block !== null)
      .join("\n\n");
  }
  return loaded.map((item) => item.text).filter((text) => text !== "").join("\n\n");
}

export function makeObservation(
  packId: CalibrationPackId,
  loaded: readonly LoadedFile[],
  truncated: boolean,
): TargetObservation {
  return {
    loadedPaths: loaded.map((item) => item.path),
    loadedTexts: loaded.map((item) => item.text),
    vendorAssembly: assembleObservation(packId, loaded),
    truncated,
  };
}
