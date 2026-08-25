import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workflowsRoot = join(repositoryRoot, ".github/workflows");
const PINNED_ACTION = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*@[0-9a-f]{40}$/u;
const ACTION_VERSION_COMMENT = /^v\d+(?:\.\d+)*$/u;

function workflowFiles(): string[] {
  return readdirSync(workflowsRoot)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort();
}

function usesEntries(text: string): readonly string[] {
  return [...text.matchAll(/^\s+uses:\s+(\S+)/gmu)].map((match) => match[1]!);
}

describe("GitHub Actions pin and release gate", () => {
  it("pins every third-party Action to a full commit SHA with a version comment", () => {
    expect(workflowFiles().length).toBeGreaterThan(0);
    for (const name of workflowFiles()) {
      const text = readFileSync(join(workflowsRoot, name), "utf8");
      for (const line of text.split(/\r?\n/u)) {
        const match = line.match(/^\s+uses:\s+(\S+)(?:\s+#\s+(\S+))?$/u);
        if (match === null) continue;
        const spec = match[1]!;
        if (spec.startsWith("./") || spec.startsWith(".\\")) continue;
        expect(spec, `${name}: ${line}`).toMatch(PINNED_ACTION);
        expect(match[2], `${name}: ${line} missing version comment`).toMatch(ACTION_VERSION_COMMENT);
      }
    }
  });

  it("keeps Verify as build+check and runs release:check on a separate Release workflow", () => {
    const verify = readFileSync(join(workflowsRoot, "verify.yml"), "utf8");
    expect(verify).not.toMatch(/npm run release:check/u);
    expect(verify).toContain("npm run build");
    expect(verify).toContain("npm run check");
    const verifyDoc = parse(verify) as {
      readonly jobs: { readonly verify: { readonly "timeout-minutes": number } };
    };
    expect(verifyDoc.jobs.verify["timeout-minutes"]).toBeLessThanOrEqual(20);

    const release = readFileSync(join(workflowsRoot, "release.yml"), "utf8");
    expect(release).toContain("npm run release:check");
    expect(release).not.toContain("npm run release:check\n          npm run release:check");
    const releaseDoc = parse(release) as {
      readonly on: { readonly workflow_dispatch?: unknown; readonly push?: { readonly tags?: unknown } };
      readonly jobs: {
        readonly [name: string]: {
          readonly "timeout-minutes"?: number;
          readonly "runs-on"?: string;
          readonly strategy?: unknown;
        };
      };
    };
    expect(releaseDoc.on.workflow_dispatch).toBeDefined();
    expect(JSON.stringify(releaseDoc.on.push?.tags ?? null)).toMatch(/v/u);
    const jobs = Object.values(releaseDoc.jobs);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.strategy).toBeUndefined();
    expect(jobs[0]?.["runs-on"]).toBe("ubuntu-latest");
    expect(jobs[0]?.["timeout-minutes"] ?? 0).toBeGreaterThanOrEqual(30);
    expect(jobs[0]?.["timeout-minutes"] ?? 0).toBeLessThanOrEqual(45);
  });
});
