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
    const nextHeading = "## **SHIPPED TO MAIN** — `v1.4.3`: Dual Skill Discovery";
    const start = roadmap.indexOf(heading);
    const next = roadmap.indexOf(nextHeading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    expect(roadmap.slice(start, next)).toMatch(/\.ruleblast-allow/u);
    expect(roadmap.slice(start, next)).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 1.4.2 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 1\.4\.2 — RELEASED/u);
  });

  it("records v1.4.3 as dual skill discovery without inventing publication", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v1.4.3`: Dual Skill Discovery";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v1.4.4`: CLI-First Front Page");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    expect(roadmap.slice(start, next)).toContain(".claude/skills");
    expect(roadmap.slice(start, next)).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 1.4.3 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 1\.4\.3 — RELEASED/u);
  });

  it("records v1.4.4 as a CLI-first front page without inventing publication", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v1.4.4`: CLI-First Front Page";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v1.5.0`: Source-Centric Blast Attribution");
    expect(roadmap.indexOf(heading)).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(roadmap.indexOf(heading));
    expect(read("CHANGELOG.md")).toContain("## 1.4.4 — SHIPPED TO MAIN");
    expect(read("PROOF.md")).toContain("150,404,342");
  });

  it("records v1.5.0 as source-centric blast attribution without inventing publication", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v1.5.0`: Source-Centric Blast Attribution";
    expect(roadmap.indexOf(heading)).toBeGreaterThan(-1);
    expect(roadmap.indexOf("## **RELEASED** — `v1.5.1`: Public Install Identity"))
      .toBeGreaterThan(roadmap.indexOf(heading));
    expect(read("CHANGELOG.md")).toContain("## 1.5.0 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 1\.5\.0 — RELEASED/u);
  });

  it("records the independently verified v1.5.1 release receipt", () => {
    const roadmap = read("ROADMAP.md");
    const releasedHeading =
      "## **RELEASED** — `v1.5.1`: Public Install Identity";
    const nextHeading = "## **SHIPPED TO MAIN** — `v1.5.2`: Evidence-Link Wording";
    const releasedStart = roadmap.indexOf(releasedHeading);
    const nextStart = roadmap.indexOf(nextHeading);

    expect(releasedStart).toBeGreaterThanOrEqual(0);
    expect(nextStart).toBeGreaterThan(releasedStart);

    const released = roadmap.slice(releasedStart, nextStart);
    for (const evidence of [
      "1e1ee219b45c69da46a732ef215835eee11f33fc",
      "ca6dea5efab263a11dbfc0221b88570cdcf50b7f",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v1.5.1",
      "https://www.npmjs.com/package/ruleblast/v/1.5.1",
      "95,434",
      "d85e4f35233b1bd65f778c65eb83122b41405df42cd4ef72b4c602a18bb1a036",
      "08711a24f3ed1a9c43e0c065337962c2ef229e9c8edf3f0051fdd97b402de590",
      "sha512-0QRQ88yxOMrOPYME1I5IIZKaWlJ8PECP40L+rXZ4rKmPM2ANFfJjlaKJnCFOAMvxOCXcyXqqk2/ON6mHPZPA8g==",
      "gitHead is absent",
      "registry download and GitHub Release asset both match",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(released).not.toMatch(/\bIN BUILD\b|remain conditional|publication.+incomplete/iu);
    expect(roadmap).toContain("## Feature admission test");
    expect(roadmap).toContain("Does it make the blast radius more exact?");

    const changelog = read("CHANGELOG.md");
    expect(changelog).toContain("## 1.5.1 — RELEASED");
    expect(changelog).toContain(
      "Signed tag object `1e1ee219b45c69da46a732ef215835eee11f33fc`",
    );
  });

  it("records v1.5.2 as evidence-link wording without inventing publication", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v1.5.2`: Evidence-Link Wording";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v1.5.3`: Receipt Binding");
    expect(roadmap.indexOf(heading)).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(roadmap.indexOf(heading));
    const shipped = roadmap.slice(roadmap.indexOf(heading), next);
    expect(shipped).toMatch(/affected path/iu);
    expect(shipped).toMatch(/overlapping attribution/iu);
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 1.5.2 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 1\.5\.2 — RELEASED/u);
    expect(read("CHANGELOG.md")).toMatch(/evidence links/iu);
  });

  it("records v1.5.3 as receipt binding without inventing publication", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v1.5.3`: Receipt Binding";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v1.6.0`: Fourth Documented Reality");
    expect(roadmap.indexOf(heading)).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(roadmap.indexOf(heading));
    const shipped = roadmap.slice(roadmap.indexOf(heading), next);
    expect(shipped).toMatch(/coreDigest/u);
    expect(shipped).toMatch(/\{owner\}__\{repo\}/u);
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 1.5.3 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 1\.5\.3 — RELEASED/u);
    expect(read("src/case.ts")).not.toContain(
      "5735038d47cae7b538e113d51214dbbc6ecd29cbca815912813abaa900ecfc89",
    );
  });

  it("records the independently verified v1.6.2 release receipt", () => {
    const roadmap = read("ROADMAP.md");
    const releasedHeading = "## **RELEASED** — `v1.6.2`: Last-Result Explain";
    const nextHeading = "## **RELEASED** — `v2.0.0`: Reality Packs";
    const releasedStart = roadmap.indexOf(releasedHeading);
    const nextStart = roadmap.indexOf(nextHeading);

    expect(releasedStart).toBeGreaterThanOrEqual(0);
    expect(nextStart).toBeGreaterThan(releasedStart);

    const released = roadmap.slice(releasedStart, nextStart);
    for (const evidence of [
      "4883efb6d5a82e0bcfe4ebd8375a0f024ff7943b",
      "ef2206a40b44a1debb211bd131f23afb519ac32f",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v1.6.2",
      "https://www.npmjs.com/package/ruleblast/v/1.6.2",
      "108,652",
      "0c93bc4c24410297ce0f20dc5cf7788ad4dfb3259c2b99662782969bec49101f",
      "8725791048ff228835279abbcaa855002303aa5867a8971182fbac601f80fec4",
      "sha512-JE3H3hE7Gp1/AuQIz8swceyFRlGnfFjLcJz/MOriBswDt69ObMatn3w/AzkjeqSSThsyhgGnnpdR4emkYKw1eg==",
      "gitHead is absent",
      "registry download and GitHub Release asset both match",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(released).not.toMatch(/\bIN BUILD\b|remain conditional|publication.+incomplete/iu);

    const changelog = read("CHANGELOG.md");
    expect(changelog).toContain("## 1.6.2 — RELEASED");
    expect(changelog).toContain(
      "Signed tag object `4883efb6d5a82e0bcfe4ebd8375a0f024ff7943b`",
    );
  });

  it("records the independently verified v2.0.0 release receipt", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **RELEASED** — `v2.0.0`: Reality Packs";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v2.0.1`: Honest PR engine pin");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const released = roadmap.slice(start, next);
    for (const evidence of [
      "250f54ff2a1ae354581919f471d3bb48dd231db4",
      "bf51ada55b7e34db2b8f5b6c0eebd468b35c0382",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v2.0.0",
      "https://www.npmjs.com/package/ruleblast/v/2.0.0",
      "118,042",
      "1059f9c02e474cb1f1376bb4664aee03f63ac13af8ac4817fcdb6fd7a94c0777",
      "04b8fe547e684aef54af743ebdd1f6172a647834255d1ff3a4f11fa02087a52c",
      "sha512-RLiS2/bBUlzzRPiEoypRYowa3fUvSutpDrpv6IoXUjl9/t5NwwIgDXaZpPVaYzwlIApjixSr3xYYbqscWQFrYg==",
      "gitHead is absent",
      "registry download and GitHub Release asset both match",
      "not facts inferred from this checkout",
      "f9e6833aeadcb3e3f23753ebf0f761df68749f0a",
      "38cb0f50bd03bc39a0046426b6fa3004103d4f4a",
      "D2a",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(released).toMatch(/No `--pack`/u);
    expect(released).not.toMatch(/\bIN BUILD\b|remain conditional|publication.+incomplete/iu);
    expect(read("CHANGELOG.md")).toContain("## 2.0.0 — RELEASED");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.0\.0 — SHIPPED TO MAIN/u);
    expect(read("CONTRACT.md")).toContain("38cb0f50bd03bc39a0046426b6fa3004103d4f4a");
  });

  it("records v2.0.1 as the Action pin and honest help patch", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v2.0.1`: Honest PR engine pin";
    const next = roadmap.indexOf("## **RELEASED** — `v2.0.2`: Retrievable identity and fail-closed pack load");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("1.6.2");
    expect(shipped).toContain("2.0.1");
    expect(shipped).toContain("7ead43338441bfd541a88096587257189939a1b7");
    expect(shipped).toContain("eddaf663ea489a3b5ab576a1763c9af42df43a82");
    expect(shipped).toMatch(/optional `reality` input/iu);
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.0.1 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.0\.1 — RELEASED/u);
  });

  it("records the independently verified v2.0.2 release receipt", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **RELEASED** — `v2.0.2`: Retrievable identity and fail-closed pack load";
    const next = roadmap.indexOf("## **RELEASED** — `v2.1.0`: Many-Reality Diff");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const released = roadmap.slice(start, next);
    for (const evidence of [
      "7b0b169f49c6be0da5289b4afcb7bc0576607486",
      "1c926b6ee92915659c58cc140627a76480996b5b",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v2.0.2",
      "https://www.npmjs.com/package/ruleblast/v/2.0.2",
      "118,836",
      "9cec50fa91cbd13b3326f5aee5cdf98e0c31421ef483231560e8290a1b97387a",
      "9a123b870a581d88b72089e1b5e5dcfd0b51b2ee361d16e302098dabdce0a9c9",
      "sha512-DsiHO5GR5xiGNioWxqjn5rtO9n/9d7sCM7+ND4OKECdVQDXMR4U0t0Sd8z2k+Ahaz4FwaGq5iyRDSF1+3UhAQg==",
      "gitHead is absent",
      "registry download and GitHub Release asset both match",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(released).toMatch(/blast radius/iu);
    expect(released).toContain("INVALID_PACK");
    expect(released).toMatch(/drive-relative|contained|unsafe pack directory/iu);
    expect(released).not.toMatch(/\bIN BUILD\b|remain conditional|publication.+incomplete/iu);
    expect(read("CHANGELOG.md")).toContain("## 2.0.2 — RELEASED");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.0\.2 — SHIPPED TO MAIN/u);
    expect(read("package.json")).toContain("blast radius of AGENTS.md and CLAUDE.md");
    expect(read(".github/actions/ruleblast/action.yml")).toMatch(/default: "2\.5\.9"/u);
    expect(released).toContain("Latest independently verified public npm distribution at that tag is `2.0.2`");
  });

  it("records the independently verified v2.1.0 release receipt", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **RELEASED** — `v2.1.0`: Many-Reality Diff";
    const next = roadmap.indexOf("## **RELEASED** — `v2.1.1`: Retrievable problem documents");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const released = roadmap.slice(start, next);
    for (const evidence of [
      "d89cc19599583ec7d81e379381ebd8fe13bb829f",
      "1cb9e6b7e1344c70b8d5dec0563c86efc3fd225b",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v2.1.0",
      "https://www.npmjs.com/package/ruleblast/v/2.1.0",
      "120,388",
      "1a8c94fd7b2d1a5875d64552ff001f9fdbdfc641b8e889d40094d744d83a982d",
      "08b9104ced23ff298a54f8d465d42eaf10509927291e0e05b9be697b6f8ed093",
      "sha512-tNxO7l++PZ02JIYyZNJGZvwtlb0l/lTM5aYhZUXFBFo22t2uv29nUWacYRzROQ/cwp7pkLbJAIpJCE2slJ6UvQ==",
      "gitHead is absent",
      "registry download and GitHub Release asset both match",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(released).toMatch(/REALITY GROUPS|evidence-equivalent|pairwise/iu);
    expect(released).toContain("SAME");
    expect(released).toMatch(/No `--reality all`/u);
    expect(released).not.toMatch(/\bIN BUILD\b|remain conditional|publication.+incomplete/iu);
    expect(released).not.toMatch(/Claude Desktop|Antigravity|Marketplace/iu);
    expect(read("CHANGELOG.md")).toContain("## 2.1.0 — RELEASED");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.1\.0 — SHIPPED TO MAIN/u);
    expect(read(".github/actions/ruleblast/action.yml")).toMatch(/default: "2\.5\.9"/u);
    expect(released).toContain("Latest independently verified public npm distribution at that tag is `2.1.0`");
  });

  it("records the independently verified v2.1.1 release receipt", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **RELEASED** — `v2.1.1`: Retrievable problem documents";
    const next = roadmap.indexOf("## **RELEASED** — `v2.2.0`: Compatible hosts");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const released = roadmap.slice(start, next);
    for (const evidence of [
      "52d3e8cb76948ab0698c0e4fda6d8ada81a5a9d2",
      "d324e8ebc2752437db1702879b896430bc961f6d",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v2.1.1",
      "https://www.npmjs.com/package/ruleblast/v/2.1.1",
      "120,404",
      "c736da718b54a6877d8c54167f06b199fcf9ac28cecb8c2e351c595eb4f56900",
      "56b1c8210bd80dd6c7a877889db131ba305a650913f834451ea07de433e39e6c",
      "sha512-eJFLnTidG0DrFabzNDktmh7QhypR29coKI69EZ2/JebsZML4I4aMnqNCaQdO+IlacLAhHye3X+tReWOgtWK56A==",
      "gitHead is absent",
      "registry download and GitHub Release asset both match",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(released).toMatch(/which files inherit/iu);
    expect(released).toContain("Kpoiut/ruleblast@v2.1.1");
    expect(released).not.toMatch(/\bIN BUILD\b|remain conditional|publication.+incomplete/iu);
    expect(read("CHANGELOG.md")).toContain("## 2.1.1 — RELEASED");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.1\.1 — SHIPPED TO MAIN/u);
    expect(read("which-files-inherit-agents-md.md")).toMatch(/Which files inherit a changed AGENTS.md/u);
    expect(read("llms.txt")).toContain("blast radius of AGENTS.md and CLAUDE.md");
    expect(read("action.yml")).toContain("uses: ./.github/actions/ruleblast");
    expect(read("CONTRIBUTING.md")).toContain("Latest independently verified public npm release is `v2.5.9`");
  });

  it("records the independently verified v2.2.0 npm receipt", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **RELEASED** — `v2.2.0`: Compatible hosts";
    const next = roadmap.indexOf(
      "## **SHIPPED TO MAIN** — `v2.2.1`: Companion icon and Windows verify",
    );
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const released = roadmap.slice(start, next);
    for (const evidence of [
      "https://www.npmjs.com/package/ruleblast/v/2.2.0",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v2.2.0",
      "b6c93afb91c0c7b12b97c163cb12dcd2b0b4a864",
      "6f3732fef48ba9a6c0ec4f7a6f9b7381786fb737",
      "128,262",
      "0d2d9c56e54e032981492afc9e49bad727a26c71526d13a68e6896595622f823",
      "sha512-ddfCo5MbaFjUyQa9eHr6D/pBzV9byQzhi30OzfkFSMnLmKdngHMHZsndIqAtNLPlHP6zs9fHeBSz+8lXVtuWZA==",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(released).toMatch(/npx --yes ruleblast@2\.2\.0 --mcp/u);
    expect(released).not.toMatch(/\bIN BUILD\b|remain conditional|publication.+incomplete/iu);
    expect(read("CHANGELOG.md")).toContain("## 2.2.0 — RELEASED");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.2\.0 — IN BUILD/u);
  });

  it("records v2.2.1 as the companion icon and Windows verify patch", () => {
    const roadmap = read("ROADMAP.md");
    const heading =
      "## **SHIPPED TO MAIN** — `v2.2.1`: Companion icon and Windows verify";
    const next = roadmap.indexOf(
      "## **SHIPPED TO MAIN** — `v2.2.2`: Git-pair overlay",
    );
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.2.1");
    expect(shipped).toContain("2.2.0");
    expect(shipped).toContain("aca42df18070b98c3ca2b52c5e3ea6b5ae83f76c");
    expect(shipped).toContain("2541576ebc9d8ea3db31bbd62e3df9b78d410c69");
    expect(shipped).toContain("https://github.com/Kpoiut/ruleblast/releases/tag/v2.2.1");
    expect(shipped).toContain("115,113");
    expect(shipped).toContain("eac0ccbcf4287de56c810481a78fe25597d99484310e5e9cfec9bf13f3dc8bd3");
    expect(shipped).toMatch(/128.?128/iu);
    expect(shipped).toContain("ruleblast-companion-2.2.1.vsix");
    expect(shipped).toMatch(/windowsVerbatimArguments|%~sI/u);
    expect(shipped).toMatch(/dist\/cli\.js/u);
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.2.1 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.2\.1 — RELEASED/u);
    expect(read("CHANGELOG.md")).toMatch(/Timeouts stay 15s \/ 120s/u);
    expect(read("CHANGELOG.md")).toMatch(/Do not overwrite Marketplace `2\.2\.0`/u);
    expect(read("CHANGELOG.md")).toContain("ruleblast-companion-2.2.1.vsix");
  });

  it("records v2.2.2 as the Git-pair overlay adjunct", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v2.2.2`: Git-pair overlay";
    const next = roadmap.indexOf("## **RELEASED** — `v2.3.0`:");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("OTHER TRACKED CHANGES");
    expect(shipped).toMatch(/Git storage blob-object identity/iu);
    expect(shipped).toContain("--json");
    expect(shipped).toMatch(/WORKTREE/u);
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(shipped).toContain("2.2.0");
    expect(read("CHANGELOG.md")).toContain("## 2.2.2 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.2\.2 — RELEASED/u);
    expect(read("scripts/package-host.mjs")).toContain("ruleblast-companion-${version}.vsix");
    const exploring = roadmap.slice(roadmap.indexOf("## **EXPLORING**"));
    expect(exploring).toMatch(/Git storage blob-object identity/iu);
  });

  it("records the independently verified v2.3.0 npm receipt", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **RELEASED** — `v2.3.0`: Overlay, work map, and companion control";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v2.3.1`:");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const released = roadmap.slice(start, next);
    for (const evidence of [
      "https://www.npmjs.com/package/ruleblast/v/2.3.0",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v2.3.0",
      "73e0fdf25f68c18380c9db5b459406419f72fc06",
      "7ca69ba262f3250e6e33630ca05c205d9f01e14c",
      "sha512-1G1yAOUMnMQUfVX64YoLbBVKPNrFsX7ivIZ8OhJwL5YQUFyC6EyWYk4mNokyDIh+q7KqeLt9djgQSXxlQ2fn2Q==",
      "138,135",
      "1672bdd9133f960d8658e003b8d7cb77a13b3fbd79c9238a2b009abf2839ba2e",
      "67280fd8b43a53cd262d68058e3b4680410c8d2d",
      "125,885",
      "40aca6dbb59bf2b5d19938788f0454baa80abb806802290429aff8c3f255ab60",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(released).toContain("WORK MAP");
    expect(released).toContain("CHANGE ALIGNMENT");
    expect(released).toContain("ruleblast-companion-2.3.0.vsix");
    expect(released).not.toMatch(/no signed `v2\.3\.0` source tag/u);
    expect(read("ROADMAP.md")).toContain("## **HORIZON** — `v4`: Stack debugger, still one product");
    expect(read("CHANGELOG.md")).toContain("## 2.3.0 — RELEASED");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.3\.0 — SHIPPED TO MAIN/u);
    expect(read("CHANGELOG.md")).toContain("ALIGNED");
    expect(read("CONTRIBUTING.md")).toContain(
      "Latest independently verified public npm release is `v2.5.9`",
    );
  });

  it("records v2.3.1 as the identity-fixture and Windows-root patch", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v2.3.1`: Identity fixture and Windows root";
    const next = roadmap.indexOf("## **RELEASED** — `v2.4.0`:");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.3.1");
    expect(shipped).toContain("2.3.0");
    expect(shipped).toMatch(/realpath|8\.3|RUNNER~1/iu);
    expect(shipped).toContain("blobIdentityKind");
    expect(shipped).toContain("unionSortedPaths");
    expect(shipped).toMatch(/ls-tree/u);
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.3.1 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.3\.1 — RELEASED/u);
    expect(read("CHANGELOG.md")).toMatch(/git add -A/u);
    expect(read("CHANGELOG.md")).toContain("ruleblast-companion-2.3.0.vsix");
  });

  it("records v2.4.0 as progressive disclosure whose npm version was unpublished", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **RELEASED** — `v2.4.0`: Progressive disclosure";
    const next = roadmap.indexOf("## **RELEASED** — `v2.4.1`:");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const released = roadmap.slice(start, next);
    expect(released).toContain("2.4.0");
    expect(released).toContain("--paths-only");
    expect(released).toContain("explain --compare");
    expect(released).toContain("PROOF");
    expect(released).toMatch(/unpublished/iu);
    expect(released).toContain("ruleblast@2.4.1");
    expect(released).toContain("https://github.com/Kpoiut/ruleblast/releases/tag/v2.4.0");
    expect(released).toContain("430115f28b62a90bc5838fc696cc5747d46f9ab5");
    expect(released).toContain("82514d7dc03614094001ec737a7d2bb13402d45a");
    expect(released).not.toMatch(/100%\s*trust|<15ms|mathematically defensible/iu);
    expect(read("CHANGELOG.md")).toContain("## 2.4.0 — RELEASED");
    expect(read("CHANGELOG.md")).toMatch(/unpublished/iu);
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.4\.0 — SHIPPED TO MAIN/u);
  });

  it("records v2.4.1 as the replacement published package", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **RELEASED** — `v2.4.1`: Republished progressive disclosure";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v2.4.2`:");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const released = roadmap.slice(start, next);
    expect(released).toContain("2.4.1");
    expect(released).toContain("ruleblast@2.4.1");
    expect(released).toContain("ruleblast-companion-2.4.1.vsix");
    for (const evidence of [
      "https://www.npmjs.com/package/ruleblast/v/2.4.1",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v2.4.1",
      "b26859f3a31bd4b1c3985f966d70bf32432d174f",
      "f80b0d0fb2af6ab0c37d703b1d36a094c9a0cc58",
      "sha512-MTTZpr2qhuMaR4BN9z5LsMe1pORPkbDeNV5Gr8f2GXb0jLI3MoPYaM5rX1CQqtyMePcNEfU4JdHXFYQWiGglOA==",
      "144,495",
      "6c89d285e938fae0e9f5aa717fc0a6403fc48f57d825c1b7310ea01c52231483",
      "137,302",
      "29efd185756292c136312f900eb89115b7a7707b8d30a3d58adc8534f654ebf6",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(read("CHANGELOG.md")).toContain("## 2.4.1 — RELEASED");
  });

  it("records v2.4.2 as one public descriptor without a rename", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v2.4.2`: One public descriptor";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v2.4.3`:");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.4.2");
    expect(shipped).toContain("2.4.1");
    expect(shipped).toContain("Git diff for AI agent repository instructions");
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(shipped).toContain("stay `ruleblast`");
    expect(read("CHANGELOG.md")).toContain("## 2.4.2 — SHIPPED TO MAIN");
    expect(read("README.md")).toContain(
      "RuleBlast — Git diff for AI agent repository instructions",
    );
  });

  it("records v2.4.3 as the domain capability-layer map", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v2.4.3`: Domain capability layers";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v2.4.4`:");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.4.3");
    expect(shipped).toContain("2.4.1");
    expect(shipped).toContain("ruleblast-companion-2.4.3.vsix");
    expect(shipped).toMatch(/L5\.5–L6|L5\.5-L6/u);
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(roadmap).toContain("## How to read capability layers");
    expect(roadmap).toContain("wrong axis");
    expect(roadmap).toContain("does not treat the checkout as “at L4”");
    expect(read("CHANGELOG.md")).toContain("## 2.4.3 — SHIPPED TO MAIN");
  });

  it("records v2.4.4 as summary and detail of one result", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v2.4.4`: Summary and detail of one result";
    const next = roadmap.indexOf("## **RELEASED** — `v2.4.5`:");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.4.4");
    expect(shipped).toContain("2.4.1");
    expect(shipped).toContain("ruleblast-companion-2.4.4.vsix");
    expect(shipped).toContain("--detail");
    expect(shipped).toContain("summary");
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.4.4 — SHIPPED TO MAIN");
  });

  it("records v2.4.5 as packed hosts of one result", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **RELEASED** — `v2.4.5`: Packed hosts of one result";
    const next = roadmap.indexOf("## **RELEASED** — `v2.4.6`:");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const released = roadmap.slice(start, next);
    expect(released).toContain("2.4.5");
    expect(released).toContain("ruleblast-companion-2.4.5.vsix");
    expect(released).toContain("MCP");
    expect(released).toContain("detail");
    expect(released).not.toMatch(/\bSHIPPED TO MAIN\b/u);
    for (const evidence of [
      "https://www.npmjs.com/package/ruleblast/v/2.4.5",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v2.4.5",
      "1bbdb7b276bede8e862e1b8c5ccc3d3f32497a13",
      "c599195b1c64cdff215e7380b7fee9d737e0a10e",
      "sha512-nnrLHacDTodnWAypkJZIiolXIMVIOo0TgHy711FK2bT3K3eimc3v6p61AdaH40Y1gSJQ8Z6SBOjYOYAQ55tt4Q==",
      "147,397",
      "9a8b228b0bcf42fc862704fa43f0a27c0b35a2b988a0f67bfd8e276998f950da",
      "142,254",
      "5b45c7fb9daf0e4674de1ab1007a0612e57d8cf11516551aba49739c0a865ea5",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(read("CHANGELOG.md")).toContain("## 2.4.5 — RELEASED");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.4\.5 — SHIPPED TO MAIN/u);
    expect(read("src/package-identity.ts")).toContain(
      'PUBLISHED_PACKAGE_VERSION = "2.5.9"',
    );
  });

  it("records v2.4.6 as the spec-driven pack interpreter", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **RELEASED** — `v2.4.6`: Spec-driven pack interpreter";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v2.4.7`: Sealed evidence and interpreter admission");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const released = roadmap.slice(start, next);
    expect(released).toContain("2.4.6");
    expect(released).toContain("ruleblast-companion-2.4.6.vsix");
    expect(released).toContain("interpret");
    expect(released).toContain("resolver.json");
    expect(released).toContain("POSSIBLY_STALE");
    expect(released).toContain("CONTINUE");
    expect(released).toContain("createCodexProfile");
    expect(released).not.toMatch(/\bSHIPPED TO MAIN\b/u);
    for (const evidence of [
      "https://www.npmjs.com/package/ruleblast/v/2.4.6",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v2.4.6",
      "137dec9cb431d6b6f20869e14252d3f5b8c838b8",
      "44124475babc60bbb73186debe311ab6753d2f6b",
      "sha512-MpYQzjNive82VKCJWqhUCx32/NXHgy8Hm878oCSt4u33y9bZgqLlTpYXPxNWHODZn+CL838IyzKZ1j/ip3SL8g==",
      "153,122",
      "c8438947be110f783b66e2f9746b5bbc6f9941a2bc5776a2a22af23fc063cdd9",
      "148,086",
      "877c565790c2e4b7366ef4ba467c9dd02efc7b0638ddca4fc95fb1faa67d0404",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(read("CHANGELOG.md")).toContain("## 2.4.6 — RELEASED");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.4\.6 — SHIPPED TO MAIN/u);
    expect(read("src/package-identity.ts")).toContain(
      'PUBLISHED_PACKAGE_VERSION = "2.5.9"',
    );
    expect(read("CHANGELOG.md")).toContain("ruleblast-companion-2.4.6.vsix");
  });

  it("records v2.4.7 as sealed evidence and interpreter admission", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v2.4.7`: Sealed evidence and interpreter admission";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v2.4.8`: Demo chrome and eight-card scoreboard");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.4.7");
    expect(shipped).toContain("2.4.6");
    expect(shipped).toContain("ruleblast-companion-2.4.7.vsix");
    expect(shipped).toContain("SEALED");
    expect(shipped).toContain("NO_KNOWN_DRIFT");
    expect(shipped).toContain("POSSIBLY_STALE");
    expect(shipped).toContain("uninterpretable");
    expect(shipped).toContain("not a recommendation");
    expect(shipped).toContain("ruleblast@2.4.6");
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.4.7 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.4\.7 — RELEASED/u);
  });

  it("records v2.4.8 as a demo presentation refresh", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v2.4.8`: Demo chrome and eight-card scoreboard";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v2.4.9`: Flush Windows Terminal tab chrome");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.4.8");
    expect(shipped).toContain("2.4.6");
    expect(shipped).toContain("ruleblast-companion-2.4.8.vsix");
    expect(shipped).toContain("35-frame");
    expect(shipped).toContain("eight-card");
    expect(shipped).toContain("Not a fifth action");
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.4.8 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.4\.8 — RELEASED/u);
  });

  it("records v2.4.9 as flush Windows Terminal tab chrome", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v2.4.9`: Flush Windows Terminal tab chrome";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v2.4.10`: Everyday CLI in the demo, git-log Diff From");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.4.9");
    expect(shipped).toContain("2.4.6");
    expect(shipped).toContain("ruleblast-companion-2.4.9.vsix");
    expect(shipped).toContain("flush title-bar chrome");
    expect(shipped).toContain("terminalBackground");
    expect(shipped).toContain("Not a fifth action");
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.4.9 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.4\.9 — RELEASED/u);
  });

  it("records v2.4.10 as everyday CLI demo and git-log Diff From", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v2.4.10`: Everyday CLI in the demo, git-log Diff From";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v2.4.11`: Agent index for large repositories");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.4.10");
    expect(shipped).toContain("2.4.6");
    expect(shipped).toContain("ruleblast-companion-2.4.10.vsix");
    expect(shipped).toContain("HEAD~1");
    expect(shipped).toContain("git log");
    expect(shipped).toContain("Same four actions");
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.4.10 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.4\.10 — RELEASED/u);
  });

  it("records v2.4.11 as the agent index for large repositories", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v2.4.11`: Agent index for large repositories";
    const next = roadmap.indexOf("## **RELEASED** — `v2.5.0`: Candidate Reality Conformance Lab");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.4.11");
    expect(shipped).toContain("2.4.6");
    expect(shipped).toContain("ruleblast-companion-2.4.11.vsix");
    expect(shipped).toContain("--index");
    expect(shipped).toContain("Not a fifth action");
    expect(shipped).toContain("Not a hosted index");
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.4.11 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.4\.11 — RELEASED/u);
  });

  it("records v2.5.0 as the candidate reality conformance lab", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **RELEASED** — `v2.5.0`: Candidate Reality Conformance Lab";
    const next = roadmap.indexOf("## **RELEASED** — `v2.5.1`: Copilot interpreted from resolver.json");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const released = roadmap.slice(start, next);
    expect(released).toContain("2.5.0");
    expect(released).toContain("ruleblast-companion-2.5.0.vsix");
    expect(released).toContain("RECORDED");
    expect(released).toContain("not a passing oracle");
    expect(released).toContain("oracle.json");
    expect(released).toContain("ORACLE");
    expect(released).toContain("ADAPTER");
    expect(released).toContain("Not a fifth action");
    expect(released).toContain("TypeScript remains the analysis authority");
    expect(released).not.toMatch(/\bSHIPPED TO MAIN\b/u);
    for (const evidence of [
      "https://www.npmjs.com/package/ruleblast/v/2.5.0",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v2.5.0",
      "a6ab195c517815cddfcbea326452e67782477fc9",
      "0afa7e251f70454078b50391cf93e5d7dc19cac5",
      "sha512-+L5dINRsAs5/vW2nSYbBpzwL4NTCAF7/P9corxZtjd/Ats/0VvKTlU61vYVL1xqW5S4MIo9e2LpqHeKS2f1Eag==",
      "174,972",
      "4fede04c92030ed7e98fdf44868f1c334f24b4d66b233ad2bf68cc6967272e4f",
      "157,848",
      "a1933630a594ae617defe530ea2e3bcaa44bba054a797f88e123710f90db1606",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(read("CHANGELOG.md")).toContain("## 2.5.0 — RELEASED");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.5\.0 — SHIPPED TO MAIN/u);
    expect(read("src/package-identity.ts")).toContain(
      'PUBLISHED_PACKAGE_VERSION = "2.5.9"',
    );
    expect(read("README.md")).toContain("ruleblast-companion-2.5.9.vsix");
  });

  it("records v2.5.1 as Copilot interpreted from resolver.json", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **RELEASED** — `v2.5.1`: Copilot interpreted from resolver.json";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v2.5.2`: Claude interpreted from resolver.json");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const released = roadmap.slice(start, next);
    expect(released).toContain("2.5.1");
    expect(released).toContain("ruleblast-companion-2.5.1.vsix");
    expect(released).toContain("applyTo");
    expect(released).toContain("INTERPRET");
    expect(released).toContain("createCopilotProfile");
    expect(released).toContain("transform");
    expect(released).toContain("Not a fifth action");
    expect(released).not.toMatch(/\bSHIPPED TO MAIN\b/u);
    for (const evidence of [
      "https://www.npmjs.com/package/ruleblast/v/2.5.1",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v2.5.1",
      "761f547ca00d911cf5c5b826461b82c01ccac900",
      "e60fd18ec4a83ce8aff7488b0bb9203ab4a8cedc",
      "sha512-cAchQ4It9MM4E+CmOMvnviX/zGic+28DvxbHIK908NN+qJ9aLAsi7iPiIEelKBJiY/N4Ie0RxiVeOqhB1TbfhQ==",
      "177,160",
      "32e3cc817f0dd915764f2f9d67c8b3f3f8aa4bc9215c11c8439842ed52ee6c4a",
      "160,281",
      "26ed18e60cf4f4bad0dfef78514f2924d2f14878355547c5644a6220e1b09869",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(read("CHANGELOG.md")).toContain("## 2.5.1 — RELEASED");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.5\.1 — SHIPPED TO MAIN/u);
    expect(read("package.json")).toContain('"version": "2.5.9"');
    expect(read("hosts/vscode/package.json")).toContain('"version": "2.5.9"');
    expect(read("CONTRIBUTING.md")).toContain("This tree is RuleBlast `v2.5.9`");
    expect(read("README.md")).toContain("ruleblast-companion-2.5.9.vsix");
    expect(read("src/package-identity.ts")).toContain(
      'PUBLISHED_PACKAGE_VERSION = "2.5.9"',
    );
  });

  it("records v2.5.2 as Claude interpreted from resolver.json", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v2.5.2`: Claude interpreted from resolver.json";
    const next = roadmap.indexOf("## **SHIPPED TO MAIN** — `v2.5.3`: Gemini interpreted by composed operations");
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.5.2");
    expect(shipped).toContain("2.5.1");
    expect(shipped).toContain("ruleblast-companion-2.5.2.vsix");
    expect(shipped).toContain("strip-html-comments");
    expect(shipped).toContain("json-exclude-globs");
    expect(shipped).toContain("createClaudeProfile");
    expect(shipped).toContain("onSymlink");
    expect(shipped).toContain("assemble");
    expect(shipped).toContain("Not a fifth action");
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.5.2 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.5\.2 — RELEASED/u);
    expect(read("package.json")).toContain('"version": "2.5.9"');
    expect(read("hosts/vscode/package.json")).toContain('"version": "2.5.9"');
    expect(read("src/package-identity.ts")).toContain(
      'PUBLISHED_PACKAGE_VERSION = "2.5.9"',
    );
  });

  it("records v2.5.3 as Gemini interpreted by composed operations", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **SHIPPED TO MAIN** — `v2.5.3`: Gemini interpreted by composed operations";
    const next = roadmap.indexOf(
      "## **SHIPPED TO MAIN** — `v2.5.4`: Host platform quoting and macOS verify",
    );
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.5.3");
    expect(shipped).toContain("2.5.1");
    expect(shipped).toContain("ruleblast-companion-2.5.3.vsix");
    expect(shipped).toContain("markdown-v1");
    expect(shipped).toContain("json-union-names");
    expect(shipped).toContain("createGeminiProfile");
    expect(shipped).toContain("Not a fifth action");
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.5.3 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.5\.3 — RELEASED/u);
    expect(read("package.json")).toContain('"version": "2.5.9"');
    expect(read("hosts/vscode/package.json")).toContain('"version": "2.5.9"');
    expect(read("src/package-identity.ts")).toContain(
      'PUBLISHED_PACKAGE_VERSION = "2.5.9"',
    );
  });

  it("records v2.5.4 as host platform quoting and macOS verify", () => {
    const roadmap = read("ROADMAP.md");
    const heading =
      "## **SHIPPED TO MAIN** — `v2.5.4`: Host platform quoting and macOS verify";
    const next = roadmap.indexOf(
      "## **SHIPPED TO MAIN** — `v2.5.5`: Host Git spawn and shared snapshot entry",
    );
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.5.4");
    expect(shipped).toContain("2.5.1");
    expect(shipped).toContain("ruleblast-companion-2.5.4.vsix");
    expect(shipped).toContain("hostShellDialect()");
    expect(shipped).toContain("macos-latest");
    expect(shipped).toContain("Not a fifth action");
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.5.4 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.5\.4 — RELEASED/u);
    expect(read("package.json")).toContain('"version": "2.5.9"');
    expect(read("hosts/vscode/package.json")).toContain('"version": "2.5.9"');
    expect(read(".github/workflows/verify.yml")).toContain("macos-latest");
    expect(read("src/package-identity.ts")).toContain(
      'PUBLISHED_PACKAGE_VERSION = "2.5.9"',
    );
  });

  it("records v2.5.5 as host Git spawn and shared snapshot entry", () => {
    const roadmap = read("ROADMAP.md");
    const heading =
      "## **SHIPPED TO MAIN** — `v2.5.5`: Host Git spawn and shared snapshot entry";
    const next = roadmap.indexOf(
      "## **SHIPPED TO MAIN** — `v2.5.6`: Runtime IDs, not model names",
    );
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.5.5");
    expect(shipped).toContain("2.5.1");
    expect(shipped).toContain("ruleblast-companion-2.5.5.vsix");
    expect(shipped).toContain("runGit()");
    expect(shipped).toContain("windowsHide");
    expect(shipped).toContain("ownSnapshotEntry()");
    expect(shipped).toContain("Not a fifth action");
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.5.5 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.5\.5 — RELEASED/u);
    expect(read("package.json")).toContain('"version": "2.5.9"');
    expect(read("hosts/vscode/package.json")).toContain('"version": "2.5.9"');
    expect(read("src/package-identity.ts")).toContain(
      'PUBLISHED_PACKAGE_VERSION = "2.5.9"',
    );
  });

  it("records v2.5.6 as runtime IDs, not model names", () => {
    const roadmap = read("ROADMAP.md");
    const heading =
      "## **SHIPPED TO MAIN** — `v2.5.6`: Runtime IDs, not model names";
    const next = roadmap.indexOf(
      "## **RELEASED** — `v2.5.7`: Exact runtime allowlist",
    );
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.5.6");
    expect(shipped).toContain("2.5.1");
    expect(shipped).toContain("ruleblast-companion-2.5.6.vsix");
    expect(shipped).toContain("xai/grok-build-cli");
    expect(shipped).toContain("qwen/qwen-code-cli");
    expect(shipped).toContain("IDs name runtimes, not models");
    expect(shipped).toContain("Not a fifth action");
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.5.6 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.5\.6 — RELEASED/u);
    expect(read("package.json")).toContain('"version": "2.5.9"');
    expect(read("hosts/vscode/package.json")).toContain('"version": "2.5.9"');
    expect(read("src/package-identity.ts")).toContain(
      'PUBLISHED_PACKAGE_VERSION = "2.5.9"',
    );
  });

  it("records v2.5.7 as an exact runtime allowlist", () => {
    const roadmap = read("ROADMAP.md");
    const heading = "## **RELEASED** — `v2.5.7`: Exact runtime allowlist";
    const next = roadmap.indexOf(
      "## **SHIPPED TO MAIN** — `v2.5.8`: Sealed runtime calibration and host discovery",
    );
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const released = roadmap.slice(start, next);
    expect(released).toContain("2.5.7");
    expect(released).toContain("ruleblast-companion-2.5.7.vsix");
    expect(released).toContain("allowlist");
    expect(released).toContain("No model-name denylist");
    expect(released).toContain("HostProcess");
    expect(released).toContain("Not a fifth action");
    expect(released).not.toMatch(/\bSHIPPED TO MAIN\b/u);
    for (const evidence of [
      "https://www.npmjs.com/package/ruleblast/v/2.5.7",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v2.5.7",
      "dd46f4a9c08d10a9de1f113092b6036091e0f2da",
      "cda8834b3bc79f52123eb4f05019b35d775c9655",
      "796c5d9abdde755f5827351358b747ce30260cb1",
      "f4154fd063e99f0f6e43e78b2e62ce2516cbdf0e",
      "7b99d529355383977ad4589d746fe83c87a59185",
      "742e27d07cec76e72a18c40598315e0b11b2b146",
      "cf6badd2ab376f1aa7f6f9b1d3be9559c1457503",
      "sha512-SzTP41slyb4hvPPYZ0KHj97SLf8sesfHz2morW/O55tQ9FTG4QoIhYgprxgNNT1YhXdTq5kQBJKDLD+Wm/eQVQ==",
      "185,439",
      "8873e179d261ecb7715b88c9268abcd7233720b40fcb7657bbd024f419c5d426",
      "167,204",
      "afac7b99c17afd07fee7255e6abca78fa04c518416f2cb8a2309b9728b93155e",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(read("CHANGELOG.md")).toContain("## 2.5.7 — RELEASED");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.5\.7 — SHIPPED TO MAIN/u);
    expect(read("package.json")).toContain('"version": "2.5.9"');
    expect(read("hosts/vscode/package.json")).toContain('"version": "2.5.9"');
    expect(read("src/package-identity.ts")).toContain(
      'PUBLISHED_PACKAGE_VERSION = "2.5.9"',
    );
  });

  it("records v2.5.8 as sealed runtime calibration and host discovery", () => {
    const roadmap = read("ROADMAP.md");
    const heading =
      "## **SHIPPED TO MAIN** — `v2.5.8`: Sealed runtime calibration and host discovery";
    const next = roadmap.indexOf(
      "## **RELEASED** — `v2.5.9`: Honest calibration, macOS realpath, and MCP flags",
    );
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const shipped = roadmap.slice(start, next);
    expect(shipped).toContain("2.5.8");
    expect(shipped).toContain("2.5.7");
    expect(shipped).toContain("ruleblast-companion-2.5.8.vsix");
    expect(shipped).toContain("calibration.json");
    expect(shipped).toContain("NO_INTROSPECTION");
    expect(shipped).toContain("unversioned");
    expect(shipped).toContain("CX≠CC");
    expect(shipped).toContain("JetBrains");
    expect(shipped).toContain("Visual Studio");
    expect(shipped).toContain("Neovim");
    expect(shipped).toContain("VSCodium");
    expect(shipped).toContain("Not a fifth action");
    expect(shipped).not.toMatch(/\bRELEASED\b/u);
    expect(read("CHANGELOG.md")).toContain("## 2.5.8 — SHIPPED TO MAIN");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.5\.8 — RELEASED/u);
    expect(read("package.json")).toContain('"version": "2.5.9"');
    expect(read("hosts/vscode/package.json")).toContain('"version": "2.5.9"');
    expect(read("src/package-identity.ts")).toContain(
      'PUBLISHED_PACKAGE_VERSION = "2.5.9"',
    );
  });

  it("records v2.5.9 as honest calibration, macOS realpath, and MCP flags", () => {
    const roadmap = read("ROADMAP.md");
    const heading =
      "## **RELEASED** — `v2.5.9`: Honest calibration, macOS realpath, and MCP flags";
    const next = roadmap.indexOf(
      "## **NEXT** — Vendor CLI dump when a surface publishes one",
    );
    const start = roadmap.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(start);
    const released = roadmap.slice(start, next);
    expect(released).toContain("2.5.9");
    expect(released).toContain("ruleblast-companion-2.5.9.vsix");
    expect(released).toContain("NO_INTROSPECTION");
    expect(released).toContain("ORACLE");
    expect(released).toContain("pathsOnly");
    expect(released).toContain("witness");
    expect(released).toContain("/var");
    expect(released).toContain("Not a fifth action");
    expect(released).not.toMatch(/\bSHIPPED TO MAIN\b/u);
    for (const evidence of [
      "https://www.npmjs.com/package/ruleblast/v/2.5.9",
      "https://github.com/Kpoiut/ruleblast/releases/tag/v2.5.9",
      "f924055b3f646d6ef53d5215a58cdee9e8ad8fdd",
      "384d4c621d6226854a67773e2000ddeb0b0b139f",
      "e841da784e18b87f706bd266aad7c07b2f1d2b60",
      "8cc3a9f737c344c6f360ba9df5eceeceb170dfa8",
      "sha512-6u2kdervEjkbPjXgEKxJ3oBGmi+b2j3TpkIZJ7kKwWKv9g/cgIH+YtEDBOXq/rcQX+mXqzsl6+EpfUUHWd12hw==",
      "204,749",
      "96debe28b646e914cbb60ed53b8f2c72202b3f241e3cf3958e25cd8f8c22493f",
      "185,323",
      "6aadb190b06442ece123811cc950010cfa4616906553da6bd8f904122aa7ff7f",
      "not facts inferred from this checkout",
    ]) {
      expect(released).toContain(evidence);
    }
    expect(read("CHANGELOG.md")).toContain("## 2.5.9 — RELEASED");
    expect(read("CHANGELOG.md")).not.toMatch(/## 2\.5\.9 — SHIPPED TO MAIN/u);
    expect(read("package.json")).toContain('"version": "2.5.9"');
    expect(read("hosts/vscode/package.json")).toContain('"version": "2.5.9"');
    expect(read("src/package-identity.ts")).toContain(
      'PUBLISHED_PACKAGE_VERSION = "2.5.9"',
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
