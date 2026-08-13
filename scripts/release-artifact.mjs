#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import { packPackage, packReport, tarballBytes } from "./package-pack.mjs";
import { runPackedPackageSmoke } from "./package-smoke.mjs";
import { validatePackage } from "./release-check.mjs";
import { runNpm } from "./release-process.mjs";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const MANIFEST_NAME = "manifest.json";

function fail(message) {
  throw new Error(message);
}

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    ).join(",")}}`;
  }
  fail("Release manifest contains a non-JSON value");
}

function assertExactKeys(value, expected, description) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${description} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${description} has missing or unknown fields`);
  }
}

function samePath(left, right) {
  const normalize = (path) => process.platform === "win32" ? path.toLowerCase() : path;
  return normalize(resolve(left)) === normalize(resolve(right));
}

function expectedReleaseDirectory(repositoryRoot) {
  return resolve(repositoryRoot, "artifacts", "release");
}

function assertDirectory(path, description) {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || !samePath(realpathSync(path), path)) {
    fail(`${description} must be a real directory, not a symlink or junction`);
  }
}

function assertRegularFile(path, parent, description) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || !samePath(realpathSync(path), path) ||
      !samePath(dirname(realpathSync(path)), parent)) {
    fail(`${description} must be a contained regular file`);
  }
}

function prepareReleaseDirectory(repositoryRoot) {
  const root = resolve(repositoryRoot);
  const artifacts = resolve(root, "artifacts");
  const release = expectedReleaseDirectory(root);
  const pathFromRoot = relative(root, release);
  if (pathFromRoot !== `artifacts${sep}release`) {
    fail("Release directory escaped the repository");
  }
  assertDirectory(root, "Repository root");
  if (existsSync(artifacts)) assertDirectory(artifacts, "Artifact root");
  else mkdirSync(artifacts);
  if (existsSync(release)) fail("Refusing to overwrite artifacts/release");
  mkdirSync(release);
  assertDirectory(release, "Release directory");
  return release;
}

