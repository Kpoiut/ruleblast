import { describe, expect, it } from "vitest";
import { CliUsageError, parseArgs } from "../src/args.js";

const text = { kind: "text", color: "auto" } as const;
const json = { kind: "json", color: "auto" } as const;
const flags = {
  witness: false, receipt: false, realities: [] as const, pathsOnly: false,
  detail: false, index: false,
} as const;
const explainFlags = { ...flags, compare: false } as const;

describe("parseArgs", () => {
  it.each([
    [[], { action: "scan", startPath: ".", output: text, ...flags }],
    [["."], { action: "scan", startPath: ".", output: text, ...flags }],
    [["scan", "--json"], { action: "scan", startPath: "scan", output: json, ...flags }],
    [["src", "--color=always"], {
      action: "scan", startPath: "src", output: { kind: "text", color: "always" }, ...flags,
    }],
    [["diff"], {
      action: "diff",
      base: { kind: "git", ref: "HEAD" },
      target: { kind: "worktree" },
      output: text,
      ...flags,
    }],
    [["diff", "HEAD~1", "--to", "release", "--json"], {
      action: "diff",
      base: { kind: "git", ref: "HEAD~1" },
      target: { kind: "git", ref: "release" },
      output: json,
      ...flags,
    }],
    [["diff", "HEAD", "--to", "-release"], {
      action: "diff",
      base: { kind: "git", ref: "HEAD" },
      target: { kind: "git", ref: "-release" },
      output: text,
      ...flags,
    }],
    [["explain", "src\\nested//./index.ts"], {
      action: "explain",
      path: "src/nested/index.ts",
      from: null,
      target: { kind: "worktree" },
      output: text,
      ...explainFlags,
    }],
    [["explain", "src/index.ts", "--from", "HEAD~1", "--to", "HEAD"], {
      action: "explain",
      path: "src/index.ts",
      from: { kind: "git", ref: "HEAD~1" },
      target: { kind: "git", ref: "HEAD" },
      output: text,
      ...explainFlags,
    }],
    [["explain", "file.ts", "--from", "-release"], {
      action: "explain",
      path: "file.ts",
      from: { kind: "git", ref: "-release" },
      target: { kind: "worktree" },
      output: text,
      ...explainFlags,
    }],
    [["explain", "src/a.ts", "--compare"], {
      action: "explain",
      path: "src/a.ts",
      from: null,
      target: { kind: "worktree" },
      output: text,
      ...explainFlags,
      compare: true,
    }],
    [["diff", "--index"], {
      action: "diff",
      base: { kind: "git", ref: "HEAD" },
      target: { kind: "worktree" },
      output: text,
      ...flags,
      index: true,
    }],
    [["diff", "--paths-only"], {
      action: "diff",
      base: { kind: "git", ref: "HEAD" },
      target: { kind: "worktree" },
      output: text,
      ...flags,
      pathsOnly: true,
    }],
    [[".", "--paths-only"], {
      action: "scan", startPath: ".", output: text, ...flags, pathsOnly: true,
    }],
    [["case", "--paths-only"], {
      action: "case", explainPath: null, output: text, ...flags, pathsOnly: true,
    }],
    [["diff", "--detail"], {
      action: "diff",
      base: { kind: "git", ref: "HEAD" },
      target: { kind: "worktree" },
      output: text,
      ...flags,
      detail: true,
    }],
    [["explain", "src/a.ts", "--detail"], {
      action: "explain",
      path: "src/a.ts",
      from: null,
      target: { kind: "worktree" },
      output: text,
      ...explainFlags,
      detail: true,
    }],
    [["case"], { action: "case", explainPath: null, output: text, ...flags }],
    [["case", "--explain", "packages\\api//./refund.ts", "--json"], {
      action: "case", explainPath: "packages/api/refund.ts", output: json, ...flags,
    }],
    [["--mcp"], { action: "mcp" }],
    [["demo"], { action: "case", explainPath: null, output: text, ...flags }],
    [["demo", "--explain", "packages\\api//./refund.ts", "--json"], {
      action: "case", explainPath: "packages/api/refund.ts", output: json, ...flags,
    }],
    [["demo", "--explain", "-file.ts"], {
      action: "case", explainPath: "-file.ts", output: text, ...flags,
    }],
    [[".", "--witness"], {
      action: "scan", startPath: ".", output: text, witness: true, receipt: false,
      realities: [], pathsOnly: false, detail: false, index: false,
    }],
    [["diff", "--witness", "--json"], {
      action: "diff",
      base: { kind: "git", ref: "HEAD" },
      target: { kind: "worktree" },
      output: json,
      witness: true,
      receipt: false,
      realities: [],
      pathsOnly: false,
      detail: false,
      index: false,
    }],
    [["case", "--receipt"], {
      action: "case", explainPath: null, output: text, witness: false, receipt: true,
      realities: [], pathsOnly: false, detail: false, index: false,
    }],
    [[".", "--detail", "--witness"], {
      action: "scan", startPath: ".", output: text, witness: true, receipt: false,
      realities: [], pathsOnly: false, detail: true, index: false,
    }],
    [[".", "--reality", "github/copilot-cli@1"], {
      action: "scan", startPath: ".", output: text, ...flags, realities: ["github/copilot-cli@1"],
    }],
    [[".", "--reality", "google/gemini-cli@1"], {
      action: "scan", startPath: ".", output: text, ...flags, realities: ["google/gemini-cli@1"],
    }],
    [[".", "--reality", "google/gemini-cli@1", "--reality", "github/copilot-cli@1"], {
      action: "scan",
      startPath: ".",
      output: text,
      ...flags,
      realities: ["github/copilot-cli@1", "google/gemini-cli@1"],
    }],
    [["--help"], { action: "help" }],
    [["--version"], { action: "version" }],
  ] as const)("parses %j", (argv, expected) => {
    expect(parseArgs(argv)).toEqual(expected);
  });

  it.each([
    [["--mcp", "."], "OPTION_CONFLICT"],
    [["--wat\nforge"], "UNKNOWN_OPTION"],
    [["diff", "HEAD", "extra"], "EXTRA_POSITIONAL"],
    [["demo", "extra"], "EXTRA_POSITIONAL"],
    [["explain"], "MISSING_PATH"],
    [["explain", ""], "INVALID_PATH"],
    [["explain", "."], "INVALID_PATH"],
    [["explain", "../secret"], "INVALID_PATH"],
    [["explain", "a/../secret"], "INVALID_PATH"],
    [["explain", "/absolute"], "INVALID_PATH"],
    [["explain", "C:\\absolute"], "INVALID_PATH"],
    [["explain", "C:relative"], "INVALID_PATH"],
    [["explain", "./C:relative"], "INVALID_PATH"],
    [["explain", ".\\C:relative"], "INVALID_PATH"],
    [["explain", "./C:/absolute"], "INVALID_PATH"],
    [["explain", "\\\\server\\share"], "INVALID_PATH"],
    [["explain", "bad\0path"], "INVALID_PATH"],
    [["diff", ""], "INVALID_REF"],
    [["diff", "bad\0ref"], "INVALID_REF"],
    [["diff", "WORKTREE"], "INVALID_REF"],
    [["explain", "file.ts", "--from", "WORKTREE"], "INVALID_REF"],
    [["diff", "HEAD", "--to", "HEAD"], "IDENTICAL_ENDPOINTS"],
    [["explain", "file.ts", "--from", "HEAD", "--to", "HEAD"], "IDENTICAL_ENDPOINTS"],
    [["diff", "--to"], "MISSING_OPTION_VALUE"],
    [["diff", "--to", "--json"], "MISSING_OPTION_VALUE"],
    [["demo", "--explain", "--json"], "MISSING_OPTION_VALUE"],
    [["diff", "--json", "--json"], "DUPLICATE_OPTION"],
    [[".", "--witness", "--witness"], "DUPLICATE_OPTION"],
    [[".", "--receipt", "--receipt"], "DUPLICATE_OPTION"],
    [[".", "--reality", "github/copilot-vscode@1"], "OPTION_CONFLICT"],
    [[".", "--reality", "cursor/editor@1"], "OPTION_CONFLICT"],
    [[".", "--reality", "grok-4"], "OPTION_CONFLICT"],
    [[".", "--reality", "cursor/composer@1"], "OPTION_CONFLICT"],
    [[".", "--reality", "zai/glm-5.3@1"], "OPTION_CONFLICT"],
    [[".", "--reality", "xai/grok-build-cli"], "OPTION_CONFLICT"],
    [[".", "--pack", "qwen"], "UNKNOWN_OPTION"],
    [[".", "--reality", "all"], "OPTION_CONFLICT"],
    [["case", "--reality", "github/copilot-cli@1"], "OPTION_CONFLICT"],
    [[".", "--reality", "github/copilot-cli@1", "--reality", "github/copilot-cli@1"], "DUPLICATE_OPTION"],
    [["diff", "--to", "one", "--to", "two"], "DUPLICATE_OPTION"],
    [["diff", "--json", "--color=always"], "OPTION_CONFLICT"],
    [["scan", "--color=rainbow"], "OPTION_CONFLICT"],
    [["diff", "--paths-only", "--json"], "OPTION_CONFLICT"],
    [[".", "--paths-only", "--witness"], "OPTION_CONFLICT"],
    [["explain", "src/a.ts", "--paths-only"], "OPTION_CONFLICT"],
    [["diff", "--index", "--json"], "OPTION_CONFLICT"],
    [[".", "--index", "--paths-only"], "OPTION_CONFLICT"],
    [["explain", "src/a.ts", "--index"], "OPTION_CONFLICT"],
    [["case", "--explain", "src/a.ts", "--index"], "OPTION_CONFLICT"],
    [[".", "--index", "--index"], "DUPLICATE_OPTION"],
    [["explain", "src/a.ts", "--compare", "--json"], "OPTION_CONFLICT"],
    [["diff", "--compare"], "OPTION_CONFLICT"],
    [["case", "--explain", "src/a.ts", "--paths-only"], "OPTION_CONFLICT"],
    [["diff", "--detail", "--json"], "OPTION_CONFLICT"],
    [[".", "--detail", "--paths-only"], "OPTION_CONFLICT"],
    [["explain", "src/a.ts", "--detail", "--compare"], "OPTION_CONFLICT"],
    [["case", "--detail", "--receipt"], "OPTION_CONFLICT"],
    [[".", "--detail", "--detail"], "DUPLICATE_OPTION"],
  ] as const)("rejects %j with %s", (argv, code) => {
    let thrown: unknown;
    try {
      parseArgs(argv);
    } catch (error: unknown) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CliUsageError);
    expect(thrown).toMatchObject({ code });
    expect((thrown as Error).message).not.toContain("\nforge");
  });

  it("captures hostile argument data once without invoking getters", () => {
    const hostile = ["diff"];
    Object.defineProperty(hostile, "0", {
      configurable: true,
      enumerable: true,
      get: () => { throw new Error("getter executed"); },
    });
    expect(() => parseArgs(hostile)).toThrowError(
      expect.objectContaining({ code: "INVALID_ARGUMENT_VECTOR" }),
    );
  });
});
