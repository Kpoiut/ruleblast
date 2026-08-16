# Hosts

RuleBlast has two host classes:

1. The terminal CLI (reference host).
2. One VS Code-compatible companion at [`vscode/`](vscode/).

GitHub Copilot Chat, Cursor, Windsurf, Kiro, Antigravity IDE, Codex IDE, Continue, Cline, and Trae reuse that companion. There is no per-editor fork. Pack an installable VSIX with `npm run host:pack`. Marketplace and Open VSX uploads are separate publisher steps.

Claude Desktop, ChatGPT/Codex desktop, and Zed use `ruleblast --mcp`. MCP is a stdio transport of the same four actions, not a third host class and not a fifth action.
