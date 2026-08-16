# Compatible host and discovery surfaces

Retrieval date: 2026-08-16. These records pin official discovery or compatibility claims. They do not model editor instruction loading as a RuleBlast reality.

| Id | Form | Official URL | Claim implemented |
|---|---|---|---|
| vscode | extension | https://code.visualstudio.com/api | One companion uses the VS Code extension API. HOSTED. |
| vscode-copilot | same companion + `.vscode/mcp.json` | https://code.visualstudio.com/docs/copilot/customization/mcp-servers | GitHub Copilot Chat/Agent in VS Code. COMPATIBLE, not `copilot/vscode@1`. |
| claude-desktop | user MCP | https://modelcontextprotocol.io/docs/develop/connect-local-servers | Paste `discovery/claude-desktop.mcp.json` into `claude_desktop_config.json`. |
| claude-code mcp | `.mcp.json` | https://code.claude.com/docs/en/mcp | Project-scoped Claude Code MCP. |
| codex-desktop | `.codex/config.toml` | https://learn.chatgpt.com/codex/extend/mcp | ChatGPT desktop, Codex CLI, and Codex IDE share this MCP file. |
| codex skill | `.agents/skills` | https://learn.chatgpt.com/codex/build-skills | Official Codex repo skill path. |
| continue | `.continue/mcpServers` | https://docs.continue.dev/customize/deep-dives/mcp | Continue JSON MCP files. |
| cline | user MCP snippet | https://docs.cline.bot/mcp/mcp-overview | Paste `discovery/cline.mcp.json`. |
| zed | settings snippet | https://zed.dev/docs/ai/mcp | Merge `discovery/zed-context-servers.json`. |
| cursor host | same companion | https://cursor.com/docs/skills | Cursor is a VS Code-compatible editor. COMPATIBLE, not `cursor/editor@1`. |
| cursor skill | `.cursor/skills/<name>/SKILL.md` | https://cursor.com/docs/skills | Project Agent Skills path. |
| windsurf host | same companion | https://docs.devin.ai/desktop/cascade/skills | Windsurf is a VS Code-compatible editor. COMPATIBLE. |
| windsurf skill | `.windsurf/skills/<name>/SKILL.md` | https://docs.devin.ai/desktop/cascade/skills | Cascade workspace skills. |
| kiro host | same companion | https://kiro.dev/docs/upgrade-guides/migrating-from-vscode/ | Kiro uses Open VSX and VS Code settings. COMPATIBLE. |
| kiro skill | `.kiro/skills/<name>/SKILL.md` | https://kiro.dev/docs/skills | Workspace Agent Skills. |
| kiro mcp | `.kiro/settings/mcp.json` | https://kiro.dev/docs/mcp/configuration/ | Workspace MCP stdio `command`/`args`. |
| antigravity host | same companion | https://antigravity.google/docs/mcp | Antigravity IDE is a VS Code-compatible editor. COMPATIBLE. |
| antigravity mcp | `.agents/mcp_config.json` | https://antigravity.google/docs/mcp | Workspace MCP stdio `command`/`args`. |
| claude-code skill | `.claude/skills/<name>/SKILL.md` | https://code.claude.com/docs/en/skills | Existing official project skill path. |
| mcp transport | `ruleblast --mcp` | https://modelcontextprotocol.io | JSON-RPC stdio, tools = the four public actions. |

A host that can run RuleBlast is not thereby MODELED.
