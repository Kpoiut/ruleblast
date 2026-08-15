import type { SourceDisposition } from "../model.js";

export interface WitnessHint {
  readonly rule: string;
  readonly inputs: readonly string[];
  readonly detail: string;
}

const HINTS: Readonly<Record<string, Partial<Record<SourceDisposition, WitnessHint>>>> = {
  "openai/codex-cli@1": {
    SHADOWED: {
      rule: "same-directory-override-precedence",
      inputs: ["AGENTS.override.md"],
      detail: "AGENTS.override.md wins the same directory; AGENTS.md is explanatory only.",
    },
  },
  "anthropic/claude-code-cli@1": {
    EXCLUDED: {
      rule: "documented-exclusion",
      inputs: [],
      detail: "Claude Code documented exclusion removed this source from contribution.",
    },
  },
};

export function packWitnessHint(
  profile: string,
  disposition: SourceDisposition,
  sourcePath: string,
): WitnessHint | null {
  const hint = HINTS[profile]?.[disposition];
  if (hint === undefined) return null;
  return {
    rule: hint.rule,
    inputs: hint.inputs.length === 0 ? [sourcePath] : [sourcePath, ...hint.inputs],
    detail: hint.detail,
  };
}
