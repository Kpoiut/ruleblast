import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

interface ExtractionReview {
  readonly path: string;
  readonly sha256: string;
  readonly reason: string;
  readonly followUp: string;
}

function walkSource(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkSource(path));
    else if (entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

function lineCount(text: string): number {
  if (text === "") return 0;
  const lines = text.split(/\r?\n/);
  return lines.at(-1) === "" ? lines.length - 1 : lines.length;
}

describe("extraction reviews", () => {
  it("binds over-limit production modules by path and content digest", () => {
    const document = JSON.parse(
      readFileSync(join(repositoryRoot, "EXTRACTION_REVIEWS.json"), "utf8"),
    ) as { readonly schemaVersion: unknown; readonly reviews: unknown };
    expect(document.schemaVersion).toBe(1);
    expect(Array.isArray(document.reviews)).toBe(true);
    const reviews = document.reviews as ExtractionReview[];
    for (const review of reviews) {
      expect(Object.keys(review).sort()).toEqual(["followUp", "path", "reason", "sha256"]);
      expect(review.path.startsWith("src/")).toBe(true);
      expect(review.path.endsWith(".ts")).toBe(true);
      expect(review.sha256).toMatch(/^[0-9a-f]{64}$/u);
      expect(review.reason.trim()).not.toBe("");
      expect(review.followUp.trim()).not.toBe("");
      const bytes = readFileSync(join(repositoryRoot, review.path));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(review.sha256);
      expect(lineCount(bytes.toString("utf8"))).toBeGreaterThan(400);
    }
    const reviewed = new Set(reviews.map((review) => review.path));
    for (const path of walkSource(join(repositoryRoot, "src"))) {
      const relative = path.slice(repositoryRoot.length + 1).replaceAll("\\", "/");
      const lines = lineCount(readFileSync(path, "utf8"));
      if (lines > 400) expect(reviewed.has(relative), relative).toBe(true);
      else expect(reviewed.has(relative), relative).toBe(false);
    }
  });
});
