import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (relative: string): string =>
  readFileSync(join(repositoryRoot, relative), "utf8");

describe("P1/B0 plan gate", () => {
  it("keeps a single prepared-diff core and wrap-once topology", () => {
    const prepared = read("src/application/diff-analysis.ts");
    expect(prepared).toContain("export async function analyzePreparedDiff");
    expect(prepared).not.toContain("cacheRepositorySnapshot");
    expect(prepared).not.toContain("cacheGitObjectSnapshot");
    expect(prepared).not.toMatch(/from ["']\.\.\/impact\.js["']/u);

    const impact = read("src/impact.ts");
    const analyzeDiff = impact.slice(impact.indexOf("export async function analyzeDiff"));
    expect(analyzeDiff.indexOf("cacheRepositorySnapshot"))
      .toBeLessThan(analyzeDiff.indexOf("analyzePreparedDiff"));

    const runtime = read("src/cli-runtime.ts");
    const fields = runtime.slice(
      runtime.indexOf("const DEPENDENCY_FIELDS"),
      runtime.indexOf("] as const"),
    );
    expect(fields).toContain("analyzeDiff");
    expect(fields).toContain("probeGitStorageFormat");
    expect(fields).not.toContain("analyzePreparedDiff");
    expect(runtime).toContain("Promise<GitObjectSnapshot>");

    const actions = read("src/cli-actions.ts");
    expect(actions).not.toMatch(/as GitObjectSnapshot/u);
    expect(actions).toContain("analyzeOverlayPair");
    expect(actions).not.toContain("cacheGitObjectSnapshot");
    expect(actions).not.toContain("analyzePreparedDiff");

    const pair = read("src/application/overlay-pair.ts");
    expect(pair.match(/cacheGitObjectSnapshot\(/gu)).toHaveLength(2);
    const body = pair.slice(pair.indexOf("export async function analyzeOverlayPair"));
    expect(body.indexOf("bindSnapshotIdentity"))
      .toBeLessThan(body.indexOf("analyzePreparedDiff"));
    expect(body.indexOf("analyzePreparedDiff"))
      .toBeLessThan(body.indexOf("buildOverlayP1("));
    expect(pair).toContain("isWorktreeIdentitySource");
  });

  it("forbids overlay I/O, a fifth action, and P2/P3/host overlay symbols", () => {
    const overlay = read("src/application/blast-overlay.ts");
    expect(overlay).not.toMatch(/\.read\s*\(/u);
    expect(overlay).not.toContain("cat-file");
    expect(overlay).not.toContain("diff-tree");
    expect(overlay).not.toContain("buildOverlayP2");
    expect(overlay).not.toContain("buildOverlayP3");

    const actions = read("src/cli-actions.ts");
    expect(actions).not.toContain("buildOverlayP2");
    expect(actions).toContain('args.output.kind !== "json"');
    expect(actions).toContain("isWorktreeIdentitySource");

    const mcp = read("src/mcp-stdio.ts");
    expect(mcp).not.toContain("buildOverlayP1");
    expect(mcp).not.toContain("reconstructWorkMap");
    expect(mcp).not.toContain("diffRepositoryWithAdjunct");
    const host = read("hosts/vscode/src/extension.ts");
    expect(host).not.toContain("buildOverlayP1");
    expect(host).not.toContain("reconstructWorkMap");
    expect(host).toContain("diffRepositoryWithAdjunct");
    expect(host).toContain("openTrackedWorktree");
    expect(overlay).toContain("export function reconstructWorkMap");
    expect(overlay).toContain("export function alignmentGloss");
    expect(overlay).toContain("export function countObservedKinds");
    expect(overlay).toContain("WORK MAP");
    expect(overlay).toContain("CHANGE ALIGNMENT");
  });

  it("does not raise kill-clocks or restore duplicate Verify smokes", () => {
    expect(read("vitest.config.ts")).not.toMatch(/testTimeout/u);
    const verify = read(".github/workflows/verify.yml");
    expect(verify).toMatch(/timeout-minutes:\s*20/u);
    expect(verify).not.toMatch(/^\s+- run: npm run package:smoke\s*$/mu);
    expect(verify).not.toMatch(/^\s+- run: npm run install:smoke\s*$/mu);
    expect(verify.indexOf("npm run build")).toBeLessThan(verify.indexOf("npm run check"));
  });

  it("records overlay as storage identity on released v2.3.0", () => {
    const changelog = read("CHANGELOG.md");
    expect(changelog).toMatch(/Git storage blob-object identity/u);
    expect(changelog).toMatch(/^## 2\.3\.0 — RELEASED/mu);
    expect(changelog).not.toMatch(/^## 2\.3\.0 — SHIPPED TO MAIN/mu);
    expect(read("ROADMAP.md")).toMatch(/## \*\*RELEASED\*\* — `v2\.3\.0`/u);
    expect(read("package.json")).toContain('"version": "2.4.2"');
  });
});
