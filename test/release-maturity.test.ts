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
      "## **RELEASED** — `v1.0.1`: Ground-Truth Hardening";
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

  it("records the independently verified v1.0.1 release receipt", () => {
    const roadmap = read("ROADMAP.md");
    const releasedHeading =
      "## **RELEASED** — `v1.0.1`: Ground-Truth Hardening";
    const activeHeading =
      "## **RELEASED** — `v1.0.2`: Adoption and Operability";
    const releasedStart = roadmap.indexOf(releasedHeading);
    const activeStart = roadmap.indexOf(activeHeading);

    expect(releasedStart).toBeGreaterThanOrEqual(0);
    expect(activeStart).toBeGreaterThan(releasedStart);

    const released = roadmap.slice(releasedStart, activeStart);
    for (const evidence of [
      "02fcc41de50a32f31a1da96095fe72f8ca2e2b8d",
      "7d643408eda5f7f435528e42dd187873ab792147",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v1.0.1",
      "https://www.npmjs.com/package/ruleblast/v/1.0.1",
      "99,047",
      "de9bc3db1ea209b48fd3a9108a40651f495b6ee4c2fd8dbbd0d9b88832283840",
      "sha512-PvJ6gKFMmB/cz6O+X22qQWmN9EPryZ3X8TMCP+/VGzuooB9yWc5AjVZPxY0wffw//vIDHGc+aiyX1+OcDnHQfg==",
      "Signed tag",
      "byte-identical package projection",
      "gitHead is absent",
      "registry download and GitHub Release asset both match",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }

    expect(released).not.toMatch(
      /\bREMAINING\b|remain incomplete until|becomes the immutable source interface only when/iu,
    );
  });

  it("records the independently verified v1.0.2 release receipt", () => {
    const roadmap = read("ROADMAP.md");
    const releasedHeading =
      "## **RELEASED** — `v1.0.2`: Adoption and Operability";
    const nextHeading = "## **IN BUILD** — `v1.0.3`: Agent Route Proof";
    const releasedStart = roadmap.indexOf(releasedHeading);
    const nextStart = roadmap.indexOf(nextHeading);

    expect(releasedStart).toBeGreaterThanOrEqual(0);
    expect(nextStart).toBeGreaterThan(releasedStart);

    const released = roadmap.slice(releasedStart, nextStart);
    for (const evidence of [
      "136c56cb5f1ba2de0fcaf7ab899ebf4678bc824b",
      "18c250b2b58910c81e5d5d9cefb7c31ca54304a0",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v1.0.2",
      "https://www.npmjs.com/package/ruleblast/v/1.0.2",
      "89,244",
      "0d40d2297924e70c93bad51a9a84d7bd8af174ffa4cd008567f926adb0b941a2",
      "59134fd306cdd34f92da145e3a6671d4099023acefe2add73874448c5f27fc64",
      "sha512-YNJp217L6g3PaEapgwcxmHRMxi/9aFwA1kNRp9HdlWOKv96ptWwLzLjjYkrGsh4fOD9ZGJ528oqlpoPbUVWMwA==",
      "gitHead is absent",
      "registry download and GitHub Release asset both match",
      "https://github.com/Kpoiut/ruleblast/actions/runs/31722775046",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(released).not.toMatch(/\bIN BUILD\b|remain conditional|publication.+incomplete/iu);

    const changelog = read("CHANGELOG.md");
    expect(changelog).toContain("## Unreleased — repository only");
    expect(changelog).toContain("## 1.0.2 — RELEASED");
    expect(changelog).toContain(
      "Post-tag repository changes are not part of the published v1.0.2 package bytes.",
    );
  });

  it("keeps release-state records outside the current package boundary", () => {
    const descriptor = JSON.parse(read("package.json")) as {
      readonly files?: readonly string[];
    };

    expect(descriptor.files).toBeDefined();
    for (const excluded of [
      "ROADMAP.md",
      "CHANGELOG.md",
      "test",
      "test/release-maturity.test.ts",
    ]) {
      expect(descriptor.files).not.toContain(excluded);
    }
  });
});
