#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertInstalledPackage,
  assertJsonContract,
  assertNoPathLeak,
  assertTextContracts,
  writeNetworkDenyPreload,
} from "./package-smoke-contract.mjs";
import { installedRuntimeDependencyDirectories } from "./capture-case-dependencies.mjs";
import { assertContained, packPackage } from "./package-pack.mjs";
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
import { runNpm } from "./release-process.mjs";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");

function fail(message) {
  throw new Error(message);
}

function copyRuntimePackage(source, destination, packageRoot = source) {
  const sourceStats = lstatSync(source);
  if (sourceStats.isSymbolicLink() || !sourceStats.isDirectory()) {
    fail("Runtime dependency root is a symlink or non-directory");
  }
  mkdirSync(destination);
  const entries = readdirSync(source, { withFileTypes: true }).sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0
  );
  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isSymbolicLink()) fail("Runtime dependency contains a symlink");
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      copyRuntimePackage(sourcePath, destinationPath, packageRoot);
      continue;
    }
    if (!entry.isFile()) fail("Runtime dependency contains a special filesystem node");
    if (source === packageRoot && entry.name === "package.json") {
      const descriptor = JSON.parse(readFileSync(sourcePath, "utf8"));
      if (typeof descriptor !== "object" || descriptor === null || Array.isArray(descriptor) ||
          typeof descriptor.name !== "string" || descriptor.name === "" ||
          typeof descriptor.version !== "string" || descriptor.version === "") {
        fail("Runtime dependency package.json is invalid");
      }
      const { scripts: _scripts, ...installDescriptor } = descriptor;
      writeFileSync(destinationPath, `${JSON.stringify(installDescriptor)}\n`);
      continue;
    }
    copyFileSync(sourcePath, destinationPath);
    chmodSync(destinationPath, lstatSync(sourcePath).mode);
  }
}

export function materializeOfflineRuntimeDependencies(directories, destinationRoot) {
  return Object.freeze(directories.map((directory, index) => {
    const destination = join(destinationRoot, String(index));
    copyRuntimePackage(directory, destination);
    return destination;
  }));
}

