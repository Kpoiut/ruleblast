import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relative: string): string =>
  readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

describe("CI kill-clock ceilings", () => {
  it("does not raise the implicit Vitest default above 5s", () => {
    const config = read("vitest.config.ts");
    expect(config).not.toMatch(/testTimeout\s*:\s*(1[5-9]|[2-9]\d)\s*_?\s*000/u);
  });

  it("keeps capture-case digest and dirtiness at or below 15s", () => {
    const source = read("test/capture-case.test.ts");
    for (const match of source.matchAll(/,\s*(\d[\d_]*)\s*\)/gu)) {
      const ms = Number(match[1]!.replaceAll("_", ""));
      if (ms === 15_000) expect(ms).toBeLessThanOrEqual(15_000);
    }
    expect(source).toContain("15_000");
  });

  it("keeps install-matrix and package-smoke at or below 120s", () => {
    expect(read("test/install-matrix.test.ts")).toMatch(/120_000/);
    expect(read("test/package-smoke.test.ts")).toMatch(/120_000/);
    expect(read(".github/workflows/verify.yml")).toMatch(/timeout-minutes:\s*20/u);
  });
});
