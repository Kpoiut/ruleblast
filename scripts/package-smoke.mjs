#!/usr/bin/env node

import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
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
import { runNpm, runProcess, runStrict } from "./release-process.mjs";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const TEMP_PREFIX = "ruleblast package smoke-";

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

function createTempRoot() {
  const root = resolve(mkdtempSync(join(tmpdir(), TEMP_PREFIX)));
  const parent = resolve(tmpdir());
  if (dirname(root) !== parent || !basename(root).startsWith(TEMP_PREFIX)) {
    fail("Refusing an unexpected package-smoke temporary root");
  }
  return root;
}

function cleanupTempRoot(root) {
  const parent = resolve(tmpdir());
  if (dirname(root) !== parent || !basename(root).startsWith(TEMP_PREFIX)) {
    fail("Refusing unsafe package-smoke cleanup");
  }
  rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

async function git(root, args, suppressFsmonitor = true, environment = process.env) {
  const prefix = ["--no-optional-locks"];
  if (suppressFsmonitor) prefix.push("-c", "core.fsmonitor=false");
  prefix.push("-C", root);
  return runStrict("git", [...prefix, ...args], {
    cwd: root,
    env: { ...environment, GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1" },
  });
}

async function createFixture(root, environment) {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "AGENTS.md"), "Root instruction: explain the change.\n");
  writeFileSync(join(root, "CLAUDE.md"), "Root instruction: explain the change.\n");
  writeFileSync(join(root, "src/index.ts"), "export const answer = 42;\n");
  await git(root, ["init"], true, environment);
  await git(root, ["config", "user.name", "RuleBlast Package Smoke"], true, environment);
  await git(root, ["config", "user.email", "smoke@example.invalid"], true, environment);
  await git(root, ["add", "--", "AGENTS.md", "CLAUDE.md", "src/index.ts"], true, environment);
  await git(root, ["commit", "-m", "fixture"], true, environment);
  writeFileSync(
    join(root, "AGENTS.md"),
    "Root instruction: explain the change.\nRoot instruction: include evidence.\n",
  );
}

async function armFsmonitor(root, environment) {
  const hook = join(root, ".git", "hooks", "ruleblast-fsmonitor");
  const sentinel = join(root, ".git", "hooks", "fsmonitor-called");
  writeFileSync(
    hook,
    "#!/bin/sh\nprintf invoked >> \"$(dirname \"$0\")/fsmonitor-called\"\nprintf 'ruleblast-token\\0'\n",
  );
  chmodSync(hook, 0o755);
  const configuredHook = '"' + hook.replaceAll("\\", "/") + '"';
  await git(root, ["config", "core.fsmonitor", configuredHook], true, environment);
  await git(root, ["update-index", "--fsmonitor"], false, environment);
  await git(root, ["diff-files", "--quiet"], false, environment).catch((error) => {
    if (!existsSync(sentinel)) throw error;
  });
  if (!existsSync(sentinel) || readFileSync(sentinel).length === 0) {
    fail("Configured fsmonitor sentinel did not prove it was live");
  }
  writeFileSync(sentinel, "calibrated\n");
  const stat = lstatSync(sentinel, { bigint: true });
  return {
    path: sentinel,
    bytes: readFileSync(sentinel),
    mtimeNs: stat.mtimeNs,
  };
}

async function indexPath(root, environment) {
  const output = await git(root, ["rev-parse", "--git-path", "index"], true, environment);
  const value = output.stdout.toString("utf8").trim();
  return resolve(root, value);
}

async function captureRepository(root, environment) {
  const index = await indexPath(root, environment);
  const stat = lstatSync(index, { bigint: true });
  const stage = (await git(root, ["ls-files", "--stage", "-z"], true, environment)).stdout;
  const flags = (await git(root, ["ls-files", "-v", "-z"], true, environment)).stdout;
  const paths = stage.toString("utf8").split("\0").filter(Boolean).map((record) => {
    const tab = record.indexOf("\t");
    if (tab < 0) fail("Invalid tracked inventory record");
    return record.slice(tab + 1);
  });
  const nodes = paths.map((path) => {
    const absolute = join(root, ...path.split("/"));
    const nodeStat = lstatSync(absolute);
    if (nodeStat.isSymbolicLink()) {
      return { path, kind: "symlink", bytes: Buffer.from(readlinkSync(absolute)).toString("base64") };
    }
    if (!nodeStat.isFile()) fail(`Unsupported fixture node: ${path}`);
    return { path, kind: "file", bytes: readFileSync(absolute).toString("base64") };
  });
  return {
    indexBytes: readFileSync(index),
    indexMtimeNs: stat.mtimeNs,
    stage,
    flags,
    nodes,
  };
}

