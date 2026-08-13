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
  armFsmonitor,
  captureRepository,
  cleanupTempRoot,
  createFixture,
  createTempRoot,
  installedBin,
  networkDenyEnvironment,
  runInstalled,
  sameCapture,
} from "./package-smoke-runtime.mjs";
import { materializeOfflineRuntimeDependencies } from "./package-smoke.mjs";
import { assertContained, packPackage } from "./package-pack.mjs";
import { runNpm, runStrict } from "./release-process.mjs";

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

function localLayout(root) {
  const installedRoot = assertContained(
    root,
    join(root, "node_modules", "ruleblast"),
    "Local installation",
  );
  return { installedRoot, bin: installedBin(root, installedRoot) };
}

function globalLayout(prefix) {
  const installedRoot = assertContained(
    prefix,
    process.platform === "win32"
      ? join(prefix, "node_modules", "ruleblast")
      : join(prefix, "lib", "node_modules", "ruleblast"),
    "Global installation",
  );
  const bin = assertContained(
    prefix,
    process.platform === "win32"
      ? join(prefix, "ruleblast.cmd")
      : join(prefix, "bin", "ruleblast"),
    "Global executable",
  );
  if (!existsSync(installedRoot) || !existsSync(bin)) {
    fail("Global install omitted its package or executable");
  }
  return { installedRoot, bin };
}

export function registryPackageSpecifier(version, environment = process.env) {
  const specifier = `ruleblast@${version}`;
  if (environment.RULEBLAST_REGISTRY_SMOKE !== specifier) {
    fail(`Registry mode guard requires RULEBLAST_REGISTRY_SMOKE=${specifier}`);
  }
  return specifier;
}

export function installArguments(scope, target, source, dependencies, offline) {
  return [
    "install",
    ...(scope === "global" ? ["--global"] : ["--save-dev", "--save-exact"]),
    "--prefix", target,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    ...(offline ? ["--offline"] : []),
    "--install-links",
    source,
    ...dependencies,
  ];
}

async function install(scope, target, source, dependencies, env, offline) {
  await runNpm(installArguments(
    scope, target, source, dependencies, offline,
  ), target, {
    env,
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}

async function uninstall(scope, target, env, offline) {
  await runNpm([
    "uninstall",
    ...(scope === "global" ? ["--global"] : ["--save-dev"]),
    "--prefix", target,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    ...(offline ? ["--offline"] : []),
    "ruleblast",
  ], target, { env, timeoutMs: COMMAND_TIMEOUT_MS });
}

function assertRemoved(layout) {
  if (existsSync(layout.installedRoot) || existsSync(layout.bin)) {
    fail("npm uninstall left the RuleBlast package or executable behind");
  }
}

async function verifyInstalled(layout, fixture, env, version) {
  const manifest = JSON.parse(readFileSync(join(layout.installedRoot, "package.json"), "utf8"));
  if (manifest.name !== "ruleblast" || manifest.version !== version) {
    fail("Installed package identity changed");
  }
  const versionBytes = await runInstalled(layout.bin, ["--version"], fixture, env);
  const versionLine = versionBytes.toString("utf8").trimEnd();
  if (versionLine !== `ruleblast ${version}`) fail("Installed CLI version changed");
  const caseBytes = await runInstalled(layout.bin, ["case", "--json"], dirname(fixture), env);
  assertJsonContract("case JSON", caseBytes, "diff");
  const before = await captureRepository(fixture, process.env);
  const analysisBytes = await runInstalled(layout.bin, [".", "--json"], fixture, env);
  assertJsonContract("current JSON", analysisBytes, "current");
  const after = await captureRepository(fixture, process.env);
  if (!sameCapture(before, after)) fail("Installed analysis changed its repository");
  return { version: versionLine, repositoryUnchanged: true };
}

async function verifyHostShell(layout, fixture, env, version) {
  const shellEnvironment = { ...env, RULEBLAST_INSTALL_BIN: layout.bin };
  const invocation = process.platform === "win32"
    ? {
        command: join(
          process.env.SystemRoot ?? "C:\\Windows",
          "System32", "WindowsPowerShell", "v1.0", "powershell.exe",
        ),
        args: [
          "-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
          "& $env:RULEBLAST_INSTALL_BIN --version",
        ],
        name: "powershell",
      }
    : {
        command: "bash",
        args: ["--noprofile", "--norc", "-c", '"$RULEBLAST_INSTALL_BIN" --version'],
        name: "bash",
      };
  const result = await runStrict(invocation.command, invocation.args, {
    cwd: fixture,
    env: shellEnvironment,
    timeoutMs: 30_000,
  });
  if (result.stderr.length !== 0 ||
      result.stdout.toString("utf8") !== `ruleblast ${version}\n`) {
    fail(`${invocation.name} did not execute the installed RuleBlast shim`);
  }
  return invocation.name;
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

async function exercise(
  scope,
  target,
  source,
  version,
  dependencies,
  fixture,
  installEnv,
  analysisEnv,
  offline,
) {
  await install(scope, target, source, dependencies, installEnv, offline);
  const first = scope === "global" ? globalLayout(target) : localLayout(target);
  const verified = await verifyInstalled(first, fixture, analysisEnv, version);
  const hostShell = await verifyHostShell(first, fixture, analysisEnv, version);
  await uninstall(scope, target, installEnv, offline);
  assertRemoved(first);
  await install(scope, target, source, dependencies, installEnv, offline);
  const second = scope === "global" ? globalLayout(target) : localLayout(target);
  await verifyInstalled(second, fixture, analysisEnv, version);
  await uninstall(scope, target, installEnv, offline);
  assertRemoved(second);
  return {
    installed: true,
    shim: process.platform === "win32" ? "cmd" : "posix",
    version: verified.version,
    caseVerified: true,
    analysisVerified: true,
    repositoryUnchanged: verified.repositoryUnchanged,
    hostShell,
    reinstalled: true,
    uninstalled: true,
  };
}

export async function runInstallSmoke(options = {}) {
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
    const registryMode = options.mode === "registry";
    let source;
    let version = descriptor.version;
    let artifactCount;
    let dependencies;
    if (registryMode) {
      source = registryPackageSpecifier(version, inheritedEnvironment);
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
    const localReport = await exercise(
      "local", local, source, version, dependencies, fixture,
      installEnv, analysisEnv, offline,
    );
    const globalReport = await exercise(
      "global", global, source, version, dependencies, fixture,
      installEnv, analysisEnv, offline,
    );
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
      hostShell: localReport.hostShell,
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
