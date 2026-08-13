#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertJsonContract, writeNetworkDenyPreload } from "./package-smoke-contract.mjs";
import { installedRuntimeDependencyDirectories } from "./capture-case-dependencies.mjs";
import {
  exerciseInstallLifecycle,
  exerciseRegistryUpgrade,
} from "./install-lifecycle-smoke.mjs";
import {
  armFsmonitor,
  cleanupTempRoot,
  createFixture,
  createTempRoot,
  networkDenyEnvironment,
} from "./package-smoke-runtime.mjs";
import { materializeOfflineRuntimeDependencies } from "./package-smoke.mjs";
import { packPackage } from "./package-pack.mjs";
import { runNpm } from "./release-process.mjs";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const COMMAND_TIMEOUT_MS = 45_000;

function fail(message) {
  throw new Error(message);
}

const CONTROLLED_NPM_KEYS = new Set([
  "npm_config_audit",
  "npm_config_cache",
  "npm_config_fund",
  "npm_config_offline",
  "npm_config_update_notifier",
  "ruleblast_lifecycle_sentinel",
]);

export function npmEnvironment(cache, inherited = process.env) {
  const environment = Object.fromEntries(
    Object.entries(inherited).filter(([key]) => !CONTROLLED_NPM_KEYS.has(key.toLowerCase())),
  );
  return {
    ...environment,
    npm_config_cache: cache,
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_offline: "false",
    npm_config_update_notifier: "false",
  };
}

function createLifecycleCanary(root) {
  mkdirSync(root);
  writeFileSync(join(root, "package.json"), `${JSON.stringify({
    name: "ruleblast-install-lifecycle-canary",
    version: "1.0.0",
    scripts: { preinstall: "node probe.cjs" },
  })}\n`);
  writeFileSync(
    join(root, "probe.cjs"),
    "require('node:fs').writeFileSync(process.env.RULEBLAST_LIFECYCLE_SENTINEL, 'ran');\n",
  );
  return root;
}

function assertFsmonitorUntouched(sentinel) {
  if (!existsSync(sentinel.path) ||
      !readFileSync(sentinel.path).equals(sentinel.bytes) ||
      lstatSync(sentinel.path, { bigint: true }).mtimeNs !== sentinel.mtimeNs) {
    fail("Installed analysis touched the configured fsmonitor sentinel");
  }
}

export function registryPackageSpecifier(version, environment = process.env) {
  const specifier = `ruleblast@${version}`;
  if (environment.RULEBLAST_REGISTRY_SMOKE !== specifier) {
    fail(`Registry mode guard requires RULEBLAST_REGISTRY_SMOKE=${specifier}`);
  }
  return specifier;
}

export function parseInstallMode(value) {
  if (value === undefined || value === "candidate") return "candidate";
  if (value === "registry") return "registry";
  fail(`Unsupported install mode: ${String(value)}`);
}

export function registryUpgradeSpecifiers(mode, currentVersion, environment = process.env) {
  if (mode !== "registry") {
    fail("Registry upgrade evidence is unavailable in candidate mode");
  }
  const to = registryPackageSpecifier(currentVersion, environment);
  const predecessorVersion = "1.0.1";
  const from = `ruleblast@${predecessorVersion}`;
  if (environment.RULEBLAST_REGISTRY_UPGRADE_FROM !== from) {
    fail(`Registry upgrade guard requires RULEBLAST_REGISTRY_UPGRADE_FROM=${from}`);
  }
  return {
    from: { specifier: from, version: predecessorVersion },
    to: { specifier: to, version: currentVersion },
  };
}

export function npmExecArguments(source, dependencies, offline) {
  return [
    "exec", "--yes", "--ignore-scripts", "--no-audit", "--no-fund",
    "--install-links",
    ...(offline ? ["--offline"] : []),
    "--package", source,
    ...dependencies.flatMap((dependency) => ["--package", dependency]),
    "--", "ruleblast", "case", "--json",
  ];
}

async function verifyNpmExec(source, dependencies, cwd, env, offline) {
  const output = await runNpm(
    npmExecArguments(source, dependencies, offline),
    cwd,
    { env, timeoutMs: COMMAND_TIMEOUT_MS },
  );
  if (output.stderr.length !== 0) fail("npm exec emitted diagnostics");
  assertJsonContract("case JSON", output.stdout, "diff");
}

