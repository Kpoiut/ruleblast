import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cli = readFileSync(new URL("../src/cli.ts", import.meta.url), "utf8");

describe("packed CLI startup", () => {
  it("does not statically import analysis, Git capture, MCP, or the case receipt", () => {
    expect(cli).not.toMatch(/from ["']\.\/mcp-stdio\.js["']/u);
    expect(cli).not.toMatch(/from ["']\.\/cli-actions\.js["']/u);
    expect(cli).not.toMatch(/from ["']\.\/impact\.js["']/u);
    expect(cli).not.toMatch(/from ["']\.\/git\.js["']/u);
    expect(cli).not.toMatch(/from ["']\.\/case\.js["']/u);
    expect(cli).not.toMatch(/from ["']\.\/application\/authority\.js["']/u);
    expect(cli).not.toMatch(/^import .+ from ["']\.\/cli-output\.js["']/mu);
    expect(cli).toContain("import(\"./mcp-stdio.js\")");
    expect(cli).toContain("import(\"./cli-actions.js\")");
  });
});
