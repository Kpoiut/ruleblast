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
    expect(skill).toContain("npx --yes ruleblast@1.6.2");
    expect(skill).toContain("There is no `ruleblast scan` subcommand");
    expect(skill).toMatch(/RULEBLAST_AGENT_ALLOW|\.ruleblast-allow/u);
    expect(skill).toMatch(/ask/iu);
    expect(skill).not.toMatch(/npx --yes ruleblast@1\.3\.0 scan\b/u);
    expect(read("AGENT_USAGE.md")).toContain("not discovered from `node_modules`");
    expect(read("AGENT_USAGE.md")).toContain(".ruleblast-allow");
    expect(skill).toMatch(/affected path/iu);
    expect(skill).toMatch(/instruction source/iu);
    expect(skill).toMatch(/overlap/iu);
    expect(skill).not.toMatch(/exact cause/iu);
  });

  it("ships the same protocol at the official Claude Code project skill path", () => {
    const claudePath = ".claude/skills/ruleblast/SKILL.md";
    const codexPath = ".agents/skills/ruleblast/SKILL.md";
    expect(existsSync(join(repositoryRoot, claudePath))).toBe(true);
    const claude = read(claudePath);
    const codex = read(codexPath);
    expect(claude).toContain("There is no `ruleblast scan` subcommand");
    expect(claude).toContain(".ruleblast-allow");
    expect(claude).toContain("npx --yes ruleblast@1.6.2");
    expect(claude).toContain(".claude/skills");
    expect(codex).toContain(".claude/skills");
    expect(read("AGENT_USAGE.md")).toContain(".claude/skills");
    expect(read("README.md")).toContain(".claude/skills/ruleblast/SKILL.md");
    expect(read("README.md")).toContain("https://code.claude.com/docs/en/skills");
  });

  it("wraps the published CLI in a nested composite action without a Marketplace root action", () => {
    const actionPath = ".github/actions/ruleblast/action.yml";
    expect(existsSync(join(repositoryRoot, "action.yml"))).toBe(false);
    expect(existsSync(join(repositoryRoot, actionPath))).toBe(true);
    const action = read(actionPath);
    expect(action).toContain("using: composite");
    expect(action).toContain('npx --yes "ruleblast@${RULEBLAST_VERSION}"');
    expect(action).toContain("--receipt");
    expect(action).not.toMatch(/ruleblast scan\b/u);
    expect(action).toMatch(/not a hosted product|not a marketplace action/iu);
    expect(read(".github/workflows/ruleblast-pr.yml")).toContain(
      "uses: ./.github/actions/ruleblast",
    );
    expect(read("README.md")).toContain(
      "uses: Kpoiut/ruleblast/.github/actions/ruleblast@main",
    );
    expect(read("README.md")).not.toMatch(/uses: Kpoiut\/ruleblast@main\s*$/mu);
  });
});
