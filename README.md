<h1 align="center">RuleBlast — Git diff for invisible repository instructions</h1>

<p align="center">
  <img src="assets/ruleblast-hero.png?v=2.0.1" alt="RuleBlast — See the second diff. Local, read-only, evidence-first" width="100%">
</p>

<p align="center">
  <a href="https://github.com/Kpoiut/ruleblast/actions/workflows/verify.yml"><img src="https://github.com/Kpoiut/ruleblast/actions/workflows/verify.yml/badge.svg" alt="Verify workflow status"></a>
  <a href="https://github.com/Kpoiut/ruleblast/releases/tag/v2.0.1"><img src="https://img.shields.io/github/package-json/v/Kpoiut/ruleblast" alt="package version 2.0.1"></a>
  <img src="https://img.shields.io/node/v/ruleblast" alt="supported Node.js versions">
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/ruleblast" alt="Apache-2.0 license"></a>
</p>

<p align="center">
  Git shows the <code>AGENTS.md</code> and <code>CLAUDE.md</code> edit. RuleBlast shows where that change lands.
</p>

<p align="center">
  You changed 2 instruction lines.<br>
  Git sees 2 lines. RuleBlast finds 206 Codex stacks that inherited them.<br>
  <strong>Codex: 206 · Claude Code: 0</strong><br>
  Why did only one agent inherit that nested <code>AGENTS.md</code>?
</p>

<div align="center">
  <img src="assets/ruleblast-causal-proof.gif?v=2.0.1" alt="Terminal demo: git sees 3 files and 6 deletions; ruleblast diff shows Codex 206 paths and Claude Code 0; explain names nested AGENTS.md" width="100%">
</div>

```bash
cd <your-git-repository>
npx --yes ruleblast@2.0.1 .
npx --yes ruleblast@2.0.1 diff HEAD~1
```

<p align="center"><sub>Local · read-only · deterministic · no network or model call</sub></p>

## What Git missed

<div align="center">
  <img src="assets/ruleblast-visual-benchmark.png?v=2.0.1" alt="Square RuleBlast 2.0.1 scoreboard: Git saw 2 instruction lines; Codex 206, Claude Code 0; why-this-path, CLI and IDE surfaces, user allow gate" width="100%">
</div>

Git shows the instruction edit. It does not show every repository path that inherits it.

## Real repository. Reproducible result.

