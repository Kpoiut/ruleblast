import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, parse, relative, resolve, sep } from "node:path";

const BUILD_DEPENDENCIES = ["@types/node", "typescript"];
const PACKAGE_NAME = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/iu;

function fail(message) {
  throw new Error(message);
}

function compareCodePoints(left, right) {
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftPoint = left.codePointAt(leftIndex);
    const rightPoint = right.codePointAt(rightIndex);
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
    leftIndex += leftPoint > 0xffff ? 2 : 1;
    rightIndex += rightPoint > 0xffff ? 2 : 1;
  }
  return leftIndex === left.length ? (rightIndex === right.length ? 0 : -1) : 1;
}

function record(hash, label, bytes) {
  const labelBytes = Buffer.from(label, "utf8");
  hash.update(`${labelBytes.length}:`, "utf8");
  hash.update(labelBytes);
  hash.update(`:${bytes.length}:`, "utf8");
  hash.update(bytes);
}

function parseLock(lockBytes) {
  let lock;
  try {
    lock = JSON.parse(lockBytes.toString("utf8"));
  } catch {
    fail("Committed package-lock.json is not valid JSON");
  }
  if (typeof lock !== "object" || lock === null || Array.isArray(lock) ||
      lock.lockfileVersion !== 3 || typeof lock.packages !== "object" ||
      lock.packages === null || Array.isArray(lock.packages) ||
      typeof lock.packages[""] !== "object" || lock.packages[""] === null) {
    fail("Committed package-lock.json must use the supported v3 package map");
  }
  return lock.packages;
}

function dependencyMap(value, label) {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  for (const [name, range] of Object.entries(value)) {
    if (!PACKAGE_NAME.test(name) || typeof range !== "string" || range === "") {
      fail(`${label} contains an invalid dependency`);
    }
  }
  return value;
}

function lockedCandidates(packages, fromPath, name) {
  const candidates = [];
  let base = fromPath;
  while (true) {
    const candidate = `${base === "" ? "" : `${base}/`}node_modules/${name}`;
    if (Object.prototype.hasOwnProperty.call(packages, candidate)) {
      candidates.push(candidate);
    }
    const marker = base.lastIndexOf("/node_modules/");
    if (marker >= 0) base = base.slice(0, marker);
    else if (base.startsWith("node_modules/")) base = "";
    else return candidates;
  }
}

async function assertDirectoryChain(path, label) {
  const resolvedPath = resolve(path);
  const root = parse(resolvedPath).root;
  let directory = root;
  const rootStats = await lstat(directory);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    fail(`${label} is a symlink, junction, or non-directory`);
  }
  for (const part of relative(root, resolvedPath).split(sep).filter(Boolean)) {
    directory = join(directory, part);
    const stats = await lstat(directory);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      fail(`${label} is a symlink, junction, or non-directory`);
    }
  }
  return resolvedPath;
}

async function installedPackageDirectory(projectRoot, path) {
  let directory = await assertDirectoryChain(projectRoot, "Dependency project root");
  for (const part of path.split("/")) {
    directory = join(directory, part);
    let stats;
    try {
      stats = await lstat(directory);
    } catch (error) {
      if (error?.code === "ENOENT") return undefined;
      throw new Error(`Cannot inspect installed dependency ancestor: ${path}`, {
        cause: error,
      });
    }
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      fail(`Installed dependency ancestor is a symlink or non-directory: ${path}`);
    }
  }
  return directory;
}

function installedName(path) {
  const marker = path.lastIndexOf("node_modules/");
  const name = path.slice(marker + "node_modules/".length);
  if (!PACKAGE_NAME.test(name)) fail(`Invalid locked dependency path: ${path}`);
  return name;
}

