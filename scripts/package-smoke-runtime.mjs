import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { assertContained } from "./package-pack.mjs";
import { runProcess, runStrict } from "./release-process.mjs";

export const PACKAGE_SMOKE_TEMP_PREFIX = "ruleblast-package-smoke-";
const TEMP_PREFIX = PACKAGE_SMOKE_TEMP_PREFIX;

function fail(message) {
  throw new Error(message);
}

function defaultTempParentCandidates() {
  const roots = [tmpdir(), process.env.TMPDIR, process.env.TEMP, process.env.TMP];
  if (process.platform === "win32") {
    roots.push(join(process.env.SystemRoot ?? "C:\\Windows", "Temp"));
  } else {
    roots.push("/tmp");
  }
  return roots.filter((value) => typeof value === "string" && value !== "");
}

export function packageSmokeTempParent(candidates = defaultTempParentCandidates()) {
  for (const candidate of candidates) {
    const parent = resolve(candidate);
    if (!/\s/u.test(parent) && existsSync(parent) && lstatSync(parent).isDirectory()) {
      return parent;
    }
  }
  fail("No space-free temporary directory for package smoke");
}

function assertSmokeTempRoot(root) {
  const resolved = resolve(root);
  const parent = dirname(resolved);
  if (
    /\s/u.test(resolved) ||
    parent !== packageSmokeTempParent() ||
    !basename(resolved).startsWith(TEMP_PREFIX)
  ) {
    fail("Refusing an unexpected package-smoke temporary root");
  }
  return resolved;
}

export function createTempRoot() {
  const root = resolve(mkdtempSync(join(packageSmokeTempParent(), TEMP_PREFIX)));
  return assertSmokeTempRoot(root);
}

export function cleanupTempRoot(root) {
  rmSync(assertSmokeTempRoot(root), { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

async function git(root, args, suppressFsmonitor = true, environment = process.env) {
  const prefix = ["--no-optional-locks"];
  if (suppressFsmonitor) prefix.push("-c", "core.fsmonitor=false");
  prefix.push("-C", root);
  return runStrict("git", [...prefix, ...args], {
    cwd: root,
    env: { ...environment, GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1" },
    timeoutMs: 30_000,
  });
}

export async function createFixture(root, environment) {
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

export async function armFsmonitor(root, environment) {
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
  return { path: sentinel, bytes: readFileSync(sentinel), mtimeNs: stat.mtimeNs };
}

async function indexPath(root, environment) {
  const output = await git(root, ["rev-parse", "--git-path", "index"], true, environment);
  return resolve(root, output.stdout.toString("utf8").trim());
}

export async function captureRepository(root, environment) {
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
    indexBytes: readFileSync(index), indexMtimeNs: stat.mtimeNs, stage, flags, nodes,
  };
}

export function sameCapture(before, after) {
  return before.indexBytes.equals(after.indexBytes) &&
    before.indexMtimeNs === after.indexMtimeNs &&
    before.stage.equals(after.stage) && before.flags.equals(after.flags) &&
    JSON.stringify(before.nodes) === JSON.stringify(after.nodes);
}

export function networkDenyEnvironment(preload, baseEnvironment) {
  const inherited = baseEnvironment.NODE_OPTIONS?.trim();
  return {
    ...baseEnvironment,
    GIT_OPTIONAL_LOCKS: "0",
    GIT_NO_LAZY_FETCH: "1",
    NODE_OPTIONS: `${inherited ? `${inherited} ` : ""}--require ${JSON.stringify(preload)}`,
  };
}

function assertSuccessfulBin(result, args) {
  if (result.code !== 0 || result.signal !== null || result.stderr.length !== 0) {
    fail([
      `Packed ruleblast failed: ${args.join(" ")}`,
      `exit=${String(result.code)} signal=${String(result.signal)}`,
      result.stdout.toString("utf8"), result.stderr.toString("utf8"),
    ].join("\n"));
  }
  return result.stdout;
}

export async function runInstalled(binShim, args, cwd, env) {
  if (process.platform === "win32") {
    const tokens = [binShim, ...args];
    if (tokens.some((token) => /["\r\n&|<>^%!]/.test(token))) {
      fail("Packed Windows bin invocation contains a cmd metacharacter");
    }
    const result = await runProcess(
      env.ComSpec ?? process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", `""${tokens.join('" "')}""`],
      { cwd, env, windowsVerbatimArguments: true, timeoutMs: 30_000 },
    );
    return assertSuccessfulBin(result, args);
  }
  return assertSuccessfulBin(await runProcess(binShim, args, {
    cwd, env, timeoutMs: 30_000,
  }), args);
}

export function installedBin(installDirectory, installedRoot) {
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
