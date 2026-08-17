<h1 align="center">RuleBlast — Git diff for invisible repository instructions</h1>

<p align="center">
  <img src="assets/ruleblast-hero.png?v=2.3.0" alt="RuleBlast — See the second diff. Local, read-only, evidence-first" width="100%">
</p>

<p align="center">
  <a href="https://github.com/Kpoiut/ruleblast/actions/workflows/verify.yml"><img src="https://github.com/Kpoiut/ruleblast/actions/workflows/verify.yml/badge.svg" alt="Verify workflow status"></a>
  <a href="https://github.com/Kpoiut/ruleblast/releases/tag/v2.3.0"><img src="https://img.shields.io/github/package-json/v/Kpoiut/ruleblast" alt="this tree 2.3.0"></a>
  <img src="https://img.shields.io/node/v/ruleblast" alt="supported Node.js versions">
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/ruleblast" alt="Apache-2.0 license"></a>
</p>

<p align="center">
  Git shows the <code>AGENTS.md</code> and <code>CLAUDE.md</code> edit. RuleBlast shows the blast radius — which files inherit that change across Codex, Claude Code, Gemini CLI, and Copilot CLI.
</p>

<p align="center">
  You changed 2 instruction lines.<br>
  Git sees 2 lines. RuleBlast finds 206 Codex stacks that inherited them.<br>
  <strong>Codex: 206 · Claude Code: 0</strong><br>
  Why did only one agent inherit that nested <code>AGENTS.md</code>?
</p>

<div align="center">
  <img src="assets/ruleblast-causal-proof.gif?v=2.3.0" alt="Terminal demo: git sees 3 files and 6 deletions; ruleblast diff shows Codex 206 paths and Claude Code 0; explain names nested AGENTS.md" width="100%">
</div>

```bash
cd <your-git-repository>
npx --yes ruleblast@2.3.0 .
npx --yes ruleblast@2.3.0 diff HEAD~1
```

<p align="center"><sub>Local · read-only · deterministic · no network or model call</sub></p>

## What Git missed

<div align="center">
  <img src="assets/ruleblast-visual-benchmark.png?v=2.3.0" alt="Square RuleBlast 2.3.0 scoreboard: Git saw 2 instruction lines; Codex 206, Claude Code 0; why-this-path, CLI and IDE surfaces, user allow gate" width="100%">
</div>

Git shows the instruction edit. It does not show every repository path that inherits it.

[Which files inherit a changed AGENTS.md?](which-files-inherit-agents-md.md)

## Real repository. Reproducible result.

