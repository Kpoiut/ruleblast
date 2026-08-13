#!/usr/bin/env node

import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertNoPathLeak } from "./package-smoke-contract.mjs";
import {
  assertRepositoryRemote,
  publishCaseExclusive,
} from "./capture-case-boundary.mjs";
import {
  createProductionArtifact,
  removeProductionArtifact,
  verifyProductionArtifact,
} from "./capture-case-producer.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const DEFAULT_CASES_ROOT = join(PROJECT_ROOT, "cases");
const FULL_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPOSITORY = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/;

const USAGE = `Usage:
  node scripts/capture-case.mjs \\
    --checkout <path> \\
    --url <https://github.com/owner/repo> \\
    --owner <owner> --repo <repo> \\
    --base <full-commit-sha> --head <full-commit-sha>
`;

function requiredString(value, label) {
  if (typeof value !== "string" || value === "" || value.includes("\0")) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function immutableObjectId(value, label) {
  const oid = requiredString(value, label);
  if (!FULL_OBJECT_ID.test(oid)) {
    throw new TypeError(`${label} must be a full immutable Git commit SHA`);
  }
  return oid;
}

function repositoryIdentity(ownerValue, repoValue, repositoryUrlValue) {
  const owner = requiredString(ownerValue, "owner");
  const repo = requiredString(repoValue, "repo");
  if (!OWNER.test(owner)) {
    throw new TypeError("owner must be a GitHub owner slug");
  }
  if (!REPOSITORY.test(repo) || repo === "." || repo === "..") {
    throw new TypeError("repo must be a GitHub repository slug");
  }
  const canonicalOwner = owner.toLowerCase();
  const canonicalRepo = repo.toLowerCase();

  const repositoryUrl = requiredString(repositoryUrlValue, "repositoryUrl");
  let parsed;
  try {
    parsed = new URL(repositoryUrl);
  } catch {
    throw new TypeError("repositoryUrl must be a public GitHub URL");
  }
  const expectedPath = `/${canonicalOwner}/${canonicalRepo}`;
  const actualPath = parsed.pathname.endsWith(".git")
    ? parsed.pathname.slice(0, -4)
    : parsed.pathname;
  if (parsed.protocol !== "https:" || parsed.hostname !== "github.com" ||
      parsed.port !== "" || parsed.username !== "" || parsed.password !== "" ||
      parsed.search !== "" || parsed.hash !== "" ||
      actualPath.toLowerCase() !== expectedPath) {
    throw new TypeError(
      "repositoryUrl is not a public GitHub URL or does not match owner and repo",
    );
  }
  return Object.freeze({
    url: `https://github.com${expectedPath}`,
    owner: canonicalOwner,
    repo: canonicalRepo,
  });
}

async function productionModules(outputRoot) {
  const load = (path) => import(pathToFileURL(join(outputRoot, path)).href);
  const [canonical, git, impact, claude, codex] = await Promise.all([
    load("canonical.js"),
    load("git.js"),
    load("impact.js"),
    load("profiles/claude.js"),
    load("profiles/codex.js"),
  ]);
  return {
    canonicalJson: canonical.canonicalJson,
    sha256: canonical.sha256,
    openGitSnapshot: git.openGitSnapshot,
    analyzeDiff: impact.analyzeDiff,
    profiles: Object.freeze([claude.claudeProfile, codex.codexProfile]),
  };
}

function captureOptions(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Capture options must be an object");
  }
  const checkout = resolve(requiredString(value.checkout, "checkout"));
  const casesRoot = resolve(requiredString(
    value.casesRoot ?? DEFAULT_CASES_ROOT,
    "casesRoot",
  ));
  const repository = repositoryIdentity(
    value.owner,
    value.repo,
    value.repositoryUrl,
  );
  const base = immutableObjectId(value.base, "base");
  const head = immutableObjectId(value.head, "head");
  if (base.length !== head.length || base === head) {
    throw new TypeError("base and head must be different commits in one repository");
  }
  return Object.freeze({ checkout, casesRoot, repository, base, head });
}

export async function captureCase(optionsValue) {
  const options = captureOptions(optionsValue);
  await assertRepositoryRemote(options.checkout, options.repository);
  const artifact = await createProductionArtifact(PROJECT_ROOT);
  let bytes;
  try {
    const production = await productionModules(artifact.outputRoot);
    let before;
    let after;
    try {
      [before, after] = await Promise.all([
        production.openGitSnapshot(options.checkout, options.base),
        production.openGitSnapshot(options.checkout, options.head),
      ]);
    } catch (error) {
      throw new Error(
        "base and head must resolve identically to the supplied full commit SHAs",
        { cause: error },
      );
    }
    if (before.ref.oid !== options.base || after.ref.oid !== options.head) {
      throw new Error(
        "base and head must resolve identically to the supplied full commit SHAs",
      );
    }
    const resultCore = await production.analyzeDiff({
      before,
      after,
      profiles: production.profiles,
    });
    await verifyProductionArtifact(artifact);
    const coreJson = production.canonicalJson(resultCore);
    const receipt = {
      schemaVersion: 1,
      repository: options.repository,
      base: options.base,
      head: options.head,
      resolverRevision: resultCore.resolverRevision,
      resultCore,
      coreDigest: production.sha256(coreJson),
      producer: artifact.producer,
      releaseReproductionCommand:
        `npx ruleblast@${artifact.producer.packageVersion} diff ${options.base} --to ${options.head} --json`,
    };
    bytes = Buffer.from(`${production.canonicalJson(receipt)}\n`, "utf8");
  } finally {
    await removeProductionArtifact(artifact);
  }
  assertNoPathLeak(new Map([["captured case", bytes]]), [
    options.checkout,
    options.casesRoot,
  ]);
  return publishCaseExclusive(
    options.casesRoot,
    `${options.repository.owner}__${options.repository.repo}`,
    `${options.base.slice(0, 12)}..${options.head.slice(0, 12)}.json`,
    bytes,
  );
}

function parseArguments(argv) {
  const values = new Map();
  const names = new Set([
    "--checkout", "--url", "--owner", "--repo", "--base", "--head",
    "--cases-root",
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!names.has(name) || value === undefined || values.has(name)) {
      throw new TypeError(`Invalid capture arguments\n${USAGE}`);
    }
    values.set(name, value);
  }
  return {
    checkout: values.get("--checkout"),
    repositoryUrl: values.get("--url"),
    owner: values.get("--owner"),
    repo: values.get("--repo"),
    base: values.get("--base"),
    head: values.get("--head"),
    casesRoot: values.get("--cases-root") ?? DEFAULT_CASES_ROOT,
  };
}

function isDirectEntry() {
  if (process.argv[1] === undefined) return false;
  return pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isDirectEntry()) {
  try {
    const outputPath = await captureCase(parseArguments(process.argv.slice(2)));
    process.stdout.write(`Captured ${relative(PROJECT_ROOT, outputPath)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
