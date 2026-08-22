import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../src/canonical.js";

const projectRoot = resolve(import.meta.dirname, "..");
const temporaryRoots: string[] = [];
let producerRoot = "";
let producerCommit = "";
let captureModuleUrl = "";

function windowsShortPath(root: string): string {
  // Node's default Win32 quoting doubles embedded quotes and yields D:\"C:...
  const printed = spawnSync(
    join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe"),
    ["/d", "/s", "/c", 'for %I in ("%RULEBLAST_ALIAS_ROOT%") do @echo %~sI'],
    {
      encoding: "utf8",
      env: { ...process.env, RULEBLAST_ALIAS_ROOT: root },
      windowsHide: true,
      windowsVerbatimArguments: true,
    },
  );
  const alias = printed.stdout.trim();
  if (printed.status !== 0 || alias.includes('"') || !existsSync(alias)) {
    throw new Error(`Windows 8.3 path is not a real directory: ${JSON.stringify(alias)}`);
  }
  return alias;
}

interface CaptureOptions {
  readonly checkout: string;
  readonly repositoryUrl: string;
  readonly owner: string;
  readonly repo: string;
  readonly base: string;
  readonly head: string;
  readonly casesRoot: string;
}

async function captureCase(options: CaptureOptions): Promise<string> {
  const loaded = await import(captureModuleUrl) as Record<string, unknown>;
  if (typeof loaded.captureCase !== "function") {
    throw new TypeError("capture-case.mjs must export captureCase");
  }
  return loaded.captureCase(options) as Promise<string>;
}

async function captureBoundary(): Promise<Record<string, unknown>> {
  return import(pathToFileURL(
    join(producerRoot, "scripts", "capture-case-boundary.mjs"),
  ).href) as Promise<Record<string, unknown>>;
}

async function captureProducer(): Promise<Record<string, unknown>> {
  return import(pathToFileURL(
    join(producerRoot, "scripts", "capture-case-producer.mjs"),
  ).href) as Promise<Record<string, unknown>>;
}

interface GitFixture {
  readonly root: string;
  readonly base: string;
  readonly head: string;
}

interface RepositoryOracle {
  readonly config: Buffer;
  readonly configMtimeNs: bigint;
  readonly index: Buffer;
  readonly indexMtimeNs: bigint;
  readonly tracked: readonly (readonly [string, Buffer])[];
}

interface IndexOracle {
  readonly bytes: Buffer;
  readonly mtimeNs: bigint;
}

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_OPTIONAL_LOCKS: "0",
    },
  }).trim();
}

function createFixture(): GitFixture {
  const root = mkdtempSync(join(tmpdir(), "ruleblast case source "));
  temporaryRoots.push(root);
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "AGENTS.md"), "Keep changes narrow.\n");
  writeFileSync(join(root, "CLAUDE.md"), "@AGENTS.md");
  writeFileSync(join(root, "src", "index.ts"), "export const answer = 41;\n");
  git(root, ["init", "--initial-branch=main"]);
  git(root, ["config", "user.name", "RuleBlast Test"]);
  git(root, ["config", "user.email", "ruleblast@example.invalid"]);
  git(root, ["remote", "add", "origin", "https://github.com/acme/rules.git"]);
  git(root, ["add", "--", "."]);
  git(root, ["commit", "-m", "base"]);
  const base = git(root, ["rev-parse", "HEAD"]);

  writeFileSync(
    join(root, "AGENTS.md"),
    "Keep changes narrow.\nRun the focused test first.\n",
  );
  git(root, ["add", "--", "AGENTS.md"]);
  git(root, ["commit", "-m", "change instructions"]);
  const head = git(root, ["rev-parse", "HEAD"]);
  return { root, base, head };
}

function newCasesRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "ruleblast captured cases "));
  temporaryRoots.push(root);
  return root;
}

function filesystemIdentity(path: string): { readonly dev: bigint; readonly ino: bigint } {
  const entry = statSync(path, { bigint: true });
  return { dev: entry.dev, ino: entry.ino };
}