export function cleanupOwnedReleaseDirectory(repositoryRoot, candidate) {
  const expected = expectedReleaseDirectory(repositoryRoot);
  if (!samePath(candidate, expected)) fail("Refusing cleanup outside artifacts/release");
  if (!existsSync(expected)) return;
  assertDirectory(resolve(repositoryRoot), "Repository root");
  assertDirectory(resolve(repositoryRoot, "artifacts"), "Artifact root");
  assertDirectory(expected, "Release directory");
  rmSync(expected, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

function digest(algorithm, bytes) {
  return createHash(algorithm).update(bytes).digest("hex");
}

function inventory(entry) {
  return entry.files.map((file) => ({ bytes: file.size, path: file.path }))
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

function createManifest(packed) {
  const bytes = tarballBytes(packed);
  const files = inventory(packed.entry);
  const unpackedBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (unpackedBytes !== packed.entry.unpackedSize) {
    fail("npm pack inventory size does not match unpacked size");
  }
  return {
    package: { name: packed.entry.name, version: packed.entry.version },
    schemaVersion: 1,
    tarball: {
      bytes: bytes.byteLength,
      file: packed.entry.filename,
      inventory: files,
      sha256: digest("sha256", bytes),
      sha512: digest("sha512", bytes),
      unpackedBytes,
    },
  };
}

function readManifest(releaseDirectory) {
  const path = join(releaseDirectory, MANIFEST_NAME);
  assertRegularFile(path, releaseDirectory, "Release manifest");
  const bytes = readFileSync(path);
  const raw = bytes.toString("utf8");
  if (!raw.endsWith("\n") || raw.slice(0, -1).includes("\n")) {
    fail("Release manifest is not canonical single-line JSON");
  }
  const value = JSON.parse(raw);
  if (`${canonicalJson(value)}\n` !== raw) fail("Release manifest keys are not canonical");
  return value;
}

function tarText(header, start, length) {
  return header.subarray(start, start + length).toString("utf8").replace(/\0.*$/su, "");
}

function tarOctal(header, start, length, description) {
  const value = tarText(header, start, length).trim();
  if (!/^[0-7]+$/u.test(value)) fail(`Tar ${description} is not canonical octal`);
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) fail(`Tar ${description} is out of range`);
  return parsed;
}

function assertTarChecksum(header) {
  const expected = tarOctal(header, 148, 8, "checksum");
  let actual = 0;
  for (let index = 0; index < header.length; index += 1) {
    actual += index >= 148 && index < 156 ? 0x20 : header[index];
  }
  if (actual !== expected) fail("Tar header checksum is invalid");
}

function canonicalPackagePath(path, directory = false) {
  const candidate = directory && path.endsWith("/") ? path.slice(0, -1) : path;
  if (!candidate.startsWith("package/") || candidate.endsWith("/") || candidate.includes("\\")) {
    fail("Tar contains a non-canonical package file path");
  }
  const relativePath = candidate.slice("package/".length);
  if (relativePath === "" || relativePath.startsWith("/") || /^[A-Za-z]:/u.test(relativePath) ||
      relativePath.split("/").some((part) => part === "" || part === "." || part === "..")) {
    fail("Tar contains a non-canonical package file path");
  }
  return relativePath;
}

function inventoryFromTar(bytes) {
  let archive;
  try {
    archive = gunzipSync(bytes);
  } catch {
    fail("Release tarball is not valid gzip data");
  }
  const files = [];
  let offset = 0;
  let ended = false;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      ended = true;
      if (!archive.subarray(offset).every((byte) => byte === 0)) {
        fail("Tar contains data after its end marker");
      }
      break;
    }
    assertTarChecksum(header);
    const size = tarOctal(header, 124, 12, "file size");
    const prefix = tarText(header, 345, 155);
    const name = tarText(header, 0, 100);
    const path = `${prefix}${prefix === "" ? "" : "/"}${name}`;
    const type = header[156];
    const next = offset + 512 + Math.ceil(size / 512) * 512;
    if (next > archive.length) fail("Tar file content exceeds the archive boundary");
    if (type === 0 || type === 0x30) {
      files.push({ bytes: size, path: canonicalPackagePath(path) });
    } else if (type === 0x35) {
      canonicalPackagePath(path, true);
      if (size !== 0) fail("Tar directory entry has file content");
    } else {
      fail("Tar contains an unsupported entry type");
    }
    offset = next;
  }
  if (!ended) fail("Tar is missing its end marker");
  return files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

function validateManifestSchema(manifest) {
  assertExactKeys(manifest, ["package", "schemaVersion", "tarball"], "Release manifest");
  assertExactKeys(manifest.package, ["name", "version"], "Release manifest package");
  assertExactKeys(
    manifest.tarball,
    ["bytes", "file", "inventory", "sha256", "sha512", "unpackedBytes"],
    "Release manifest tarball",
  );
  if (!Array.isArray(manifest.tarball.inventory)) {
    fail("Release manifest inventory is invalid");
  }
  for (const file of manifest.tarball.inventory) {
    assertExactKeys(file, ["bytes", "path"], "Release manifest inventory entry");
  }
}

export function verifyReleaseArtifact(repositoryRoot, releaseDirectory) {
  const expected = expectedReleaseDirectory(repositoryRoot);
  if (!samePath(releaseDirectory, expected)) fail("Release artifact is outside artifacts/release");
  assertDirectory(expected, "Release directory");
  const manifest = readManifest(expected);
  validateManifestSchema(manifest);
  const descriptor = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.package?.name !== descriptor.name ||
      manifest.package?.version !== descriptor.version ||
      typeof manifest.tarball?.file !== "string" ||
      manifest.tarball.file !== `ruleblast-${descriptor.version}.tgz`) {
    fail("Release manifest package identity does not match package.json");
  }
  const tarball = resolve(expected, manifest.tarball.file);
  if (dirname(tarball) !== expected || !existsSync(tarball)) fail("Release tarball is missing");
  assertRegularFile(tarball, expected, "Release tarball");
  const bytes = readFileSync(tarball);
  if (manifest.tarball.bytes !== bytes.byteLength || statSync(tarball).size !== bytes.byteLength ||
      manifest.tarball.sha256 !== digest("sha256", bytes) ||
      manifest.tarball.sha512 !== digest("sha512", bytes)) {
    fail("Release tarball digest or size does not match its manifest");
  }
  const files = manifest.tarball.inventory;
  if (!Array.isArray(files) || files.some((file) =>
    typeof file?.path !== "string" || !Number.isSafeInteger(file?.bytes) || file.bytes < 0
  )) fail("Release manifest inventory is invalid");
  const paths = files.map((file) => file.path);
  if (JSON.stringify(paths) !== JSON.stringify([...paths].sort()) || new Set(paths).size !== paths.length ||
      manifest.tarball.unpackedBytes !== files.reduce((sum, file) => sum + file.bytes, 0)) {
    fail("Release manifest inventory is not sorted, unique, and size-consistent");
  }
  const actualInventory = inventoryFromTar(bytes);
  if (JSON.stringify(files) !== JSON.stringify(actualInventory)) {
    fail("Release manifest inventory does not match the tarball");
  }
  if (JSON.stringify(readdirSync(expected).sort()) !==
      JSON.stringify([MANIFEST_NAME, manifest.tarball.file].sort())) {
    fail("Release directory contains an unexpected file");
  }
  return { manifest, tarball };
}

export async function buildReleaseArtifact(options = {}) {
  const repositoryRoot = resolve(options.repositoryRoot ?? REPOSITORY_ROOT);
  const environment = { ...(options.env ?? process.env), CI: "1", NO_COLOR: "1" };
  const releaseDirectory = prepareReleaseDirectory(repositoryRoot);
  let complete = false;
  try {
    await runNpm(["run", "build"], repositoryRoot, { env: environment });
    const packed = await packPackage(repositoryRoot, releaseDirectory, environment);
    const manifest = createManifest(packed);
    writeFileSync(
      join(releaseDirectory, MANIFEST_NAME),
      `${canonicalJson(manifest)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    const verified = verifyReleaseArtifact(repositoryRoot, releaseDirectory);
    validatePackage(packReport(packed), repositoryRoot);
    await runPackedPackageSmoke(packed, {
      dependencyRoot: options.dependencyRoot,
      env: environment,
      repositoryRoot,
    });
    if (!samePath(verified.tarball, packed.tarball)) fail("Smoke test used a different tarball");
    const verifiedAfterSmoke = verifyReleaseArtifact(repositoryRoot, releaseDirectory);
    if (!samePath(verifiedAfterSmoke.tarball, packed.tarball) ||
        canonicalJson(verifiedAfterSmoke.manifest) !== canonicalJson(verified.manifest)) {
      fail("Release artifact changed during its smoke test");
    }
    complete = true;
    return {
      manifest: "artifacts/release/manifest.json",
      smokeTestedTarball: `artifacts/release/${packed.entry.filename}`,
    };
  } finally {
    if (!complete) cleanupOwnedReleaseDirectory(repositoryRoot, releaseDirectory);
  }
}

const directEntry = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (directEntry) {
  try {
    const report = await buildReleaseArtifact();
    if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(report)}\n`);
    else process.stdout.write(`release artifact: ${report.smokeTestedTarball}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
