export type SurfaceKind = "host" | "skill" | "mcp";
export type SurfaceStatus = "HOSTED" | "COMPATIBLE" | "DISCOVERABLE";
export type HostForm = "extension" | "desktop" | "cli";
export type HostAdapter = "hosts/vscode" | "mcp-stdio" | "skill";
export type McpConfigFormat = "mcpServers" | "vscodeServers" | "codexToml" | "zedContext";

export interface HostSurface {
  readonly id: string;
  readonly kind: "host";
  readonly form: HostForm;
  readonly adapter: HostAdapter;
  readonly status: SurfaceStatus;
  readonly evidenceUrl: string;
  readonly claim: string;
}

export interface SkillSurface {
  readonly id: string;
  readonly kind: "skill";
  readonly form: "skill";
  readonly path: string;
  readonly status: "DISCOVERABLE";
  readonly evidenceUrl: string;
  readonly claim: string;
}

export interface McpConfigSurface {
  readonly id: string;
  readonly kind: "mcp";
  readonly form: "mcp-stdio";
  readonly path: string;
  readonly format: McpConfigFormat;
  readonly status: "DISCOVERABLE";
  readonly evidenceUrl: string;
  readonly claim: string;
}

export const VSCODE_FAMILY_ADAPTER = "hosts/vscode" as const;
export const CANONICAL_SKILL_PATH = "discovery/SKILL.md" as const;

export const HOST_SURFACES: readonly HostSurface[] = Object.freeze([
  Object.freeze({
    id: "vscode",
    kind: "host",
    form: "extension",
    adapter: VSCODE_FAMILY_ADAPTER,
    status: "HOSTED",
    evidenceUrl: "https://code.visualstudio.com/api",
    claim: "One VS Code extension API companion renders the four actions.",
  }),
  Object.freeze({
    id: "vscode-copilot",
    kind: "host",
    form: "extension",
    adapter: VSCODE_FAMILY_ADAPTER,
    status: "COMPATIBLE",
    evidenceUrl: "https://code.visualstudio.com/docs/copilot/customization/mcp-servers",
    claim: "GitHub Copilot Chat and Agent in VS Code use the same companion plus .vscode/mcp.json. Not copilot/vscode@1.",
  }),
  Object.freeze({
    id: "cursor",
    kind: "host",
    form: "extension",
    adapter: VSCODE_FAMILY_ADAPTER,
    status: "COMPATIBLE",
    evidenceUrl: "https://cursor.com/docs/skills",
    claim: "Cursor is a VS Code-compatible host. Same companion. Not cursor/editor@1.",
  }),
  Object.freeze({
    id: "windsurf",
    kind: "host",
    form: "extension",
    adapter: VSCODE_FAMILY_ADAPTER,
    status: "COMPATIBLE",
    evidenceUrl: "https://docs.devin.ai/desktop/cascade/skills",
    claim: "Windsurf is a VS Code-compatible host. Same companion. Not a modeled reality.",
  }),
  Object.freeze({
    id: "kiro",
    kind: "host",
    form: "extension",
    adapter: VSCODE_FAMILY_ADAPTER,
    status: "COMPATIBLE",
    evidenceUrl: "https://kiro.dev/docs/upgrade-guides/migrating-from-vscode/",
    claim: "Kiro is a VS Code-compatible host via Open VSX. Same companion.",
  }),
  Object.freeze({
    id: "antigravity",
    kind: "host",
    form: "extension",
    adapter: VSCODE_FAMILY_ADAPTER,
    status: "COMPATIBLE",
    evidenceUrl: "https://antigravity.google/docs/mcp",
    claim: "Antigravity IDE is a VS Code-compatible host. Same companion.",
  }),
  Object.freeze({
    id: "codex-ide",
    kind: "host",
    form: "extension",
    adapter: VSCODE_FAMILY_ADAPTER,
    status: "COMPATIBLE",
    evidenceUrl: "https://learn.chatgpt.com/codex/ide",
    claim: "Codex IDE extension is a VS Code-compatible host. Same companion plus .agents/skills and .codex/config.toml.",
  }),
  Object.freeze({
    id: "continue",
    kind: "host",
    form: "extension",
    adapter: VSCODE_FAMILY_ADAPTER,
    status: "COMPATIBLE",
    evidenceUrl: "https://docs.continue.dev/customize/deep-dives/mcp",
    claim: "Continue on VS Code uses the same companion plus .continue/mcpServers.",
  }),
  Object.freeze({
    id: "cline",
    kind: "host",
    form: "extension",
    adapter: VSCODE_FAMILY_ADAPTER,
    status: "COMPATIBLE",
    evidenceUrl: "https://docs.cline.bot/mcp/mcp-overview",
    claim: "Cline on VS Code uses the same companion. MCP is user-level; a paste snippet ships under discovery/.",
  }),
  Object.freeze({
    id: "trae",
    kind: "host",
    form: "extension",
    adapter: VSCODE_FAMILY_ADAPTER,
    status: "COMPATIBLE",
    evidenceUrl: "https://code.visualstudio.com/api",
    claim: "Trae is a VS Code-compatible host. Same companion. Not a modeled reality.",
  }),
  Object.freeze({
    id: "claude-desktop",
    kind: "host",
    form: "desktop",
    adapter: "mcp-stdio",
    status: "DISCOVERABLE",
    evidenceUrl: "https://modelcontextprotocol.io/docs/develop/connect-local-servers",
    claim: "Claude Desktop loads user claude_desktop_config.json. Project .mcp.json is the shareable Claude Code form.",
  }),
  Object.freeze({
    id: "codex-desktop",
    kind: "host",
    form: "desktop",
    adapter: "mcp-stdio",
    status: "DISCOVERABLE",
    evidenceUrl: "https://learn.chatgpt.com/codex/extend/mcp",
    claim: "ChatGPT desktop, Codex CLI, and the IDE extension share .codex/config.toml MCP.",
  }),
  Object.freeze({
    id: "zed",
    kind: "host",
    form: "desktop",
    adapter: "mcp-stdio",
    status: "DISCOVERABLE",
    evidenceUrl: "https://zed.dev/docs/ai/mcp",
    claim: "Zed MCP is context_servers in settings. A paste snippet ships under discovery/.",
  }),
]);

