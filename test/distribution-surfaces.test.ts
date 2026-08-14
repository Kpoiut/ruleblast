import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path: string): string =>
  readFileSync(join(repositoryRoot, path), "utf8");

describe("distribution surfaces", () => {
  it("ships a repository skill that Codex can discover", () => {
    const skillPath = ".agents/skills/ruleblast/SKILL.md";
    expect(existsSync(join(repositoryRoot, skillPath))).toBe(true);
    const skill = read(skillPath);
    expect(skill).toMatch(/^---\r?\nname: ruleblast\r?\n/u);
    expect(skill).toContain("Use when");
    expect(skill).toContain("npx --yes ruleblast@1.3.0");
    expect(skill).toContain("There is no `ruleblast scan` subcommand");
    expect(skill).not.toMatch(/npx --yes ruleblast@1\.3\.0 scan\b/u);
    expect(read("AGENT_USAGE.md")).toContain("not discovered from `node_modules`");
  });

  it("wraps the published CLI in a composite action without a fifth command", () => {
    const action = read("action.yml");
    expect(action).toContain("using: composite");
    expect(action).toContain('npx --yes "ruleblast@${RULEBLAST_VERSION}"');
    expect(action).toContain("--receipt");
    expect(action).not.toMatch(/ruleblast scan\b/u);
    expect(read(".github/workflows/ruleblast-pr.yml")).toContain("uses: ./");
  });
});
