import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_SKILL_PATH,
  HOST_SURFACES,
  MCP_CONFIG_SURFACES,
  MCP_SNIPPET_SURFACES,
  SKILL_SURFACES,
  VSCODE_FAMILY_ADAPTER,
  hostAdapterPaths,
  invokesRuleblastMcp,
  mcpConfigPaths,
  mcpSnippetPaths,
  skillPaths,
  vscodeFamilyHosts,
} from "../src/discovery/surfaces.js";
import { MCP_TOOL_NAMES } from "../src/mcp-stdio.js";
import { advertisedPackage } from "../src/package-identity.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path: string): string =>
  readFileSync(join(repositoryRoot, path), "utf8");

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

describe("compatible host catalog", () => {
  it("keeps one VS Code-family adapter for every compatible editor", () => {
    expect(hostAdapterPaths()).toEqual([VSCODE_FAMILY_ADAPTER]);
    expect(vscodeFamilyHosts().map((surface) => surface.id)).toEqual([
      "vscode",
      "vscode-copilot",
      "cursor",
      "windsurf",
      "kiro",
      "antigravity",
      "codex-ide",
      "continue",
      "cline",
      "trae",
      "vscodium",
      "roo-code",
    ]);
    expect(HOST_SURFACES.map((surface) => surface.id)).toContain("claude-desktop");
    expect(HOST_SURFACES.map((surface) => surface.id)).toContain("codex-desktop");
    expect(HOST_SURFACES.map((surface) => surface.id)).toContain("jetbrains");
    expect(HOST_SURFACES.map((surface) => surface.id)).toContain("visual-studio");
    expect(HOST_SURFACES.map((surface) => surface.id)).toContain("neovim");
    expect(HOST_SURFACES.find((surface) => surface.id === "jetbrains")?.adapter).toBe("mcp-stdio");
    expect(HOST_SURFACES.find((surface) => surface.id === "visual-studio")?.adapter).toBe("mcp-stdio");
    expect(HOST_SURFACES.find((surface) => surface.id === "neovim")?.adapter).toBe("mcp-stdio");
    expect(HOST_SURFACES.find((surface) => surface.id === "vscodium")?.status).toBe("COMPATIBLE");
    expect(HOST_SURFACES.find((surface) => surface.id === "roo-code")?.status).toBe("COMPATIBLE");
    expect(HOST_SURFACES.find((surface) => surface.id === "vscode")?.status).toBe("HOSTED");
    expect(vscodeFamilyHosts().filter((surface) => surface.id !== "vscode").every(
      (surface) => surface.status === "COMPATIBLE",
    )).toBe(true);
    expect(HOST_SURFACES.find((surface) => surface.id === "claude-desktop")?.adapter).toBe("mcp-stdio");
    expect(existsSync(join(repositoryRoot, "hosts/cursor"))).toBe(false);
    expect(existsSync(join(repositoryRoot, "hosts/windsurf"))).toBe(false);
    expect(existsSync(join(repositoryRoot, "hosts/kiro"))).toBe(false);
    expect(existsSync(join(repositoryRoot, "hosts/antigravity"))).toBe(false);
    const hostSources = walk(join(repositoryRoot, "hosts")).filter((path) =>
      path.endsWith(".ts"),
    );
    expect(hostSources.every((path) => path.includes(`${join("hosts", "vscode")}`))).toBe(true);
  });

  it("ships one canonical skill body at every official discovery path", () => {
    const canonical = read(CANONICAL_SKILL_PATH);
    expect(canonical).toMatch(/^---\r?\nname: ruleblast\r?\n/u);
    expect(canonical).toContain("There is no `ruleblast scan` subcommand");
    expect(canonical).toContain(".cursor/skills");
    expect(canonical).toContain(".windsurf/skills");
    expect(canonical).toContain(".kiro/skills");
    expect(canonical).toContain("Claude Desktop");
    expect(canonical).toContain(".vscode/mcp.json");
    expect(canonical).toContain(".codex/config.toml");
    expect(canonical).toContain("ruleblast@2.5.11 --mcp");
    expect(canonical).toContain("WORK MAP");
    expect(canonical).toContain("not actor telemetry");
    expect(canonical).not.toMatch(/cursor\/editor@1/u);
    for (const path of skillPaths()) {
      expect(read(path), path).toBe(canonical);
    }
    expect(SKILL_SURFACES.map((surface) => surface.path)).toEqual([
      ".agents/skills/ruleblast/SKILL.md",
      ".claude/skills/ruleblast/SKILL.md",
      ".cursor/skills/ruleblast/SKILL.md",
      ".windsurf/skills/ruleblast/SKILL.md",
      ".kiro/skills/ruleblast/SKILL.md",
    ]);
  });

  it("ships one stdio MCP config shape and exactly the four public tools", () => {
    expect([...MCP_TOOL_NAMES]).toEqual(["scan", "diff", "explain", "case"]);
    expect(mcpConfigPaths()).toEqual([
      ".mcp.json",
      ".vscode/mcp.json",
      ".codex/config.toml",
      ".cursor/mcp.json",
      ".kiro/settings/mcp.json",
      ".agents/mcp_config.json",
      ".continue/mcpServers/ruleblast.json",
    ]);
    expect(mcpSnippetPaths()).toEqual([
      "discovery/claude-desktop.mcp.json",
      "discovery/cline.mcp.json",
      "discovery/zed-context-servers.json",
      "discovery/jetbrains.mcp.json",
      "discovery/visual-studio.mcp.json",
      "discovery/neovim.mcp.json",
      "discovery/windsurf.mcp.json",
      "discovery/roo-code.mcp.json",
    ]);
    for (const surface of [...MCP_CONFIG_SURFACES, ...MCP_SNIPPET_SURFACES]) {
      const text = read(surface.path);
      expect(invokesRuleblastMcp(text, surface.format), surface.path).toBe(true);
      expect(text).toContain(advertisedPackage());
      expect(text).not.toMatch(/ruleblast@2\.4\./u);
      expect(text).not.toMatch(/autoApprove/u);
    }
    expect(read("src/mcp-stdio.ts")).not.toMatch(/from ["'].*profiles\//u);
    const descriptor = JSON.parse(read("package.json")) as {
      readonly files?: readonly string[];
    };
    expect(descriptor.files ?? []).not.toContain("hosts");
    expect(descriptor.files ?? []).not.toContain("discovery");
  });
});
