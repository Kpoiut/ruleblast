# RuleBlast companion

RuleBlast — Git diff for AI agent repository instructions. Change `AGENTS.md`. See every file that now inherits a different instruction stack. Companion version `2.5.5`. Published npm CLI is `2.5.1`. Status Bar follows the active file. Compare selected realities opens two stacks.

Scan, Diff, Explain, and Case — the same four actions as the CLI. One adapter for VS Code, GitHub Copilot Chat, Cursor, Windsurf, Kiro, Antigravity, Codex IDE, Continue, Cline, and Trae.

After `npm run build` at the repository root, compile this host with `npm run host:build` and launch `hosts/vscode` as an unpacked extension. Pack `ruleblast-companion-2.5.5.vsix` with `npm run host:pack`. The activity bar icon is `media/icon.svg` (`currentColor`). The Marketplace icon is `media/icon.png` (128×128). Marketplace and Open VSX uploads are separate publisher steps.

Commands map 1:1 to `scan`, `diff`, `explain`, and `case`. Select Reality can add both opt-in CLI surfaces on the next run. It is not a fifth action. Explain uses the last canonical result when one exists and keeps `STALE` if the worktree already moved. File changes mark the last result `STALE`. They do not start a new analysis. An unsaved editor buffer is not a worktree snapshot.

Agents in those editors also get the same skill body and, where the editor speaks MCP, `ruleblast --mcp`.