export async function runPackedPackageSmoke(packed, options = {}) {
  const repositoryRoot = resolve(options.repositoryRoot ?? REPOSITORY_ROOT);
  const dependencyRoot = resolve(options.dependencyRoot ?? repositoryRoot);
  const baseEnvironment = options.env ?? process.env;
  const runtimeDependencies = await installedRuntimeDependencyDirectories(
    dependencyRoot,
    readFileSync(join(repositoryRoot, "package-lock.json")),
  );
  const temporaryRoot = createTempRoot();
  try {
    const dependencyDirectory = join(temporaryRoot, "dependencies");
    const installDirectory = join(temporaryRoot, "install");
    const fixture = join(temporaryRoot, "fixture");
    mkdirSync(dependencyDirectory);
    mkdirSync(installDirectory);
    mkdirSync(fixture);
    const dependencies = materializeOfflineRuntimeDependencies(
      runtimeDependencies,
      dependencyDirectory,
    );
    await runNpm([
      "install", "--prefix", installDirectory, "--ignore-scripts", "--no-audit",
      "--no-fund", "--offline", "--package-lock=false", "--install-links",
      packed.tarball,
      ...dependencies,
    ], installDirectory, { env: baseEnvironment });
    const installedRoot = assertContained(
      installDirectory,
      join(installDirectory, "node_modules", "ruleblast"),
      "Installed package",
    );
    const installedPackage = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8"));
    const sourcePackage = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8"));
    assertInstalledPackage(sourcePackage, installedPackage, packed.entry);
    const requiredFiles = [
      "CONTRACT.md",
      "assets/ruleblast-eye.webp",
      "cases/kpoiut__ruleblast/27d52e2cd6ee..e420008a1c10.json",
    ];
    for (const required of requiredFiles) {
      const installed = join(installedRoot, ...required.split("/"));
      const source = join(repositoryRoot, ...required.split("/"));
      if (!existsSync(installed) || !readFileSync(installed).equals(readFileSync(source))) {
        fail(`Packed file missing or changed: ${required}`);
      }
    }
    const receipt = readFileSync(join(
      installedRoot,
      "cases",
      "kpoiut__ruleblast",
      "27d52e2cd6ee..e420008a1c10.json",
    ));
    if (createHash("sha256").update(receipt).digest("hex") !==
        "5735038d47cae7b538e113d51214dbbc6ecd29cbca815912813abaa900ecfc89") {
      fail("Packed case receipt SHA-256 changed");
    }
    const binTarget = installedBin(installDirectory, installedRoot);
    const preload = join(temporaryRoot, "deny-network.cjs");
    writeNetworkDenyPreload(preload);
    const env = networkDenyEnvironment(preload, baseEnvironment);
    const help = await runInstalled(binTarget, ["--help"], temporaryRoot, env);
    const version = await runInstalled(binTarget, ["--version"], temporaryRoot, env);
    if (!help.toString("utf8").startsWith("Usage:\n  ruleblast")) {
      fail("Packed ruleblast --help did not expose the CLI usage");
    }
    const expectedVersion = `ruleblast ${installedPackage.version}\n`;
    if (version.toString("utf8") !== expectedVersion) {
      fail("Packed ruleblast --version does not match package.json");
    }
    await createFixture(fixture, baseEnvironment);
    const sentinel = await armFsmonitor(fixture, baseEnvironment);
    const before = await captureRepository(fixture, baseEnvironment);
    const outputs = new Map();
    const commands = [
      ["case-text", ["case"]],
      ["case-json-1", ["case", "--json"]],
      ["case-json-2", ["case", "--json"]],
      ["legacy-text", ["demo"]],
      ["legacy-json", ["demo", "--json"]],
      ["current-text", ["."]],
      ["current-json", [".", "--json"]],
      ["diff-text", ["diff", "HEAD"]],
      ["diff-json", ["diff", "HEAD", "--json"]],
      ["explain-text", ["explain", "src/index.ts"]],
      ["explain-json", ["explain", "src/index.ts", "--json"]],
    ];
    for (const [label, args] of commands) {
      outputs.set(label, await runInstalled(binTarget, args, fixture, env));
    }
    const golden = readFileSync(join(repositoryRoot, "test", "golden", "diff-case.txt"));
    if (!outputs.get("case-text").equals(golden)) fail("Packed case text differs from its golden");
    if (!outputs.get("case-text").equals(outputs.get("legacy-text")) ||
        !outputs.get("case-json-1").equals(outputs.get("legacy-json"))) {
      fail("Packed legacy alias is not byte-identical to case");
    }
    if (!outputs.get("case-json-1").equals(outputs.get("case-json-2"))) {
      fail("Packed case JSON is not byte-identical across runs");
    }
    assertJsonContract("case JSON", outputs.get("case-json-1"), "diff");
    assertJsonContract("current JSON", outputs.get("current-json"), "current");
    assertJsonContract("diff JSON", outputs.get("diff-json"), "diff");
    assertJsonContract("explain JSON", outputs.get("explain-json"), "explain", "current");
    assertTextContracts(outputs);
    assertNoPathLeak(outputs, [temporaryRoot, repositoryRoot]);
    const after = await captureRepository(fixture, baseEnvironment);
    if (!sameCapture(before, after)) fail("Packed analysis changed the Git fixture");
    if (!existsSync(sentinel.path)) fail("Packed analysis removed the fsmonitor sentinel");
    const sentinelAfter = lstatSync(sentinel.path, { bigint: true });
    if (!readFileSync(sentinel.path).equals(sentinel.bytes) ||
        sentinelAfter.mtimeNs !== sentinel.mtimeNs) {
      fail("Packed analysis touched the configured fsmonitor sentinel");
    }
    return {
      ok: true,
      fixtureUnchanged: true,
      fsmonitorUntouched: true,
      helpVerified: true,
      jsonDeterministic: true,
      metadataVerified: true,
      version: expectedVersion.trimEnd(),
      tarballBytes: packed.entry.size,
      packedFiles: packed.entry.files.map((file) => file.path).sort(),
    };
  } finally {
    cleanupTempRoot(temporaryRoot);
  }
}

export async function runPackageSmoke(options = {}) {
  const repositoryRoot = resolve(options.repositoryRoot ?? REPOSITORY_ROOT);
  const baseEnvironment = options.env ?? process.env;
  const packRoot = createTempRoot();
  try {
    const packDirectory = join(packRoot, "pack");
    mkdirSync(packDirectory);
    await runNpm(["run", "build"], repositoryRoot, { env: baseEnvironment });
    const packed = await packPackage(repositoryRoot, packDirectory, baseEnvironment);
    return await runPackedPackageSmoke(packed, {
      env: baseEnvironment,
      repositoryRoot,
    });
  } finally {
    cleanupTempRoot(packRoot);
  }
}

const directEntry = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (directEntry) {
  try {
    const report = await runPackageSmoke();
    if (process.argv.includes("--json-report")) process.stdout.write(`${JSON.stringify(report)}\n`);
    else process.stdout.write(`package smoke: ok (${report.tarballBytes} bytes)\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
