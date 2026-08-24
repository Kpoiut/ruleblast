import type { CalibrationPackId } from "./observation.js";

const CODEX_BUDGET = 32 * 1024;

function utf8File(path: string, text: string): {
  readonly path: string;
  readonly kind: "file";
  readonly executable: false;
  readonly base64: string;
} {
  return {
    path,
    kind: "file",
    executable: false,
    base64: Buffer.from(text, "utf8").toString("base64"),
  };
}

export function calibrationManifest(
  label: string,
  files: ReadonlyArray<readonly [string, string]>,
): unknown {
  return {
    schemaVersion: 1,
    label,
    entries: files.map(([path, text]) => utf8File(path, text)),
  };
}

export function calibrationSnapshots(packId: CalibrationPackId): readonly unknown[] {
  if (packId === "openai/codex-cli@1") {
    return [
      calibrationManifest("codex-assembly", [
        ["AGENTS.md", "root\n"],
        ["services/AGENTS.md", "nested"],
        ["services/file.ts", "code\n"],
      ]),
      calibrationManifest("codex-override", [
        ["AGENTS.md", "root\n"],
        ["services/AGENTS.override.md", "over\n"],
        ["services/AGENTS.md", "hidden\n"],
        ["services/file.ts", "code\n"],
      ]),
      calibrationManifest("codex-empty", [
        ["AGENTS.md", "   \n"],
        ["src/file.ts", "code\n"],
      ]),
      calibrationManifest("codex-budget", [
        ["AGENTS.md", `${"x".repeat(CODEX_BUDGET)}TAIL`],
        ["services/AGENTS.md", "yy"],
        ["services/file.ts", "code\n"],
      ]),
    ];
  }
  if (packId === "google/gemini-cli@1") {
    return [
      calibrationManifest("gemini-hierarchy", [
        ["GEMINI.md", "root\n"],
        ["src/GEMINI.md", "nested\n"],
        ["src/file.ts", "code\n"],
      ]),
      calibrationManifest("gemini-import", [
        ["GEMINI.md", "@a.md\n"],
        ["a.md", "VALUE_B\n"],
        ["src/file.ts", "code\n"],
      ]),
      calibrationManifest("gemini-names", [
        [".gemini/settings.json", "{\"context\":{\"fileName\":\"CONTEXT.md\"}}\n"],
        ["GEMINI.md", "default\n"],
        ["CONTEXT.md", "extra\n"],
        ["src/file.ts", "code\n"],
      ]),
    ];
  }
  if (packId === "anthropic/claude-code-cli@1") {
    return [
      calibrationManifest("claude-ancestors", [
        ["CLAUDE.md", "root\n"],
        ["src/CLAUDE.md", "nested\n"],
        ["src/app.ts", "code\n"],
      ]),
      calibrationManifest("claude-comments", [
        ["CLAUDE.md", "keep\n<!-- secret -->\nmore\n"],
        ["src/app.ts", "code\n"],
      ]),
      calibrationManifest("claude-local", [
        ["CLAUDE.md", "root\n"],
        ["CLAUDE.local.md", "local\n"],
        ["src/app.ts", "code\n"],
      ]),
      calibrationManifest("claude-rules", [
        ["CLAUDE.md", "root\n"],
        [".claude/rules/ts.md", "---\npaths:\n  - \"**/*.ts\"\n---\nrule-body\n"],
        ["src/app.ts", "code\n"],
        ["README.md", "doc\n"],
      ]),
    ];
  }
  return [
    calibrationManifest("copilot-repo", [
      [".github/copilot-instructions.md", "repo-wide\n"],
      ["src/file.ts", "code\n"],
    ]),
    calibrationManifest("copilot-agents", [
      ["AGENTS.md", "agents\n"],
      ["CLAUDE.md", "claude\n"],
      ["src/file.ts", "code\n"],
    ]),
    calibrationManifest("copilot-dot-claude", [
      [".claude/CLAUDE.md", "nested-claude\n"],
      ["src/file.ts", "code\n"],
    ]),
    calibrationManifest("copilot-apply", [
      [
        ".github/instructions/ts.instructions.md",
        "---\napplyTo: \"**/*.ts\"\n---\nts-only\n",
      ],
      ["src/file.ts", "code\n"],
      ["README.md", "doc\n"],
    ]),
  ];
}
