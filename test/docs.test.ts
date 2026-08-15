import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
  "PROOF.md",
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

  it("leads with the exact first command, then verified evidence and install detail", () => {
    expect(readme).toMatch(
      /^<h1 align="center">RuleBlast — Git diff for invisible repository instructions<\/h1>\s/u,
    );
    expectOrdered(readme, [
      "assets/ruleblast-hero.png",
      "actions/workflows/verify.yml/badge.svg",
      "img.shields.io/github/package-json/v/Kpoiut/ruleblast",
      "Git shows the <code>AGENTS.md</code>",
      "assets/ruleblast-causal-proof.gif",
      "npx --yes ruleblast@2.0.2 .",
      "## What Git missed",
      "assets/ruleblast-visual-benchmark.png",
      "codex-rs/tui/src/bottom_pane/action_required_title.rs",
      "PROOF.md",
      "## Install",
      "## Run the verified case",
      "npx --yes ruleblast@2.0.2 case --json",
      "Exact packaged-case terminal transcript",
      "## Explain one path",
      "## Scope",
      "## How it works",
      "## Performance",
      "## Examples",
      "## Open in the editor",
      "## Give your agent RuleBlast",
      "## Show a blast on a pull request",
      "## Contribute a Blast Case",
      "## Roadmap",
    ]);

    const marker = readme.indexOf("invisible repository instructions</h1>");
    for (const metric of ["2", "206", "4,476"]) {
      expect(readme.indexOf(metric)).toBeGreaterThan(marker);
    }
    expect(read("PROOF.md")).toContain("zero partial");
    expect(readme).not.toContain("DEMO FIXTURE");
  });

  it("names the nested AGENTS.md as the changed source and the .rs file as an affected path", () => {
    const proof = read("PROOF.md");
    const pair = `${readme}\n${proof}`;
    expect(pair).not.toMatch(/One (exact )?cause/iu);
    expect(pair).not.toMatch(
      /exact cause[^\n]*action_required_title\.rs/iu,
    );
    expect(readme).toMatch(
      /One affected path:[\s\S]*action_required_title\.rs[\s\S]*inheriting the changed nested[\s\S]*AGENTS\.md/iu,
    );
    expect(proof).toMatch(/Changed instruction source/u);
    expect(proof).toContain(
      "codex-rs/tui/src/bottom_pane/AGENTS.md",
    );
    expect(proof).toMatch(/Example affected path/u);
    expect(proof).toContain(
      "codex-rs/tui/src/bottom_pane/action_required_title.rs",
    );
    expect(proof).toMatch(/evidence link/iu);
    expect(
      readme.slice(
        readme.indexOf("## Real repository"),
        readme.indexOf("## Install"),
      ),
    ).toMatch(/\?/u);
  });

  it("embeds the checked golden verified-case transcript exactly", () => {
    const transcript = /Exact packaged-case terminal transcript<\/strong><\/summary>[\s\S]*?```text\r?\n([\s\S]*?)\r?\n```/u
      .exec(readme)?.[1]?.replace(/\r\n/g, "\n");
    const golden = read("test/golden/diff-case.txt")
      .replace(/\r\n/g, "\n")
      .replace(/\n$/u, "");
    expect(transcript).toBe(golden);
  });

  it("embeds the branding hero in the first fold without packaging it", () => {
    const asset = "assets/ruleblast-hero.png";
    expect(readme.indexOf(asset)).toBeGreaterThan(
      readme.indexOf("invisible repository instructions</h1>"),
    );
    expect(readme.indexOf(asset)).toBeLessThan(
      readme.indexOf("actions/workflows/verify.yml/badge.svg"),
    );
    const bytes = readFileSync(join(repositoryRoot, asset));
    expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(bytes.readUInt32BE(16)).toBe(1_774);
    expect(bytes.readUInt32BE(20)).toBe(887);
    expect(bytes.byteLength).toBe(1_730_674);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "97672cba5a0b740fdcb21f57fa63b0bf2884c1c6e8114247d15ab1db77593564",
    );
    const descriptor = JSON.parse(read("package.json")) as {
      readonly files?: readonly string[];
    };
    expect(descriptor.files).not.toContain(asset);
    expect(existsSync(join(repositoryRoot, "assets/ruleblast-eye.webp"))).toBe(false);
  });

  it("documents one-command, global, local, maintenance, and source installs", () => {
    for (const command of [
      "node --version",
      "npm view ruleblast@2.0.2 version",
      "npx --yes ruleblast@2.0.2",
      "npx --yes ruleblast@2.0.2 --help",
      "cd <your-git-repository>",
      "npm install --global ruleblast@2.0.2",
      "ruleblast --version",
      "ruleblast --help",
      "ruleblast",
      "npm install --save-dev --save-exact ruleblast@2.0.2",
      "npx ruleblast --version",
      "npx ruleblast --help",
      "npm uninstall --global ruleblast",
      "npm uninstall --save-dev ruleblast",
      "npm cache verify",
      "git clone --branch v2.0.2 --depth 1 https://github.com/Kpoiut/ruleblast.git",
      "npm ci --ignore-scripts",
      "npm run build",
      "node dist/cli.js --version",
      "node dist/cli.js --help",
    ]) {
      expect(readme).toContain(command);
    }
    for (const action of [
      "npx --yes ruleblast@2.0.2 .",
      "npx --yes ruleblast@2.0.2 diff HEAD~1",
      "npx --yes ruleblast@2.0.2 explain src/args.ts --from HEAD~1",
      "npx --yes ruleblast@2.0.2 case",
    ]) {
      expect(readme).toContain(action);
    }
    expect(readme).toMatch(/Windows.+Linux/isu);
    expect(readme).not.toMatch(/Windows.+macOS.+Linux/isu);
    expect(readme).toMatch(/npx.+downloads.+runs/isu);
    expect(readme).toMatch(/global.+full CLI/isu);
    expect(readme).toContain("Node.js 20");
    expect(readme).toMatch(/permission/iu);
    expect(readme).toMatch(/cache/iu);
    expect(readme).toContain("NOT_REPOSITORY");
    expect(readme).toContain("REF_NOT_FOUND");
    expect(readme).not.toContain("@latest");
    expect(readme).not.toMatch(/npx (?!--yes )ruleblast@1\.3\.0/gu);
    expect(readme).not.toMatch(/npx (?!--yes )ruleblast@2\.0\.0/gu);
    expect(`${readme}\n${read("CONTRACT.md")}`).not.toMatch(
      /release[- ]candidate|before package and tag publication/iu,
    );
    expect(readme).not.toMatch(/curl[^\r\n]*\|[^\r\n]*(?:sh|bash)/iu);
    expect(readme.slice(0, readme.indexOf("## Install"))).not.toMatch(
      /table of contents|sponsor wall|architecture diagram/iu,
    );
    expect(readme).toContain(
      "npx ruleblast@1.0.0 diff 27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8 --to e420008a1c10c5c328e506247560117f4d40b855 --json",
    );
    expect(readme).not.toMatch(/demo --json\s*>\s*demo\.json/iu);
    expect(readme).not.toContain("Limit the current view to one tracked path");
    expect(readme).toContain("filesystem starting point");
  });

  it("keeps the required roadmap teaser verbatim", () => {
    expect(readme).toContain(`Today: Codex, Claude Code, opt-in Copilot CLI, and opt-in Gemini CLI.

Reality is not host. Four documented realities. Same result in the terminal or editor.

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

  it("records v1.0.2 as the bounded adoption and operability release", () => {
    const roadmap = read("ROADMAP.md");
    expect(roadmap).toContain("`v1.0.2`: Adoption and Operability");
    expect(roadmap).toContain("did not add an action, resolver surface, hosted component, or telemetry");
    expect(roadmap).toContain("public npm and GitHub APIs");
    expect(roadmap).toContain("No star, fork, or download count is a release guarantee");
    expect(roadmap).toContain("2 instruction-line edits");
    expect(roadmap).toContain("206 tracked paths");
    expect(roadmap).toContain("4,476 unchanged paths");
    expect(roadmap).toContain(
      "zero tool-reported partial, unknown, or indeterminate paths for the modeled surfaces",
    );
    expect(roadmap).not.toContain("ruleblast demo [--explain <path>]");
  });
});

describe("cross-platform checkout integrity", () => {
  it("pins canonical text, receipts, and goldens to LF bytes", () => {
    const attributes = read(".gitattributes");
    expect(attributes).toContain("* text=auto eol=lf");
    expect(attributes).toContain("*.webp -text");
    for (const path of [
      "AGENTS.md",
      "CLAUDE.md",
      "README.md",
      "cases/kpoiut__ruleblast/27d52e2cd6ee..e420008a1c10.json",
      "test/golden/diff-blast.txt",
    ]) {
      expect(readFileSync(join(repositoryRoot, path)).includes(13), path).toBe(false);
    }
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
    expect(existsSync(join(repositoryRoot, "docs/superpowers"))).toBe(false);
    expect(existsSync(join(repositoryRoot, "docs/plans"))).toBe(false);
    expect(existsSync(join(repositoryRoot, "docs/v2"))).toBe(false);
    expect(existsSync(join(repositoryRoot, "docs/README.md"))).toBe(false);
    const docsRoot = join(repositoryRoot, "docs");
    expect(existsSync(docsRoot)).toBe(true);
    const top = readdirSync(docsRoot, { withFileTypes: true });
    expect(top.map((entry) => entry.name).sort()).toEqual(["evidence", "measurements"]);
    expect(top.every((entry) => entry.isDirectory())).toBe(true);
    for (const folder of ["evidence", "measurements"] as const) {
      const names = readdirSync(join(docsRoot, folder), { withFileTypes: true });
      expect(names.length).toBeGreaterThan(0);
      expect(names.every((entry) => entry.isFile() && entry.name.endsWith(".md"))).toBe(true);
      expect(names.some((entry) => entry.name === "README.md")).toBe(false);
    }
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
    const extraDocs = existsSync(join(repositoryRoot, "docs"))
      ? readdirSync(join(repositoryRoot, "docs"), { withFileTypes: true }).flatMap((entry) => {
        if (entry.isFile() && entry.name.endsWith(".md")) return [`docs/${entry.name}`];
        if (!entry.isDirectory()) return [];
        return readdirSync(join(repositoryRoot, "docs", entry.name))
          .filter((name) => name.endsWith(".md"))
          .map((name) => `docs/${entry.name}/${name}`);
      })
      : [];
    for (const path of [...publicDocs, ...extraDocs]) {
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
    const gatedEnd = ["## **IN BUILD**", "## **NEXT**"]
      .map((heading) => roadmap.indexOf(heading, shippedStart))
      .filter((index) => index > shippedStart)
      .sort((left, right) => left - right)[0] ?? roadmap.length;
    const shipped = roadmap.slice(shippedStart, gatedEnd);
    expect(shipped).toMatch(/packaged.+verified case/isu);
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
    expect(form.labels).toContain("bug");

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
    expect(form.labels).toContain("enhancement");
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
