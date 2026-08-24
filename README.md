<h1 align="center">RuleBlast — Git diff for AI agent repository instructions</h1>

<p align="center">
  <img src="assets/ruleblast-hero.png?v=2.5.9s" alt="RuleBlast — See the second diff. Local, read-only, evidence-first" width="100%">
</p>

<p align="center">
  <a href="https://github.com/Kpoiut/ruleblast/actions/workflows/verify.yml"><img src="https://github.com/Kpoiut/ruleblast/actions/workflows/verify.yml/badge.svg" alt="Verify workflow status"></a>
  <a href="https://github.com/Kpoiut/ruleblast/releases/tag/v2.5.9"><img src="https://img.shields.io/github/package-json/v/Kpoiut/ruleblast" alt="this tree 2.5.10"></a>
  <img src="https://img.shields.io/node/v/ruleblast" alt="supported Node.js versions">
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/ruleblast" alt="Apache-2.0 license"></a>
</p>

<p align="center">
  Git shows the <code>AGENTS.md</code> and <code>CLAUDE.md</code> edit. RuleBlast shows the blast radius — which files inherit that change across Codex, Claude Code, Gemini CLI, and Copilot CLI.
</p>

<p align="center">
  You changed the rule. Git lists the files you touched.<br>
  RuleBlast adds <strong>OTHER TRACKED CHANGES</strong>, a <strong>WORK MAP</strong>, and <strong>CHANGE ALIGNMENT</strong>:<br>
  <code>ALIGNED</code> · <code>MIXED</code> · <code>DIVERGENT</code> · <code>UNRESOLVED</code><br>
  Inherited stacks versus independent Git motion. Later work on an inherited path gets the new instruction. Other Git motion did not.
</p>

<div align="center">
  <img src="assets/ruleblast-causal-proof.gif?v=2.5.9s" alt="Terminal demo: git sees 3 files and 6 deletions; ruleblast diff shows Codex 206 paths and Claude Code 0; explain names nested AGENTS.md" width="100%">
</div>

```bash
cd <your-git-repository>
npx --yes ruleblast@2.5.9 .
npx --yes ruleblast@2.5.9 diff HEAD~1
```

<p align="center"><sub>This tree is 2.5.10. Published CLI is ruleblast@2.5.9. Local · read-only · deterministic · no network or model call</sub></p>

<p align="center">
  A Status Bar can say <code>Δ206</code> before anyone opens RuleBlast.<br>
  One compare puts Codex next to Claude. A <code>PROOF</code> line names the source chain.<br>
  You do not have to believe the tool. You can read why it said that.
</p>

## What Git missed

<div align="center">
  <img src="assets/ruleblast-visual-benchmark.png?v=2.5.9s" alt="RuleBlast 2.4.6 scoreboard: Git saw 2 instruction lines; Codex 206, Claude Code 0; nested AGENTS.md; ALIGNED CONTINUE 2" width="100%">
</div>

Git shows the instruction edit. It does not show every repository path that inherits it.

[Which files inherit a changed AGENTS.md?](which-files-inherit-agents-md.md)

## Real repository. Reproducible result.

