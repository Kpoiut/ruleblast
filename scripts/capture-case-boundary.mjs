import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  lstat,
  link,
  mkdir,
  open,
  realpath,
  unlink,
} from "node:fs/promises";
import { dirname, join, parse, resolve, sep } from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const GITHUB_HTTPS = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/u;
const GITHUB_SSH = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/u;
const CASE_DIRECTORY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const CASE_FILENAME = /^[0-9a-f]{12}\.\.[0-9a-f]{12}\.json$/u;

function gitEnvironment() {
  return {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_NO_LAZY_FETCH: "1",
    GIT_OPTIONAL_LOCKS: "0",
  };
}

export async function readOnlyGit(root, args, allowEmpty = false) {
  try {
    const result = await runFile("git", [
      "--no-optional-locks",
      "--no-replace-objects",
      "-c",
      "core.fsmonitor=false",
      "-C",
      root,
      ...args,
    ], {
      encoding: "buffer",
      env: gitEnvironment(),
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    return Buffer.from(result.stdout);
  } catch (error) {
    if (allowEmpty && error?.code === 1) return Buffer.alloc(0);
    throw error;
  }
}

function remoteIdentity(value) {
  const match = GITHUB_HTTPS.exec(value) ?? GITHUB_SSH.exec(value);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    throw new Error(
      "Every configured remote must use canonical HTTPS or git@github.com syntax",
    );
  }
  return `${match[1]}/${match[2]}`.toLowerCase();
}

export async function assertRepositoryRemote(checkout, repository) {
  const output = await readOnlyGit(checkout, [
    "config",
    "--local",
    "--null",
    "--get-regexp",
    "^remote\\..*\\.url$",
  ], true);
  if (output.length === 0) {
    throw new Error("Repository has no configured remote URL");
  }
  const records = output.toString("utf8").split("\0");
  records.pop();
  const identities = new Set();
  for (const record of records) {
    const newline = record.indexOf("\n");
    if (newline < 1 || newline === record.length - 1) {
      throw new Error("Git returned an invalid configured remote URL record");
    }
    identities.add(remoteIdentity(record.slice(newline + 1)));
  }
  if (identities.size !== 1) {
    throw new Error("Repository has ambiguous configured remote identities");
  }
  const configured = identities.values().next().value;
  const declared = `${repository.owner}/${repository.repo}`.toLowerCase();
  if (configured !== declared) {
    throw new Error("Declared repository identity does not match configured remote");
  }
}

async function assertDirectoryChain(path) {
  const absolute = resolve(path);
  const parsed = parse(absolute);
  const parts = absolute.slice(parsed.root.length).split(sep).filter(Boolean);
  let cursor = parsed.root;
  for (const part of parts) {
    cursor = join(cursor, part);
    let stats;
    try {
      stats = await lstat(cursor);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error(`Case destination contains a symlink or non-directory: ${cursor}`);
    }
  }
}

function sameFilesystemPath(left, right) {
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

async function verifiedOwnerDirectory(casesRoot, ownerDirectory) {
  await assertDirectoryChain(casesRoot);
  await mkdir(casesRoot, { recursive: true });
  await assertDirectoryChain(casesRoot);
  const rootReal = await realpath(casesRoot);
  if (!sameFilesystemPath(rootReal, resolve(casesRoot))) {
    throw new Error("Cases root resolves through a symlink or reparse boundary");
  }
  const directory = join(casesRoot, ownerDirectory);
  await mkdir(directory).catch((error) => {
    if (error?.code !== "EEXIST") throw error;
  });
  await assertDirectoryChain(directory);
  const directoryReal = await realpath(directory);
  if (!sameFilesystemPath(dirname(directoryReal), rootReal) ||
      !sameFilesystemPath(directoryReal, join(rootReal, ownerDirectory))) {
    throw new Error("Case owner directory escapes the cases root");
  }
  return directoryReal;
}

export async function publishCaseExclusive(
  casesRoot,
  ownerDirectory,
  filename,
  bytes,
) {
  if (!CASE_DIRECTORY.test(ownerDirectory) ||
      ownerDirectory === "." || ownerDirectory === ".." ||
      !CASE_FILENAME.test(filename)) {
    throw new TypeError("Case destination components are not canonical");
  }
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("Case bytes must be a Uint8Array");
  }
  const directory = await verifiedOwnerDirectory(casesRoot, ownerDirectory);
  const path = join(directory, filename);
  const temporaryPath = join(
    directory,
    `.${filename}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`,
  );
  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o644);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    const revalidated = await verifiedOwnerDirectory(casesRoot, ownerDirectory);
    if (revalidated !== directory) {
      throw new Error("Case owner directory changed during publication");
    }
    try {
      await link(temporaryPath, path);
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new Error(`Case already exists: ${path}`);
      }
      throw error;
    }
    return path;
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(temporaryPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}
