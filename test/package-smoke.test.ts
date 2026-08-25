import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const runFile = promisify(execFile);

describe("packed package smoke", () => {
  it("keeps package-smoke temp roots free of spaces so Windows npm exec can address them", async () => {
    const moduleUrl = new URL("../scripts/package-smoke-runtime.mjs", import.meta.url).href;
    const runtime = await import(moduleUrl) as {
      PACKAGE_SMOKE_TEMP_PREFIX: string;
      createTempRoot(): string;
      cleanupTempRoot(root: string): void;
    };
    expect(runtime.PACKAGE_SMOKE_TEMP_PREFIX).not.toMatch(/\s/u);
    const root = runtime.createTempRoot();
    try {
      expect(root).not.toMatch(/\s/u);
      expect(root.includes(runtime.PACKAGE_SMOKE_TEMP_PREFIX)).toBe(true);
    } finally {
      runtime.cleanupTempRoot(root);
    }
  });

  it("selects a space-free temp parent instead of hanging npm exec on a spaced tmpdir", async () => {
    const moduleUrl = new URL("../scripts/package-smoke-runtime.mjs", import.meta.url).href;
    const runtime = await import(moduleUrl) as {
      packageSmokeTempParent: (candidates?: readonly string[]) => string;
    };
    const root = await mkdtemp(join(tmpdir(), "ruleblast-temp-pick-"));
    const spaced = join(root, "has space");
    const clean = join(root, "clean");
    try {
      await mkdir(spaced);
      await mkdir(clean);
      expect(runtime.packageSmokeTempParent([spaced, clean])).toBe(resolve(clean));
      expect(() => runtime.packageSmokeTempParent([spaced])).toThrow(/space-free/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("materializes runtime packages without source lifecycle scripts", async () => {
    const root = await mkdtemp(join(tmpdir(), "ruleblast-offline-runtime-"));
    try {
      const source = join(root, "source");
      const output = join(root, "output");
      await mkdir(source);
      await mkdir(output);
      const descriptor = {
        name: "fixture-runtime",
        version: "1.2.3",
        scripts: { prepare: "exit 91", postinstall: "exit 92" },
      };
      await writeFile(join(source, "package.json"), JSON.stringify(descriptor));
      await writeFile(join(source, "runtime.js"), "export const value = 42;\n");
      const moduleUrl = new URL("../scripts/package-smoke.mjs", import.meta.url).href;
      const program = [
        `import { materializeOfflineRuntimeDependencies } from ${JSON.stringify(moduleUrl)};`,
        `const result = materializeOfflineRuntimeDependencies([${JSON.stringify(source)}], ${JSON.stringify(output)});`,
        "process.stdout.write(JSON.stringify(result));",
      ].join("\n");
      const { stdout, stderr } = await runFile(
        process.execPath,
        ["--input-type=module", "--eval", program],
        { encoding: "utf8" },
      );
      const [materialized] = JSON.parse(stdout) as string[];

      expect(stderr).toBe("");
      expect(materialized).toBe(join(output, "0"));
      expect(JSON.parse(await readFile(join(materialized!, "package.json"), "utf8")))
        .toEqual({ name: "fixture-runtime", version: "1.2.3" });
      expect(await readFile(join(materialized!, "runtime.js"), "utf8"))
        .toBe("export const value = 42;\n");
      expect(JSON.parse(await readFile(join(source, "package.json"), "utf8")))
        .toEqual(descriptor);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("derives the exact installed runtime dependency closure from the committed lock", async () => {
    const moduleUrl = new URL(
      "../scripts/capture-case-dependencies.mjs",
      import.meta.url,
    ).href;
    const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
    const program = [
      `import { installedRuntimeDependencyDirectories } from ${JSON.stringify(moduleUrl)};`,
      "import { readFile } from 'node:fs/promises';",
      "import { join } from 'node:path';",
      `const root = ${JSON.stringify(repositoryRoot)};`,
      "const lock = await readFile(join(root, 'package-lock.json'));",
      "const directories = await installedRuntimeDependencyDirectories(root, lock);",
      "const names = await Promise.all(directories.map(async (directory) =>",
      "  JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')).name));",
      "process.stdout.write(JSON.stringify(names.sort()));",
    ].join("\n");
    const { stdout, stderr } = await runFile(
      process.execPath,
      ["--input-type=module", "--eval", program],
      { encoding: "utf8" },
    );

    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toEqual([
      "balanced-match",
      "brace-expansion",
      "diff",
      "minimatch",
      "yaml",
    ]);
  });

  it("rejects an absolute path hidden by JSON backslash escaping", async () => {
    const moduleUrl = new URL(
      "../scripts/package-smoke-contract.mjs",
      import.meta.url,
    ).href;
    const program = [
      `import { assertNoPathLeak } from ${JSON.stringify(moduleUrl)};`,
      "const expected = process.platform === 'win32' ? 'D:\\\\TUT123\\\\Secret' : '/tmp/RuleBlast Secret';",
      "const leaked = process.platform === 'win32' ? expected.toLowerCase() : expected;",
      "const output = Buffer.from(JSON.stringify({ nested: [{ path: `prefix:${leaked}:suffix` }] }));",
      "try {",
      "  assertNoPathLeak(new Map([['json', output]]), [expected]);",
      "  process.exitCode = 2;",
      "} catch (error) {",
      "  if (!/leaked an absolute path/.test(String(error))) throw error;",
      "  process.stdout.write('rejected');",
      "}",
    ].join("\n");
    const { stdout, stderr } = await runFile(
      process.execPath,
      ["--input-type=module", "--eval", program],
      { encoding: "utf8" },
    );
    expect(stderr).toBe("");
    expect(stdout).toBe("rejected");
  });

  it("rejects a stale dist artifact instead of blessing current output", async () => {
    const rogue = new URL("../dist/stale-release-artifact.txt", import.meta.url);
    await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
    await writeFile(rogue, "must not ship");
    try {
      const moduleUrl = new URL("../scripts/release-check.mjs", import.meta.url).href;
      const program = [
        `import { expectedPackedFiles, validatePackage } from ${JSON.stringify(moduleUrl)};`,
        "try {",
        "  validatePackage({ tarballBytes: 1, packedFiles: [...expectedPackedFiles(), 'dist/stale-release-artifact.txt'] });",
        "  process.exitCode = 2;",
        "} catch (error) {",
        "  if (!/allowlist mismatch/.test(String(error))) throw error;",
        "  process.stdout.write('rejected');",
        "}",
      ].join("\n");
      const { stdout, stderr } = await runFile(
        process.execPath,
        ["--input-type=module", "--eval", program],
        { encoding: "utf8" },
      );
      expect(stderr).toBe("");
      expect(stdout).toBe("rejected");
    } finally {
      await rm(rogue, { force: true });
    }
  });

  it("forwards the controlled environment to npm descendants", async () => {
    const root = await mkdtemp(join(tmpdir(), "ruleblast-release-env-"));
    try {
      const fakeNpm = join(root, "fake-npm.cjs");
      await writeFile(
        fakeNpm,
        "process.stdout.write(`${process.env.RULEBLAST_ENV_PROBE}:${process.argv.slice(2).join(',')}`);\n",
      );
      const moduleUrl = new URL("../scripts/release-process.mjs", import.meta.url).href;
      const program = [
        `import { runNpm } from ${JSON.stringify(moduleUrl)};`,
        `const env = { ...process.env, npm_execpath: ${JSON.stringify(fakeNpm)}, RULEBLAST_ENV_PROBE: 'controlled' };`,
        `const result = await runNpm(['probe'], ${JSON.stringify(root)}, { env });`,
        "process.stdout.write(result.stdout);",
      ].join("\n");
      const { stdout, stderr } = await runFile(
        process.execPath,
        ["--input-type=module", "--eval", program],
        { encoding: "utf8", env: { ...process.env, npm_execpath: "" } },
      );
      expect(stderr).toBe("");
      expect(stdout).toBe("controlled:probe");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("installs the tarball and leaves its Git fixture byte-for-byte unchanged", async () => {
    const { stdout, stderr } = await runFile(
      process.execPath,
      ["scripts/package-smoke.mjs", "--json-report"],
      {
        cwd: new URL("..", import.meta.url),
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toMatchObject({
      ok: true,
      fixtureUnchanged: true,
      fsmonitorUntouched: true,
      helpVerified: true,
      jsonDeterministic: true,
      metadataVerified: true,
      version: "ruleblast 2.5.11",
    });
  }, 120_000);
});
