import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical.js";
import { runCli, type CliIo } from "../src/cli.js";
import { createDemoSnapshots, openDemo } from "../src/demo.js";
import { analyzeDiff } from "../src/impact.js";
import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
} from "../src/model.js";
import { claudeProfile } from "../src/profiles/claude.js";
import { codexProfile } from "../src/profiles/codex.js";

const TARGET = "packages/api/internal/refund.ts";
const profiles = Object.freeze([claudeProfile, codexProfile]);

function capturedIo(): {
  readonly io: CliIo;
  readonly stdout: string[];
  readonly stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    io: {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
      cwd: () => process.cwd(),
      env: {},
      stdoutIsTTY: false,
    },
    stdout,
    stderr,
  };
}

async function analyzeDemo() {
  const pair = await openDemo();
  return analyzeDiff({ before: pair.before, after: pair.after, profiles });
}

describe("deterministic demo", () => {
  it("expands the compact recipe through the production impact pipeline", async () => {
    const first = await analyzeDemo();
    const second = await analyzeDemo();

    expect(first.counts).toMatchObject({
      candidatePathCount: 3906,
      changedStackPathCount: 1842,
      newlySplitPathCount: 1229,
      currentSplitPathCount: 1229,
      convergedPathCount: 0,
      partialPathCount: 0,
      unknownPathCount: 0,
      indeterminatePathCount: 0,
    });
    expect(first.diffStats).toEqual({
      addedLineCount: 7,
      deletedLineCount: 2,
      editedLineCount: 9,
      binaryChangedSourceCount: 0,
    });
    expect(Object.fromEntries(first.counts.byProfile.map((profile) => [
      profile.profile,
      {
        complete: profile.completePathCount,
        changed: profile.changedStackPathCount,
        partial: profile.partialPathCount,
        unknown: profile.unknownPathCount,
      },
    ]))).toEqual({
      [ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID]: {
        complete: 3906,
        changed: 613,
        partial: 0,
        unknown: 0,
      },
      [OPENAI_CODEX_CLI_PROFILE_ID]: {
        complete: 3906,
        changed: 1842,
        partial: 0,
        unknown: 0,
      },
    });
    expect(first.changedInstructionSources.map((change) => change.afterPath))
      .toEqual([
        "packages/api/internal/AGENTS.md",
        "packages/shared/AGENTS.md",
        "packages/shared/CLAUDE.md",
      ]);
    expect(first.paths.find((path) => path.path === TARGET)).toMatchObject({
      changedProfiles: [OPENAI_CODEX_CLI_PROFILE_ID],
      beforePayloadRelation: "SAME",
      afterPayloadRelation: "DIFFERENT",
      wasSplit: false,
      isSplit: true,
      causes: ["packages/api/internal/AGENTS.md"],
    });
    expect(canonicalJson(first)).toBe(canonicalJson(second));
  });

  it("marks the fixture before its first number and explains real source chains", async () => {
    const demo = capturedIo();
    expect(await runCli(["demo"], demo.io)).toBe(0);
    expect(demo.stderr).toEqual([]);
    const text = demo.stdout.join("");
    expect(text.indexOf("DEMO FIXTURE")).toBeLessThan(text.search(/\d/));
    expect(text).toContain("9 instruction-line edits.");
    expect(text).toContain("1,842\ntracked paths changed stack.");
    expect(text).toContain("1,229 paths now live in two AI realities.");
    expect(text).toContain("Scope: 3,906 tracked paths");

    const explain = capturedIo();
    expect(await runCli(["demo", "--explain", TARGET], explain.io)).toBe(0);
    expect(explain.stderr).toEqual([]);
    const detail = explain.stdout.join("");
    expect(detail).toContain("RULEBLAST EXPLAIN · DEMO FIXTURE");
    expect(detail).toMatch(
      /CLAUDE CODE[\s\S]*?BEFORE[\s\S]*?Sources:\n    \(none\)[\s\S]*?AFTER[\s\S]*?Sources:\n    \(none\)/,
    );
    expect(detail).toMatch(
      /CODEX[\s\S]*?BEFORE[\s\S]*?\[SELECTED_EMPTY\] packages\/api\/internal\/AGENTS\.md[\s\S]*?AFTER[\s\S]*?\[SELECTED\] packages\/api\/internal\/AGENTS\.md/,
    );
    expect(detail).toContain("= changed profiles: openai/codex-cli@1");
    expect(detail).toContain("= profile relation: SAME → DIFFERENT");
    expect(detail).toContain("= newly split: yes");

  });

  it("emits byte-identical JSON through the default CLI", async () => {
    const first = capturedIo();
    const second = capturedIo();
    expect(await runCli(["demo", "--json"], first.io)).toBe(0);
    expect(await runCli(["demo", "--json"], second.io)).toBe(0);
    expect(first.stdout).toEqual(second.stdout);
    expect(first.stderr).toEqual([]);
    expect(JSON.parse(first.stdout.join(""))).toMatchObject({ mode: "diff" });
  });

  it("captures a closed recipe without retaining mutable input", async () => {
    const recipe = JSON.parse(readFileSync(
      new URL("../fixtures/demo/case.json", import.meta.url),
      "utf8",
    )) as {
      pathGroups: Array<{ count: number }>;
      files: Array<{ after: string }>;
    };
    const pair = createDemoSnapshots(recipe);
    recipe.pathGroups[0]!.count = 0;
    recipe.files[0]!.after = "mutated";
    expect((await pair.after.listPaths()).length).toBe(3906);

    let getterCalls = 0;
    const hostile = Object.defineProperty({}, "schemaVersion", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 1;
      },
    });
    expect(() => createDemoSnapshots(hostile)).toThrow(TypeError);
    expect(getterCalls).toBe(0);
    expect(() => createDemoSnapshots({
      ...JSON.parse(readFileSync(
        new URL("../fixtures/demo/case.json", import.meta.url),
        "utf8",
      )),
      extra: true,
    })).toThrow(TypeError);

    const collision = JSON.parse(readFileSync(
      new URL("../fixtures/demo/case.json", import.meta.url),
      "utf8",
    )) as { files: Array<{ path: string }> };
    collision.files[0]!.path = "packages/shared/zz-shared-0001.ts";
    expect(() => createDemoSnapshots(collision)).toThrow(
      /Duplicate snapshot path/,
    );
  });

  it("keeps fixture metrics out of the general-purpose text renderer", () => {
    const renderer = [
      "render-context.ts",
      "render-explain.ts",
      "render-format.ts",
      "render-text.ts",
    ].map((file) => readFileSync(
      new URL(`../src/${file}`, import.meta.url),
      "utf8",
    )).join("\n");
    expect(renderer).not.toMatch(
      /\b(?:3,906|1,842|1,229|3906|1842|1229|613)\b/,
    );
  });
});
