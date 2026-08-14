import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface WorkflowStep {
  readonly name?: string;
  readonly if?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly run?: string;
}

interface VerifyWorkflow {
  readonly jobs: {
    readonly verify: {
      readonly "timeout-minutes": number;
      readonly strategy: {
        readonly matrix: {
          readonly os: readonly string[];
          readonly node: readonly number[];
        };
      };
      readonly steps: readonly WorkflowStep[];
    };
  };
}

async function waitForFile(path: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(path)) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for fixture file: ${path}`);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (processIsAlive(pid)) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed-out descendant is still alive: ${pid}`);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
}

describe("candidate installation matrix", () => {
  it("runs every release gate in each supported OS and Node cell", async () => {
    const workflow = await readFile(
      new URL("../.github/workflows/verify.yml", import.meta.url),
      "utf8",
    );
    expect(workflow).toContain("os: [ubuntu-latest, windows-latest]");
    expect(workflow).toContain("node: [20, 22, 24, 26]");
    expect(workflow).toContain("workflow_dispatch:");
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
    expect(workflow).toContain("RULEBLAST_REGISTRY_SMOKE: ruleblast@1.3.0");
    expect(workflow).toContain(
      "RULEBLAST_REGISTRY_UPGRADE_FROM: ruleblast@1.0.2",
    );
    expect(workflow).toContain("npm run install:smoke -- --registry");
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain("github.ref == 'refs/tags/v1.3.0'");
    const parsed = parse(workflow) as VerifyWorkflow;
    const job = parsed.jobs.verify;
    expect(job["timeout-minutes"]).toBe(20);
    expect(job.strategy.matrix).toEqual({
      os: ["ubuntu-latest", "windows-latest"],
      node: [20, 22, 24, 26],
    });
    const registryStep = job.steps.find(
      (step) => step.name === "Verify published registry upgrade",
    );
    expect(registryStep).toEqual(expect.objectContaining({
      if: "github.event_name == 'workflow_dispatch' && github.ref == 'refs/tags/v1.3.0'",
      env: {
        RULEBLAST_REGISTRY_SMOKE: "ruleblast@1.3.0",
        RULEBLAST_REGISTRY_UPGRADE_FROM: "ruleblast@1.0.2",
      },
      run: "npm run install:smoke -- --registry",
    }));
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
      mode: "candidate",
      hostShells: process.platform === "win32"
        ? ["cmd.exe", "powershell"]
        : ["bash"],
      lifecycleSentinelUntouched: true,
      fsmonitorUntouched: true,
      registryUpgrade: null,
      local: {
        installed: true,
        shim: process.platform === "win32" ? "cmd" : "posix",
        version: "ruleblast 1.3.0",
        caseVerified: true,
        analysisVerified: true,
        repositoryUnchanged: true,
        hostShells: process.platform === "win32"
          ? ["cmd.exe", "powershell"]
          : ["bash"],
        reinstalled: true,
        uninstalled: true,
      },
      global: {
        installed: true,
        shim: process.platform === "win32" ? "cmd" : "posix",
        version: "ruleblast 1.3.0",
        caseVerified: true,
        analysisVerified: true,
        repositoryUnchanged: true,
        hostShells: process.platform === "win32"
          ? ["cmd.exe", "powershell"]
          : ["bash"],
        reinstalled: true,
        uninstalled: true,
      },
    });
  }, 120_000);

  it("documents exact, non-interactive and reversible install commands", async () => {
    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
    for (const command of [
      "npx --yes ruleblast@1.3.0 --help",
      "npx --yes ruleblast@1.3.0 .",
      "npm install --save-dev --save-exact ruleblast@1.3.0",
      "ruleblast --version",
      "npx ruleblast --version",
      "npm uninstall --global ruleblast",
      "npm uninstall --save-dev ruleblast",
      "npm ci --ignore-scripts",
    ]) {
      expect(readme).toContain(command);
    }
    expect(readme).toMatch(
      /npm uninstall --global ruleblast[\s\S]+npm install --global ruleblast@1\.3\.0/u,
    );
    expect(readme).toMatch(
      /npm uninstall --save-dev ruleblast[\s\S]+npm install --save-dev --save-exact ruleblast@1\.3\.0/u,
    );
    expect(readme).toContain(
      "git clone --branch v1.3.0 --depth 1 https://github.com/Kpoiut/ruleblast.git",
    );
    expect(readme).toMatch(/Windows.+Linux/isu);
    expect(readme).not.toMatch(/Windows.+macOS.+Linux/isu);
    expect(readme).not.toMatch(/npx (?!--yes )ruleblast@1\.3\.0/gu);
  });

  it("terminates timed-out process descendants before rejecting", async () => {
    const root = await mkdtemp(join(tmpdir(), "ruleblast-process-tree-"));
    const heartbeat = join(root, "descendant-heartbeat.txt");
    const pidFile = join(root, "descendant-pid.txt");
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
          [
            "const { writeFileSync } = require('node:fs');",
            `writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));`,
            "let sequence = 0;",
            `const beat = () => writeFileSync(${JSON.stringify(heartbeat)}, String(++sequence));`,
            "beat();",
            "setInterval(beat, 50);",
          ].join("\n"),
        )}], { stdio: 'ignore' });`,
        "setInterval(() => {}, 1000);",
      ].join("\n");
      const outcome = processModule.runProcess(
        process.execPath,
        ["-e", descendant],
        { timeoutMs: 2_000 },
      ).then(
        () => new Error("Timed-out fixture unexpectedly completed"),
        (error: unknown) => error,
      );
      await waitForFile(pidFile, 1_500);
      await waitForFile(heartbeat, 1_500);
      const error = await outcome;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/timed out/iu);

      const descendantPid = Number.parseInt(await readFile(pidFile, "utf8"), 10);
      expect(Number.isSafeInteger(descendantPid)).toBe(true);
      await waitForProcessExit(descendantPid, 500);
      const stoppedHeartbeat = await readFile(heartbeat, "utf8");
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
      expect(await readFile(heartbeat, "utf8")).toBe(stoppedHeartbeat);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);

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
    const lifecycle = await import(
      new URL("../scripts/install-lifecycle-smoke.mjs", import.meta.url).href
    ) as Record<string, unknown>;
    expect(runner.registryPackageSpecifier).toBeTypeOf("function");
    const registryPackageSpecifier = runner.registryPackageSpecifier as (
      version: string,
      environment: Record<string, string>,
    ) => string;
    expect(() => registryPackageSpecifier("1.0.2", {})).toThrow(/guard/iu);
    expect(registryPackageSpecifier("1.0.2", {
      RULEBLAST_REGISTRY_SMOKE: "ruleblast@1.0.2",
    })).toBe("ruleblast@1.0.2");

    expect(runner.registryUpgradeSpecifiers).toBeTypeOf("function");
    const registryUpgradeSpecifiers = runner.registryUpgradeSpecifiers as (
      mode: "candidate" | "registry",
      currentVersion: string,
      environment: Record<string, string>,
    ) => {
      readonly from: { readonly specifier: string; readonly version: string };
      readonly to: { readonly specifier: string; readonly version: string };
    };
    const guardedEnvironment = {
      RULEBLAST_REGISTRY_SMOKE: "ruleblast@1.0.2",
      RULEBLAST_REGISTRY_UPGRADE_FROM: "ruleblast@1.0.1",
    };
    expect(runner.parseInstallMode).toBeTypeOf("function");
    const parseInstallMode = runner.parseInstallMode as (
      value: unknown,
    ) => "candidate" | "registry";
    expect(parseInstallMode(undefined)).toBe("candidate");
    expect(parseInstallMode("registry")).toBe("registry");
    expect(() => parseInstallMode("preview")).toThrow(/install mode/iu);
    expect(() => registryUpgradeSpecifiers(
      "candidate", "1.0.2", guardedEnvironment,
    )).toThrow(/candidate mode/iu);
    expect(() => registryUpgradeSpecifiers(
      "registry", "1.0.2", {},
    )).toThrow(/RULEBLAST_REGISTRY_SMOKE/iu);
    expect(() => registryUpgradeSpecifiers(
      "registry", "1.0.2", {
        RULEBLAST_REGISTRY_SMOKE: "ruleblast@1.0.2",
      },
    )).toThrow(/RULEBLAST_REGISTRY_UPGRADE_FROM/iu);
    expect(() => registryUpgradeSpecifiers(
      "registry", "1.0.2", {
        ...guardedEnvironment,
        RULEBLAST_REGISTRY_SMOKE: "ruleblast@1.0.1",
      },
    )).toThrow(/RULEBLAST_REGISTRY_SMOKE/iu);
    expect(() => registryUpgradeSpecifiers(
      "registry", "1.0.2", {
        ...guardedEnvironment,
        RULEBLAST_REGISTRY_UPGRADE_FROM: "ruleblast@1.0.0",
      },
    )).toThrow(/RULEBLAST_REGISTRY_UPGRADE_FROM/iu);
    expect(registryUpgradeSpecifiers(
      "registry", "1.0.2", guardedEnvironment,
    )).toEqual({
      from: { specifier: "ruleblast@1.0.1", version: "1.0.1" },
      to: { specifier: "ruleblast@1.0.2", version: "1.0.2" },
    });

    const installArguments = lifecycle.installArguments as (
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
    const installLifecycle = await readFile(
      new URL("../scripts/install-lifecycle-smoke.mjs", import.meta.url),
      "utf8",
    );
    expect(installSmoke.split(/\r?\n/u).length).toBeLessThanOrEqual(400);
    expect(packageSmoke.split(/\r?\n/u).length).toBeLessThanOrEqual(400);
    expect(installLifecycle.split(/\r?\n/u).length).toBeLessThanOrEqual(400);
    expect(installSmoke).not.toContain("function copyRuntimePackage");
    expect(installLifecycle).toContain('"System32", "cmd.exe"');
    expect(installLifecycle).toContain(
      '"WindowsPowerShell", "v1.0", "powershell.exe"',
    );
    expect(releaseProcess).toMatch(
      /const capture = \(target\) => \(chunk\) => \{\s+if \(settled\) return;\s+outputBytes \+= chunk\.length;/u,
    );
  });
});
