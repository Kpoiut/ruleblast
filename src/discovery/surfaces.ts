import { advertisedPackage } from "../package-identity.js";
import {
  HOST_SURFACES,
  MCP_CONFIG_SURFACES,
  MCP_SNIPPET_SURFACES,
  SKILL_SURFACES,
} from "./catalog.js";

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

export {
  HOST_SURFACES,
  MCP_CONFIG_SURFACES,
  MCP_SNIPPET_SURFACES,
  SKILL_SURFACES,
};

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
  if (!text.includes(advertisedPackage())) return false;
  if (format === "codexToml") {
    return text.includes("[mcp_servers.ruleblast]") && text.includes("--mcp");
  }
  if (format === "vscodeServers") {
    return text.includes('"servers"') && text.includes('"ruleblast"');
  }
  if (format === "zedContext") {
    return text.includes("context_servers") && text.includes("ruleblast");
  }
  return text.includes("mcpServers") && text.includes("ruleblast");
}
