import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const runFile = promisify(execFile);

describe("packed package smoke", () => {
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
      jsonDeterministic: true,
    });
  }, 120_000);
});
