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
    expect(skill).toContain("npx --yes ruleblast@2.5.1");
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
    expect(claude).toContain("npx --yes ruleblast@2.5.1");
    expect(claude).toContain(".claude/skills");
    expect(codex).toContain(".claude/skills");
    expect(read("AGENT_USAGE.md")).toContain(".claude/skills");
    expect(read("README.md")).toContain(".claude/skills/ruleblast/SKILL.md");
    expect(read("README.md")).toContain("https://code.claude.com/docs/en/skills");
  });

  it("exposes the published CLI as a root Action that still delegates to the nested composite", () => {
    const nestedPath = ".github/actions/ruleblast/action.yml";
    expect(existsSync(join(repositoryRoot, "action.yml"))).toBe(true);
    expect(existsSync(join(repositoryRoot, nestedPath))).toBe(true);
    const root = read("action.yml");
    const nested = read(nestedPath);
    expect(root).toContain("using: composite");
    expect(root).toContain("uses: ./.github/actions/ruleblast");
    expect(root).toMatch(/blast radius of AGENTS.md and CLAUDE.md/u);
    expect(root).toMatch(/pull-request runner/iu);
    const rootDescription = /^description:\s*(.+)$/mu.exec(root)?.[1] ?? "";
    expect(rootDescription.length).toBeGreaterThan(0);
    expect(rootDescription.length).toBeLessThan(125);
    expect(root).not.toMatch(/ruleblast scan\b/u);
    expect(nested).toContain('npx --yes "ruleblast@${RULEBLAST_VERSION}"');
    expect(nested).toContain("--receipt");
    expect(nested).toMatch(/default: "2\.5\.1"/u);
    expect(nested).not.toMatch(/default: "2\.4\.0"/u);
    expect(read(".github/workflows/ruleblast-pr.yml")).toContain(
      "uses: ./.github/actions/ruleblast",
    );
    expect(read("README.md")).toContain("uses: Kpoiut/ruleblast@v2.5.1");
    expect(read("README.md")).not.toMatch(/uses: Kpoiut\/ruleblast@main\s*$/mu);
  });

  it("ships independent retrieval documents for problem queries, not brand queries", () => {
    const problem = read("which-files-inherit-agents-md.md");
    expect(problem).toMatch(/^# Which files inherit a changed AGENTS.md\?/u);
    expect(problem).toMatch(/blast radius/iu);
    expect(problem).toContain("CLAUDE.md");
    expect(problem).toContain("206");
    expect(problem).toContain("PROOF.md");
    expect(problem).toContain("https://github.com/Kpoiut/ruleblast");
    expect(problem).not.toMatch(/all agents|model compliance is proven/iu);
    const llms = read("llms.txt");
    expect(llms).toContain("blast radius of AGENTS.md and CLAUDE.md");
    expect(llms).toContain("https://github.com/Kpoiut/ruleblast");
    expect(llms).toContain("https://www.npmjs.com/package/ruleblast");
    const citation = read("CITATION.cff");
    expect(citation).toMatch(/^cff-version:/u);
    expect(citation).toContain("RuleBlast");
    expect(citation).toContain("blast radius");
    expect(read("README.md")).toContain("which-files-inherit-agents-md.md");
    const descriptor = JSON.parse(read("package.json")) as {
      readonly files?: readonly string[];
    };
    expect(descriptor.files).not.toContain("which-files-inherit-agents-md.md");
    expect(descriptor.files).not.toContain("llms.txt");
    expect(descriptor.files).not.toContain("CITATION.cff");
    expect(descriptor.files).not.toContain("action.yml");
    expect(descriptor.files).not.toContain("site");
  });

  it("ships a canonical landing page the project can submit to external indexes", () => {
    const html = read("site/index.html");
    expect(html).toContain('rel="canonical" href="https://kpoiut.github.io/ruleblast/"');
    expect(html).toContain("blast radius of AGENTS.md and CLAUDE.md");
    expect(html).toContain("which files inherit");
    expect(html).toContain("https://github.com/Kpoiut/ruleblast");
    expect(html).toContain("https://www.npmjs.com/package/ruleblast");
    expect(html).toContain("npx --yes ruleblast@2.5.1 .");
    expect(html).toContain("https://github.com/Kpoiut/ruleblast/releases/tag/v2.5.1");
    expect(html).toContain("SoftwareSourceCode");
    expect(html).toContain("og:title");
    expect(read("site/robots.txt")).toContain("Sitemap: https://kpoiut.github.io/ruleblast/sitemap.xml");
    expect(read("site/sitemap.xml")).toContain("https://kpoiut.github.io/ruleblast/");
    expect(existsSync(join(repositoryRoot, ".github/workflows/pages.yml"))).toBe(true);
    expect(read(".github/workflows/pages.yml")).toContain("upload-pages-artifact");
    expect(read("README.md")).toContain("https://kpoiut.github.io/ruleblast/");
  });
});
