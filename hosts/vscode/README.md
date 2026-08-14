# RuleBlast companion

Read-only VS Code-compatible host for the RuleBlast analysis engine.

It does not resolve instruction files itself. After `npm run build` at the repository root, compile this host with `npm run host:build` and launch it as an unpacked extension.

Commands map 1:1 to `scan`, `diff`, `explain`, and `case`. File changes mark the last result `STALE`. They do not start a new analysis. An unsaved editor buffer is not a worktree snapshot.
