import { describe, expect, it } from "vitest";
import { CliUsageError, parseArgs } from "../src/args.js";

const text = { kind: "text", color: "auto" } as const;
const json = { kind: "json", color: "auto" } as const;
const flags = { witness: false, receipt: false, reality: null } as const;

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
      ...flags,
    }],
    [["explain", "src/index.ts", "--from", "HEAD~1", "--to", "HEAD"], {
      action: "explain",
      path: "src/index.ts",
      from: { kind: "git", ref: "HEAD~1" },
      target: { kind: "git", ref: "HEAD" },
      output: text,
      ...flags,
    }],
    [["explain", "file.ts", "--from", "-release"], {
      action: "explain",
      path: "file.ts",
      from: { kind: "git", ref: "-release" },
      target: { kind: "worktree" },
      output: text,
      ...flags,
    }],
    [["case"], { action: "case", explainPath: null, output: text, ...flags }],
    [["case", "--explain", "packages\\api//./refund.ts", "--json"], {
      action: "case", explainPath: "packages/api/refund.ts", output: json, ...flags,
    }],
    [["demo"], { action: "case", explainPath: null, output: text, ...flags }],
    [["demo", "--explain", "packages\\api//./refund.ts", "--json"], {
      action: "case", explainPath: "packages/api/refund.ts", output: json, ...flags,
    }],
    [["demo", "--explain", "-file.ts"], {
      action: "case", explainPath: "-file.ts", output: text, ...flags,
    }],
    [[".", "--witness"], {
      action: "scan", startPath: ".", output: text, witness: true, receipt: false,
      reality: null,
    }],
    [["diff", "--witness", "--json"], {
      action: "diff",
      base: { kind: "git", ref: "HEAD" },
      target: { kind: "worktree" },
      output: json,
      witness: true,
      receipt: false,
      reality: null,
    }],
    [["case", "--receipt"], {
      action: "case", explainPath: null, output: text, witness: false, receipt: true,
      reality: null,
    }],
    [[".", "--reality", "github/copilot-cli@1"], {
      action: "scan", startPath: ".", output: text, ...flags, reality: "github/copilot-cli@1",
    }],
    [[".", "--reality", "google/gemini-cli@1"], {
      action: "scan", startPath: ".", output: text, ...flags, reality: "google/gemini-cli@1",
    }],
    [["--help"], { action: "help" }],
    [["--version"], { action: "version" }],
  ] as const)("parses %j", (argv, expected) => {
    expect(parseArgs(argv)).toEqual(expected);
  });

  it.each([
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
    [["case", "--reality", "github/copilot-cli@1"], "OPTION_CONFLICT"],
    [["diff", "--to", "one", "--to", "two"], "DUPLICATE_OPTION"],
    [["diff", "--json", "--color=always"], "OPTION_CONFLICT"],
    [["scan", "--color=rainbow"], "OPTION_CONFLICT"],
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
