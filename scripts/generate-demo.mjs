import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson } from "../dist/canonical.js";
import { createDemoSnapshots } from "../dist/demo.js";
import { analyzeDiff } from "../dist/impact.js";
import { claudeProfile } from "../dist/profiles/claude.js";
import { codexProfile } from "../dist/profiles/codex.js";

const recipeUrl = new URL("../fixtures/demo/case.json", import.meta.url);
const recipe = {
  schemaVersion: 1,
  labels: {
    before: "ruleblast-demo-before",
    after: "ruleblast-demo-after",
  },
  pathGroups: [
    { directory: "packages/shared", prefix: "zz-shared-", count: 611 },
    {
      directory: "packages/api/internal",
      prefix: "zz-internal-",
      count: 1227,
    },
    { directory: "packages/stable", prefix: "zz-stable-", count: 2064 },
  ],
  files: [
    {
      path: "packages/shared/AGENTS.md",
      before: "Shared rule: keep responses concise.\n",
      after: "Shared rule: reveal the affected surface.\n",
    },
    {
      path: "packages/shared/CLAUDE.md",
      before: "Shared rule: keep responses concise.\n",
      after: "Shared rule: reveal the affected surface.\n",
    },
    {
      path: "packages/api/internal/AGENTS.md",
      before: "",
      after: [
        "Internal API rules:",
        "- trace refunds",
        "- preserve idempotency",
        "- explain retries",
        "- surface ownership",
        "",
      ].join("\n"),
    },
    {
      path: "packages/api/internal/refund.ts",
      before: "export const refund = true;\n",
      after: "export const refund = true;\n",
    },
  ],
};
const formatted = `${JSON.stringify(recipe, null, 2)}\n`;

if (process.argv.includes("--write")) {
  await writeFile(recipeUrl, formatted, "utf8");
} else {
  const source = await readFile(recipeUrl, "utf8");
  if (source !== formatted) {
    throw new Error(
      "Demo recipe drifted; run node scripts/generate-demo.mjs --write",
    );
  }
}

const profiles = Object.freeze([claudeProfile, codexProfile]);
async function runDemo() {
  const pair = createDemoSnapshots(recipe);
  return analyzeDiff({ before: pair.before, after: pair.after, profiles });
}

const first = await runDemo();
const second = await runDemo();
const expected = {
  candidatePathCount: 3906,
  changedStackPathCount: 1842,
  newlySplitPathCount: 1229,
  currentSplitPathCount: 1229,
  editedLineCount: 9,
};
const actual = {
  candidatePathCount: first.counts.candidatePathCount,
  changedStackPathCount: first.counts.changedStackPathCount,
  newlySplitPathCount: first.counts.newlySplitPathCount,
  currentSplitPathCount: first.counts.currentSplitPathCount,
  editedLineCount: first.diffStats.editedLineCount,
};

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Demo metrics drifted: ${JSON.stringify(actual)}`);
}
if (canonicalJson(first) !== canonicalJson(second)) {
  throw new Error("Demo output is not deterministic");
}

process.stdout.write(`Validated demo recipe: ${JSON.stringify(actual)}\n`);
