import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const read = (relative: string): string =>
  readFileSync(join(repositoryRoot, relative), "utf8");

const IMPLICIT_VITEST_MS = 5_000;

/** Per-file ceiling for explicit Vitest hook/it timeouts. Do not raise. */
const TEST_TIMEOUT_CEILINGS: Readonly<Record<string, number>> = {
  "test/capture-case.test.ts": 180_000,
  "test/case.test.ts": 20_000,
  "test/install-matrix.test.ts": 120_000,
  "test/metamorphic.test.ts": 20_000,
  "test/package-smoke.test.ts": 120_000,
  "test/release-candidate.test.ts": 120_000,
};

function walkTests(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkTests(path));
    else if (entry.name.endsWith(".test.ts")) files.push(path);
  }
  return files;
}

function relativeTest(path: string): string {
  return path.slice(repositoryRoot.length + 1).replaceAll("\\", "/");
}

function explicitTimeouts(source: string): number[] {
  const values: number[] = [];
  const hookOrCase =
    /(?:^|\n)[ \t]*(?:it|test|beforeAll|afterAll|beforeEach|afterEach)(?:\.(?:only|skip|todo))?\s*\(/gu;
  let match: RegExpExecArray | null;
  while ((match = hookOrCase.exec(source)) !== null) {
    const open = source.indexOf("(", match.index + match[0].lastIndexOf("("));
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
      const character = source[index];
      if (character === "(") depth += 1;
      else if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          const call = source.slice(open, index + 1);
          const trailing = /,\s*(\d[\d_]*)\s*\)$/u.exec(call);
          if (trailing !== null) {
            values.push(Number(trailing[1]!.replaceAll("_", "")));
          }
          break;
        }
      }
    }
  }
  return values;
}

describe("CI kill-clock ceilings", () => {
  it("does not raise the implicit Vitest default above 5s", () => {
    const config = read("vitest.config.ts");
    expect(config).not.toMatch(/testTimeout/u);
    expect(config).not.toMatch(/hookTimeout/u);
    expect(IMPLICIT_VITEST_MS).toBe(5_000);
  });

  it("lists every explicit test timeout as a ceiling and does not raise it", () => {
    const tests = walkTests(join(repositoryRoot, "test"));
    const seen = new Set<string>();
    for (const path of tests) {
      const relative = relativeTest(path);
      const timeouts = explicitTimeouts(readFileSync(path, "utf8"))
        .filter((ms) => ms >= IMPLICIT_VITEST_MS);
      if (timeouts.length === 0) {
        expect(TEST_TIMEOUT_CEILINGS[relative], relative).toBeUndefined();
        continue;
      }
      const ceiling = TEST_TIMEOUT_CEILINGS[relative];
      expect(ceiling, `unlistable timeout file: ${relative}`).toBeTypeOf("number");
      seen.add(relative);
      for (const ms of timeouts) {
        expect(ms, `${relative} timeout ${ms}`).toBeLessThanOrEqual(ceiling!);
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(TEST_TIMEOUT_CEILINGS).sort());
  });

  it("keeps capture-case digest and dirtiness at or below their listed clocks", () => {
    const timeouts = explicitTimeouts(read("test/capture-case.test.ts"));
    expect(timeouts).toContain(15_000);
    expect(timeouts).toContain(180_000);
    expect(Math.max(...timeouts)).toBeLessThanOrEqual(180_000);
  });

  it("keeps install-matrix, package-smoke, and the Verify job at or below listed clocks", () => {
    expect(Math.max(...explicitTimeouts(read("test/install-matrix.test.ts"))))
      .toBeLessThanOrEqual(120_000);
    expect(Math.max(...explicitTimeouts(read("test/package-smoke.test.ts"))))
      .toBeLessThanOrEqual(120_000);
    expect(Math.max(...explicitTimeouts(read("test/case.test.ts"))))
      .toBeLessThanOrEqual(20_000);
    expect(Math.max(...explicitTimeouts(read("test/metamorphic.test.ts"))))
      .toBeLessThanOrEqual(20_000);
    const workflow = parse(read(".github/workflows/verify.yml")) as {
      readonly jobs: { readonly verify: { readonly "timeout-minutes": number } };
    };
    expect(workflow.jobs.verify["timeout-minutes"]).toBeLessThanOrEqual(20);
  });
});