const EXECUTION_DEPENDENCIES = [
  "@types/node",
  "balanced-match",
  "brace-expansion",
  "diff",
  "minimatch",
  "typescript",
  "undici-types",
  "yaml",
] as const;

function copyExecutionDependencies(root: string): void {
  const targetModules = join(root, "node_modules");
  mkdirSync(targetModules, { recursive: true });
  const copyPackage = (path: string): void => {
    const target = join(targetModules, ...path.split("/"));
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(projectRoot, "node_modules", ...path.split("/")), target, {
      recursive: true,
    });
  };
  for (const path of EXECUTION_DEPENDENCIES) copyPackage(path);
  const platformRoot = join(projectRoot, "node_modules", "@typescript");
  for (const entry of readdirSync(platformRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) copyPackage(`@typescript/${entry.name}`);
  }
}

function createProducer(): void {
  producerRoot = mkdtempSync(join(tmpdir(), "ruleblast case producer "));
  temporaryRoots.push(producerRoot);
  for (const path of [
    ".gitignore",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.build.json",
    "src",
  ]) {
    cpSync(join(projectRoot, path), join(producerRoot, path), { recursive: true });
  }
  mkdirSync(join(producerRoot, "scripts"));
  for (const name of [
    "capture-case.mjs",
    "capture-case-boundary.mjs",
    "capture-case-dependencies.mjs",
    "capture-case-producer.mjs",
    "package-smoke-contract.mjs",
  ]) {
    cpSync(join(projectRoot, "scripts", name), join(producerRoot, "scripts", name));
  }
  git(producerRoot, ["init", "--initial-branch=main"]);
  git(producerRoot, ["config", "user.name", "RuleBlast Test"]);
  git(producerRoot, ["config", "user.email", "ruleblast@example.invalid"]);
  git(producerRoot, ["add", "--", "."]);
  git(producerRoot, ["commit", "-m", "test producer"]);
  producerCommit = git(producerRoot, ["rev-parse", "HEAD"]);
  copyExecutionDependencies(producerRoot);
  captureModuleUrl = pathToFileURL(
    join(producerRoot, "scripts", "capture-case.mjs"),
  ).href;
}

function cloneProducer(withDependencies = false): string {
  const parent = mkdtempSync(join(tmpdir(), "ruleblast case producer clone "));
  temporaryRoots.push(parent);
  const root = join(parent, "producer");
  execFileSync("git", ["clone", "--local", "--shared", producerRoot, root], {
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_OPTIONAL_LOCKS: "0" },
  });
  if (withDependencies) copyExecutionDependencies(root);
  else mkdirSync(join(root, "node_modules"));
  return root;
}

function createMinimalProducer(): string {
  const root = mkdtempSync(join(tmpdir(), "ruleblast dirty producer "));
  temporaryRoots.push(root);
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "scripts"));
  writeFileSync(join(root, "package.json"), "{}\n");
  writeFileSync(join(root, "package-lock.json"), "{}\n");
  writeFileSync(join(root, "tsconfig.json"), "{}\n");
  writeFileSync(join(root, "tsconfig.build.json"), "{}\n");
  writeFileSync(join(root, "src", "index.ts"), "export {};\n");
  writeFileSync(join(root, "scripts", "capture-case.mjs"), "export {};\n");
  git(root, ["init", "--initial-branch=main"]);
  git(root, ["config", "user.name", "RuleBlast Test"]);
  git(root, ["config", "user.email", "ruleblast@example.invalid"]);
  git(root, ["add", "--", "."]);
  git(root, ["commit", "-m", "minimal producer"]);
  return root;
}

function repositoryOracle(root: string): RepositoryOracle {
  const configPath = join(root, ".git", "config");
  const indexPath = join(root, ".git", "index");
  return {
    config: readFileSync(configPath),
    configMtimeNs: statSync(configPath, { bigint: true }).mtimeNs,
    index: readFileSync(indexPath),
    indexMtimeNs: statSync(indexPath, { bigint: true }).mtimeNs,
    tracked: ["AGENTS.md", "CLAUDE.md", "src/index.ts"].map(
      (path) => [path, readFileSync(join(root, path))] as const,
    ),
  };
}

