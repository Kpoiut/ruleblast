import { describe, expect, it } from "vitest";
import { parseFrontmatterGlobs } from "../../src/packs/ops-frontmatter.js";
import { parseClaudeRule } from "../../src/packs/ops-glob.js";
import type { CapturedClaudeFile } from "../../src/packs/ops-markdown.js";

function file(path: string, text: string): CapturedClaudeFile {
  return {
    path,
    kind: "file",
    bytes: new TextEncoder().encode(text),
  };
}

describe("narrow YAML frontmatter globs", () => {
  it("accepts a string scalar, comma-split, or string sequence for Copilot applyTo", () => {
    expect(parseFrontmatterGlobs("---\napplyTo: src/**/*.ts\n---\nbody\n", "applyTo", false))
      .toEqual({ kind: "ok", patterns: ["src/**/*.ts"], body: "body\n" });
    expect(parseFrontmatterGlobs(
      "---\napplyTo: a.ts, b.ts\n---\n",
      "applyTo",
      false,
    )).toEqual({ kind: "ok", patterns: ["a.ts", "b.ts"], body: "" });
    expect(parseFrontmatterGlobs(
      "---\napplyTo:\n  - src/**\n  - test/**\n---\nkeep\n",
      "applyTo",
      false,
    )).toEqual({ kind: "ok", patterns: ["src/**", "test/**"], body: "keep\n" });
  });

  it("keeps extra Copilot mapping keys and fails closed on maps, aliases, and merge", () => {
    const extra = parseFrontmatterGlobs(
      "---\ndescription: x\napplyTo: '*.ts'\n---\n",
      "applyTo",
      false,
    );
    expect(extra).toEqual({ kind: "ok", patterns: ["*.ts"], body: "" });
    expect(parseFrontmatterGlobs("---\napplyTo:\n  nested: true\n---\n", "applyTo", false).kind)
      .toBe("malformed");
    expect(parseFrontmatterGlobs("---\napplyTo: &id src/**\n---\n", "applyTo", false).kind)
      .toBe("malformed");
    expect(parseFrontmatterGlobs(
      "---\nbase: { applyTo: '*.ts' }\n<<: *missing\n---\n",
      "applyTo",
      false,
    ).kind).toBe("malformed");
  });

  it("treats Claude paths as a sequence-only mapping and shares that decoder with rules", () => {
    expect(parseFrontmatterGlobs("---\npaths:\n  - src/**\n---\nrule\n", "paths", true))
      .toEqual({ kind: "ok", patterns: ["src/**"], body: "rule\n" });
    expect(parseFrontmatterGlobs("---\npaths: src/**\n---\n", "paths", true).kind)
      .toBe("malformed");
    expect(parseFrontmatterGlobs("---\ndescription: x\npaths:\n  - src/**\n---\n", "paths", true).kind)
      .toBe("malformed");
    const rule = parseClaudeRule(file(
      ".claude/rules/api.md",
      "---\npaths:\n  - src/api/**\n---\nUse the API rules.\n",
    ));
    expect(rule.malformed).toBe(false);
    expect(rule.patterns).toEqual(["src/api/**"]);
    expect(rule.body).toBe("Use the API rules.\n");
  });

  it("returns absent with original body when there is no frontmatter fence", () => {
    expect(parseFrontmatterGlobs("plain\n", "applyTo", false))
      .toEqual({ kind: "absent", body: "plain\n" });
  });
});