function sameCapture(before, after) {
  return before.indexBytes.equals(after.indexBytes) &&
    before.indexMtimeNs === after.indexMtimeNs &&
    before.stage.equals(after.stage) && before.flags.equals(after.flags) &&
    JSON.stringify(before.nodes) === JSON.stringify(after.nodes);
}

function networkDenyEnvironment(preload, baseEnvironment) {
  const inherited = baseEnvironment.NODE_OPTIONS?.trim();
  return {
    ...baseEnvironment,
    GIT_OPTIONAL_LOCKS: "0",
    GIT_NO_LAZY_FETCH: "1",
    NODE_OPTIONS: `${inherited ? `${inherited} ` : ""}--require ${JSON.stringify(preload)}`,
  };
}

async function runInstalled(binShim, args, cwd, env) {
  if (process.platform === "win32") {
    const tokens = [binShim, ...args];
    if (tokens.some((token) => /["\r\n&|<>^%!]/.test(token))) {
      fail("Packed Windows bin invocation contains a cmd metacharacter");
    }
    const commandLine = `""${tokens.join('" "')}""`;
    const result = await runProcess(
      env.ComSpec ?? process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", commandLine],
      { cwd, env, windowsVerbatimArguments: true },
    );
    return assertSuccessfulBin(result, args);
  }
  return assertSuccessfulBin(await runProcess(binShim, args, { cwd, env }), args);
}

function assertSuccessfulBin(result, args) {
  if (result.code !== 0 || result.signal !== null || result.stderr.length !== 0) {
    fail([
      `Packed ruleblast failed: ${args.join(" ")}`,
      `exit=${String(result.code)} signal=${String(result.signal)}`,
      result.stdout.toString("utf8"),
      result.stderr.toString("utf8"),
    ].join("\n"));
  }
  return result.stdout;
}

function installedBin(installDirectory, installedRoot) {
  const binDirectory = assertContained(
    installDirectory,
    join(installDirectory, "node_modules", ".bin"),
    "Installed bin directory",
  );
  const target = resolve(installedRoot, "dist", "cli.js");
  const shim = assertContained(
    installDirectory,
    join(binDirectory, process.platform === "win32" ? "ruleblast.cmd" : "ruleblast"),
    "Installed ruleblast bin",
  );
  if (!existsSync(shim)) fail("npm did not create the packed ruleblast bin");
  if (process.platform === "win32") {
    const content = readFileSync(shim, "utf8").replaceAll("/", "\\").toLowerCase();
    if (!content.includes("..\\ruleblast\\dist\\cli.js")) {
      fail("Installed Windows bin does not point to packed ruleblast");
    }
  } else {
    const stat = lstatSync(shim);
    const resolvedTarget = stat.isSymbolicLink()
      ? resolve(dirname(shim), readlinkSync(shim))
      : target;
    if (resolvedTarget !== target || (!stat.isSymbolicLink() &&
        !readFileSync(shim, "utf8").includes("../ruleblast/dist/cli.js"))) {
      fail("Installed POSIX bin does not point to packed ruleblast");
    }
  }
  return shim;
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
    for (const required of ["CONTRACT.md", "fixtures/demo/case.json"]) {
      const installed = join(installedRoot, ...required.split("/"));
      const source = join(repositoryRoot, ...required.split("/"));
      if (!existsSync(installed) || !readFileSync(installed).equals(readFileSync(source))) {
        fail(`Packed file missing or changed: ${required}`);
      }
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
      ["demo-text", ["demo"]],
      ["demo-json-1", ["demo", "--json"]],
      ["demo-json-2", ["demo", "--json"]],
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
    const golden = readFileSync(join(repositoryRoot, "test", "golden", "diff-demo.txt"));
    if (!outputs.get("demo-text").equals(golden)) fail("Packed demo text differs from its golden");
    if (!outputs.get("demo-json-1").equals(outputs.get("demo-json-2"))) {
      fail("Packed demo JSON is not byte-identical across runs");
    }
    assertJsonContract("demo JSON", outputs.get("demo-json-1"), "diff");
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
