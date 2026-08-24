import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { readOnlyGit, readOnlyGitStdin } from "./capture-case-boundary.mjs";
import { digestDependencyClosure } from "./capture-case-dependencies.mjs";

export { digestDependencyClosure } from "./capture-case-dependencies.mjs";

const runFile = promisify(execFile);
const FULL_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const BLOB_OBJECT_ID = /^[0-9a-f]+$/u;
const PRODUCER_PATHS = [
  "src",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.build.json",
  "scripts",
];
const TREE_PATHS = [
  "src",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.build.json",
];
const REQUIRED_ROOT_FILES = new Set(TREE_PATHS.slice(1));

function line(output, description) {
  const value = output.toString("utf8").replace(/\r?\n$/u, "");
  if (value === "" || value.includes("\n") || value.includes("\r")) {
    throw new Error(`Git returned an invalid ${description}`);
  }
  return value;
}

function parsePackageVersion(bytes) {
  const descriptor = JSON.parse(bytes.toString("utf8"));
  if (typeof descriptor !== "object" || descriptor === null ||
      Array.isArray(descriptor) || typeof descriptor.version !== "string" ||
      descriptor.version === "") {
    throw new TypeError("Committed package.json must contain a package version");
  }
  return descriptor.version;
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

export async function assertCleanProducer(projectRoot) {
  const [headOutput, staged, tracked, untracked] = await Promise.all([
    readOnlyGit(projectRoot, ["rev-parse", "--verify", "HEAD^{commit}"]),
    readOnlyGit(projectRoot, [
      "diff-index", "--cached", "--name-only", "-z", "--no-ext-diff",
      "--no-textconv", "HEAD", "--", ...PRODUCER_PATHS,
    ]),
    readOnlyGit(projectRoot, [
      "diff-files", "--name-only", "-z", "--no-ext-diff", "--no-textconv",
      "--", ...PRODUCER_PATHS,
    ]),
    readOnlyGit(projectRoot, [
      "ls-files", "--others", "--exclude-standard", "-z", "--",
      ...PRODUCER_PATHS,
    ]),
  ]);
  const gitCommit = line(headOutput, "producer commit id");
  if (!FULL_OBJECT_ID.test(gitCommit)) {
    throw new Error("Producer HEAD is not a full immutable commit id");
  }
  if (staged.length !== 0 || tracked.length !== 0 || untracked.length !== 0) {
    throw new Error(
      `Producer src, package, or scripts are dirty ` +
      `(staged=${staged.length}, tracked=${tracked.length}, untracked=${untracked.length})`,
    );
  }
  return gitCommit;
}

function parseTree(output) {
  const entries = [];
  for (const bytes of output.toString("utf8").split("\0")) {
    if (bytes === "") continue;
    const tab = bytes.indexOf("\t");
    const metadata = bytes.slice(0, tab).split(" ");
    const path = bytes.slice(tab + 1);
    const mode = metadata[0];
    const type = metadata[1];
    const oid = metadata[2];
    if (tab < 1 || (mode !== "100644" && mode !== "100755") ||
        type !== "blob" || oid === undefined || !BLOB_OBJECT_ID.test(oid) ||
        path === "" || path.includes("\\") || path.startsWith("/") ||
        path.split("/").some((part) => part === "" || part === "." || part === "..") ||
        (!path.startsWith("src/") && !REQUIRED_ROOT_FILES.has(path))) {
      throw new Error("Producer commit contains an invalid build-tree entry");
    }
    entries.push({ path, oid, executable: mode === "100755" });
  }
  for (const path of REQUIRED_ROOT_FILES) {
    if (!entries.some((entry) => entry.path === path)) {
      throw new Error(`Producer commit omits required build file: ${path}`);
    }
  }
  if (!entries.some((entry) => entry.path.startsWith("src/"))) {
    throw new Error("Producer commit has no production source files");
  }
  return entries.sort((left, right) => compareCodePoints(left.path, right.path));
}

function parseCatFileBatch(output, expected) {
  const blobs = [];
  let offset = 0;
  while (offset < output.length) {
    const lineEnd = output.indexOf(0x0a, offset);
    if (lineEnd < 0) throw new Error("Producer blob batch is truncated");
    const header = output.subarray(offset, lineEnd).toString("ascii");
    if (header.endsWith(" missing")) {
      throw new Error(`Producer blob is missing: ${header.slice(0, -" missing".length)}`);
    }
    const parts = header.split(" ");
    const oid = parts[0];
    const type = parts[1];
    const size = Number(parts[2]);
    if (oid === undefined || type === undefined || !Number.isInteger(size) || size < 0) {
      throw new Error("Producer blob batch header is invalid");
    }
    const start = lineEnd + 1;
    const end = start + size;
    if (end >= output.length || output[end] !== 0x0a) {
      throw new Error("Producer blob batch is truncated");
    }
    blobs.push({ oid, type, contents: output.subarray(start, end) });
    offset = end + 1;
  }
  if (blobs.length !== expected) {
    throw new Error("Producer blob batch does not match the committed tree");
  }
  return blobs;
}

async function materializeProducer(projectRoot, commit, sourceRoot) {
  const tree = parseTree(await readOnlyGit(projectRoot, [
    "ls-tree", "-rz", "--full-tree", commit, "--", ...TREE_PATHS,
  ]));
  const directories = new Set(tree.map((entry) =>
    dirname(join(sourceRoot, ...entry.path.split("/")))));
  await Promise.all([...directories].map((directory) => mkdir(directory, { recursive: true })));
  const packed = await readOnlyGitStdin(
    projectRoot,
    ["cat-file", "--batch"],
    Buffer.from(`${tree.map((entry) => entry.oid).join("\n")}\n`, "ascii"),
  );
  const blobs = parseCatFileBatch(packed, tree.length);
  for (let index = 0; index < tree.length; index += 1) {
    const entry = tree[index];
    const blob = blobs[index];
    if (blob.oid !== entry.oid || blob.type !== "blob") {
      throw new Error("Producer blob batch does not match the committed tree");
    }
    const path = join(sourceRoot, ...entry.path.split("/"));
    const handle = await open(path, "wx", entry.executable ? 0o755 : 0o644);
    try {
      await handle.writeFile(blob.contents);
    } finally {
      await handle.close();
    }
  }
}

async function artifactFiles(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await artifactFiles(root, path));
    else if (entry.isFile()) files.push(path);
    else throw new Error("Production build emitted a non-file artifact");
  }
  return files.sort((left, right) => compareCodePoints(
    relative(root, left).split(sep).join("/"),
    relative(root, right).split(sep).join("/"),
  ));
}

