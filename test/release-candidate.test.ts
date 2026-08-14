import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  existsSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const runFile = promisify(execFile);
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const temporaryRoots: string[] = [];
const lifecycleScripts = [
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
] as const;

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function digest(algorithm: "sha256" | "sha512", bytes: Buffer): string {
  return createHash(algorithm).update(bytes).digest("hex");
}

function createIsolatedRepository(): string {
  const root = mkdtempSync(join(tmpdir(), "ruleblast release test "));
  temporaryRoots.push(root);
  for (const name of [
    "assets",
    "cases",
    "scripts",
    "src",
    "test",
    "CONTRACT.md",
    "LICENSE",
    "AGENT_USAGE.md",
    "README.md",
    "EXTRACTION_REVIEWS.json",
    "package-lock.json",
    "package.json",
    "tsconfig.build.json",
    "tsconfig.json",
  ]) {
    cpSync(join(repositoryRoot, name), join(root, name), { recursive: true });
  }
  symlinkSync(
    join(repositoryRoot, "node_modules"),
    join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  return root;
}

async function buildArtifact(root: string): Promise<void> {
  const emptyCache = mkdtempSync(join(tmpdir(), "ruleblast release empty cache "));
  temporaryRoots.push(emptyCache);
  const moduleUrl = new URL("../scripts/release-artifact.mjs", import.meta.url).href;
  const program = [
    `import { buildReleaseArtifact } from ${JSON.stringify(moduleUrl)};`,
    `await buildReleaseArtifact({ dependencyRoot: ${JSON.stringify(repositoryRoot)}, repositoryRoot: ${JSON.stringify(root)} });`,
  ].join("\n");
  await runFile(process.execPath, ["--input-type=module", "--eval", program], {
    cwd: root,
    env: { ...process.env, npm_config_cache: emptyCache },
    maxBuffer: 20 * 1024 * 1024,
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

describe("1.6.1 package identity", () => {
  it("pins release metadata without install lifecycle behavior", () => {
    const descriptor = readJson(join(repositoryRoot, "package.json"));
    const lock = readJson(join(repositoryRoot, "package-lock.json"));
    const packages = lock.packages as Record<string, Record<string, unknown>>;

    expect(descriptor).toMatchObject({
      name: "ruleblast",
      version: "1.6.1",
      description:
        "Git diff for invisible repository instructions. See which tracked paths inherit an AGENTS.md or CLAUDE.md edit—and whether pinned Codex, Claude Code, Copilot CLI, and Gemini CLI projections already differ.",
      repository: {
        type: "git",
        url: "git+https://github.com/Kpoiut/ruleblast.git",
      },
      homepage: "https://github.com/Kpoiut/ruleblast#readme",
      bugs: { url: "https://github.com/Kpoiut/ruleblast/issues" },
      engines: { node: ">=20" },
      keywords: [
        "agents.md",
        "claude.md",
        "gemini.md",
        "codex",
        "claude-code",
        "gemini-cli",
        "ai-coding-agents",
        "coding-agents",
        "repository-instructions",
        "repository-rules",
        "instruction-scope",
        "blast-radius",
        "git",
        "cli",
        "developer-tools",
      ],
    });
    expect(lock.version).toBe("1.6.1");
    expect(packages[""]?.version).toBe("1.6.1");
    expect(Object.keys(descriptor.dependencies as object).sort()).toEqual([
      "diff",
      "minimatch",
      "yaml",
    ]);
    for (const script of lifecycleScripts) {
      expect((descriptor.scripts as Record<string, string>)[script]).toBeUndefined();
    }
  });
});

describe("release artifact", () => {
  it("packs once, verifies that exact tarball, and records canonical digests and inventory", async () => {
    const isolatedRoot = createIsolatedRepository();
    const isolatedRelease = join(isolatedRoot, "artifacts", "release");
    const isolatedManifest = join(isolatedRelease, "manifest.json");
    expect(existsSync(join(isolatedRoot, "dist"))).toBe(false);
    await buildArtifact(isolatedRoot);

    const manifestBytes = readFileSync(isolatedManifest);
    expect(manifestBytes.at(-1)).toBe(0x0a);
    expect(manifestBytes.subarray(0, -1).includes(0x0a)).toBe(false);
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as {
      readonly package: { readonly name: string; readonly version: string };
      readonly schemaVersion: number;
      readonly tarball: {
        readonly bytes: number;
        readonly file: string;
        readonly inventory: readonly { readonly bytes: number; readonly path: string }[];
        readonly sha256: string;
        readonly sha512: string;
        readonly unpackedBytes: number;
      };
    };
    const tarballPath = join(isolatedRelease, manifest.tarball.file);
    const tarballBytes = readFileSync(tarballPath);
    expect(manifest.package).toEqual({ name: "ruleblast", version: "1.6.1" });
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.tarball.bytes).toBe(statSync(tarballPath).size);
    expect(manifest.tarball.bytes).toBeLessThanOrEqual(1024 * 1024);
    expect(manifest.tarball.sha256).toBe(digest("sha256", tarballBytes));
    expect(manifest.tarball.sha512).toBe(digest("sha512", tarballBytes));
    expect(manifest.tarball.inventory.map((entry) => entry.path)).toEqual(
      JSON.parse(
        (await runFile(
          process.execPath,
          [
            "--input-type=module",
            "--eval",
            [
              "import { readFileSync } from 'node:fs';",
              "import { gunzipSync } from 'node:zlib';",
              `const bytes = gunzipSync(readFileSync(${JSON.stringify(tarballPath)}));`,
              "const paths = [];",
              "for (let offset = 0; offset + 512 <= bytes.length;) {",
              "  const header = bytes.subarray(offset, offset + 512);",
              "  if (header.every((byte) => byte === 0)) break;",
              "  const text = (start, length) => header.subarray(start, start + length).toString('utf8').replace(/\\0.*$/s, '');",
              "  const size = Number.parseInt(text(124, 12).trim() || '0', 8);",
              "  const name = `${text(345, 155)}${text(345, 155) ? '/' : ''}${text(0, 100)}`;",
              "  if (header[156] === 48 || header[156] === 0) paths.push(name.replace(/^package\\//, ''));",
              "  offset += 512 + Math.ceil(size / 512) * 512;",
              "}",
              "process.stdout.write(JSON.stringify(paths.sort()));",
            ].join("\n"),
          ],
          { cwd: repositoryRoot, encoding: "utf8" },
        )).stdout,
      ),
    );
    expect(manifest.tarball.inventory).toEqual(
      [...manifest.tarball.inventory].sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0
      ),
    );
    expect(manifest.tarball.inventory).toContainEqual({
      path: "package.json",
      bytes: readFileSync(join(isolatedRoot, "package.json")).byteLength,
    });
    expect(manifest.tarball.unpackedBytes).toBe(
      manifest.tarball.inventory.reduce((sum, entry) => sum + entry.bytes, 0),
    );
    expect(readdirSync(isolatedRelease).sort()).toEqual([
      "manifest.json",
      "ruleblast-1.6.1.tgz",
    ]);

    const before = new Map(readdirSync(isolatedRelease).map((name) => [
      name,
      readFileSync(join(isolatedRelease, name)),
    ]));
    await expect(buildArtifact(isolatedRoot)).rejects.toMatchObject({
      stderr: expect.stringMatching(/refusing to overwrite/iu),
    });
    for (const [name, bytes] of before) {
      expect(readFileSync(join(isolatedRelease, name))).toEqual(bytes);
    }
  }, 120_000);

  it("confines cleanup to the owned release directory", async () => {
    const isolatedRoot = createIsolatedRepository();
    const isolatedArtifactRoot = join(isolatedRoot, "artifacts");
    const isolatedRelease = join(isolatedArtifactRoot, "release");
    mkdirSync(isolatedRelease, { recursive: true });
    const outside = join(isolatedArtifactRoot, "keep.txt");
    writeFileSync(join(isolatedRelease, "partial.tgz"), "partial");
    writeFileSync(outside, "keep");
    const moduleUrl = new URL("../scripts/release-artifact.mjs", import.meta.url).href;
    const program = [
      `import { cleanupOwnedReleaseDirectory } from ${JSON.stringify(moduleUrl)};`,
      `cleanupOwnedReleaseDirectory(${JSON.stringify(isolatedRoot)}, ${JSON.stringify(isolatedRelease)});`,
    ].join("\n");
    await runFile(process.execPath, ["--input-type=module", "--eval", program], {
      cwd: isolatedRoot,
    });
    expect(existsSync(isolatedRelease)).toBe(false);
    expect(readFileSync(outside, "utf8")).toBe("keep");
    rmSync(outside);

    const escaped = dirname(isolatedArtifactRoot);
    const escapeProgram = [
      `import { cleanupOwnedReleaseDirectory } from ${JSON.stringify(moduleUrl)};`,
      `try { cleanupOwnedReleaseDirectory(${JSON.stringify(isolatedRoot)}, ${JSON.stringify(escaped)}); }`,
      "catch (error) { if (!/outside artifacts\\/release/iu.test(String(error))) throw error; process.stdout.write('rejected'); }",
    ].join("\n");
    const { stdout } = await runFile(
      process.execPath,
      ["--input-type=module", "--eval", escapeProgram],
      { cwd: isolatedRoot, encoding: "utf8" },
    );
    expect(stdout).toBe("rejected");
  });

  it("refuses cleanup through a symlinked artifact ancestor", async () => {
    const isolatedRoot = createIsolatedRepository();
    const outside = mkdtempSync(join(tmpdir(), "ruleblast release outside "));
    temporaryRoots.push(outside);
    const outsideRelease = join(outside, "release");
    mkdirSync(outsideRelease);
    const marker = join(outsideRelease, "keep.txt");
    writeFileSync(marker, "keep");
    symlinkSync(
      outside,
      join(isolatedRoot, "artifacts"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const moduleUrl = new URL("../scripts/release-artifact.mjs", import.meta.url).href;
    const program = [
      `import { cleanupOwnedReleaseDirectory } from ${JSON.stringify(moduleUrl)};`,
      `cleanupOwnedReleaseDirectory(${JSON.stringify(isolatedRoot)}, ${JSON.stringify(join(isolatedRoot, "artifacts", "release"))});`,
    ].join("\n");
    await expect(runFile(
      process.execPath,
      ["--input-type=module", "--eval", program],
      { cwd: isolatedRoot },
    )).rejects.toMatchObject({ stderr: expect.stringMatching(/real directory|junction|symlink/iu) });
    expect(readFileSync(marker, "utf8")).toBe("keep");
  });

  it("re-verifies durable tarball bytes after the smoke boundary", async () => {
    const isolatedRoot = createIsolatedRepository();
    const smokeModuleUrl = new URL("../scripts/package-smoke.mjs", import.meta.url).href;
    const original = readFileSync(new URL("../scripts/release-artifact.mjs", import.meta.url), "utf8");
    const isolatedScript = join(isolatedRoot, "scripts", "release-artifact.mjs");
    const tamperingImport = `import { appendFileSync } from "node:fs";\nimport { runPackedPackageSmoke as realSmoke } from ${JSON.stringify(smokeModuleUrl)};\nconst runPackedPackageSmoke = async (packed, options) => { const value = await realSmoke(packed, options); appendFileSync(packed.tarball, "changed"); return value; };`;
    const mutated = original.replace(
      'import { runPackedPackageSmoke } from "./package-smoke.mjs";',
      tamperingImport,
    );
    writeFileSync(isolatedScript, mutated);
    const moduleUrl = new URL(`file:///${isolatedScript.replaceAll("\\", "/")}`).href;
    const program = [
      `import { buildReleaseArtifact } from ${JSON.stringify(moduleUrl)};`,
      `await buildReleaseArtifact({ dependencyRoot: ${JSON.stringify(repositoryRoot)}, repositoryRoot: ${JSON.stringify(isolatedRoot)} });`,
    ].join("\n");
    await expect(runFile(
      process.execPath,
      ["--input-type=module", "--eval", program],
      { cwd: isolatedRoot, maxBuffer: 20 * 1024 * 1024 },
    )).rejects.toMatchObject({ stderr: expect.stringMatching(/digest|size|changed/iu) });
    expect(existsSync(join(isolatedRoot, "artifacts", "release"))).toBe(false);
  }, 120_000);

  it("rejects closed-schema and tar-inventory manifest tampering", async () => {
    const isolatedRoot = createIsolatedRepository();
    const isolatedRelease = join(isolatedRoot, "artifacts", "release");
    const isolatedManifest = join(isolatedRelease, "manifest.json");
    await buildArtifact(isolatedRoot);
    const moduleUrl = new URL("../scripts/release-artifact.mjs", import.meta.url).href;
    const verify = async (): Promise<void> => {
      const program = [
        `import { verifyReleaseArtifact } from ${JSON.stringify(moduleUrl)};`,
        `verifyReleaseArtifact(${JSON.stringify(isolatedRoot)}, ${JSON.stringify(isolatedRelease)});`,
      ].join("\n");
      await runFile(process.execPath, ["--input-type=module", "--eval", program], {
        cwd: isolatedRoot,
      });
    };

    const original = readFileSync(isolatedManifest);
    const withUnknown = JSON.parse(original.toString("utf8")) as Record<string, unknown>;
    withUnknown.unknown = true;
    writeFileSync(isolatedManifest, `${JSON.stringify(withUnknown)}\n`);
    await expect(verify()).rejects.toMatchObject({
      stderr: expect.stringMatching(/unknown|fields|schema/iu),
    });

    const withInventoryLie = JSON.parse(original.toString("utf8")) as {
      tarball: { inventory: { bytes: number; path: string }[] };
    };
    const first = withInventoryLie.tarball.inventory[0];
    const second = withInventoryLie.tarball.inventory[1];
    if (first === undefined || second === undefined) throw new Error("fixture inventory too small");
    first.bytes += 1;
    second.bytes -= 1;
    writeFileSync(isolatedManifest, `${JSON.stringify(withInventoryLie)}\n`);
    await expect(verify()).rejects.toMatchObject({
      stderr: expect.stringMatching(/inventory|tarball/iu),
    });
  }, 120_000);

  it("rejects a release tarball symlink that escapes its directory", async () => {
    const isolatedRoot = createIsolatedRepository();
    const isolatedRelease = join(isolatedRoot, "artifacts", "release");
    await buildArtifact(isolatedRoot);
    const manifest = readJson(join(isolatedRelease, "manifest.json")) as {
      tarball: { file: string };
    };
    const tarball = join(isolatedRelease, manifest.tarball.file);
    const outside = join(isolatedRoot, "outside.tgz");
    cpSync(tarball, outside);
    rmSync(tarball);
    symlinkSync(outside, tarball, "file");
    const moduleUrl = new URL("../scripts/release-artifact.mjs", import.meta.url).href;
    const program = [
      `import { verifyReleaseArtifact } from ${JSON.stringify(moduleUrl)};`,
      `verifyReleaseArtifact(${JSON.stringify(isolatedRoot)}, ${JSON.stringify(isolatedRelease)});`,
    ].join("\n");
    await expect(runFile(
      process.execPath,
      ["--input-type=module", "--eval", program],
      { cwd: isolatedRoot },
    )).rejects.toMatchObject({ stderr: expect.stringMatching(/regular file|contained|symlink/iu) });
  }, 120_000);

  it("never removes an existing release artifact outside its selected repository", async () => {
    const selected = createIsolatedRepository();
    const protectedRoot = mkdtempSync(join(tmpdir(), "ruleblast approved artifact "));
    temporaryRoots.push(protectedRoot);
    const protectedRelease = join(protectedRoot, "artifacts", "release");
    mkdirSync(protectedRelease, { recursive: true });
    const sentinel = join(protectedRelease, "approved.tgz");
    writeFileSync(sentinel, "approved");
    await buildArtifact(selected);
    expect(readFileSync(sentinel, "utf8")).toBe("approved");
  }, 120_000);
});
