import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { analyzeCurrent } from "../src/impact.js";
import { claudeProfile } from "../src/profiles/claude.js";
import { codexProfile } from "../src/profiles/codex.js";
import { ManifestSnapshot } from "../src/snapshot.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path: string): string =>
  readFileSync(join(repositoryRoot, path), "utf8");

const publicDocs = [
  "README.md",
  "CONTRACT.md",
  "ROADMAP.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "AGENTS.md",
  "CLAUDE.md",
] as const;

function firstWords(markdown: string, count: number): string {
  return markdown.split(/\s+/u).filter(Boolean).slice(0, count).join(" ");
}

function expectOrdered(text: string, needles: readonly string[]): void {
  let previous = -1;
  for (const needle of needles) {
    const position = text.indexOf(needle);
    expect(position, `missing ${JSON.stringify(needle)}`).toBeGreaterThan(-1);
    expect(position, `${JSON.stringify(needle)} is out of order`).toBeGreaterThan(
      previous,
    );
    previous = position;
  }
}

function localMarkdownLinks(markdown: string): string[] {
  return [...markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((target) =>
      target !== "" && !target.startsWith("#") &&
      !/^[a-z][a-z0-9+.-]*:/iu.test(target),
    )
    .map((target) => target.split("#", 1)[0] ?? "");
}

interface IssueField {
  readonly id?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly validations?: { readonly required?: boolean };
}

interface IssueForm {
  readonly name?: string;
  readonly description?: string;
  readonly title?: string;
  readonly labels?: readonly string[];
  readonly body?: readonly IssueField[];
}

function issueForm(path: string): IssueForm {
  return parse(read(path)) as IssueForm;
}

describe("README story contract", () => {
  const readme = read("README.md");

  it("names both instruction surfaces and Git in the first 160 words", () => {
    const opening = firstWords(readme, 160);
    for (const term of [
      "RuleBlast",
      "AGENTS.md",
      "CLAUDE.md",
      "Codex",
      "Claude Code",
      "Git",
    ]) {
      expect(opening).toContain(term);
    }
  });

  it("leads with verified evidence, then gives the exact install interface early", () => {
    expect(readme).toMatch(/^# RuleBlast\s/u);
    expectOrdered(readme, [
      "33 instruction-line edits. 106 tracked paths changed stack.",
      "Git shows the first diff. RuleBlast finds the second.",
      "## Install",
      "npx ruleblast@1.0.1",
      "## Terminal transcript",
      "## Explain one path",
      "<details>",
      "## Scope",
      "## How it works",
      "## Examples",
      "## Contribute a Blast Case",
      "## Roadmap",
    ]);

    const marker = readme.indexOf("# RuleBlast");
    for (const metric of ["33", "106", "zero"]) {
      expect(readme.indexOf(metric)).toBeGreaterThan(marker);
    }
    expect(readme).not.toContain("DEMO FIXTURE");
  });

  it("embeds the checked golden verified-case transcript exactly", () => {
    const transcript = /## Terminal transcript[^`]*```text\r?\n([\s\S]*?)\r?\n```/u
      .exec(readme)?.[1]?.replace(/\r\n/g, "\n");
    const golden = read("test/golden/diff-case.txt")
      .replace(/\r\n/g, "\n")
      .replace(/\n$/u, "");
    expect(transcript).toBe(golden);
  });

  it("ships the RuleBlast eye referenced by README", () => {
    const asset = "assets/ruleblast-eye.webp";
    expect(readme).toContain(`![RuleBlast eye](${asset})`);
    const bytes = readFileSync(join(repositoryRoot, asset));
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(bytes.byteLength).toBe(11_052);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "8a95aa9e4f697a258200ddfd2180d728b73d4abcbf778b45e5f223094cfd85ed",
    );
    const descriptor = JSON.parse(read("package.json")) as {
      readonly files?: readonly string[];
    };
    expect(descriptor.files).toContain(asset);
  });

  it("documents one-command, global, local, maintenance, and source installs", () => {
    for (const command of [
      "node --version",
      "npm view ruleblast@1.0.1 version",
      "npx ruleblast@1.0.1",
      "npx ruleblast@1.0.1 --help",
      "cd <your-git-repository>",
      "npm install --global ruleblast@1.0.1",
      "ruleblast --help",
      "ruleblast",
      "npm install --save-dev ruleblast@1.0.1",
      "npx ruleblast --help",
      "npm uninstall --global ruleblast",
      "npm uninstall --save-dev ruleblast",
      "npm cache verify",
      "git clone --branch v1.0.1 --depth 1 https://github.com/Kpoiut/ruleblast.git",
      "npm ci",
      "npm run build",
      "node dist/cli.js --help",
    ]) {
      expect(readme).toContain(command);
    }
    for (const action of [
      "npx ruleblast@1.0.1 .",
      "npx ruleblast@1.0.1 diff HEAD~1",
      "npx ruleblast@1.0.1 explain packages/api/internal/refund.ts --from HEAD~1",
      "npx ruleblast@1.0.1 case",
    ]) {
      expect(readme).toContain(action);
    }
    expect(readme).toMatch(/Windows.+macOS.+Linux/isu);
    expect(readme).toMatch(/npx.+downloads.+runs/isu);
    expect(readme).toMatch(/global.+full CLI/isu);
    expect(readme).toContain("Node.js 20");
    expect(readme).toMatch(/permission/iu);
    expect(readme).toMatch(/cache/iu);
    expect(readme).toContain("NOT_REPOSITORY");
    expect(readme).toContain("REF_NOT_FOUND");
    expect(readme).not.toContain("@latest");
    expect(`${readme}\n${read("CONTRACT.md")}`).not.toMatch(
      /release[- ]candidate|before package and tag publication/iu,
    );
    expect(readme).not.toMatch(/curl[^\r\n]*\|[^\r\n]*(?:sh|bash)/iu);
    expect(readme.slice(0, readme.indexOf("## Install"))).not.toMatch(
      /table of contents|shields\.io|sponsor wall|architecture diagram/iu,
    );
    expect(readme).toContain(
      "npx ruleblast@1.0.0 diff 27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8 --to e420008a1c10c5c328e506247560117f4d40b855 --json",
    );
    expect(readme).not.toMatch(/demo --json\s*>\s*demo\.json/iu);
    expect(readme).not.toContain("Limit the current view to one tracked path");
    expect(readme).toContain("filesystem starting point");
  });

  it("keeps the required roadmap teaser verbatim", () => {
    expect(readme).toContain(`Today: Codex + Claude Code.

The profile seam is already there for the rest.

Two agents share this repo.
How many rule realities are still hiding in it…?`);
  });

  it("describes the completed pilot without inventing a private repository", () => {
    const roadmap = read("ROADMAP.md");
    expect(roadmap).toContain("local-only pilot covered 25 immutable");
    expect(roadmap).toContain("public Apache-2.0 `openai/codex` repository");
    expect(roadmap).toContain("24 useful non-obvious results");
    expect(roadmap).toContain("Earlier roadmap copy called this a “private-repository pilot.”");
    expect(roadmap).not.toMatch(/private repository (was|has been) analyzed/iu);
  });

  it("keeps v1.0.2 as a gated adoption and operability patch", () => {
    const roadmap = read("ROADMAP.md");
    expect(roadmap).toContain("`v1.0.2`: Adoption and Operability");
    expect(roadmap).toContain("does not add an action, resolver surface, hosted component, or telemetry");
    expect(roadmap).toContain("public npm and GitHub APIs");
    expect(roadmap).toContain("No star, fork, or download count is a release guarantee");
  });
});

describe("public contract", () => {
  const contract = read("CONTRACT.md");

  it("defines snapshots, projection context, and uncertainty vocabulary", () => {
    for (const term of [
      "SnapshotRef",
      "git",
      "worktree",
      "fixture",
      "ProjectionContext",
      "cwd",
      "STARTUP",
      "READ_TARGET",
      "targetPath",
      "repositoryOnly",
      "COMPLETE",
      "PARTIAL",
      "UNKNOWN",
      "ORDERED",
      "UNORDERED",
      "UNSPECIFIED",
      "RUNTIME_DECIDED",
      "SELECTED",
      "SELECTED_EMPTY",
      "IMPORTED",
      "APPLIED_RULE",
      "SHADOWED",
      "EXCLUDED",
      "UNRESOLVED_IMPORT",
    ]) {
      expect(contract).toContain(term);
    }
  });

  it("states the implemented scan, worktree, gitlink, and target inventory boundaries", () => {
    expect(contract).toContain("filesystem starting point");
    expect(contract).toContain("does not select or filter one tracked result path");
    expect(contract).toContain("missing path marked skip-worktree");
    expect(contract).toContain("existing tracked regular file or symlink node is copied");
    expect(contract).toContain("index mode `160000`");
    expect(contract).toContain("after/target snapshot inventory");
    expect(contract).not.toContain("Union of Git-tracked blob paths");
  });

  it("defines every current, diff, line, and per-profile metric", () => {
    for (const metric of [
      "candidatePathCount",
      "currentSplitPathCount",
      "partialPathCount",
      "unknownPathCount",
      "indeterminatePathCount",
      "completePathCount",
      "changedStackPathCount",
      "newlySplitPathCount",
      "convergedPathCount",
      "addedLineCount",
      "deletedLineCount",
      "editedLineCount",
      "binaryChangedSourceCount",
    ]) {
      expect(contract).toContain(`\`${metric}\``);
    }
  });

  it("defines relations, transitions, evidence, findings, and canonical JSON", () => {
    for (const term of [
      "SAME",
      "DIFFERENT",
      "INDETERMINATE",
      "changedProfiles",
      "beforePayloadRelation",
      "afterPayloadRelation",
      "causes",
      "changedInstructionSources",
      "groups",
      "findings",
      "canonical JSON",
      "profile evidence boundary",
      "Product claims",
      "Non-claims",
    ]) {
      expect(contract).toContain(term);
    }
  });
});

describe("repository documentation integrity", () => {
  it("keeps superseded design records outside the public repository tree", () => {
    expect(existsSync(join(repositoryRoot, "docs"))).toBe(false);
  });

  it("keeps public claims restrained", () => {
    const body = publicDocs.map(read).join("\n");
    for (const phrase of [
      "actual prompt",
      "agent will obey",
      "guaranteed behavior",
      "AI-ready score",
      "100% accurate",
    ]) {
      expect(body.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
    expect(body).not.toContain("docs/superpowers/plans/");
    expect(body).not.toContain("ruleblast-v1-implementation");
    expect(body).not.toMatch(
      /npm (?:release )?(?:is )?not published|npm release does not exist|pending release command/iu,
    );
  });

  it("resolves every local Markdown link", () => {
    for (const path of publicDocs) {
      const base = dirname(path);
      for (const target of localMarkdownLinks(read(path))) {
        expect(
          existsSync(join(repositoryRoot, base, decodeURIComponent(target))),
          `${path} links to missing ${target}`,
        ).toBe(true);
      }
    }
  });

  it("self-dogfoods one aligned root instruction projection", async () => {
    const agents = read("AGENTS.md");
    const claude = read("CLAUDE.md");
    const snapshot = new ManifestSnapshot({
      schemaVersion: 1,
      label: "repository root instructions",
      entries: [
        ["AGENTS.md", agents],
        ["CLAUDE.md", claude],
        ["x.ts", ""],
      ].map(([path, contents]) => ({
        path,
        kind: "file",
        executable: false,
        base64: Buffer.from(contents ?? "", "utf8").toString("base64"),
      })),
    });
    const result = await analyzeCurrent({
      snapshot,
      profiles: [claudeProfile, codexProfile],
    });
    const target = result.paths.find((path) => path.path === "x.ts");

    expect(read("AGENTS.md")).toContain("CONTRACT.md");
    expect(target?.payloadRelation).toBe("SAME");
    expect(claude).toBe("@AGENTS.md");
  });

  it("keeps the long-horizon roadmap gated and undated", () => {
    const roadmap = read("ROADMAP.md");
    for (const heading of [
      "SHIPPED TO MAIN",
      "IN BUILD",
      "NEXT",
      "HORIZON",
      "EXPLORING",
      "v1.0.0",
      "v1.1.0",
      "v1.2.0",
      "v2.0.0",
      "v2.1.0",
    ]) {
      expect(roadmap).toContain(heading);
    }
    expect(roadmap).toContain("Copilot CLI");
    expect(roadmap).toContain("Copilot VS Code");
    expect(roadmap).toMatch(/CLI, editor, and hosted/iu);
    expect(roadmap).not.toMatch(/^\s*-\s+\[\s\]/gmu);
    expect(roadmap).not.toMatch(/\bQ[1-4]\b|\b20\d{2}-\d{2}-\d{2}\b/gu);

    const shippedStart = roadmap.indexOf("## **SHIPPED TO MAIN**");
    const shipped = roadmap.slice(
      shippedStart,
      roadmap.indexOf("## **IN BUILD**", shippedStart),
    );
    expect(shipped).toMatch(/packaged.+demo/isu);
    expect(roadmap).not.toContain("**Production-pipeline demo**");
  });
});

describe("issue forms", () => {
  const blastCases = [
    "wrong-blast.yml",
    "missing-blast.yml",
    "weird-blast.yml",
  ];

  it.each(blastCases)("keeps %s atomic and reproducible", (name) => {
    const form = issueForm(`.github/ISSUE_TEMPLATE/${name}`);
    expect(form.name).toBeTruthy();
    expect(form.description).toBeTruthy();
    expect(form.title).toMatch(/^\[Blast Case\]/u);
    expect(form.labels).toContain("blast-case");

    const requiredIds = (form.body ?? [])
      .filter((field) => field.validations?.required === true)
      .map((field) => field.id);
    expect(requiredIds).toEqual(expect.arrayContaining([
      "official_source_url",
      "retrieval_date",
      "before_manifest",
      "after_manifest",
      "expected_canonical_json",
      "surprise",
    ]));
    expect((form.body ?? []).some(
      (field) => field.id === "publication_permission",
    )).toBe(true);
    for (const optionalId of ["repository_url", "before_ref", "after_ref"]) {
      const field = (form.body ?? []).find((candidate) =>
        candidate.id === optionalId
      );
      expect(field, `missing ${optionalId}`).toBeTruthy();
      expect(field?.validations?.required).not.toBe(true);
    }
  });

  it("keeps profile evidence scoped to one documented surface", () => {
    const form = issueForm(
      ".github/ISSUE_TEMPLATE/profile-evidence.yml",
    );
    const requiredIds = (form.body ?? [])
      .filter((field) => field.validations?.required === true)
      .map((field) => field.id);
    expect(form.title).toMatch(/^\[Profile evidence\]/u);
    expect(form.labels).toContain("profile-evidence");
    expect(requiredIds).toEqual(expect.arrayContaining([
      "surface_id",
      "official_source_url",
      "retrieval_date",
      "loading_semantics",
      "positive_case",
      "negative_case",
      "ordering_or_unknown",
    ]));
    expect((form.body ?? []).some(
      (field) => field.id === "publication_permission",
    )).toBe(true);
  });
});
