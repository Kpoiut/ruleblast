import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { runNpm } from "./release-process.mjs";

const DEFAULT_PACK_TIMEOUT_MS = 60_000;

function fail(message) {
  throw new Error(message);
}

export function assertContained(root, candidate, description) {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  const pathFromRoot = relative(resolvedRoot, resolvedCandidate);
  if (pathFromRoot === "" || pathFromRoot === ".." ||
      pathFromRoot.startsWith(`..${sep}`) || resolve(resolvedRoot, pathFromRoot) !== resolvedCandidate) {
    fail(`${description} escaped its containing directory`);
  }
  return resolvedCandidate;
}

function parsePackJson(stdout) {
  let value;
  try {
    value = JSON.parse(stdout.toString("utf8"));
  } catch {
    fail("npm pack did not emit one JSON document");
  }
  if (!Array.isArray(value) || value.length !== 1 ||
      typeof value[0] !== "object" || value[0] === null) {
    fail("npm pack must report exactly one package");
  }
  return value[0];
}

function validPackFile(file) {
  return typeof file === "object" && file !== null &&
    typeof file.path === "string" && file.path !== "" &&
    Number.isSafeInteger(file.size) && file.size >= 0;
}

export function parsePack(stdout, packDirectory) {
  const entry = parsePackJson(stdout);
  if (typeof entry.filename !== "string" || entry.filename !== basename(entry.filename) ||
      typeof entry.name !== "string" || entry.name === "" ||
      typeof entry.version !== "string" || entry.version === "" ||
      !Number.isSafeInteger(entry.size) || entry.size < 1 ||
      !Number.isSafeInteger(entry.unpackedSize) || entry.unpackedSize < 1 ||
      !Array.isArray(entry.files) || !entry.files.every(validPackFile)) {
    fail("npm pack returned an invalid package record");
  }
  const tarball = assertContained(packDirectory, resolve(packDirectory, entry.filename), "Tarball");
  if (!existsSync(tarball) || statSync(tarball).size !== entry.size) {
    fail("npm pack size does not match the produced tarball");
  }
  return { entry, tarball };
}

export async function packPackage(
  repositoryRoot,
  packDirectory,
  environment = process.env,
  options = {},
) {
  const result = await runNpm([
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    packDirectory,
  ], repositoryRoot, {
    env: environment,
    timeoutMs: options.timeoutMs ?? DEFAULT_PACK_TIMEOUT_MS,
  });
  return parsePack(result.stdout, packDirectory);
}

export function packReport(packed) {
  if (!existsSync(packed.tarball) || statSync(packed.tarball).size !== packed.entry.size) {
    fail("Packed tarball changed after npm pack");
  }
  return {
    tarballBytes: packed.entry.size,
    packedFiles: packed.entry.files.map((file) => file.path).sort(),
  };
}

export function tarballBytes(packed) {
  const bytes = readFileSync(packed.tarball);
  if (bytes.byteLength !== packed.entry.size) fail("Packed tarball size changed");
  return bytes;
}