Not a synthetic fixture. Public [`openai/codex`](https://github.com/openai/codex/compare/8fcf2ad931b90589dd29a571f367e3185d26bbe0...f0f483e8b2a2630bf8dfa5f8451e81eba20def6c) `8fcf2ad` → `f0f483e`: 2 instruction-line edits, 206 tracked paths changed stack for Codex, 0 for Claude Code. 4,476 tracked paths remained unchanged. One affected path: [`codex-rs/tui/src/bottom_pane/action_required_title.rs`](https://github.com/openai/codex/blob/f0f483e8b2a2630bf8dfa5f8451e81eba20def6c/codex-rs/tui/src/bottom_pane/action_required_title.rs) inheriting the changed nested [`AGENTS.md`](https://github.com/openai/codex/blob/8fcf2ad931b90589dd29a571f367e3185d26bbe0/codex-rs/tui/src/bottom_pane/AGENTS.md). Which other path inherited the same source?

[Inspect the evidence →](PROOF.md)

```bash
ruleblast diff 8fcf2ad931b90589dd29a571f367e3185d26bbe0 --to f0f483e8b2a2630bf8dfa5f8451e81eba20def6c
```

## Other tracked changes

This tree is `2.3.0`. The strongest addition is not a fifth action. Human `diff` Git→Git and Git→WORKTREE can append **OTHER TRACKED CHANGES** from Git storage blob-object identity, then a **WORK MAP** and a deterministic **CHANGE ALIGNMENT**: `ALIGNED`, `MIXED`, `DIVERGENT`, or `UNRESOLVED`. The adjunct also names the identity law, other-path kinds (added / modified / deleted), and an operational gloss. That restates membership. It is not actor telemetry and not model compliance. `--json` stays the canonical result.

Companion Diff From renders the prepared adjunct. Keys: `Ctrl+Alt+R` then `S` scan · `D` diff · `E` explain · `C` case.

## Install

Published CLI is `ruleblast@2.3.0`. Node.js 20+. `npx` downloads and runs the pinned package.

```bash
cd <your-git-repository>
npx --yes ruleblast@2.3.0 .
npx --yes ruleblast@2.3.0 diff HEAD~1
```

`NOT_REPOSITORY` means `cd` into a Git repo first. `REF_NOT_FOUND` means pick a real ref. On a permission error, use `npx` instead of elevating. Release CI is Windows and Linux.

<details>
<summary>Global, project-local, uninstall, cache, source build</summary>

```bash
node --version
npm view ruleblast@2.3.0 version
npx --yes ruleblast@2.3.0 --help
npm install --global ruleblast@2.3.0
ruleblast --version
ruleblast --help
ruleblast
npm install --save-dev --save-exact ruleblast@2.3.0
npx ruleblast --version
npx ruleblast --help
npx ruleblast
npx --yes ruleblast@2.3.0 explain src/args.ts --from HEAD~1
npx --yes ruleblast@2.3.0 case
```

A global install downloads the full CLI.

```bash
npm uninstall --global ruleblast
npm install --global ruleblast@2.3.0
npm uninstall --save-dev ruleblast
npm install --save-dev --save-exact ruleblast@2.3.0
npm cache verify
npx --yes ruleblast@2.3.0 --help
git clone --branch v2.3.0 --depth 1 https://github.com/Kpoiut/ruleblast.git
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
npx --yes ruleblast@2.3.0 case
npx --yes ruleblast@2.3.0 case --json
npx --yes ruleblast@2.3.0 case --explain .github/ISSUE_TEMPLATE/missing-blast.yml
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
npx --yes ruleblast@2.3.0 case --explain .github/ISSUE_TEMPLATE/missing-blast.yml
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

This tree, dirty worktree versus `HEAD~1`: 237 tracked paths. Default Codex + Claude Code: 0 changed stacks, 0 split. The same diff plus both opt-in CLI surfaces stays 0 changed stacks; Copilot CLI is 0 complete and the N-way is 237 split / 237 partial / 237 indeterminate. That is current-state coverage, not a new instruction edit. Compact metrics: [docs/measurements/fresh-replay.md](docs/measurements/fresh-replay.md). The sealed openai/codex 2→206 proof is unchanged.

## Examples

The optional path is only a filesystem starting point for repository discovery. Add `--witness` when you need why-edges. Add `--receipt` when you need a pasteable card. Add `--reality github/copilot-cli@1` and/or `--reality google/gemini-cli@1` when you need those documented surfaces. Repeat `--reality` for a four-surface N-way. Default `--json` stays the two-profile canonical result.

| Surface | MODELED | HOST | DISCOVERABLE |
|---|---|---|---|
| Codex CLI | yes | terminal | `.agents/skills` + `.codex/config.toml` |
| ChatGPT / Codex desktop | not a reality id | desktop MCP | `.codex/config.toml` |
| Codex IDE extension | not a reality id | COMPATIBLE host | skill + `.codex/config.toml` |
| Claude Code CLI | yes | terminal | `.claude/skills` + `.mcp.json` |
| Claude Desktop | not a reality id | desktop MCP | paste `discovery/claude-desktop.mcp.json` |
| GitHub Copilot CLI | yes, opt-in | terminal | — |
| GitHub Copilot Chat / Agent | not a reality id | COMPATIBLE host | `.vscode/mcp.json` |
| Gemini CLI | yes, opt-in | terminal | `.agents/skills` |
| VS Code | not a reality id | HOSTED companion | `.vscode/mcp.json` |
| Cursor | not a reality id | COMPATIBLE host | `.cursor/skills` + MCP |
| Windsurf | not a reality id | COMPATIBLE host | `.windsurf/skills` |
| Kiro | not a reality id | COMPATIBLE host | `.kiro/skills` + MCP |
| Antigravity IDE | not a reality id | COMPATIBLE host | `.agents/mcp_config.json` |
| Continue | not a reality id | COMPATIBLE host | `.continue/mcpServers` |
| Cline | not a reality id | COMPATIBLE host | paste `discovery/cline.mcp.json` |
| Trae | not a reality id | COMPATIBLE host | same companion |
| Zed | not a reality id | desktop MCP | paste `discovery/zed-context-servers.json` |

```bash
npx --yes ruleblast@2.3.0 .
npx --yes ruleblast@2.3.0 packages/api/internal
npx --yes ruleblast@2.3.0 diff HEAD~1
npx --yes ruleblast@2.3.0 explain src/args.ts --from HEAD~1
npx --yes ruleblast@2.3.0 diff HEAD~1 --json
```

## Open in the editor

The VS Code-compatible companion lives at [`hosts/vscode`](hosts/vscode). It is a view of the same engine, not a second resolver. Install that one unpacked folder in VS Code (including GitHub Copilot Chat), Cursor, Windsurf, Kiro, Antigravity, Codex IDE, Continue, Cline, or Trae. Select Reality can add both opt-in CLI surfaces. Saving a file marks the last result stale. It does not start another analysis. Claude Desktop, ChatGPT/Codex desktop, and Zed use `--mcp`, not a second extension.

```bash
npm run build
npm run host:build
```

Install the unpacked `hosts/vscode` folder. This tree packs `ruleblast-companion-2.3.0.vsix` with `npm run host:pack`. The activity bar uses a themed SVG; the Marketplace PNG stays 128×128. Do not overwrite Marketplace `2.2.0` or `2.2.1`. Commands: Scan Workspace, Diff From…, Explain Active File, Open Verified Case. Keys: `Ctrl+Alt+R` then `S`/`D`/`E`/`C`. Marketplace / Open VSX listings are separate publisher operations; the VSIX is the installable extension form.

## Give your agent RuleBlast

One skill body, copied to every official path. Neither `node_modules` nor a host is a modeled reality.

- Codex CLI / desktop / IDE: [`.agents/skills/ruleblast/SKILL.md`](.agents/skills/ruleblast/SKILL.md) ([official skills](https://learn.chatgpt.com/codex/build-skills))
- Claude Code: [`.claude/skills/ruleblast/SKILL.md`](.claude/skills/ruleblast/SKILL.md) ([official skills](https://code.claude.com/docs/en/skills))
- Cursor: [`.cursor/skills/ruleblast/SKILL.md`](.cursor/skills/ruleblast/SKILL.md)
- Windsurf: [`.windsurf/skills/ruleblast/SKILL.md`](.windsurf/skills/ruleblast/SKILL.md)
- Kiro: [`.kiro/skills/ruleblast/SKILL.md`](.kiro/skills/ruleblast/SKILL.md)

MCP is the same four actions: `node dist/cli.js --mcp`.

- GitHub Copilot in VS Code: [`.vscode/mcp.json`](.vscode/mcp.json)
- Claude Code: [`.mcp.json`](.mcp.json)
- Codex desktop / CLI / IDE: [`.codex/config.toml`](.codex/config.toml)
- Continue: [`.continue/mcpServers/ruleblast.json`](.continue/mcpServers/ruleblast.json)
- Claude Desktop: paste [discovery/claude-desktop.mcp.json](discovery/claude-desktop.mcp.json) into `claude_desktop_config.json`
- Cline: paste [discovery/cline.mcp.json](discovery/cline.mcp.json)
- Zed: merge [discovery/zed-context-servers.json](discovery/zed-context-servers.json)

Agents still need your allow gate before they run. Copilot Chat using RuleBlast is HOST/DISCOVERABLE. It is not `github/copilot-cli@1` and not a new modeled editor reality.

```bash
echo yes > .ruleblast-allow
# or:  set RULEBLAST_AGENT_ALLOW=yes
npx --yes ruleblast@2.3.0 . --receipt
```

Off: `RULEBLAST_AGENT_ALLOW=off`. RuleBlast never writes the allow file.

## Show a blast on a pull request

Optional. Not a hosted product. The runner only executes the published CLI.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: Kpoiut/ruleblast@v2.3.0
```

Root Action `Kpoiut/ruleblast@v2.3.0` is a distribution surface of the same published CLI. It posts a `--receipt` comment for `base.sha → head.sha`. Pin a commit after you trust the workflow.

## Contribute a Blast Case

Fast lane: [surprising result](https://github.com/Kpoiut/ruleblast/issues/new?template=surprising-result.yml) — command, observed text, one sentence. No canonical JSON.

Promoted Blast Case: official evidence, retrieval date, manifests, expected JSON. The 25-commit pilot is only for packaging `case`, not for a first PR. [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

This tree is `2.3.0`: overlay, work map, change alignment, companion control.

Today: Codex, Claude Code, opt-in Copilot CLI, and opt-in Gemini CLI. Same companion in VS Code-family editors, including Copilot Chat. Same four actions over `--mcp` for Claude Desktop and Codex desktop.

Reality is not host. Four documented realities. Same result in the terminal or editor.

How many rule realities are still hiding in it…?

Horizon `v3` proves overlay at corpus scale. Horizon `v4` is a stack debugger that still has four actions, no dashboard, and no model score.

Canonical landing: [kpoiut.github.io/ruleblast](https://kpoiut.github.io/ruleblast/). Read [ROADMAP.md](ROADMAP.md). Apache-2.0. [CHANGELOG.md](CHANGELOG.md). Measurements: [docs/measurements](docs/measurements/). Evidence inventories: [docs/evidence](docs/evidence/).

[Code of conduct](CODE_OF_CONDUCT.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)
