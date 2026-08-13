import { describe, expect, it } from "vitest";
import { CliUsageError, parseArgs } from "../src/args.js";

const text = { kind: "text", color: "auto" } as const;
const json = { kind: "json", color: "auto" } as const;

describe("parseArgs", () => {
  it.each([
    [[], { action: "scan", startPath: ".", output: text }],
    [["."], { action: "scan", startPath: ".", output: text }],
    [["scan", "--json"], { action: "scan", startPath: "scan", output: json }],
    [["src", "--color=always"], {
      action: "scan", startPath: "src", output: { kind: "text", color: "always" },
    }],
    [["diff"], {
      action: "diff",
      base: { kind: "git", ref: "HEAD" },
      target: { kind: "worktree" },
      output: text,
    }],
    [["diff", "HEAD~1", "--to", "release", "--json"], {
      action: "diff",
      base: { kind: "git", ref: "HEAD~1" },
      target: { kind: "git", ref: "release" },
      output: json,
    }],
    [["diff", "HEAD", "--to", "-release"], {
      action: "diff",
      base: { kind: "git", ref: "HEAD" },
      target: { kind: "git", ref: "-release" },
      output: text,
    }],
    [["explain", "src\\nested//./index.ts"], {
      action: "explain",
      path: "src/nested/index.ts",
      from: null,
      target: { kind: "worktree" },
      output: text,
    }],
    [["explain", "src/index.ts", "--from", "HEAD~1", "--to", "HEAD"], {
      action: "explain",
      path: "src/index.ts",
      from: { kind: "git", ref: "HEAD~1" },
      target: { kind: "git", ref: "HEAD" },
      output: text,
    }],
    [["explain", "file.ts", "--from", "-release"], {
      action: "explain",
      path: "file.ts",
      from: { kind: "git", ref: "-release" },
      target: { kind: "worktree" },
      output: text,
    }],
    [["case"], { action: "case", explainPath: null, output: text }],
    [["case", "--explain", "packages\\api//./refund.ts", "--json"], {
      action: "case", explainPath: "packages/api/refund.ts", output: json,
    }],
    [["demo"], { action: "case", explainPath: null, output: text }],
    [["demo", "--explain", "packages\\api//./refund.ts", "--json"], {
      action: "case", explainPath: "packages/api/refund.ts", output: json,
    }],
    [["demo", "--explain", "-file.ts"], {
      action: "case", explainPath: "-file.ts", output: text,
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
