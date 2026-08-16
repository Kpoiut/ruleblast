# RuleBlast companion

Read-only VS Code-compatible host for the RuleBlast analysis engine.

One adapter. VS Code is HOSTED. Cursor, Windsurf, Kiro, and Antigravity IDE are COMPATIBLE hosts of the same extension. They are not modeled realities. A host is not `cursor/editor@1`.

It does not resolve instruction files itself. After `npm run build` at the repository root, compile this host with `npm run host:build` and launch `hosts/vscode` as an unpacked extension in any of those editors.

Commands map 1:1 to `scan`, `diff`, `explain`, and `case`. Select Reality can add both opt-in CLI surfaces on the next run. It is not a fifth action. Explain uses the last canonical result when one exists and keeps `STALE` if the worktree already moved. File changes mark the last result `STALE`. They do not start a new analysis. An unsaved editor buffer is not a worktree snapshot.

Agents in those editors also get the same skill body and, where the editor speaks MCP, `ruleblast --mcp`.
