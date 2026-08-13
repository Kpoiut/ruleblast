import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path: string): string =>
  readFileSync(join(repositoryRoot, path), "utf8");
const readJson = <T>(path: string): T => JSON.parse(read(path)) as T;

interface PackageDescriptor {
  readonly version: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly repository: { readonly type: string; readonly url: string };
  readonly homepage: string;
  readonly bugs: { readonly url: string };
  readonly engines: { readonly node: string };
  readonly files: readonly string[];
}

interface PackageLock {
  readonly version: string;
  readonly packages: Readonly<Record<string, { readonly version?: string }>>;
}

describe("v1.0.2 adoption contract", () => {
  it("locks the exact package identity and supported discovery metadata", () => {
    const descriptor = readJson<PackageDescriptor>("package.json");
    const lock = readJson<PackageLock>("package-lock.json");

    expect(descriptor).toMatchObject({
      version: "1.0.2",
      description:
        "Map where AGENTS.md and CLAUDE.md changes land across a repo—and where Codex and Claude Code split.",
      repository: {
        type: "git",
        url: "git+https://github.com/Kpoiut/ruleblast.git",
      },
      homepage: "https://github.com/Kpoiut/ruleblast#readme",
      bugs: { url: "https://github.com/Kpoiut/ruleblast/issues" },
      engines: { node: ">=20" },
    });
    expect(descriptor.keywords).toEqual([
      "agents.md",
      "claude.md",
      "codex",
      "claude-code",
      "ai-coding-agents",
      "repository-instructions",
      "instruction-scope",
      "blast-radius",
      "git",
      "cli",
      "developer-tools",
    ]);
    expect(lock.version).toBe("1.0.2");
    expect(lock.packages[""]?.version).toBe("1.0.2");

    const discovery = `${descriptor.description}\n${descriptor.keywords.join("\n")}`;
    expect(discovery).not.toMatch(
      /copilot|cursor|gemini|all agents|model quality|model compliance/iu,
    );
  });

  it("preserves immutable evidence and the historical release record", () => {
    const receipt = readFileSync(join(
      repositoryRoot,
      "cases/kpoiut__ruleblast/27d52e2cd6ee..e420008a1c10.json",
    ));
    expect(receipt.byteLength).toBe(716_411);
    expect(createHash("sha256").update(receipt).digest("hex")).toBe(
      "5735038d47cae7b538e113d51214dbbc6ecd29cbca815912813abaa900ecfc89",
    );
    expect(receipt.toString("utf8")).toContain("ruleblast@1.0.0");

    const readme = read("README.md");
    expect(readme).toContain(
      "npx ruleblast@1.0.0 diff 27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8 --to e420008a1c10c5c328e506247560117f4d40b855 --json",
    );

    const changelog = read("CHANGELOG.md");
    const v101Start = changelog.indexOf("## 1.0.1");
    const v100Start = changelog.indexOf("## 1.0.0");
    expect(v101Start).toBeGreaterThan(-1);
    expect(v100Start).toBeGreaterThan(v101Start);
    expect(changelog.slice(v101Start, v100Start)).toContain(
      "hidden v1 compatibility alias",
    );
    expect(changelog.slice(v100Start)).toContain("A packaged `DEMO FIXTURE`");
  });

  it("keeps the public onboarding on the verified case and product boundary", () => {
    const readme = read("README.md");
    expect(readme).toContain("## Run the verified case");
    expect(readme).toContain("npx --yes ruleblast@1.0.2 case");
    expect(readme).not.toMatch(/ruleblast demo/iu);
    expect(readme).not.toContain("DEMO FIXTURE");
    expect(readme).not.toContain("remains conditional");
    expect(readme).not.toMatch(/after (the )?tag is visible|`1\.0\.2` build carries/iu);
    expect(readme).toContain(
      "https://github.com/Kpoiut/ruleblast/actions/runs/31722775046",
    );
    expect(readme).toMatch(/registry upgrade.+verified.+eight/isu);
    expect(readme).toMatch(/no network or model call/iu);
    expect(readme).toMatch(/mutation, sync, generation, scoring, or auto-fix/iu);
    expect(readme).toMatch(/network calls, model calls, telemetry, dashboard, or product UI/iu);

    const tagline = readme.indexOf("See where <code>AGENTS.md</code>");
    const quickStart = readme.indexOf("<code>npx --yes ruleblast@1.0.2 case</code>");
    const proofLink = readme.indexOf('href="#two-lines-206-path-stacks-one-exact-cause"');
    const installLink = readme.indexOf('href="#install"');
    const contributeLink = readme.indexOf('href="#contribute-a-blast-case"');
    const causalProof = readme.indexOf("assets/ruleblast-causal-proof.gif");
    expect(tagline).toBeGreaterThan(-1);
    expect(quickStart).toBeGreaterThan(tagline);
    expect(proofLink).toBeGreaterThan(quickStart);
    expect(installLink).toBeGreaterThan(proofLink);
    expect(contributeLink).toBeGreaterThan(installLink);
    expect(causalProof).toBeGreaterThan(contributeLink);
  });

  it("publishes a truthful community funnel without shipping repository-only assets", () => {
    const required = [
      ".github/ISSUE_TEMPLATE/config.yml",
      ".github/ISSUE_TEMPLATE/install-run.yml",
      ".github/ISSUE_TEMPLATE/docs-correction.yml",
      ".github/PULL_REQUEST_TEMPLATE.md",
      "SECURITY.md",
      "CODE_OF_CONDUCT.md",
    ] as const;
    for (const path of required) {
      expect(existsSync(join(repositoryRoot, path)), path).toBe(true);
    }

    const chooser = read(".github/ISSUE_TEMPLATE/config.yml");
    expect(chooser).toContain("blank_issues_enabled: false");
    expect(chooser.match(/^\s+url:/gmu)).toHaveLength(2);
    expect(chooser).toContain(
      "https://github.com/Kpoiut/ruleblast/security/advisories/new",
    );
    expect(chooser).toContain(
      "https://github.com/Kpoiut/ruleblast/blob/main/CONTRIBUTING.md",
    );
    expect(chooser).toMatch(/only when.+private reporting.+enabled/iu);

    const pullRequest = read(".github/PULL_REQUEST_TEMPLATE.md");
    expect(pullRequest).toMatch(/immutable (commit )?refs/iu);
    expect(pullRequest).toMatch(/official evidence URL.+revision/iu);
    expect(pullRequest).toMatch(/uncertainty/iu);
    expect(pullRequest).toContain("npm run check");
    expect(pullRequest).toContain("npm run build");
    expect(pullRequest).toContain("git diff --check");

    const security = read("SECURITY.md");
    expect(security).toMatch(/do not include exploit details in a public issue/iu);
    expect(security).toMatch(/no response-time or remediation-time guarantee/iu);
    expect(security).toMatch(/latest published `1\.0\.x`/iu);
    expect(security).toMatch(/security\/advisories\/new.+UNAVAILABLE/isu);
    expect(security).not.toMatch(/private vulnerability reporting is enabled/iu);

    const conduct = read("CODE_OF_CONDUCT.md");
    expect(conduct).toMatch(/harassment/iu);
    expect(conduct).toMatch(/privacy/iu);
    expect(conduct).toMatch(/maintainers/iu);

    const installReport = read(".github/ISSUE_TEMPLATE/install-run.yml");
    for (const field of [
      "package_or_commit",
      "npm_view",
      "node_npm",
      "operating_system_shell",
      "redacted_command",
      "redacted_output",
    ]) {
      expect(installReport).toContain(`id: ${field}`);
    }
    expect(installReport).toMatch(/labels:\s*\n\s+- bug/iu);

    const docsCorrection = read(".github/ISSUE_TEMPLATE/docs-correction.yml");
    expect(docsCorrection).toMatch(/labels:\s*\n\s+- documentation/iu);
    for (const field of ["page_or_link", "problem", "suggested_correction"]) {
      expect(docsCorrection).toContain(`id: ${field}`);
    }
    expect(docsCorrection.match(/required:\s*true/gu)).toHaveLength(3);

    const contributing = read("CONTRIBUTING.md");
    expect(contributing).toContain("## Pull requests");
    expect(contributing).toContain(".github/PULL_REQUEST_TEMPLATE.md");
    expect(contributing).toContain(
      "https://github.com/Kpoiut/ruleblast/issues/new?template=docs-correction.yml",
    );
    expect(contributing).toMatch(/no Blast Case or canonical JSON is required/iu);

    const descriptor = readJson<PackageDescriptor>("package.json");
    expect(descriptor.files).not.toContain(".github");
    expect(descriptor.files).not.toContain("SECURITY.md");
    expect(existsSync(join(
      repositoryRoot,
      "assets/ruleblast-social-preview.png",
    ))).toBe(false);
  });

  it("uses the selected horizontal hero without shipping presentation media", () => {
    const readme = read("README.md");
    const asset = "assets/ruleblast-hero.png";
    const bytes = readFileSync(join(repositoryRoot, asset));
    expect(readme).toContain(
      `https://raw.githubusercontent.com/Kpoiut/ruleblast/main/${asset}`,
    );
    expect(readme).toContain('width="100%"');
    expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(bytes.readUInt32BE(16)).toBe(1_774);
    expect(bytes.readUInt32BE(20)).toBe(887);
    expect(bytes.byteLength).toBe(1_730_674);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "97672cba5a0b740fdcb21f57fa63b0bf2884c1c6e8114247d15ab1db77593564",
    );
    const descriptor = readJson<PackageDescriptor>("package.json");
    expect(descriptor.files).not.toContain(asset);
    expect(existsSync(join(repositoryRoot, "assets/ruleblast-eye.webp"))).toBe(false);
  });

  it("leads with an evidence-locked causal hero instead of a demo fixture", () => {
    const readme = read("README.md");
    const eye = readme.indexOf("assets/ruleblast-hero.png");
    const hero = readme.indexOf("assets/ruleblast-causal-proof.gif");
    const cause = readme.indexOf("2 instruction-line edits");
    const blast = readme.indexOf("206 tracked paths changed stack");
    const explain = readme.indexOf(
      "codex-rs/tui/src/bottom_pane/action_required_title.rs",
    );
    const install = readme.indexOf("## Install");
    expect(eye).toBeGreaterThan(-1);
    expect(hero).toBeGreaterThan(eye);
    expect(cause).toBeGreaterThan(hero);
    expect(blast).toBeGreaterThan(cause);
    expect(explain).toBeGreaterThan(blast);
    expect(install).toBeGreaterThan(explain);
    expect(readme).toContain(
      "8fcf2ad931b90589dd29a571f367e3185d26bbe0",
    );
    expect(readme).toContain(
      "f0f483e8b2a2630bf8dfa5f8451e81eba20def6c",
    );
    expect(readme).toContain("4,476 tracked paths remained unchanged");
    expect(readme).toContain("Codex changed: 206 · Claude Code changed: 0");
    expect(readme).toContain("openai/codex-cli@1");
    expect(readme).toContain("anthropic/claude-code-cli@1");
    expect(readme).toContain("DIFFERENT → DIFFERENT");
    expect(readme).toMatch(/no path newly split across profiles/iu);
    expect(readme).toMatch(/zero partial, zero unknown, and zero indeterminate/iu);
    expect(readme).toMatch(/not a claim about model compliance or response behavior/iu);
    expect(readme).toContain(
      "517cc07af9d2d7dafb48b9f2b3cfaecd85444a1d",
    );
    expect(readme).toContain(
      "5659e4cb83051aeaa246c3b45fad75698754806db30f4e710849d220d12ee9d2",
    );
    expect(readme).toContain("resolver revision 1");
    expect(readme).toContain(
      "https://github.com/openai/codex/blob/f73a07224653c2cc775b3f84f129b872b1e08f85/LICENSE",
    );
    expect(readme).toContain(
      "ruleblast diff 8fcf2ad931b90589dd29a571f367e3185d26bbe0 --to f0f483e8b2a2630bf8dfa5f8451e81eba20def6c",
    );
    expect(readme).not.toMatch(/AI behavior|AI brains|DEMO FIXTURE|ruleblast demo/iu);

    const heroPath = join(repositoryRoot, "assets/ruleblast-causal-proof.gif");
    const bytes = readFileSync(heroPath);
    expect(bytes.subarray(0, 6).toString("ascii")).toBe("GIF89a");
    expect(bytes.readUInt16LE(6)).toBe(1200);
    expect(bytes.readUInt16LE(8)).toBe(675);
    expect(statSync(heroPath).size).toBeLessThanOrEqual(5 * 1024 * 1024);
    const frameControls: Array<{
      readonly delayCentiseconds: number;
      readonly disposal: number;
    }> = [];
    let totalDelayCentiseconds = 0;
    for (let offset = 0; offset <= bytes.length - 8; offset += 1) {
      if (
        bytes[offset] === 0x21 && bytes[offset + 1] === 0xf9 &&
        bytes[offset + 2] === 0x04
      ) {
        const delayCentiseconds = bytes.readUInt16LE(offset + 4);
        frameControls.push({
          delayCentiseconds,
          disposal: ((bytes[offset + 3] ?? 0) >> 2) & 0x07,
        });
        totalDelayCentiseconds += delayCentiseconds;
      }
    }
    expect(frameControls).toHaveLength(15);
    expect(frameControls.every(({ disposal }) => disposal === 1)).toBe(true);
    expect(frameControls.every(({ delayCentiseconds }) =>
      delayCentiseconds > 0 && delayCentiseconds <= 70
    )).toBe(true);
    expect(totalDelayCentiseconds).toBe(1_050);
    expect(bytes.toString("ascii")).toContain("NETSCAPE2.0");
    expect(bytes.toString("ascii")).toContain(
      "RULEBLAST_POSTER=A tiny instruction diff; complete held frames only",
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "c4a79cf8e53c47e2ab1c3fef69b4f83ebe56bcaf7644e6b9e1225fc23881b1eb",
    );

    const descriptor = readJson<PackageDescriptor>("package.json");
    expect(descriptor.files).not.toContain("assets/ruleblast-causal-proof.gif");

    const changelog = read("CHANGELOG.md");
    const current = changelog.slice(0, changelog.indexOf("## 1.0.1"));
    expect(current).toMatch(/causal proof/iu);
    expect(current).toContain("2 instruction-line edits");
    expect(current).toContain("206 tracked paths");
  });
});