async function collectClosure(projectRoot, packages, includeBuildDependencies) {
  const root = packages[""];
  const runtime = dependencyMap(root.dependencies, "Root dependencies");
  const development = dependencyMap(root.devDependencies, "Root devDependencies");
  const pending = Object.keys(runtime).map((name) => ({ from: "", name, optional: false }));
  if (includeBuildDependencies) {
    for (const name of BUILD_DEPENDENCIES) {
      if (!Object.prototype.hasOwnProperty.call(development, name)) {
        fail(`Build dependency is not locked at the root: ${name}`);
      }
      pending.push({ from: "", name, optional: false });
    }
  }

  const selected = new Map();
  while (pending.length > 0) {
    const edge = pending.shift();
    const candidates = lockedCandidates(packages, edge.from, edge.name);
    if (candidates.length === 0) {
      if (edge.optional) continue;
      fail(`Dependency is absent from the committed lock: ${edge.name}`);
    }
    let path;
    let directory;
    for (const candidate of candidates) {
      const installed = selected.get(candidate)?.directory ??
        await installedPackageDirectory(projectRoot, candidate);
      if (installed !== undefined) {
        path = candidate;
        directory = installed;
        break;
      }
    }
    if (path === undefined || directory === undefined) {
      if (edge.optional) continue;
      fail(`Installed dependency is missing: ${edge.name}`);
    }
    if (selected.has(path)) continue;
    const entry = packages[path];
    if (typeof entry !== "object" || entry === null || Array.isArray(entry) ||
        typeof entry.version !== "string" || entry.version === "") {
      fail(`Locked dependency has an invalid record: ${path}`);
    }
    const descriptor = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    if (typeof descriptor !== "object" || descriptor === null ||
        descriptor.name !== installedName(path) || descriptor.version !== entry.version) {
      fail(`Installed dependency identity differs from the committed lock: ${path}`);
    }
    selected.set(path, { directory, entry });
    for (const name of Object.keys(dependencyMap(entry.dependencies, `${path} dependencies`))) {
      pending.push({ from: path, name, optional: false });
    }
    for (const name of Object.keys(dependencyMap(
      entry.optionalDependencies,
      `${path} optionalDependencies`,
    ))) {
      pending.push({ from: path, name, optional: true });
    }
    for (const name of Object.keys(dependencyMap(
      entry.peerDependencies,
      `${path} peerDependencies`,
    ))) {
      pending.push({ from: path, name, optional: true });
    }
  }
  return [...selected.entries()].sort(([left], [right]) => compareCodePoints(left, right));
}

async function packageFiles(root, directory = root) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => compareCodePoints(left.name, right.name));
  for (const entry of entries) {
    if (entry.name === "node_modules" && entry.isDirectory()) continue;
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) fail("Installed dependency contains a symlink");
    if (entry.isDirectory()) files.push(...await packageFiles(root, path));
    else if (entry.isFile()) files.push(path);
    else fail("Installed dependency contains a special filesystem node");
  }
  return files.sort((left, right) => compareCodePoints(
    relative(root, left).split(sep).join("/"),
    relative(root, right).split(sep).join("/"),
  ));
}

async function installedDependencyClosure(projectRoot, lockBytes, includeBuildDependencies) {
  if (!(lockBytes instanceof Uint8Array)) {
    throw new TypeError("Dependency lock bytes must be a Uint8Array");
  }
  const exactLockBytes = Buffer.from(lockBytes);
  const packages = parseLock(exactLockBytes);
  const closure = await collectClosure(projectRoot, packages, includeBuildDependencies);
  return { closure, exactLockBytes };
}

export async function installedRuntimeDependencyDirectories(projectRoot, lockBytes) {
  const { closure } = await installedDependencyClosure(projectRoot, lockBytes, false);
  return Object.freeze(closure.map(([, captured]) => captured.directory));
}

export async function digestDependencyClosure(projectRoot, lockBytes) {
  const { closure, exactLockBytes } = await installedDependencyClosure(
    projectRoot,
    lockBytes,
    true,
  );
  const hash = createHash("sha256");
  record(hash, "package-lock.json", exactLockBytes);
  for (const [path, captured] of closure) {
    const metadata = Buffer.from(JSON.stringify({
      integrity: captured.entry.integrity ?? null,
      path,
      version: captured.entry.version,
    }), "utf8");
    record(hash, `dependency:${path}`, metadata);
    for (const file of await packageFiles(captured.directory)) {
      const relativePath = relative(captured.directory, file).split(sep).join("/");
      record(hash, `${path}/${relativePath}`, await readFile(file));
    }
  }
  return hash.digest("hex");
}
