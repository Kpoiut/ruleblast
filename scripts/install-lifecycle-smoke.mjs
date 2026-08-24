import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assertJsonContract } from "./package-smoke-contract.mjs";
import {
  captureRepository,
  installedBin,
  runInstalled,
  sameCapture,
} from "./package-smoke-runtime.mjs";
import { assertContained } from "./package-pack.mjs";
import { runNpm, runStrict } from "./release-process.mjs";

const COMMAND_TIMEOUT_MS = 45_000;

function fail(message) {
  throw new Error(message);
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

function layout(scope, target) {
  return scope === "global" ? globalLayout(target) : localLayout(target);
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
  ), target, { env, timeoutMs: COMMAND_TIMEOUT_MS });
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

function assertRemoved(installed) {
  if (existsSync(installed.installedRoot) || existsSync(installed.bin)) {
    fail("npm uninstall left the RuleBlast package or executable behind");
  }
}

async function verifyBinVersion(installed, fixture, env, version) {
  const manifest = JSON.parse(readFileSync(
    join(installed.installedRoot, "package.json"),
    "utf8",
  ));
  if (manifest.name !== "ruleblast" || manifest.version !== version) {
    fail("Installed package identity changed");
  }
  const versionBytes = await runInstalled(installed.bin, ["--version"], fixture, env);
  const versionLine = versionBytes.toString("utf8").trimEnd();
  if (versionLine !== `ruleblast ${version}`) fail("Installed CLI version changed");
  return versionLine;
}

async function verifyInstalled(installed, fixture, env, version) {
  const versionLine = await verifyBinVersion(installed, fixture, env, version);
  const caseBytes = await runInstalled(installed.bin, ["case", "--json"], fixture, env);
  assertJsonContract("case JSON", caseBytes, "diff");
  const before = await captureRepository(fixture, process.env);
  const analysisBytes = await runInstalled(installed.bin, [".", "--json"], fixture, env);
  assertJsonContract("current JSON", analysisBytes, "current");
  const after = await captureRepository(fixture, process.env);
  if (!sameCapture(before, after)) fail("Installed analysis changed its repository");
  return { version: versionLine, repositoryUnchanged: true };
}

function assertVersionOutput(name, result, version) {
  const stdout = result.stdout.toString("utf8").replaceAll("\r\n", "\n");
  if (result.stderr.length !== 0 || stdout !== `ruleblast ${version}\n`) {
    fail(`${name} did not execute the installed RuleBlast shim`);
  }
}

async function verifyHostShells(installed, fixture, env, version) {
  const shellEnvironment = { ...env, RULEBLAST_INSTALL_BIN: installed.bin };
  if (process.platform === "win32") {
    const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
    const cmd = join(systemRoot, "System32", "cmd.exe");
    const commandLine = '""%RULEBLAST_INSTALL_BIN%" --version"';
    const cmdResult = await runStrict(cmd, ["/d", "/s", "/c", commandLine], {
      cwd: fixture,
      env: shellEnvironment,
      timeoutMs: 30_000,
      windowsVerbatimArguments: true,
    });
    assertVersionOutput("cmd.exe", cmdResult, version);

    const powershell = join(
      systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe",
    );
    const powershellResult = await runStrict(powershell, [
      "-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
      "& $env:RULEBLAST_INSTALL_BIN --version",
    ], { cwd: fixture, env: shellEnvironment, timeoutMs: 30_000 });
    assertVersionOutput("powershell", powershellResult, version);
    return ["cmd.exe", "powershell"];
  }

  const bashResult = await runStrict("bash", [
    "--noprofile", "--norc", "-c", '"$RULEBLAST_INSTALL_BIN" --version',
  ], { cwd: fixture, env: shellEnvironment, timeoutMs: 30_000 });
  assertVersionOutput("bash", bashResult, version);
  return ["bash"];
}

export async function exerciseInstallLifecycle(options) {
  const {
    scope, target, source, version, dependencies, fixture,
    installEnv, analysisEnv, offline,
  } = options;
  await install(scope, target, source, dependencies, installEnv, offline);
  const first = layout(scope, target);
  const verified = await verifyInstalled(first, fixture, analysisEnv, version);
  const hostShells = await verifyHostShells(first, fixture, analysisEnv, version);
  await uninstall(scope, target, installEnv, offline);
  assertRemoved(first);
  await install(scope, target, source, dependencies, installEnv, offline);
  const second = layout(scope, target);
  const reinstalledVersion = await verifyBinVersion(second, fixture, analysisEnv, version);
  if (reinstalledVersion !== verified.version) fail("Reinstalled CLI version changed");
  await uninstall(scope, target, installEnv, offline);
  assertRemoved(second);
  return {
    installed: true,
    shim: process.platform === "win32" ? "cmd" : "posix",
    version: verified.version,
    caseVerified: true,
    analysisVerified: true,
    repositoryUnchanged: verified.repositoryUnchanged,
    hostShells,
    reinstalled: true,
    uninstalled: true,
  };
}

export async function exerciseRegistryUpgrade(options) {
  const {
    scope, target, from, to, dependencies, fixture, installEnv, analysisEnv,
  } = options;
  await install(scope, target, from.specifier, dependencies, installEnv, false);
  const predecessor = layout(scope, target);
  const predecessorVerified = await verifyInstalled(
    predecessor, fixture, analysisEnv, from.version,
  );
  await install(scope, target, to.specifier, dependencies, installEnv, false);
  const current = layout(scope, target);
  const verified = await verifyInstalled(current, fixture, analysisEnv, to.version);
  const hostShells = await verifyHostShells(current, fixture, analysisEnv, to.version);
  await uninstall(scope, target, installEnv, false);
  assertRemoved(current);
  return {
    from: from.specifier,
    to: to.specifier,
    predecessorVersion: predecessorVerified.version,
    predecessorVerified: true,
    version: verified.version,
    repositoryUnchanged: verified.repositoryUnchanged,
    hostShells,
    uninstalled: true,
  };
}
