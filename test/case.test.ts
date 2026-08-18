import { readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../src/canonical.js";
import { openPackagedCase } from "../src/case.js";
import { runCli, type CliIo } from "../src/cli.js";

const RECEIPT_PATH = resolve(
  import.meta.dirname,
  "..",
  "cases",
  "kpoiut__ruleblast",
  "27d52e2cd6ee..e420008a1c10.json",
);
const RECEIPT_SHA256 =
  "5735038d47cae7b538e113d51214dbbc6ecd29cbca815912813abaa900ecfc89";
const EXPLAIN_PATH = ".github/ISSUE_TEMPLATE/missing-blast.yml";

function capturedIo() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: CliIo = {
    stdout: (text) => { stdout.push(text); },
    stderr: (text) => { stderr.push(text); },
    cwd: () => join(tmpdir(), "ruleblast-case-outside-git"),
    env: {},
    stdoutIsTTY: false,
    stderrIsTTY: false,
  };
  return { io, stdout, stderr };
}

describe("packaged verified case", () => {
  it("loads the immutable receipt result directly without changing its bytes", async () => {
    const before = readFileSync(RECEIPT_PATH);
    const beforeMtime = statSync(RECEIPT_PATH, { bigint: true }).mtimeNs;
    const receipt = JSON.parse(before.toString("utf8")) as {
      readonly base: string;
      readonly head: string;
      readonly resolverRevision: number;
      readonly coreDigest: string;
      readonly resultCore: { readonly resolverRevision: number };
    };

    expect(sha256(before)).toBe(RECEIPT_SHA256);
    expect(before.at(-1)).toBe(0x0a);
    expect(before.subarray(0, -1).includes(0x0a)).toBe(false);
    expect(before.toString("utf8")).toBe(`${canonicalJson(receipt)}\n`);
    expect(receipt).toMatchObject({
      base: "27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8",
      head: "e420008a1c10c5c328e506247560117f4d40b855",
      resolverRevision: 1,
      coreDigest:
        "1e907a88ed648ebbd68b4f588c3bd09058ab7714e8f85a3f2d4a1c60e5a40938",
    });
    expect(receipt.resultCore.resolverRevision).toBe(receipt.resolverRevision);
    expect(sha256(canonicalJson(receipt.resultCore))).toBe(receipt.coreDigest);
    expect(await openPackagedCase()).toEqual(receipt.resultCore);
    expect(readFileSync(RECEIPT_PATH)).toEqual(before);
    expect(statSync(RECEIPT_PATH, { bigint: true }).mtimeNs).toBe(beforeMtime);
  });

  it("keeps the hidden demo alias byte-identical to the four-action case surface", async () => {
    const receipt = JSON.parse(readFileSync(RECEIPT_PATH, "utf8")) as {
      readonly resultCore: unknown;
    };
    const expected = `${canonicalJson(receipt.resultCore)}\n`;
    const current = capturedIo();
    const legacy = capturedIo();

    expect(await runCli(["case", "--json"], current.io)).toBe(0);
    expect(await runCli(["demo", "--json"], legacy.io)).toBe(0);
    expect(current.stderr).toEqual([]);
    expect(legacy.stderr).toEqual([]);
    expect(current.stdout).toEqual([expected]);
    expect(legacy.stdout).toEqual(current.stdout);
  });

  it("presents a real repository case and drills into its recorded source chain", async () => {
    const overview = capturedIo();
    const detail = capturedIo();

    expect(await runCli(["case", "--color=never"], overview.io)).toBe(0);
    expect(overview.stdout.join("")).toContain(
      "RULEBLAST · VERIFIED CASE · kpoiut/ruleblast · 27d52e2cd6ee → e420008a1c10",
    );
    expect(overview.stdout.join("")).toContain(
      `ruleblast case --explain ${EXPLAIN_PATH}`,
    );
    expect(overview.stdout.join("")).not.toContain("DEMO FIXTURE");

    expect(await runCli([
      "case", "--explain", EXPLAIN_PATH, "--json",
    ], detail.io)).toBe(0);
    expect(JSON.parse(detail.stdout.join(""))).toMatchObject({
      mode: "explain",
      analysisMode: "diff",
      path: { path: EXPLAIN_PATH },
    });

    const textDetail = capturedIo();
    expect(await runCli([
      "case", "--explain", EXPLAIN_PATH, "--color=never",
    ], textDetail.io)).toBe(0);
    expect(textDetail.stdout.join("")).toContain(
      "RULEBLAST EXPLAIN · VERIFIED CASE · kpoiut/ruleblast · 27d52e2cd6ee → e420008a1c10",
    );
  });

  it("advertises exactly four semantic actions and keeps the legacy alias hidden", async () => {
    const help = capturedIo();
    expect(await runCli(["--help"], help.io)).toBe(0);
    const text = help.stdout.join("");
    expect(text).toContain("ruleblast [path]");
    expect(text).toContain("ruleblast diff");
    expect(text).toContain("ruleblast explain");
    expect(text).toContain("ruleblast case");
    expect(text).not.toContain("ruleblast demo");
  });
});
