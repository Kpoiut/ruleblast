import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/args.js";
import { renderCliHelp, routeCatalog } from "../src/cli-help.js";
import { runCli } from "../src/cli.js";

describe("route catalog", () => {
  it("freezes the four existing routes in scan/diff/explain/case order", () => {
    const routes = routeCatalog();
    expect(routes.map((route) => route.id)).toEqual(["scan", "diff", "explain", "case"]);
    expect(Object.isFrozen(routes)).toBe(true);
    for (const route of routes) {
      expect(parseArgs([...route.exampleArgv]).action).toBe(route.action);
    }
  });

  it("never documents an explicit scan subcommand", () => {
    expect(renderCliHelp()).not.toMatch(/ruleblast scan\b/u);
    expect(parseArgs(["scan"])).toMatchObject({ action: "scan", startPath: "scan" });
  });

  it("teaches last-commit diff without --from and keeps case as the teaching receipt", () => {
    const help = renderCliHelp();
    expect(help).toContain("ruleblast diff HEAD~1 --to HEAD --color=never");
    expect(help).not.toContain("diff --from");
    expect(help).toContain("33→106");
    expect(help).toContain("not the 206 Codex proof");
    expect(help).toContain("not \"every path COMPLETE\"");
  });
});

describe("help path", () => {
  it("prints semantic help on stdout without touching a repository", async () => {
    const stdout: string[] = [];
    const code = await runCli(["--help"], {
      stdout: (text) => { stdout.push(text); },
      stderr: () => { throw new Error("help must not write stderr"); },
      cwd: () => { throw new Error("help must not read cwd"); },
      env: {},
      stdoutIsTTY: false,
    });
    expect(code).toBe(0);
    expect(stdout.join("")).toBe(renderCliHelp());
    expect(stdout.join("")).toContain("Two documented instruction realities");
  });
});
