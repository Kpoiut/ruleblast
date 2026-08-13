import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path: string): string =>
  readFileSync(join(repositoryRoot, path), "utf8");

describe("public release maturity", () => {
  it("records the independently verified v1.0.0 release receipt", () => {
    const roadmap = read("ROADMAP.md");
    const releasedHeading = "## **RELEASED** — `v1.0.0`: The Second Diff";
    const activeHeading =
      "## **IN BUILD** — `v1.0.1`: Ground-Truth Hardening";
    const releasedStart = roadmap.indexOf(releasedHeading);
    const activeStart = roadmap.indexOf(activeHeading);

    expect(roadmap).toContain("| **RELEASED** |");
    expect(releasedStart).toBeGreaterThanOrEqual(0);
    expect(activeStart).toBeGreaterThan(releasedStart);

    const released = roadmap.slice(releasedStart, activeStart);
    for (const evidence of [
      "327cea48343b4018a0dca1d4c9dfae9a2b6b1bcb",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v1.0.0",
      "https://www.npmjs.com/package/ruleblast/v/1.0.0",
      "146,553",
      "8c552b0e749277376010a929c1f1c444db7f7fc02c9f5099e2f902d29e0ec136",
      "sha512-kXIWZtwFwtUVSQun3HcV0FN65fkojbhaODIxYvggOPeNSqsl8VxZK3ST5jkfMPYDVcuWPVYlX8V4iTC0cla+hA==",
      "signed tag",
      "npm",
      "GitHub Release",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }

    expect(released).not.toMatch(
      /\bREMAINING\b|becomes the immutable source interface only when/iu,
    );
  });

  it("keeps release-state records outside the frozen package boundary", () => {
    const descriptor = JSON.parse(read("package.json")) as {
      readonly files?: readonly string[];
    };

    expect(descriptor.files).toEqual([
      "assets/ruleblast-demo-terminal.gif",
      "dist",
      "fixtures/demo",
      "README.md",
      "CONTRACT.md",
      "LICENSE",
    ]);
    expect(descriptor.files).not.toEqual(
      expect.arrayContaining([
        "ROADMAP.md",
        "CHANGELOG.md",
        "test",
        "test/release-maturity.test.ts",
      ]),
    );
  });
});