function indexOracle(root: string): IndexOracle {
  const path = join(root, ".git", "index");
  return {
    bytes: readFileSync(path),
    mtimeNs: statSync(path, { bigint: true }).mtimeNs,
  };
}

function buildResidue(root: string): string[] {
  return readdirSync(join(root, "node_modules"))
    .filter((name) => name.startsWith(".ruleblast-case-build-"));
}

beforeAll(createProducer, 60_000);

afterAll(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}, 60_000);

describe("captureCase", () => {
  it("writes one canonical receipt from immutable Git snapshots through the production analyzer", async () => {
    const fixture = createFixture();
    const casesRoot = newCasesRoot();
    const beforeCapture = repositoryOracle(fixture.root);
    const producerIndex = indexOracle(producerRoot);
    expect(existsSync(join(producerRoot, "dist"))).toBe(false);
    expect(buildResidue(producerRoot)).toEqual([]);
    const outputPath = await captureCase({
      checkout: fixture.root,
      repositoryUrl: "https://github.com/acme/rules",
      owner: "acme",
      repo: "rules",
      base: fixture.base,
      head: fixture.head,
      casesRoot,
    });

    expect(filesystemIdentity(outputPath)).toEqual(filesystemIdentity(join(
      casesRoot,
      "acme__rules",
      `${fixture.base.slice(0, 12)}..${fixture.head.slice(0, 12)}.json`,
    )));
    const bytes = readFileSync(outputPath, "utf8");
    expect(bytes.endsWith("\n")).toBe(true);
    expect(bytes.slice(0, -1)).not.toContain("\n");
    const receipt = JSON.parse(bytes) as Record<string, unknown>;
    expect(Object.keys(receipt).sort()).toEqual([
      "base",
      "coreDigest",
      "head",
      "producer",
      "releaseReproductionCommand",
      "repository",
      "resolverRevision",
      "resultCore",
      "schemaVersion",
    ]);
    expect(receipt).toMatchObject({
      schemaVersion: 1,
      repository: {
        url: "https://github.com/acme/rules",
        owner: "acme",
        repo: "rules",
      },
      base: fixture.base,
      head: fixture.head,
      resolverRevision: 1,
      producer: {
        gitCommit: producerCommit,
        packageVersion: "2.4.11",
        dependencyClosureDigest: expect.stringMatching(/^[0-9a-f]{64}$/u),
      },
      releaseReproductionCommand:
        `npx ruleblast@2.4.11 diff ${fixture.base} --to ${fixture.head} --json`,
      resultCore: {
        mode: "diff",
        before: { kind: "git", label: fixture.base, oid: fixture.base },
        after: { kind: "git", label: fixture.head, oid: fixture.head },
      },
    });

    expect(receipt.coreDigest).toBe(sha256(canonicalJson(receipt.resultCore)));
    const producer = receipt.producer as Record<string, unknown>;
    expect(Object.keys(producer).sort()).toEqual([
      "artifactDigest",
      "dependencyClosureDigest",
      "gitCommit",
      "packageVersion",
    ]);
    expect(producer.artifactDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(bytes.toLowerCase()).not.toContain(fixture.root.toLowerCase());
    expect(bytes).not.toContain("Keep changes narrow");
    expect(bytes).not.toContain("@AGENTS.md");
    expect(bytes).not.toContain("export const answer");
    expect(repositoryOracle(fixture.root)).toEqual(beforeCapture);
    expect(indexOracle(producerRoot)).toEqual(producerIndex);
    expect(existsSync(join(producerRoot, "dist"))).toBe(false);
    expect(buildResidue(producerRoot)).toEqual([]);
  }, 60_000);

  it("is deterministic across destinations and refuses to overwrite a receipt", async () => {
    const fixture = createFixture();
    const firstRoot = newCasesRoot();
    const secondRoot = newCasesRoot();
    const options = {
      checkout: fixture.root,
      repositoryUrl: "https://github.com/acme/rules",
      owner: "acme",
      repo: "rules",
      base: fixture.base,
      head: fixture.head,
    } as const;
    const firstPath = await captureCase({ ...options, casesRoot: firstRoot });
    const secondPath = await captureCase({
      ...options,
      repositoryUrl: "https://github.com/AcMe/RuLeS",
      owner: "AcMe",
      repo: "RuLeS",
      casesRoot: secondRoot,
    });
    const original = readFileSync(firstPath);
    expect(readFileSync(secondPath)).toEqual(original);
    expect(filesystemIdentity(secondPath)).toEqual(filesystemIdentity(join(
      secondRoot,
      "acme__rules",
      `${fixture.base.slice(0, 12)}..${fixture.head.slice(0, 12)}.json`,
    )));

    await expect(captureCase({ ...options, casesRoot: firstRoot }))
      .rejects.toThrow(/already exists/i);
    expect(readFileSync(firstPath)).toEqual(original);
    // The failure happens after the temporary file is written and the
    // exclusive hard-link sees the existing final path. No temp survives.
    expect(readdirSync(join(firstRoot, "acme__rules"))).toEqual([
      `${fixture.base.slice(0, 12)}..${fixture.head.slice(0, 12)}.json`,
    ]);
  }, 60_000);

  it("rejects mutable, abbreviated, identical, mismatched, and unsafe identities", async () => {
    const fixture = createFixture();
    const valid = {
      checkout: fixture.root,
      repositoryUrl: "https://github.com/acme/rules",
      owner: "acme",
      repo: "rules",
      base: fixture.base,
      head: fixture.head,
      casesRoot: newCasesRoot(),
    } as const;

    await expect(captureCase({ ...valid, base: "HEAD" }))
      .rejects.toThrow(/full immutable/i);
    await expect(captureCase({ ...valid, base: fixture.base.slice(0, 12) }))
      .rejects.toThrow(/full immutable/i);
    await expect(captureCase({ ...valid, head: fixture.base }))
      .rejects.toThrow(/different commits/i);
    const invalidUrls = [
      "https://github.com/other/rules",
      "http://github.com/acme/rules",
      "https://user@github.com/acme/rules",
      "https://github.com:444/acme/rules",
      "https://github.com/acme/rules?ref=main",
      "https://github.com/acme/rules#readme",
      "https://github.com/acme/%72ules",
      "https://github.com/acme/rules/extra",
    ];
    for (const repositoryUrl of invalidUrls) {
      await expect(captureCase({ ...valid, repositoryUrl }))
        .rejects.toThrow(/public GitHub URL|does not match/i);
    }
    for (const [field, value] of [
      ["owner", "../acme"],
      ["owner", "acme/team"],
      ["owner", "."],
      ["repo", "../rules"],
      ["repo", "rules/child"],
      ["repo", ".."],
    ] as const) {
      await expect(captureCase({ ...valid, [field]: value }))
        .rejects.toThrow(/slug/i);
    }
    expect(existsSync(join(valid.casesRoot, "acme__rules"))).toBe(false);
  }, 30_000);

  it("rejects a full object id that does not resolve to the identical commit", async () => {
    const fixture = createFixture();
    const blob = git(fixture.root, ["rev-parse", `${fixture.head}:AGENTS.md`]);
    const casesRoot = newCasesRoot();
    await expect(captureCase({
      checkout: fixture.root,
      repositoryUrl: "https://github.com/acme/rules",
      owner: "acme",
      repo: "rules",
      base: fixture.base,
      head: blob,
      casesRoot,
    })).rejects.toThrow(/resolve identically/i);
    expect(readdirSync(casesRoot)).toEqual([]);
    expect(buildResidue(producerRoot)).toEqual([]);
  }, 30_000);

  it("ties the declared public identity to one unambiguous configured remote", async () => {
    const mismatch = createFixture();
    await expect(captureCase({
      checkout: mismatch.root,
      repositoryUrl: "https://github.com/other/rules",
      owner: "other",
      repo: "rules",
      base: mismatch.base,
      head: mismatch.head,
      casesRoot: newCasesRoot(),
    })).rejects.toThrow(/does not match.*remote/i);

    const missing = createFixture();
    git(missing.root, ["remote", "remove", "origin"]);
    await expect(captureCase({
      checkout: missing.root,
      repositoryUrl: "https://github.com/acme/rules",
      owner: "acme",
      repo: "rules",
      base: missing.base,
      head: missing.head,
      casesRoot: newCasesRoot(),
    })).rejects.toThrow(/configured remote/i);

    const ambiguous = createFixture();
    git(ambiguous.root, [
      "remote", "add", "upstream", "git@github.com:other/rules.git",
    ]);
    await expect(captureCase({
      checkout: ambiguous.root,
      repositoryUrl: "https://github.com/acme/rules",
      owner: "acme",
      repo: "rules",
      base: ambiguous.base,
      head: ambiguous.head,
      casesRoot: newCasesRoot(),
    })).rejects.toThrow(/ambiguous/i);

    const ssh = createFixture();
    git(ssh.root, ["remote", "set-url", "origin", "git@github.com:acme/rules.git"]);
    const sshOracle = repositoryOracle(ssh.root);
    const boundary = await captureBoundary();
    const assertRemote = boundary.assertRepositoryRemote as (
      checkout: string,
      repository: { readonly owner: string; readonly repo: string },
    ) => Promise<void>;
    await expect(assertRemote(ssh.root, { owner: "acme", repo: "rules" }))
      .resolves.toBeUndefined();
    expect(repositoryOracle(ssh.root)).toEqual(sshOracle);
  }, 30_000);

  it("checks producer dirtiness without refreshing its raw Git index", async () => {
    const producer = await captureProducer();
    const assertCleanProducer = producer.assertCleanProducer as (
      root: string,
    ) => Promise<string>;
    const trackedRoot = createMinimalProducer();
    const trackedOracle = indexOracle(trackedRoot);
    const capturePath = join(trackedRoot, "scripts", "capture-case.mjs");
    writeFileSync(capturePath, Buffer.concat([
      readFileSync(capturePath),
      Buffer.from("\n"),
    ]));
    await expect(assertCleanProducer(trackedRoot)).rejects.toThrow(/dirty/i);
    expect(indexOracle(trackedRoot)).toEqual(trackedOracle);

    const untrackedRoot = createMinimalProducer();
    const untrackedOracle = indexOracle(untrackedRoot);
    const untracked = join(untrackedRoot, "scripts", "capture-case-rogue.mjs");
    writeFileSync(untracked, "export {};\n");
    await expect(assertCleanProducer(untrackedRoot)).rejects.toThrow(/dirty/i);
    expect(indexOracle(untrackedRoot)).toEqual(untrackedOracle);
    await expect(assertCleanProducer(producerRoot)).resolves.toBe(producerCommit);
  }, 15_000);

  it("resolves a Windows 8.3 alias without embedding cmd quotes", () => {
    if (process.platform !== "win32") return;
    const root = mkdtempSync(join(tmpdir(), "ruleblast short path "));
    temporaryRoots.push(root);
    const alias = windowsShortPath(root);
    expect(alias.includes('"')).toBe(false);
    expect(existsSync(alias)).toBe(true);
    expect(statSync(alias).isDirectory()).toBe(true);
  });

  it("binds transitive build and runtime dependency bytes into producer provenance", async () => {
    const producer = await captureProducer();
    const digestDependencyClosure = producer.digestDependencyClosure as
      | ((projectRoot: string, lockBytes: Buffer) => Promise<string>)
      | undefined;
    expect(digestDependencyClosure).toBeTypeOf("function");

    const root = mkdtempSync(join(tmpdir(), "ruleblast dependency closure "));
    temporaryRoots.push(root);
    const packages = {
      "": {
        dependencies: {
          diff: "1.0.0",
          host: "1.0.0",
          minimatch: "1.0.0",
          yaml: "1.0.0",
        },
        devDependencies: { "@types/node": "1.0.0", typescript: "1.0.0" },
      },
      "node_modules/@types/node": {
        version: "1.0.0",
        dependencies: { "undici-types": "1.0.0" },
      },
      "node_modules/balanced-match": { version: "1.0.0" },
      "node_modules/brace-expansion": {
        version: "1.0.0",
        dependencies: { "balanced-match": "1.0.0" },
      },
      "node_modules/diff": { version: "1.0.0" },
      "node_modules/fallback": { version: "1.0.0" },
      "node_modules/host": {
        version: "1.0.0",
        optionalDependencies: { fallback: "1.0.0" },
      },
      "node_modules/host/node_modules/fallback": { version: "2.0.0" },
      "node_modules/minimatch": {
        version: "1.0.0",
        dependencies: { "brace-expansion": "1.0.0" },
      },
      "node_modules/typescript": { version: "1.0.0" },
      "node_modules/undici-types": { version: "1.0.0" },
      "node_modules/yaml": { version: "1.0.0" },
    } as const;
    const lockBytes = Buffer.from(JSON.stringify({
      name: "fixture",
      version: "1.0.0",
      lockfileVersion: 3,
      packages,
    }));
    for (const [path, descriptor] of Object.entries(packages).slice(1) as
      [string, { readonly version: string }][]) {
      if (path === "node_modules/host/node_modules/fallback") continue;
      const directory = join(root, ...path.split("/"));
      mkdirSync(directory, { recursive: true });
      const name = path.slice("node_modules/".length);
      writeFileSync(join(directory, "package.json"), JSON.stringify({
        name,
        version: descriptor.version,
      }));
      writeFileSync(join(directory, "index.js"), `export const id = ${JSON.stringify(name)};\n`);
    }

    let dependencyRoot = root;
    if (process.platform === "win32") {
      dependencyRoot = windowsShortPath(root);
    }

    const first = await digestDependencyClosure!(dependencyRoot, lockBytes);
    const repeated = await digestDependencyClosure!(root, lockBytes);
    expect(repeated).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/u);

    writeFileSync(
      join(root, "node_modules", "balanced-match", "index.js"),
      "export const id = 'tampered';\n",
    );
    const afterTransitiveTamper = await digestDependencyClosure!(root, lockBytes);
    expect(afterTransitiveTamper).not.toBe(first);

    writeFileSync(
      join(root, "node_modules", "fallback", "index.js"),
      "export const id = 'hoisted fallback tampered';\n",
    );
    expect(await digestDependencyClosure!(root, lockBytes))
      .not.toBe(afterTransitiveTamper);
  }, 15_000);

  it("rejects a symlinked dependency ancestor", async () => {
    const producer = await captureProducer();
    const digestDependencyClosure = producer.digestDependencyClosure as
      (projectRoot: string, lockBytes: Buffer) => Promise<string>;
    const installedRoot = mkdtempSync(join(tmpdir(), "ruleblast real dependencies "));
    const linkedRoot = mkdtempSync(join(tmpdir(), "ruleblast linked dependencies "));
    temporaryRoots.push(installedRoot, linkedRoot);
    const packages = {
      "": {
        dependencies: { diff: "1.0.0", minimatch: "1.0.0", yaml: "1.0.0" },
        devDependencies: { "@types/node": "1.0.0", typescript: "1.0.0" },
      },
      "node_modules/@types/node": { version: "1.0.0" },
      "node_modules/diff": { version: "1.0.0" },
      "node_modules/minimatch": { version: "1.0.0" },
      "node_modules/typescript": { version: "1.0.0" },
      "node_modules/yaml": { version: "1.0.0" },
    } as const;
    for (const [path, descriptor] of Object.entries(packages).slice(1) as
      [string, { readonly version: string }][]) {
      const directory = join(installedRoot, ...path.split("/"));
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "package.json"), JSON.stringify({
        name: path.slice("node_modules/".length),
        version: descriptor.version,
      }));
    }
    symlinkSync(
      join(installedRoot, "node_modules"),
      join(linkedRoot, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const lockBytes = Buffer.from(JSON.stringify({
      name: "fixture",
      version: "1.0.0",
      lockfileVersion: 3,
      packages,
    }));

    await expect(digestDependencyClosure(linkedRoot, lockBytes))
      .rejects.toThrow(/ancestor|junction|symlink/iu);
  });

  it("rejects a dependency project nested below a symlinked parent", async () => {
    const producer = await captureProducer();
    const digestDependencyClosure = producer.digestDependencyClosure as
      (projectRoot: string, lockBytes: Buffer) => Promise<string>;
    const realParent = mkdtempSync(join(tmpdir(), "ruleblast real parent "));
    const linkedParent = mkdtempSync(join(tmpdir(), "ruleblast linked parent "));
    temporaryRoots.push(realParent, linkedParent);
    const root = join(realParent, "project");
    mkdirSync(root);
    const packages = {
      "": {
        dependencies: { diff: "1.0.0", minimatch: "1.0.0", yaml: "1.0.0" },
        devDependencies: { "@types/node": "1.0.0", typescript: "1.0.0" },
      },
      "node_modules/@types/node": { version: "1.0.0" },
      "node_modules/diff": { version: "1.0.0" },
      "node_modules/minimatch": { version: "1.0.0" },
      "node_modules/typescript": { version: "1.0.0" },
      "node_modules/yaml": { version: "1.0.0" },
    } as const;
    for (const [path, descriptor] of Object.entries(packages).slice(1) as
      [string, { readonly version: string }][]) {
      const directory = join(root, ...path.split("/"));
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "package.json"), JSON.stringify({
        name: path.slice("node_modules/".length),
        version: descriptor.version,
      }));
    }
    const alias = join(linkedParent, "alias");
    symlinkSync(realParent, alias, process.platform === "win32" ? "junction" : "dir");
    const lockBytes = Buffer.from(JSON.stringify({
      name: "fixture",
      version: "1.0.0",
      lockfileVersion: 3,
      packages,
    }));

    await expect(digestDependencyClosure(join(alias, "project"), lockBytes))
      .rejects.toThrow(/project root|junction|symlink/iu);
  });

  it("rejects a producer mutation after preflight and removes its artifact", async () => {
    const root = cloneProducer(true);
    const producer = await captureProducer();
    const createArtifact = producer.createProductionArtifact as (
      projectRoot: string,
    ) => Promise<unknown>;
    const oracle = indexOracle(root);
    const source = join(root, "src", "model.ts");
    let mutated = false;
    const timer = setInterval(() => {
      if (!mutated && buildResidue(root).length > 0) {
        writeFileSync(source, Buffer.concat([
          readFileSync(source),
          Buffer.from("\n"),
        ]));
        mutated = true;
      }
    }, 2);
    try {
      await expect(createArtifact(root)).rejects.toThrow(/dirty|changed/i);
    } finally {
      clearInterval(timer);
    }
    expect(mutated).toBe(true);
    expect(buildResidue(root)).toEqual([]);
    expect(indexOracle(root)).toEqual(oracle);
  }, 180_000);

  it("rejects symlinked destination boundaries without writing outside cases root", async () => {
    const boundary = await captureBoundary();
    const publish = boundary.publishCaseExclusive as (
      casesRoot: string,
      ownerDirectory: string,
      filename: string,
      bytes: Buffer,
    ) => Promise<string>;
    const casesRoot = newCasesRoot();
    const ownerOutside = newCasesRoot();
    symlinkSync(
      ownerOutside,
      join(casesRoot, "acme__rules"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await expect(publish(
      casesRoot,
      "acme__rules",
      "aaaaaaaaaaaa..bbbbbbbbbbbb.json",
      Buffer.from("{}\n"),
    )).rejects.toThrow(/symlink|escapes/i);
    expect(readdirSync(ownerOutside)).toEqual([]);
    rmSync(join(casesRoot, "acme__rules"), { force: true });

    const parent = newCasesRoot();
    const rootOutside = newCasesRoot();
    const linkedRoot = join(parent, "linked-cases");
    symlinkSync(
      rootOutside,
      linkedRoot,
      process.platform === "win32" ? "junction" : "dir",
    );
    await expect(publish(
      linkedRoot,
      "acme__rules",
      "aaaaaaaaaaaa..bbbbbbbbbbbb.json",
      Buffer.from("{}\n"),
    )).rejects.toThrow(/symlink|escapes/i);
    expect(readdirSync(rootOutside)).toEqual([]);
    rmSync(linkedRoot, { force: true });
  });
});
