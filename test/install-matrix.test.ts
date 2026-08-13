import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("candidate installation matrix", () => {
  it("runs every release gate in each supported OS and Node cell", async () => {
    const workflow = await readFile(
      new URL("../.github/workflows/verify.yml", import.meta.url),
      "utf8",
    );
    expect(workflow).toContain("os: [ubuntu-latest, windows-latest]");
    expect(workflow).toContain("node: [20, 22, 24]");
    const jobs = workflow.slice(workflow.indexOf("jobs:"));
    expect(jobs.match(/^  [a-z][a-z-]+:$/gmu)).toHaveLength(1);

    let cursor = 0;
    for (const command of [
      "npm ci --ignore-scripts",
      "npm run check",
      "npm run build",
      "npm run package:smoke",
      "npm run install:smoke",
    ]) {
      const position = workflow.indexOf(command, cursor);
      expect(position, `missing or out-of-order workflow command: ${command}`)
        .toBeGreaterThanOrEqual(cursor);
      cursor = position + command.length;
    }
  });

  it("exercises isolated local and global lifecycle flows from one packed tarball", async () => {
    const moduleUrl = new URL("../scripts/install-smoke.mjs", import.meta.url).href;
    const runner = await import(moduleUrl) as {
      runInstallSmoke(): Promise<Record<string, unknown>>;
    };
    expect(await runner.runInstallSmoke()).toMatchObject({
      ok: true,
      artifactCount: 1,
      cacheInitiallyEmpty: true,
      installScriptsIgnored: true,
      npmExecVerified: true,
      hostShell: process.platform === "win32" ? "powershell" : "bash",
      lifecycleSentinelUntouched: true,
      fsmonitorUntouched: true,
      local: {
        installed: true,
        shim: process.platform === "win32" ? "cmd" : "posix",
        version: "ruleblast 1.0.2",
        caseVerified: true,
        analysisVerified: true,
        repositoryUnchanged: true,
        reinstalled: true,
        uninstalled: true,
      },
      global: {
        installed: true,
        shim: process.platform === "win32" ? "cmd" : "posix",
        version: "ruleblast 1.0.2",
        caseVerified: true,
        analysisVerified: true,
        repositoryUnchanged: true,
        reinstalled: true,
        uninstalled: true,
      },
    });
  }, 120_000);

  it("documents exact, non-interactive and reversible install commands", async () => {
    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
    for (const command of [
      "npx --yes ruleblast@1.0.2 --help",
      "npx --yes ruleblast@1.0.2 .",
      "npm install --save-dev --save-exact ruleblast@1.0.2",
      "ruleblast --version",
      "npx ruleblast --version",
      "npm uninstall --global ruleblast",
      "npm uninstall --save-dev ruleblast",
      "npm ci --ignore-scripts",
    ]) {
      expect(readme).toContain(command);
    }
    expect(readme).toMatch(
      /npm uninstall --global ruleblast[\s\S]+npm install --global ruleblast@1\.0\.2/u,
    );
    expect(readme).toMatch(
      /npm uninstall --save-dev ruleblast[\s\S]+npm install --save-dev --save-exact ruleblast@1\.0\.2/u,
    );
    expect(readme).toContain(
      "git clone --branch v1.0.2 --depth 1 https://github.com/Kpoiut/ruleblast.git",
    );
    expect(readme).toMatch(/Windows.+Linux/isu);
    expect(readme).not.toMatch(/Windows.+macOS.+Linux/isu);
    expect(readme).not.toMatch(/npx (?!--yes )ruleblast@1\.0\.2/gu);
  });

  it("terminates timed-out process descendants before rejecting", async () => {
    const root = await mkdtemp(join(tmpdir(), "ruleblast-process-tree-"));
    const sentinel = join(root, "orphan.txt");
    try {
      const moduleUrl = new URL("../scripts/release-process.mjs", import.meta.url).href;
      const processModule = await import(moduleUrl) as {
        runProcess(
          command: string,
          args: readonly string[],
          options: Record<string, unknown>,
        ): Promise<unknown>;
      };
      const descendant = [
        "const { spawn } = require('node:child_process');",
        `spawn(process.execPath, ['-e', ${JSON.stringify(
          `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'orphan'), 1200)`,
        )}], { stdio: 'ignore' });`,
        "setInterval(() => {}, 1000);",
      ].join("\n");
      await expect(processModule.runProcess(
        process.execPath,
        ["-e", descendant],
        { timeoutMs: 300 },
      )).rejects.toThrow(/timed out/iu);
      await new Promise((resolveWait) => setTimeout(resolveWait, 1_500));
      expect(existsSync(sentinel)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 10_000);

  it("bounds npm pack before the install fixture can be left behind", async () => {
    const root = await mkdtemp(join(tmpdir(), "ruleblast-pack-timeout-"));
    const packDirectory = join(root, "pack");
    const fakeNpm = join(root, "slow-npm.mjs");
    try {
      await mkdir(packDirectory);
      await writeFile(
        fakeNpm,
        "setTimeout(() => process.stdout.write('[]'), 500);\n",
      );
      const moduleUrl = new URL("../scripts/package-pack.mjs", import.meta.url).href;
      const packModule = await import(moduleUrl) as {
        packPackage(
          repositoryRoot: string,
          outputDirectory: string,
          environment: NodeJS.ProcessEnv,
          options: { timeoutMs: number },
        ): Promise<unknown>;
      };
      await expect(packModule.packPackage(
        root,
        packDirectory,
        { ...process.env, npm_execpath: fakeNpm },
        { timeoutMs: 100 },
      )).rejects.toThrow(/timed out/iu);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);

  it("keeps unpublished registry parity behind an exact-version guard", async () => {
    const moduleUrl = new URL("../scripts/install-smoke.mjs", import.meta.url).href;
    const runner = await import(moduleUrl) as Record<string, unknown>;
    expect(runner.registryPackageSpecifier).toBeTypeOf("function");
    const registryPackageSpecifier = runner.registryPackageSpecifier as (
      version: string,
      environment: Record<string, string>,
    ) => string;
    expect(() => registryPackageSpecifier("1.0.2", {})).toThrow(/guard/iu);
    expect(registryPackageSpecifier("1.0.2", {
      RULEBLAST_REGISTRY_SMOKE: "ruleblast@1.0.2",
    })).toBe("ruleblast@1.0.2");

    const installArguments = runner.installArguments as (
      scope: "local" | "global",
      target: string,
      source: string,
      dependencies: readonly string[],
      offline: boolean,
    ) => string[];
    const npmExecArguments = runner.npmExecArguments as (
      source: string,
      dependencies: readonly string[],
      offline: boolean,
    ) => string[];
    for (const args of [
      installArguments("local", "repo", "ruleblast@1.0.2", [], false),
      installArguments("global", "prefix", "ruleblast@1.0.2", [], false),
      npmExecArguments("ruleblast@1.0.2", [], false),
    ]) {
      expect(args).toContain("ruleblast@1.0.2");
      expect(args).not.toContain("--offline");
    }
  });

  it("replaces inherited npm controls case-insensitively", async () => {
    const moduleUrl = new URL("../scripts/install-smoke.mjs", import.meta.url).href;
    const runner = await import(moduleUrl) as Record<string, unknown>;
    expect(runner.npmEnvironment).toBeTypeOf("function");
    const npmEnvironment = runner.npmEnvironment as (
      cache: string,
      inherited: NodeJS.ProcessEnv,
    ) => NodeJS.ProcessEnv;
    const environment = npmEnvironment("isolated-cache", {
      NPM_CONFIG_CACHE: "host-cache",
      Npm_Config_Audit: "true",
      npm_config_fund: "true",
      NPM_CONFIG_OFFLINE: "true",
      npm_config_update_notifier: "true",
      ruleblast_lifecycle_sentinel: "host-sentinel",
      PATH: process.env.PATH,
    });
    for (const [name, expected] of [
      ["npm_config_cache", "isolated-cache"],
      ["npm_config_audit", "false"],
      ["npm_config_fund", "false"],
      ["npm_config_offline", "false"],
      ["npm_config_update_notifier", "false"],
    ] as const) {
      const matches = Object.entries(environment)
        .filter(([key]) => key.toLowerCase() === name);
      expect(matches).toEqual([[name, expected]]);
    }
    expect(Object.keys(environment).some(
      (key) => key.toLowerCase() === "ruleblast_lifecycle_sentinel",
    )).toBe(false);
  });

  it("keeps the install runner separate and every production script below 400 lines", async () => {
    const installSmoke = await readFile(
      new URL("../scripts/install-smoke.mjs", import.meta.url),
      "utf8",
    );
    const packageSmoke = await readFile(
      new URL("../scripts/package-smoke.mjs", import.meta.url),
      "utf8",
    );
    const releaseProcess = await readFile(
      new URL("../scripts/release-process.mjs", import.meta.url),
      "utf8",
    );
    expect(installSmoke.split(/\r?\n/u).length).toBeLessThanOrEqual(400);
    expect(packageSmoke.split(/\r?\n/u).length).toBeLessThanOrEqual(400);
    expect(installSmoke).not.toContain("function copyRuntimePackage");
    expect(releaseProcess).toMatch(
      /const capture = \(target\) => \(chunk\) => \{\s+if \(settled\) return;\s+outputBytes \+= chunk\.length;/u,
    );
  });
});