Not a synthetic fixture. Public [`openai/codex`](https://github.com/openai/codex/compare/8fcf2ad931b90589dd29a571f367e3185d26bbe0...f0f483e8b2a2630bf8dfa5f8451e81eba20def6c) `8fcf2ad` → `f0f483e`: 2 instruction-line edits, 206 tracked paths changed stack for Codex, 0 for Claude Code. 4,476 tracked paths remained unchanged. One affected path: [`codex-rs/tui/src/bottom_pane/action_required_title.rs`](https://github.com/openai/codex/blob/f0f483e8b2a2630bf8dfa5f8451e81eba20def6c/codex-rs/tui/src/bottom_pane/action_required_title.rs) inheriting the changed nested [`AGENTS.md`](https://github.com/openai/codex/blob/8fcf2ad931b90589dd29a571f367e3185d26bbe0/codex-rs/tui/src/bottom_pane/AGENTS.md). Which other path inherited the same source?

[Inspect the evidence →](PROOF.md)

```bash
ruleblast diff 8fcf2ad931b90589dd29a571f367e3185d26bbe0 --to f0f483e8b2a2630bf8dfa5f8451e81eba20def6c
```

## Install

Published CLI is `ruleblast@2.0.1`. Node.js 20+. `npx` downloads and runs the pinned package.

```bash
cd <your-git-repository>
npx --yes ruleblast@2.0.1 .
npx --yes ruleblast@2.0.1 diff HEAD~1
```

`NOT_REPOSITORY` means `cd` into a Git repo first. `REF_NOT_FOUND` means pick a real ref. On a permission error, use `npx` instead of elevating. Release CI is Windows and Linux.

<details>
<summary>Global, project-local, uninstall, cache, source build</summary>

```bash
node --version
npm view ruleblast@2.0.1 version
npx --yes ruleblast@2.0.1 --help
npm install --global ruleblast@2.0.1
ruleblast --version
ruleblast --help
ruleblast
npm install --save-dev --save-exact ruleblast@2.0.1
npx ruleblast --version
npx ruleblast --help
npx ruleblast
npx --yes ruleblast@2.0.1 explain src/args.ts --from HEAD~1
npx --yes ruleblast@2.0.1 case
```

A global install downloads the full CLI.

```bash
npm uninstall --global ruleblast
npm install --global ruleblast@2.0.1
npm uninstall --save-dev ruleblast
npm install --save-dev --save-exact ruleblast@2.0.1
npm cache verify
npx --yes ruleblast@2.0.1 --help
git clone --branch v2.0.1 --depth 1 https://github.com/Kpoiut/ruleblast.git
cd ruleblast
npm ci --ignore-scripts
npm run build
node dist/cli.js --version
node dist/cli.js --help
node dist/cli.js .
node dist/cli.js case --json
```

The `1.0.1 → 1.0.2` registry upgrade was verified by the guarded [eight-cell release workflow](https://github.com/Kpoiut/ruleblast/actions/runs/31722775046).

</details>

## Run the verified case

Packaged teaching receipt: [`27d52e2…`](https://github.com/Kpoiut/ruleblast/commit/27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8) → [`e420008…`](https://github.com/Kpoiut/ruleblast/commit/e420008a1c10c5c328e506247560117f4d40b855). 33 instruction-line edits. 106 of 106 stacks moved. Zero current split, partial, unknown, or indeterminate paths. [Canonical receipt](cases/kpoiut__ruleblast/27d52e2cd6ee..e420008a1c10.json) core digest `1e907a88ed648ebbd68b4f588c3bd09058ab7714e8f85a3f2d4a1c60e5a40938`.

```bash
npx --yes ruleblast@2.0.1 case
npx --yes ruleblast@2.0.1 case --json
npx --yes ruleblast@2.0.1 case --explain .github/ISSUE_TEMPLATE/missing-blast.yml
```

<details>
<summary><strong>Exact packaged-case terminal transcript</strong></summary>

```text
RULEBLAST · VERIFIED CASE · kpoiut/ruleblast · 27d52e2cd6ee → e420008a1c10

33 instruction-line edits.

106
tracked paths changed stack.

CHANGED SOURCES
AGENTS.md
  CC Claude Code  106 affected paths
  CX Codex  106 affected paths
CLAUDE.md
  CC Claude Code  106 affected paths
  CX Codex  106 affected paths
No paths newly split across profiles.

The largest blast starts at ./.

Pick one path. See every source:
  ruleblast case --explain .github/ISSUE_TEMPLATE/missing-blast.yml

Scope: 106 tracked paths · repository-only · resolver revision 1
```

</details>

## Explain one path

```bash
npx --yes ruleblast@2.0.1 case --explain .github/ISSUE_TEMPLATE/missing-blast.yml
```

Historical reproduction (needs both commits checked out):

```bash
npx ruleblast@1.0.0 diff 27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8 --to e420008a1c10c5c328e506247560117f4d40b855 --json
```

## Scope

| In | Out |
|---|---|
| Git commit and tracked-worktree snapshots | untracked, ignored, user, managed, or session instructions |
| Codex CLI, Claude Code CLI, and opt-in Copilot or Gemini CLI repository projections | editor, hosted, or similarly branded surfaces |
| `scan`, `diff`, `explain`, and `case` | mutation, sync, generation, scoring, or auto-fix |
| deterministic text and canonical JSON | network calls, model calls, telemetry, dashboard, or product UI |

Unresolved stays `PARTIAL`, `UNKNOWN`, or `INDETERMINATE`. Contract: [CONTRACT.md](CONTRACT.md). Agents after install: [AGENT_USAGE.md](AGENT_USAGE.md).

## How it works

Snapshot → evidence-pinned profile projection → compare payloads → render the blast. Bundled Reality Packs declare the four realities; named engines own vendor rules. The analysis engine is the authority; the CLI is the reference host. Impact stays profile-neutral.

## Performance

Packed budget: 10,000 nested paths, p95 < 2,000 ms. `npm run benchmark`. Not a claim about model quality.

## Examples

The optional path is only a filesystem starting point for repository discovery. Add `--witness` when you need why-edges. Add `--receipt` when you need a pasteable card. Add `--reality github/copilot-cli@1` or `--reality google/gemini-cli@1` when you need that documented surface. Default `--json` stays the two-profile canonical result.

| Surface | MODELED | HOSTED | DISCOVERABLE |
|---|---|---|---|
| Codex CLI | yes | terminal | `.agents/skills` |
| Claude Code CLI | yes | terminal | `.claude/skills` |
| GitHub Copilot CLI | yes, opt-in | terminal | — |
| Gemini CLI | yes, opt-in | terminal | `.agents/skills` |
| VS Code | not a reality id | companion | not claimed |
| Cursor | not a reality id | compatible host | not claimed |

```bash
npx --yes ruleblast@2.0.1 .
npx --yes ruleblast@2.0.1 packages/api/internal
npx --yes ruleblast@2.0.1 diff HEAD~1
npx --yes ruleblast@2.0.1 explain src/args.ts --from HEAD~1
npx --yes ruleblast@2.0.1 diff HEAD~1 --json
```

## Open in the editor

The VS Code-compatible companion lives at [`hosts/vscode`](hosts/vscode). It is a view of the same engine, not a second resolver.

```bash
npm run build
npm run host:build
```

Then install `hosts/vscode` as an unpacked extension. Commands: Scan Workspace, Diff From…, Explain Active File, Open Verified Case. Saving a file marks the last result stale. It does not start another analysis.

## Give your agent RuleBlast

Codex discovers repository skills from `.agents/skills`. Claude Code discovers project skills from `.claude/skills` ([official skills docs](https://code.claude.com/docs/en/skills)). Neither reads `node_modules`.

Copy [`.agents/skills/ruleblast/SKILL.md`](.agents/skills/ruleblast/SKILL.md) for Codex and [`.claude/skills/ruleblast/SKILL.md`](.claude/skills/ruleblast/SKILL.md) for Claude Code. Same four routes. Agents still need your allow gate before they run.

```bash
echo yes > .ruleblast-allow
# or:  set RULEBLAST_AGENT_ALLOW=yes
npx --yes ruleblast@2.0.1 . --receipt
```

Off: `RULEBLAST_AGENT_ALLOW=off`. RuleBlast never writes the allow file.

## Show a blast on a pull request

Optional. Not a hosted product. The runner only executes the published CLI.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: Kpoiut/ruleblast/.github/actions/ruleblast@main
```

The nested composite Action posts a `--receipt` comment for `base.sha → head.sha`. It is not listed on the GitHub Marketplace. Pin a commit instead of `@main` after you trust the workflow.

## Contribute a Blast Case

Fast lane: [surprising result](https://github.com/Kpoiut/ruleblast/issues/new?template=surprising-result.yml) — command, observed text, one sentence. No canonical JSON.

Promoted Blast Case: official evidence, retrieval date, manifests, expected JSON. The 25-commit pilot is only for packaging `case`, not for a first PR. [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

Today: Codex, Claude Code, opt-in Copilot CLI, and opt-in Gemini CLI.

Reality is not host. Four documented realities. Same result in the terminal or editor.

How many rule realities are still hiding in it…?

Read [ROADMAP.md](ROADMAP.md). Apache-2.0. [CHANGELOG.md](CHANGELOG.md). Measurements: [docs/measurements](docs/measurements/). Evidence inventories: [docs/evidence](docs/evidence/).

[Code of conduct](CODE_OF_CONDUCT.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)
