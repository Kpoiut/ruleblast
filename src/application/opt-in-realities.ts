export const OPT_IN_REALITY_IDS = Object.freeze([
  "github/copilot-cli@1",
  "google/gemini-cli@1",
] as const);

export function isOptInRealityId(value: string): boolean {
  return (OPT_IN_REALITY_IDS as readonly string[]).includes(value);
}