export async function runInstallSmoke(options = {}) {
  const mode = parseInstallMode(options.mode);
  const root = createTempRoot();
  try {
    const inheritedEnvironment = options.env ?? process.env;
    const buildCache = join(root, "build-cache");
    const installCache = join(root, "empty-install-cache");
    const packDirectory = join(root, "pack");
    const dependencyRoot = join(root, "dependencies");
    const canaryRoot = join(root, "lifecycle-canary");
    const lifecycleSentinel = join(root, "lifecycle-ran");
    const local = join(root, "local");
    const global = join(root, "global");
    const fixture = join(root, "fixture");
    for (const path of [
      buildCache, installCache, packDirectory, dependencyRoot, local, global, fixture,
    ]) {
      mkdirSync(path);
    }
    const cacheInitiallyEmpty = readdirSync(installCache).length === 0;
    const descriptor = JSON.parse(readFileSync(join(REPOSITORY_ROOT, "package.json"), "utf8"));
    const registryMode = mode === "registry";
    let source;
    let upgrade;
    let version = descriptor.version;
    let artifactCount;
    let dependencies;
    if (registryMode) {
      upgrade = registryUpgradeSpecifiers("registry", version, inheritedEnvironment);
      source = upgrade.to.specifier;
      artifactCount = 0;
      dependencies = [];
    } else {
      const buildEnv = npmEnvironment(buildCache, inheritedEnvironment);
      await runNpm(["run", "build"], REPOSITORY_ROOT, {
        env: buildEnv,
        timeoutMs: COMMAND_TIMEOUT_MS,
      });
      const packed = await packPackage(
        REPOSITORY_ROOT,
        packDirectory,
        buildEnv,
        { timeoutMs: COMMAND_TIMEOUT_MS },
      );
      source = packed.tarball;
      version = packed.entry.version;
      artifactCount = 1;
      const dependencyDirectories = await installedRuntimeDependencyDirectories(
        REPOSITORY_ROOT,
        readFileSync(join(REPOSITORY_ROOT, "package-lock.json")),
      );
      dependencies = materializeOfflineRuntimeDependencies(
        dependencyDirectories,
        dependencyRoot,
      );
    }
    dependencies = [...dependencies, createLifecycleCanary(canaryRoot)];
    writeFileSync(join(local, "package.json"), "{\"private\":true}\n");
    await createFixture(fixture, inheritedEnvironment);
    const fsmonitorSentinel = await armFsmonitor(fixture, inheritedEnvironment);
    const preload = join(root, "deny-network.cjs");
    writeNetworkDenyPreload(preload);
    const baseInstallEnv = {
      ...npmEnvironment(installCache, inheritedEnvironment),
      RULEBLAST_LIFECYCLE_SENTINEL: lifecycleSentinel,
    };
    const offline = !registryMode;
    const installEnv = offline
      ? networkDenyEnvironment(preload, baseInstallEnv)
      : baseInstallEnv;
    const analysisEnv = networkDenyEnvironment(preload, baseInstallEnv);
    await verifyNpmExec(source, dependencies, dirname(fixture), installEnv, offline);
    const lifecycleOptions = (scope, target) => ({
      scope, target, source, version, dependencies, fixture,
      installEnv, analysisEnv, offline,
    });
    const localReport = await exerciseInstallLifecycle(
      lifecycleOptions("local", local),
    );
    const globalReport = await exerciseInstallLifecycle(
      lifecycleOptions("global", global),
    );
    const upgradeReport = registryMode
      ? {
          local: await exerciseRegistryUpgrade({
            ...lifecycleOptions("local", local),
            from: upgrade.from,
            to: upgrade.to,
          }),
          global: await exerciseRegistryUpgrade({
            ...lifecycleOptions("global", global),
            from: upgrade.from,
            to: upgrade.to,
          }),
        }
      : null;
    if (existsSync(lifecycleSentinel)) {
      fail("npm executed an install lifecycle script despite --ignore-scripts");
    }
    assertFsmonitorUntouched(fsmonitorSentinel);
    return {
      ok: true,
      artifactCount,
      cacheInitiallyEmpty,
      installScriptsIgnored: true,
      npmExecVerified: true,
      mode: registryMode ? "registry" : "candidate",
      hostShells: localReport.hostShells,
      registryUpgrade: upgradeReport,
      lifecycleSentinelUntouched: true,
      fsmonitorUntouched: true,
      local: localReport,
      global: globalReport,
    };
  } finally {
    cleanupTempRoot(root);
  }
}

const directEntry = process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (directEntry) {
  try {
    const report = await runInstallSmoke({
      mode: process.argv.includes("--registry") ? "registry" : "candidate",
    });
    if (process.argv.includes("--json-report")) {
      process.stdout.write(`${JSON.stringify(report)}\n`);
    } else {
      process.stdout.write("install smoke: ok\n");
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
