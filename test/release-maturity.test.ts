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
    const nextHeading = "## **SHIPPED TO MAIN** — `v1.0.3`: Agent Route Proof";
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

  it("records the independently verified v1.3.0 release receipt", () => {
    const roadmap = read("ROADMAP.md");
    const releasedHeading =
      "## **RELEASED** — `v1.3.0`: Third Documented Reality";
    const nextHeading = "## **SHIPPED TO MAIN** — `v1.3.1`: Longer Causal Proof";
    const releasedStart = roadmap.indexOf(releasedHeading);
    const nextStart = roadmap.indexOf(nextHeading);

    expect(releasedStart).toBeGreaterThanOrEqual(0);
    expect(nextStart).toBeGreaterThan(releasedStart);

    const released = roadmap.slice(releasedStart, nextStart);
    for (const evidence of [
      "f417ee350a6aa7431f23bbe698d58edd24dc8285",
      "8b2d083e6ebedb43315a2135621bd237a06a5f5d",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v1.3.0",
      "https://www.npmjs.com/package/ruleblast/v/1.3.0",
      "93,562",
      "b4a2f04e4536d1859e3e80c2d4722b456d5194f47b7167df879af5577da5ec7c",
      "9b5da71c2352b3273efeef5cdd228a602060e535ccbcf5804089a9ddacd9a664",
      "sha512-BsVvo3OsYiQKZx961VTZH7tYMLoEJuNNYWqX+OXcYMZZz77Rtvfs5rJ3kiGTfoycn3f4h4ze++tySXrOTiIRIw==",
      "gitHead is absent",
      "registry download and GitHub Release asset both match",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(released).not.toMatch(/\bIN BUILD\b|remain conditional|publication.+incomplete/iu);

    const changelog = read("CHANGELOG.md");
    expect(changelog).toContain("## 1.3.0 — RELEASED");
    expect(changelog).toContain(
      "Signed tag object `f417ee350a6aa7431f23bbe698d58edd24dc8285`",
    );
  });

  it("records v1.3.1 as a shipped presentation patch without inventing publication", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v1.3.1`: Longer Causal Proof";
    const nextHeading = "## **SHIPPED TO MAIN** — `v1.4.0`: Visual Benchmark";
    const start = roadmap.indexOf(heading);
    const next = roadmap.indexOf(nextHeading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toMatch(/28 held frames/iu);
    expect(shipped).toMatch(/Git will never show that second diff/iu);
    expect(shipped).not.toMatch(/\bRELEASED\b/u);

    const changelog = read("CHANGELOG.md");
    expect(changelog).toContain("## 1.3.1 — SHIPPED TO MAIN");
    expect(changelog).toMatch(/longer causal-proof/iu);
    expect(changelog).not.toMatch(/## 1\.3\.1 — RELEASED/u);
  });

  it("records v1.4.0 as a shipped visual benchmark without inventing publication", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v1.4.0`: Visual Benchmark";
    const nextHeading = "## **SHIPPED TO MAIN** — `v1.4.1`: Compact Scoreboard";
    const start = roadmap.indexOf(heading);
    const next = roadmap.indexOf(nextHeading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("10,000");
    expect(shipped).toContain("2,000 ms");
    expect(shipped).toMatch(/does not measure model quality/iu);
    expect(shipped).not.toMatch(/\bRELEASED\b/u);

    const changelog = read("CHANGELOG.md");
    expect(changelog).toContain("## 1.4.0 — SHIPPED TO MAIN");
    expect(changelog).toMatch(/visual benchmark/iu);
    expect(changelog).not.toMatch(/## 1\.4\.0 — RELEASED/u);
  });

  it("records v1.4.1 as a compact scoreboard patch without a Marketplace root action", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v1.4.1`: Compact Scoreboard";
    const nextHeading = "## **SHIPPED TO MAIN** — `v1.4.2`: User-Owned Scoreboard Gate";
    const start = roadmap.indexOf(heading);
    const next = roadmap.indexOf(nextHeading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toMatch(/1,200.?×.?360/iu);
    expect(shipped).toMatch(/Marketplace/iu);
    expect(shipped).not.toMatch(/\bRELEASED\b/u);

    const changelog = read("CHANGELOG.md");
    expect(changelog).toContain("## 1.4.1 — SHIPPED TO MAIN");
    expect(changelog).toMatch(/compact/iu);
    expect(changelog).not.toMatch(/## 1\.4\.1 — RELEASED/u);
  });

  it("records v1.4.2 as a user-owned scoreboard gate without inventing publication", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v1.4.2`: User-Owned Scoreboard Gate";
    const nextHeading = "## **NEXT** — `v2.0.0`: Reality Packs";
    const start = roadmap.indexOf(heading);
    const next = roadmap.indexOf(nextHeading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    expect(roadmap.slice(start, next)).toMatch(/\.ruleblast-allow/u);
    expect(roadmap.slice(start, next)).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 1.4.2 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 1\.4\.2 — RELEASED/u);
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