Not a synthetic fixture. Public [`openai/codex`](https://github.com/openai/codex/compare/8fcf2ad931b90589dd29a571f367e3185d26bbe0...f0f483e8b2a2630bf8dfa5f8451e81eba20def6c) `8fcf2ad` → `f0f483e`: 2 instruction-line edits, 206 tracked paths changed stack for Codex, 0 for Claude Code. **Codex: 206 · Claude Code: 0**. 4,476 tracked paths remained unchanged. One affected path: [`codex-rs/tui/src/bottom_pane/action_required_title.rs`](https://github.com/openai/codex/blob/f0f483e8b2a2630bf8dfa5f8451e81eba20def6c/codex-rs/tui/src/bottom_pane/action_required_title.rs) inheriting the changed nested [`AGENTS.md`](https://github.com/openai/codex/blob/8fcf2ad931b90589dd29a571f367e3185d26bbe0/codex-rs/tui/src/bottom_pane/AGENTS.md). Which other path inherited the same source?

[Inspect the evidence →](PROOF.md)

```bash
ruleblast diff 8fcf2ad931b90589dd29a571f367e3185d26bbe0 --to f0f483e8b2a2630bf8dfa5f8451e81eba20def6c
```

A pull request that only edits `AGENTS.md` can look tiny in Git. Human `diff` then answers the review question: which other tracked paths inherited that stack, and which Git motion is independent? `--json` stays the canonical result. It is not actor telemetry.

Companion Diff From renders that prepared adjunct. Keys: `Ctrl+Alt+R` then `S` scan · `D` diff · `E` explain · `C` case. Diff From lists HEAD, the last parent, recent bases, and git log. The Status Bar follows the active file. Compare selected realities opens two stacks in the editor diff.

## Install

Published CLI is `ruleblast@2.5.9`. Node.js 20+. `npx` downloads and runs the pinned package.

```bash
cd <your-git-repository>
npx --yes ruleblast@2.5.9 .
npx --yes ruleblast@2.5.9 diff HEAD~1
```

`NOT_REPOSITORY` means `cd` into a Git repo first. `REF_NOT_FOUND` means pick a real ref. On a permission error, use `npx` instead of elevating. Release CI is Windows and Linux.

<details>
<summary>Global, project-local, uninstall, cache, source build</summary>

```bash
node --version
npm view ruleblast@2.5.9 version
npx --yes ruleblast@2.5.9 --help
npm install --global ruleblast@2.5.9
ruleblast --version
ruleblast --help
ruleblast
npm install --save-dev --save-exact ruleblast@2.5.9
npx ruleblast --version
npx ruleblast --help
npx ruleblast
npx --yes ruleblast@2.5.9 explain src/args.ts --from HEAD~1
npx --yes ruleblast@2.5.9 case
```

A global install downloads the full CLI.

```bash
npm uninstall --global ruleblast
npm install --global ruleblast@2.5.9
npm uninstall --save-dev ruleblast
npm install --save-dev --save-exact ruleblast@2.5.9
npm cache verify
npx --yes ruleblast@2.5.9 --help
git clone --branch v2.5.9 --depth 1 https://github.com/Kpoiut/ruleblast.git
cd ruleblast
npm ci --ignore-scripts
npm run build
node dist/cli.js --version
node dist/cli.js --help
node dist/cli.js .
node dist/cli.js case --json
node dist/cli.js diff HEAD --paths-only
node dist/cli.js diff HEAD --index
node dist/cli.js explain src/args.ts --compare
```

The `1.0.1 → 1.0.2` registry upgrade was verified by the guarded [eight-cell release workflow](https://github.com/Kpoiut/ruleblast/actions/runs/31722775046).

</details>

## Run the verified case

Packaged teaching receipt: [`27d52e2…`](https://github.com/Kpoiut/ruleblast/commit/27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8) → [`e420008…`](https://github.com/Kpoiut/ruleblast/commit/e420008a1c10c5c328e506247560117f4d40b855). 33 instruction-line edits. 106 of 106 stacks moved. Zero current split, partial, unknown, or indeterminate paths. [Canonical receipt](cases/kpoiut__ruleblast/27d52e2cd6ee..e420008a1c10.json) core digest `1e907a88ed648ebbd68b4f588c3bd09058ab7714e8f85a3f2d4a1c60e5a40938`.

```bash
npx --yes ruleblast@2.5.9 case
npx --yes ruleblast@2.5.9 case --json
npx --yes ruleblast@2.5.9 case --explain .github/ISSUE_TEMPLATE/missing-blast.yml
```

<details>
<summary><strong>Exact packaged-case terminal transcript</strong></summary>

```text
RULEBLAST · VERIFIED CASE · kpoiut/ruleblast · 27d52e2cd6ee → e420008a1c10

  Δ STACK CHANGED        106
  ≠ NEWLY SPLIT            0
  ? UNRESOLVED             0

106 tracked paths changed stack.

33 instruction-line edits.
SOURCE
  AGENTS.md
    CC Claude Code       106
    CX Codex             106
  CLAUDE.md
    CC Claude Code       106
    CX Codex             106
No paths newly split across profiles.

The largest blast starts at ./.

EXPLAIN
  ruleblast case --explain .github/ISSUE_TEMPLATE/missing-blast.yml

Scope: 106 tracked paths · repository-only · resolver revision 1
```

</details>

## Explain one path

```bash
npx --yes ruleblast@2.5.9 case --explain .github/ISSUE_TEMPLATE/missing-blast.yml
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

This tree discloses that same result in layers: one-line glance, `--paths-only`, `--index`, `explain --compare`, then a `PROOF` line. Published `2.4.6` includes glance, `--paths-only`, `explain --compare`, and `PROOF`. `--index` is this tree.

## Performance

Packed budget: 10,000 nested paths. Efficiency gate: p95 < 1,000 ms. Ceiling: p95 < 2,000 ms. The ceiling is the hard stop, not the goal. `npm run benchmark` also times the sealed GIF pair (diff + explain KEEP) and lab inventory. Not a claim about model quality.

<details>
<summary>Current-tree replay (not the sealed 2→206 proof)</summary>

This tree, dirty worktree versus `HEAD~1`: 237 tracked paths. Default Codex + Claude Code: 0 changed stacks, 0 split. The same diff plus both opt-in CLI surfaces stays 0 changed stacks; Copilot CLI is 0 complete and the N-way is 237 split / 237 partial / 237 indeterminate. That is current-state coverage, not a new instruction edit. Compact metrics: [docs/measurements/fresh-replay.md](docs/measurements/fresh-replay.md). The sealed openai/codex 2→206 proof is unchanged.

</details>

## Examples

The optional path is only a filesystem starting point for repository discovery. Add `--witness` when you need why-edges. Add `--receipt` when you need a pasteable card. Add `--reality github/copilot-cli@1` and/or `--reality google/gemini-cli@1` when you need those documented surfaces. Repeat `--reality` for a four-surface N-way. Default `--json` stays the two-profile canonical result.

```bash
npx --yes ruleblast@2.5.9 .
npx --yes ruleblast@2.5.9 packages/api/internal
npx --yes ruleblast@2.5.9 diff HEAD~1
npx --yes ruleblast@2.5.9 explain src/args.ts --from HEAD~1
npx --yes ruleblast@2.5.9 diff HEAD~1 --json
```

<details>
<summary>Host is not a reality — surface map</summary>

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
| VSCodium | not a reality id | COMPATIBLE host | same companion vsix |
| Roo Code | not a reality id | COMPATIBLE host | same companion + paste `discovery/roo-code.mcp.json` |
| JetBrains AI Assistant | not a reality id | desktop MCP | paste `discovery/jetbrains.mcp.json` |
| Visual Studio Copilot | not a reality id | desktop MCP | paste `discovery/visual-studio.mcp.json` (also reads `.vscode/mcp.json`) |
| Neovim | not a reality id | desktop MCP | paste `discovery/neovim.mcp.json` into mcphub.nvim |
| Zed | not a reality id | desktop MCP | paste `discovery/zed-context-servers.json` |

</details>

## Open in the editor

Change `AGENTS.md`. See every file that now inherits a different instruction stack.

The companion at [`hosts/vscode`](hosts/vscode) is the same four actions as the CLI: Scan, Diff, Explain, Case. One folder for VS Code (including GitHub Copilot Chat), Cursor, Windsurf, Kiro, Antigravity, Codex IDE, Continue, Cline, Trae, VSCodium, or Roo Code. JetBrains AI Assistant, Visual Studio Copilot, Neovim, Zed, and Claude Desktop use `--mcp`. Keys: `Ctrl+Alt+R` then `S`/`D`/`E`/`C`.

```bash
npm run build
npm run host:build
```

Install the unpacked `hosts/vscode` folder, or pack `ruleblast-companion-2.5.10.vsix` with `npm run host:pack`. GitHub Release [`v2.5.9`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.5.9) serves `ruleblast-companion-2.5.9.vsix`. The Status Bar follows the active file from the last result. Compare selected realities opens the two stacks in the editor diff. Saving a file marks the last result stale; it does not start another analysis. Claude Desktop, ChatGPT/Codex desktop, and Zed use `--mcp`. Marketplace / Open VSX listings are separate publisher operations.

## Give your agent RuleBlast

One skill body, copied to every official path. Neither `node_modules` nor a host is a modeled reality.

- Codex CLI / desktop / IDE: [`.agents/skills/ruleblast/SKILL.md`](.agents/skills/ruleblast/SKILL.md) ([official skills](https://learn.chatgpt.com/codex/build-skills))
- Claude Code: [`.claude/skills/ruleblast/SKILL.md`](.claude/skills/ruleblast/SKILL.md) ([official skills](https://code.claude.com/docs/en/skills))
- Cursor: [`.cursor/skills/ruleblast/SKILL.md`](.cursor/skills/ruleblast/SKILL.md)
- Windsurf: [`.windsurf/skills/ruleblast/SKILL.md`](.windsurf/skills/ruleblast/SKILL.md)
- Kiro: [`.kiro/skills/ruleblast/SKILL.md`](.kiro/skills/ruleblast/SKILL.md)

<details>
<summary>MCP configs — same four actions</summary>

MCP is the same four actions: `node dist/cli.js --mcp`.

- GitHub Copilot in VS Code: [`.vscode/mcp.json`](.vscode/mcp.json)
- Claude Code: [`.mcp.json`](.mcp.json)
- Codex desktop / CLI / IDE: [`.codex/config.toml`](.codex/config.toml)
- Continue: [`.continue/mcpServers/ruleblast.json`](.continue/mcpServers/ruleblast.json)
- Cursor: [`.cursor/mcp.json`](.cursor/mcp.json)
- Kiro: [`.kiro/settings/mcp.json`](.kiro/settings/mcp.json)
- Antigravity: [`.agents/mcp_config.json`](.agents/mcp_config.json)
- Claude Desktop: paste [discovery/claude-desktop.mcp.json](discovery/claude-desktop.mcp.json) into `claude_desktop_config.json`
- Cline: paste [discovery/cline.mcp.json](discovery/cline.mcp.json)
- Roo Code: paste [discovery/roo-code.mcp.json](discovery/roo-code.mcp.json)
- Windsurf Cascade: paste [discovery/windsurf.mcp.json](discovery/windsurf.mcp.json) into `~/.codeium/windsurf/mcp_config.json`
- JetBrains AI Assistant: paste [discovery/jetbrains.mcp.json](discovery/jetbrains.mcp.json)
- Visual Studio Copilot: paste [discovery/visual-studio.mcp.json](discovery/visual-studio.mcp.json)
- Neovim: paste [discovery/neovim.mcp.json](discovery/neovim.mcp.json) into mcphub.nvim
- Zed: merge [discovery/zed-context-servers.json](discovery/zed-context-servers.json)

</details>

Agents still need your allow gate before they run. Copilot Chat using RuleBlast is HOST/DISCOVERABLE. It is not `github/copilot-cli@1` and not a new modeled editor reality.

```bash
echo yes > .ruleblast-allow
# or:  set RULEBLAST_AGENT_ALLOW=yes
npx --yes ruleblast@2.5.9 . --receipt
```

Off: `RULEBLAST_AGENT_ALLOW=off`. RuleBlast never writes the allow file.

## Show a blast on a pull request

A pull request that only edits `AGENTS.md` can look small in Git. The Action comments which tracked files now inherit a different instruction stack. Reviewers see the blast before merge. The runner only executes the published CLI.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: Kpoiut/ruleblast@v2.5.9
```

Root Action `Kpoiut/ruleblast@v2.5.9` posts a `--receipt` for `base.sha → head.sha`. It runs published `ruleblast@2.5.9`. Pin a commit after you trust the workflow.

## Contribute a Blast Case

Fast lane: [surprising result](https://github.com/Kpoiut/ruleblast/issues/new?template=surprising-result.yml) — command, observed text, one sentence. No canonical JSON.

Promoted Blast Case: official evidence, retrieval date, manifests, expected JSON. The 25-commit pilot is only for packaging `case`, not for a first PR. [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

This tree is `2.5.10`. Published CLI is `ruleblast@2.5.9`. The product is overlay, work map, change alignment, and intent — which files now receive different AI instructions, and whether later work should CONTINUE or REJECT that inheritance. REJECT is not a recommendation to discard the Git change. Glance, `--paths-only`, `--index`, `explain --compare`, and a `PROOF` line disclose that same result. Offline `--detail` / `--receipt` can say a pinned evidence revision is SEALED, NO_KNOWN_DRIFT, or POSSIBLY_STALE, and print the Candidate Reality Conformance Lab, without a network fetch. Lab `ORACLE` is a sealed interpreter match on every packed Codex, Copilot, Claude, and Gemini fixture probe. Pack id is the lookup key for the executing reality. `RECORDED` is not a passing oracle. Candidate `LOADED` is a snapshot that constructed, not a passing projection. Candidate runtimes sit in the lab as `NOT_ADMITTED` under runtime IDs such as `xai/grok-build-cli` and `qwen/qwen-code-cli`. A model name is never a `--reality`. It is not a model-quality score.

Today: Codex, Claude Code, opt-in Copilot CLI, and opt-in Gemini CLI. Same companion in VS Code-family editors, including Copilot Chat. Same four actions over `--mcp` for Claude Desktop and Codex desktop.

Reality is not host. Four documented realities. Same result in the terminal or editor.

How many rule realities are still hiding in it…?

Canonical landing: [kpoiut.github.io/ruleblast](https://kpoiut.github.io/ruleblast/). Read [ROADMAP.md](ROADMAP.md). Apache-2.0. [CHANGELOG.md](CHANGELOG.md). Measurements: [docs/measurements](docs/measurements/). Evidence inventories: [docs/evidence](docs/evidence/).

[Code of conduct](CODE_OF_CONDUCT.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)
