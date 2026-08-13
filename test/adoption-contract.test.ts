import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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
    expect(readme).toMatch(/no network or model call/iu);
    expect(readme).toMatch(/mutation, sync, generation, scoring, or auto-fix/iu);
    expect(readme).toMatch(/network calls, model calls, telemetry, dashboard, or product UI/iu);
  });
});
