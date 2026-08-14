#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runPackageSmoke } from "./package-smoke.mjs";
import { runNpm } from "./release-process.mjs";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const MAX_TARBALL_BYTES = 1024 * 1024;
const MAX_RUNTIME_DEPENDENCIES = 3;
const MAX_PRODUCTION_MODULE_LINES = 400;
const INSTALL_LIFECYCLE_SCRIPTS = [
  "preinstall",
  "install",
  "postinstall",
  "prepack",
  "postpack",
  "prepublish",
  "prepublishOnly",
  "publish",
  "postpublish",
  "preprepare",
  "prepare",
  "postprepare",
  "preversion",
  "version",
  "postversion",
];

function fail(message) {
  throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sortedKeys(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("Expected a JSON object");
  }
  return Object.keys(value).sort();
}

function assertExactKeys(value, expected, description) {
  const actual = sortedKeys(value);
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${description} has missing or unknown fields`);
  }
}

function slashPath(path) {
  return path.split(sep).join("/");
}

function filesBelow(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesBelow(path));
    else if (entry.isFile()) result.push(path);
    else fail(`Release allowlist contains a non-file: ${slashPath(relative(REPOSITORY_ROOT, path))}`);
  }
  return result;
}

export function expectedPackedFiles(repositoryRoot = REPOSITORY_ROOT) {
  const fixed = [
    "package.json",
    "README.md",
    "CONTRACT.md",
    "LICENSE",
    "AGENT_USAGE.md",
    "cases/README.md",
    "cases/kpoiut__ruleblast/27d52e2cd6ee..e420008a1c10.json",
  ];
  const dist = filesBelow(join(repositoryRoot, "src"))
    .filter((path) => path.endsWith(".ts"))
    .flatMap((path) => {
      const sourceRelative = slashPath(relative(join(repositoryRoot, "src"), path));
      const base = sourceRelative.slice(0, -3);
      return [`dist/${base}.js`, `dist/${base}.d.ts`];
    });
  return [...fixed, ...dist].sort();
}

export function validatePackage(report, repositoryRoot = REPOSITORY_ROOT) {
  const descriptor = readJson(join(repositoryRoot, "package.json"));
  const dependencies = sortedKeys(descriptor.dependencies ?? {});
  if (dependencies.length > MAX_RUNTIME_DEPENDENCIES) {
    fail(`Runtime dependency count ${dependencies.length} exceeds ${MAX_RUNTIME_DEPENDENCIES}`);
  }
  const scripts = descriptor.scripts ?? {};
  const lifecycle = INSTALL_LIFECYCLE_SCRIPTS.filter((name) =>
    Object.prototype.hasOwnProperty.call(scripts, name),
  );
  if (lifecycle.length > 0) fail(`Install lifecycle scripts are forbidden: ${lifecycle.join(", ")}`);
  if (report.tarballBytes > MAX_TARBALL_BYTES) {
    fail(`Packed tarball ${report.tarballBytes} bytes exceeds ${MAX_TARBALL_BYTES}`);
  }
  const actualFiles = [...report.packedFiles].sort();
  const expectedFiles = expectedPackedFiles(repositoryRoot);
  for (const path of actualFiles) {
    if (path.startsWith("/") || /^[A-Za-z]:/.test(path) ||
        path.split("/").some((part) => part === "" || part === "." || part === "..")) {
      fail(`Packed path is not canonical: ${JSON.stringify(path)}`);
    }
  }
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    const missing = expectedFiles.filter((path) => !actualFiles.includes(path));
    const extra = actualFiles.filter((path) => !expectedFiles.includes(path));
    fail(`Packed allowlist mismatch; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`);
  }
  return { dependencyCount: dependencies.length, lifecycleScripts: lifecycle };
}

function lineCount(text) {
  if (text === "") return 0;
  const lines = text.split(/\r?\n/);
  return lines.at(-1) === "" ? lines.length - 1 : lines.length;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function extractionReviews() {
  const value = readJson(join(REPOSITORY_ROOT, "EXTRACTION_REVIEWS.json"));
  assertExactKeys(value, ["schemaVersion", "reviews"], "Extraction review document");
  if (value.schemaVersion !== 1 || !Array.isArray(value.reviews)) {
    fail("Extraction review document has an unsupported schema");
  }
  const reviews = new Map();
  for (const review of value.reviews) {
    assertExactKeys(review, ["path", "sha256", "reason", "followUp"], "Extraction review");
    if (typeof review.path !== "string" || !review.path.startsWith("src/") ||
        !review.path.endsWith(".ts") || review.path.split("/").includes("..") ||
        typeof review.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(review.sha256) ||
        typeof review.reason !== "string" || review.reason.trim() === "" ||
        typeof review.followUp !== "string" || review.followUp.trim() === "") {
      fail("Extraction review contains an invalid field");
    }
    if (reviews.has(review.path)) fail(`Duplicate extraction review: ${review.path}`);
    reviews.set(review.path, review);
  }
  return reviews;
}

function validateProductionModules() {
  const sourceRoot = join(REPOSITORY_ROOT, "src");
  const modules = filesBelow(sourceRoot).filter((path) => path.endsWith(".ts"));
  const reviews = extractionReviews();
  const digests = new Map();
  let totalLines = 0;
  for (const path of modules) {
    const bytes = readFileSync(path);
    const relativePath = slashPath(relative(REPOSITORY_ROOT, path));
    const lines = lineCount(bytes.toString("utf8"));
    totalLines += lines;
    const digest = sha256(bytes);
    const duplicate = digests.get(digest);
    if (duplicate !== undefined) fail(`Duplicate production modules: ${duplicate} and ${relativePath}`);
    digests.set(digest, relativePath);
    const review = reviews.get(relativePath);
    if (lines > MAX_PRODUCTION_MODULE_LINES) {
      if (review === undefined || review.sha256 !== digest) {
        fail(`${relativePath} has ${lines} lines without an exact-content extraction review`);
      }
      reviews.delete(relativePath);
    } else if (review !== undefined) {
      fail(`Stale extraction review for ${relativePath}; module is now ${lines} lines`);
    }
  }
  if (reviews.size > 0) fail(`Extraction reviews reference missing modules: ${[...reviews.keys()].join(", ")}`);
  return { moduleCount: modules.length, totalLines, maximumLines: MAX_PRODUCTION_MODULE_LINES };
}

function controlledEnvironment() {
  return { ...process.env, CI: "1", NO_COLOR: "1" };
}

export async function runReleaseCheck() {
  const environment = controlledEnvironment();
  await runNpm(["run", "check"], REPOSITORY_ROOT, { env: environment });
  await runNpm(["run", "build"], REPOSITORY_ROOT, { env: environment });
  const packageReport = await runPackageSmoke({ env: environment });
  const packageGate = validatePackage(packageReport);
  const moduleGate = validateProductionModules();
  const { runBenchmark } = await import("./benchmark.mjs");
  const benchmark = await runBenchmark();
  return {
    ok: true,
    tarballBytes: packageReport.tarballBytes,
    packedFileCount: packageReport.packedFiles.length,
    runtimeDependencyCount: packageGate.dependencyCount,
    productionModuleCount: moduleGate.moduleCount,
    productionLines: moduleGate.totalLines,
    benchmarkP95Ms: benchmark.benchmark.p95Ms,
  };
}

const directEntry = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (directEntry) {
  try {
    const report = await runReleaseCheck();
    if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(report)}\n`);
    else process.stdout.write(
      `release check: ok; tarball ${report.tarballBytes} bytes; ` +
      `${report.packedFileCount} files; ${report.runtimeDependencyCount} runtime dependencies; ` +
      `${report.productionModuleCount} production modules / ${report.productionLines} lines (informational); ` +
      `benchmark p95 ${report.benchmarkP95Ms.toFixed(2)}ms\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