export const SKILL_SURFACES: readonly SkillSurface[] = Object.freeze([
  Object.freeze({
    id: "codex",
    kind: "skill",
    form: "skill",
    path: ".agents/skills/ruleblast/SKILL.md",
    status: "DISCOVERABLE",
    evidenceUrl: "https://learn.chatgpt.com/codex/build-skills",
    claim: "Codex repo skills load from .agents/skills/<name>/SKILL.md.",
  }),
  Object.freeze({
    id: "claude-code",
    kind: "skill",
    form: "skill",
    path: ".claude/skills/ruleblast/SKILL.md",
    status: "DISCOVERABLE",
    evidenceUrl: "https://code.claude.com/docs/en/skills",
    claim: "Claude Code project skills live at .claude/skills/<name>/SKILL.md.",
  }),
  Object.freeze({
    id: "cursor",
    kind: "skill",
    form: "skill",
    path: ".cursor/skills/ruleblast/SKILL.md",
    status: "DISCOVERABLE",
    evidenceUrl: "https://cursor.com/docs/skills",
    claim: "Cursor loads project skills from .cursor/skills/<name>/SKILL.md.",
  }),
  Object.freeze({
    id: "windsurf",
    kind: "skill",
    form: "skill",
    path: ".windsurf/skills/ruleblast/SKILL.md",
    status: "DISCOVERABLE",
    evidenceUrl: "https://docs.devin.ai/desktop/cascade/skills",
    claim: "Windsurf Cascade loads workspace skills from .windsurf/skills/<name>/SKILL.md.",
  }),
  Object.freeze({
    id: "kiro",
    kind: "skill",
    form: "skill",
    path: ".kiro/skills/ruleblast/SKILL.md",
    status: "DISCOVERABLE",
    evidenceUrl: "https://kiro.dev/docs/skills",
    claim: "Kiro loads workspace Agent Skills from .kiro/skills/<name>/SKILL.md.",
  }),
]);