async function artifactDigest(root) {
  const hash = createHash("sha256");
  for (const path of await artifactFiles(root)) {
    const nameBytes = Buffer.from(
      relative(root, path).split(sep).join("/"),
      "utf8",
    );
    const bytes = await readFile(path);
    hash.update(`${nameBytes.length}:`, "utf8");
    hash.update(nameBytes);
    hash.update(`:${bytes.length}:`, "utf8");
    hash.update(bytes);
  }
  return hash.digest("hex");
}

function phase(label, startedAt) {
  if (process.env.RULEBLAST_CAPTURE_PHASES !== "1") return;
  process.stderr.write(`capture-phase ${label} ${Math.round(performance.now() - startedAt)}ms\n`);
}

export async function createProductionArtifact(projectRoot) {
  const totalAt = performance.now();
  let startedAt = totalAt;
  const gitCommit = await assertCleanProducer(projectRoot);
  phase("assertCleanProducer", startedAt);
  startedAt = performance.now();
  const temporaryRoot = await mkdtemp(join(
    projectRoot,
    "node_modules",
    ".ruleblast-case-build-",
  ));
  const sourceRoot = join(temporaryRoot, "source");
  const outputRoot = join(temporaryRoot, "dist");
  try {
    await materializeProducer(projectRoot, gitCommit, sourceRoot);
    phase("materializeProducer", startedAt);
    startedAt = performance.now();
    const lockBytes = await readFile(join(sourceRoot, "package-lock.json"));
    const dependencyClosureDigest = await digestDependencyClosure(
      projectRoot,
      lockBytes,
    );
    phase("digestDependencyClosure", startedAt);
    startedAt = performance.now();
    await runFile(process.execPath, [
      join(projectRoot, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      join(sourceRoot, "tsconfig.build.json"),
      "--outDir",
      outputRoot,
    ], {
      cwd: sourceRoot,
      env: process.env,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    });
    phase("tsc", startedAt);
    startedAt = performance.now();
    const artifact = Object.freeze({
      projectRoot: resolve(projectRoot),
      outputRoot,
      temporaryRoot,
      lockBytes: Buffer.from(lockBytes),
      producer: Object.freeze({
        gitCommit,
        packageVersion: parsePackageVersion(
          await readFile(join(sourceRoot, "package.json")),
        ),
        artifactDigest: await artifactDigest(outputRoot),
        dependencyClosureDigest,
      }),
    });
    phase("artifactDigest", startedAt);
    startedAt = performance.now();
    await verifyProductionArtifact(artifact, false);
    phase("verifyProductionArtifact", startedAt);
    phase("createProductionArtifact.total", totalAt);
    return artifact;
  } catch (error) {
    await removeProductionArtifact({ projectRoot, temporaryRoot });
    throw error;
  }
}

export async function verifyProductionArtifact(artifact, checkDependencies = true) {
  const finalCommit = await assertCleanProducer(artifact.projectRoot);
  if (finalCommit !== artifact.producer.gitCommit) {
    throw new Error("Producer HEAD changed during artifact construction");
  }
  const artifactNow = await artifactDigest(artifact.outputRoot);
  if (artifactNow !== artifact.producer.artifactDigest) {
    throw new Error("Production artifact changed during case capture");
  }
  if (!checkDependencies) return;
  const dependenciesNow = await digestDependencyClosure(
    artifact.projectRoot,
    artifact.lockBytes,
  );
  if (dependenciesNow !== artifact.producer.dependencyClosureDigest) {
    throw new Error("Installed dependency closure changed during case capture");
  }
}

export async function removeProductionArtifact(artifact) {
  const resolved = resolve(artifact.temporaryRoot);
  const prefix = resolve(
    artifact.projectRoot,
    "node_modules",
    ".ruleblast-case-build-",
  );
  if (dirname(resolved) !== dirname(prefix) ||
      !resolved.startsWith(prefix) || resolved.length <= prefix.length) {
    throw new Error("Refusing to remove an unrecognized production artifact path");
  }
  await rm(resolved, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}
