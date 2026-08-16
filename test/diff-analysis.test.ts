import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical.js";
import { defaultProfileDefinitions } from "../src/application/profile-catalog.js";
import { cacheRepositorySnapshot } from "../src/application/projection-boundary.js";
import { analyzePreparedDiff } from "../src/application/diff-analysis.js";
import { analyzeDiff } from "../src/impact.js";
import { ManifestSnapshot } from "../src/snapshot.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (relative: string): string =>
  readFileSync(join(repositoryRoot, relative), "utf8");

function manifest(
  label: string,
  entries: Readonly<Record<string, string>>,
): ManifestSnapshot {
  return new ManifestSnapshot({
    schemaVersion: 1,
    label,
    entries: Object.entries(entries).map(([path, content]) => ({
      path,
      kind: "file" as const,
      executable: false,
      base64: Buffer.from(content).toString("base64"),
    })),
  });
}

const before = manifest("before", {
  "AGENTS.md": "root before\n",
  "src/app.ts": "export {};\n",
});
const after = manifest("after", {
  "AGENTS.md": "root after\n",
  "src/app.ts": "export {};\n",
});
const profiles = defaultProfileDefinitions();

describe("prepared diff core", () => {
  it("exports analyzePreparedDiff without wrapping snapshots", () => {
    const source = read("src/application/diff-analysis.ts");
    expect(source).toContain("export async function analyzePreparedDiff");
    expect(source).not.toContain("cacheRepositorySnapshot");
    expect(source).not.toContain("cacheGitObjectSnapshot");
    expect(source).not.toMatch(/from ["']\.\.\/impact\.js["']/u);
  });

  it("keeps analyzeDiff as a single wrap plus the prepared core", () => {
    const source = read("src/impact.ts");
    const start = source.indexOf("export async function analyzeDiff");
    const body = source.slice(start);
    expect(body).toContain("cacheRepositorySnapshot");
    expect(body).toContain("analyzePreparedDiff");
    expect(body.indexOf("cacheRepositorySnapshot"))
      .toBeLessThan(body.indexOf("analyzePreparedDiff"));
    expect(body).not.toContain("preparePairs");
  });

  it("keeps a single injectable CLI semantic diff", () => {
    const runtime = read("src/cli-runtime.ts");
    expect(runtime).toContain('analyzeDiff');
    expect(runtime).not.toContain("prepareDiffCore");
    expect(runtime).not.toContain("analyzePreparedDiff");
    expect(runtime.match(/analyzeDiff/gu)?.length).toBeGreaterThanOrEqual(1);
    const fields = runtime.slice(
      runtime.indexOf("const DEPENDENCY_FIELDS"),
      runtime.indexOf("] as const"),
    );
    expect(fields).toContain("analyzeCurrent");
    expect(fields).toContain("analyzeDiff");
    expect(fields).not.toContain("analyzePreparedDiff");
  });

  it("matches analyzeDiff canonical bytes when callers wrap once", async () => {
    const wrapped = {
      before: cacheRepositorySnapshot(before),
      after: cacheRepositorySnapshot(after),
      profiles,
    };
    const prepared = await analyzePreparedDiff(wrapped);
    const facade = await analyzeDiff({ before, after, profiles });
    expect(canonicalJson(prepared)).toBe(canonicalJson(facade));
  });
});