export const MCP_CONFIG_SURFACES: readonly McpConfigSurface[] = Object.freeze([
  Object.freeze({
    id: "claude-code",
    kind: "mcp",
    form: "mcp-stdio",
    path: ".mcp.json",
    format: "mcpServers",
    status: "DISCOVERABLE",
    evidenceUrl: "https://code.claude.com/docs/en/mcp",
    claim: "Claude Code project MCP is .mcp.json. Copilot Agent Host also reads a workspace .mcp.json.",
  }),
  Object.freeze({
    id: "vscode-copilot",
    kind: "mcp",
    form: "mcp-stdio",
    path: ".vscode/mcp.json",
    format: "vscodeServers",
    status: "DISCOVERABLE",
    evidenceUrl: "https://code.visualstudio.com/docs/copilot/customization/mcp-servers",
    claim: "GitHub Copilot in VS Code workspace MCP is .vscode/mcp.json servers.",
  }),
  Object.freeze({
    id: "codex",
    kind: "mcp",
    form: "mcp-stdio",
    path: ".codex/config.toml",
    format: "codexToml",
    status: "DISCOVERABLE",
    evidenceUrl: "https://learn.chatgpt.com/codex/extend/mcp",
    claim: "ChatGPT desktop, Codex CLI, and Codex IDE share project .codex/config.toml.",
  }),
  Object.freeze({
    id: "cursor",
    kind: "mcp",
    form: "mcp-stdio",
    path: ".cursor/mcp.json",
    format: "mcpServers",
    status: "DISCOVERABLE",
    evidenceUrl: "https://cursor.com/docs",
    claim: "Cursor workspace MCP uses mcpServers command/args stdio.",
  }),
  Object.freeze({
    id: "kiro",
    kind: "mcp",
    form: "mcp-stdio",
    path: ".kiro/settings/mcp.json",
    format: "mcpServers",
    status: "DISCOVERABLE",
    evidenceUrl: "https://kiro.dev/docs/mcp/configuration/",
    claim: "Kiro workspace MCP is .kiro/settings/mcp.json.",
  }),
  Object.freeze({
    id: "antigravity",
    kind: "mcp",
    form: "mcp-stdio",
    path: ".agents/mcp_config.json",
    format: "mcpServers",
    status: "DISCOVERABLE",
    evidenceUrl: "https://antigravity.google/docs/mcp",
    claim: "Antigravity workspace MCP is .agents/mcp_config.json.",
  }),
  Object.freeze({
    id: "continue",
    kind: "mcp",
    form: "mcp-stdio",
    path: ".continue/mcpServers/ruleblast.json",
    format: "mcpServers",
    status: "DISCOVERABLE",
    evidenceUrl: "https://docs.continue.dev/customize/deep-dives/mcp",
    claim: "Continue loads JSON MCP files from .continue/mcpServers/.",
  }),
]);

export const MCP_SNIPPET_SURFACES: readonly McpConfigSurface[] = Object.freeze([
  Object.freeze({
    id: "claude-desktop",
    kind: "mcp",
    form: "mcp-stdio",
    path: "discovery/claude-desktop.mcp.json",
    format: "mcpServers",
    status: "DISCOVERABLE",
    evidenceUrl: "https://modelcontextprotocol.io/docs/develop/connect-local-servers",
    claim: "Paste into Claude Desktop user claude_desktop_config.json.",
  }),
  Object.freeze({
    id: "cline",
    kind: "mcp",
    form: "mcp-stdio",
    path: "discovery/cline.mcp.json",
    format: "mcpServers",
    status: "DISCOVERABLE",
    evidenceUrl: "https://docs.cline.bot/mcp/mcp-overview",
    claim: "Paste into Cline MCP settings JSON.",
  }),
  Object.freeze({
    id: "zed",
    kind: "mcp",
    form: "mcp-stdio",
    path: "discovery/zed-context-servers.json",
    format: "zedContext",
    status: "DISCOVERABLE",
    evidenceUrl: "https://zed.dev/docs/ai/mcp",
    claim: "Merge context_servers into Zed settings.",
  }),
]);

export function vscodeFamilyHosts(): readonly HostSurface[] {
  return Object.freeze(HOST_SURFACES.filter((surface) => surface.adapter === VSCODE_FAMILY_ADAPTER));
}

export function hostAdapterPaths(): readonly string[] {
  return Object.freeze([
    ...new Set(
      HOST_SURFACES
        .filter((surface) => surface.adapter === VSCODE_FAMILY_ADAPTER)
        .map((surface) => surface.adapter),
    ),
  ]);
}

export function skillPaths(): readonly string[] {
  return Object.freeze(SKILL_SURFACES.map((surface) => surface.path));
}

export function mcpConfigPaths(): readonly string[] {
  return Object.freeze(MCP_CONFIG_SURFACES.map((surface) => surface.path));
}

export function mcpSnippetPaths(): readonly string[] {
  return Object.freeze(MCP_SNIPPET_SURFACES.map((surface) => surface.path));
}

export function invokesRuleblastMcp(text: string, format: McpConfigFormat): boolean {
  if (!text.includes("--mcp")) return false;
  if (format === "codexToml") {
    return text.includes("[mcp_servers.ruleblast]") &&
      text.includes("ruleblast@2.2.0") &&
      text.includes("--mcp");
  }
  if (format === "vscodeServers") {
    return text.includes('"servers"') && text.includes('"ruleblast"');
  }
  if (format === "zedContext") {
    return text.includes("context_servers") && text.includes("ruleblast");
  }
  return text.includes("mcpServers") && text.includes("ruleblast");
}
