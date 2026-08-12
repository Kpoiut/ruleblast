import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const publicPlan = join(
  repositoryRoot,
  "docs/superpowers/plans/2026-08-12-ruleblast-v1-implementation.md",
);

function readRepositoryFile(path: string): string {
  return readFileSync(join(repositoryRoot, path), "utf8");
}

describe("public documentation boundary", () => {
  it("keeps the implementation plan local-only", () => {
    expect(existsSync(publicPlan)).toBe(false);

    const publicDocs = [
      "README.md",
      "CONTRIBUTING.md",
      "ROADMAP.md",
      "docs/superpowers/specs/2026-08-12-ruleblast-design.md",
    ].map(readRepositoryFile).join("\n");

    expect(publicDocs).not.toContain("docs/superpowers/plans/");
    expect(publicDocs).not.toContain("ruleblast-v1-implementation");
  });

  it("labels roadmap maturity without calendar promises", () => {
    const roadmap = readRepositoryFile("ROADMAP.md");

    for (const label of [
      "SHIPPED TO MAIN",
      "IN BUILD",
      "NEXT",
      "HORIZON",
      "EXPLORING",
    ]) {
      expect(roadmap).toContain(`**${label}**`);
    }

    expect(roadmap).not.toMatch(/^\s*-\s+\[\s\]/mu);
    expect(roadmap).not.toMatch(/\bcoming soon\b|\bQ[1-4]\b|\b20\d{2}-\d{2}-\d{2}\b/iu);
  });
});
