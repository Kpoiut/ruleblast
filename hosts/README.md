# Hosts

RuleBlast has two host classes:

1. The terminal CLI (reference host).
2. One VS Code-compatible companion at [`vscode/`](vscode/).

GitHub Copilot Chat, Cursor, Windsurf, Kiro, Antigravity IDE, Codex IDE, Continue, Cline, Trae, VSCodium, and Roo Code reuse that companion. There is no per-editor fork. Pack `ruleblast-companion-2.5.9.vsix` with `npm run host:pack`. Published npm is `2.5.7`. Marketplace and Open VSX uploads are separate publisher steps.

Claude Desktop, ChatGPT/Codex desktop, Zed, JetBrains AI Assistant, Visual Studio Copilot, and Neovim (via mcphub.nvim) use `ruleblast --mcp`. MCP is a stdio transport of the same four actions, not a third host class and not a fifth action.
