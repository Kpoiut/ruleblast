import type { Readable, Writable } from "node:stream";
import { resolveAgentAllow } from "./domain/agent-allow.js";
import {
  diffRepository,
  diffRepositoryWithAdjunct,
  explainRepository,
  presentExplain,
  scanRepository,
} from "./application/authority.js";
import { isOptInReality, optInRealityIds } from "./application/profile-catalog.js";
import {
  currentHostProcess,
  hostProcessDialect,
  hostTextContext,
  type HostProcess,
} from "./application/host-process.js";
import { publicRealityRefusal } from "./application/runtime-surfaces.js";
import {
  OVERLAY_UNAVAILABLE,
  renderBlastOverlay,
} from "./application/blast-overlay.js";
import { adjunctRenderContext } from "./application/overlay-tree.js";
import { replayMetricsFromResult } from "./application/replay.js";
import {
  findRepositoryRoot,
  openGitSnapshot,
  openPackagedCase,
  openTrackedWorktree,
  packagedCasePresentation,
  probeGitStorageFormat,
} from "./application/repository.js";
import { explainExistingResult } from "./cli-output.js";
import { renderResultIndex } from "./application/result-index.js";
import { canonicalJson } from "./canonical.js";
import { packageVersion } from "./package-identity.js";
import { renderDetail } from "./render-detail.js";
import {
  isGitObjectSnapshot,
  isWorktreeIdentitySource,
} from "./snapshot.js";
import {
  asJsonRpcRequest,
  consumeMcpBuffer,
  encodeMcpFrame,
  isJsonRpcParseError,
  MCP_PROTOCOL_VERSION,
  type JsonRpcMessage,
  type JsonRpcRequest,
} from "./mcp-protocol.js";

export const MCP_TOOL_NAMES = Object.freeze(["scan", "diff", "explain", "case"]);

export interface McpHost {
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform?: string;
}

function mcpHostProcess(host: McpHost): HostProcess {
  return currentHostProcess(
    host.platform === undefined
      ? { cwd: host.cwd, env: host.env }
      : { cwd: host.cwd, env: host.env, platform: host.platform },
  );
}

const ALLOWED = optInRealityIds();

const TOOLS = Object.freeze([
  Object.freeze({
    name: "scan",
    description:
      "Current instruction stacks. Same as ruleblast [path]. Ask the human before running.",
    inputSchema: {
      type: "object",
      properties: {
        startPath: { type: "string" },
        realities: { type: "array", items: { type: "string" } },
        detail: { type: "boolean" },
        index: { type: "boolean" },
      },
    },
  }),
  Object.freeze({
    name: "diff",
    description:
      "Which tracked stacks moved. Same as ruleblast diff [base]. Ask the human before running.",
    inputSchema: {
      type: "object",
      properties: {
        base: { type: "string" },
        to: { type: "string" },
        startPath: { type: "string" },
        realities: { type: "array", items: { type: "string" } },
        detail: { type: "boolean" },
        index: { type: "boolean" },
      },
    },
  }),
  Object.freeze({
    name: "explain",
    description:
      "Why one path inherited this stack. Same as ruleblast explain <path>. Ask the human first.",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        startPath: { type: "string" },
        realities: { type: "array", items: { type: "string" } },
        detail: { type: "boolean" },
      },
    },
  }),
  Object.freeze({
    name: "case",
    description:
      "Packaged 33→106 teaching receipt. Same as ruleblast case. Ask the human first.",
    inputSchema: {
      type: "object",
      properties: {
        explainPath: { type: "string" },
        detail: { type: "boolean" },
        index: { type: "boolean" },
      },
    },
  }),
]);

function objectParams(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringField(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

function wantsDetail(params: Record<string, unknown>): boolean {
  return params.detail === true;
}

function wantsIndex(params: Record<string, unknown>): boolean {
  return params.index === true;
}

function realitiesOf(params: Record<string, unknown>): readonly string[] {
  const value = params.realities;
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TypeError("realities must be an array of strings");
  }
  const unique = [...new Set(value as string[])].sort();
  for (const id of unique) {
    if (id === "all" || !isOptInReality(id)) {
      throw new TypeError(publicRealityRefusal(id));
    }
  }
  return unique;
}

function toolResult(text: string, isError = false): unknown {
  return { content: [{ type: "text", text }], isError };
}

function ok(id: string | number | null, result: unknown): JsonRpcMessage {
  return { jsonrpc: "2.0", id, result };
}

function fail(id: string | number | null, code: number, message: string): JsonRpcMessage {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function withDetail(
  payload: Record<string, unknown>,
  params: Record<string, unknown>,
  result: Parameters<typeof renderDetail>[0],
  context?: Parameters<typeof renderDetail>[1],
): Promise<Record<string, unknown>> {
  if (!wantsDetail(params)) return payload;
  return { ...payload, text: await renderDetail(result, context, false) };
}

async function runScan(host: McpHost, params: Record<string, unknown>): Promise<string> {
  const start = stringField(params, "startPath") ?? host.cwd;
  const root = await findRepositoryRoot(start);
  const snapshot = await openTrackedWorktree(root);
  const result = await scanRepository({ snapshot, realities: realitiesOf(params) });
  if (wantsIndex(params)) return renderResultIndex(result);
  return canonicalJson(await withDetail({
    metrics: replayMetricsFromResult(result),
    result,
  }, params, result, hostTextContext(mcpHostProcess(host), {
    currentLabel: "WORKTREE",
    caseLabel: null,
  })));
}

async function runDiff(host: McpHost, params: Record<string, unknown>): Promise<string> {
  const start = stringField(params, "startPath") ?? host.cwd;
  const root = await findRepositoryRoot(start);
  const base = stringField(params, "base") ?? "HEAD";
  const to = stringField(params, "to") ?? "WORKTREE";
  const before = await openGitSnapshot(root, base);
  const after = to === "WORKTREE" ? await openTrackedWorktree(root) : await openGitSnapshot(root, to);
  const realities = realitiesOf(params);
  const admitOverlay = isGitObjectSnapshot(before) &&
    (isGitObjectSnapshot(after) || isWorktreeIdentitySource(after));
  const pair = admitOverlay
    ? await diffRepositoryWithAdjunct({
        before,
        after,
        realities,
        format: await probeGitStorageFormat(root),
      })
    : {
        result: await diffRepository({ before, after, realities }),
        overlay: null,
        unavailable: false,
      };
  const payload: Record<string, unknown> = {
    metrics: replayMetricsFromResult(pair.result),
    result: pair.result,
  };
  if (pair.unavailable) payload.overlay = OVERLAY_UNAVAILABLE;
  else if (pair.overlay !== null) {
    payload.overlay = renderBlastOverlay(
      pair.overlay,
      adjunctRenderContext(pair.result),
    );
  }
  if (wantsIndex(params)) {
    return renderResultIndex(pair.result, {
      overlay: pair.overlay,
      from: base,
      to: to === "WORKTREE" ? "WORKTREE" : to,
    });
  }
  return canonicalJson(await withDetail(payload, params, pair.result, hostTextContext(mcpHostProcess(host), {
    beforeLabel: base,
    afterLabel: to === "WORKTREE" ? "WORKTREE" : to,
    caseLabel: null,
  })));
}

async function runExplain(host: McpHost, params: Record<string, unknown>): Promise<string> {
  const path = stringField(params, "path");
  if (path === undefined) throw new TypeError("explain requires path");
  const start = stringField(params, "startPath") ?? host.cwd;
  const root = await findRepositoryRoot(start);
  const from = stringField(params, "from");
  const to = stringField(params, "to") ?? "WORKTREE";
  const realities = realitiesOf(params);
  if (from === undefined) {
    const snapshot = await openTrackedWorktree(root);
    const explained = await explainRepository({ snapshot, path, realities });
    if (wantsDetail(params)) {
      return renderDetail(explained.explain, hostTextContext(mcpHostProcess(host), {
        currentLabel: "WORKTREE",
        caseLabel: null,
      }), false);
    }
    return presentExplain(explained.explain, hostProcessDialect(mcpHostProcess(host)));
  }
  const before = await openGitSnapshot(root, from);
  const after = to === "WORKTREE" ? await openTrackedWorktree(root) : await openGitSnapshot(root, to);
  const explained = await explainRepository({ before, after, path, realities });
  if (wantsDetail(params)) {
    return renderDetail(explained.explain, hostTextContext(mcpHostProcess(host), {
      beforeLabel: from,
      afterLabel: to === "WORKTREE" ? "WORKTREE" : to,
      caseLabel: null,
    }), false);
  }
  return presentExplain(explained.explain, hostProcessDialect(mcpHostProcess(host)));
}

async function runCase(host: McpHost, params: Record<string, unknown>): Promise<string> {
  const result = await openPackagedCase();
  const explainPath = stringField(params, "explainPath");
  if (explainPath === undefined) {
    const presentation = packagedCasePresentation();
    if (wantsIndex(params)) {
      return renderResultIndex(result, {
        from: presentation.beforeLabel,
        to: presentation.afterLabel,
      });
    }
    return canonicalJson(await withDetail({
      metrics: replayMetricsFromResult(result),
      result,
    }, params, result, hostTextContext(mcpHostProcess(host), {
      beforeLabel: presentation.beforeLabel,
      afterLabel: presentation.afterLabel,
      caseLabel: presentation.label,
    })));
  }
  const { explain } = explainExistingResult(result, explainPath);
  const presentation = packagedCasePresentation();
  if (wantsDetail(params)) {
    return renderDetail(explain, hostTextContext(mcpHostProcess(host), {
      beforeLabel: presentation.beforeLabel,
      afterLabel: presentation.afterLabel,
      caseLabel: presentation.label,
    }), false);
  }
  return presentExplain(explain, hostProcessDialect(mcpHostProcess(host)));
}

async function callTool(host: McpHost, params: Record<string, unknown>): Promise<unknown> {
  const name = stringField(params, "name");
  const args = objectParams(params.arguments);
  if (name === undefined || !MCP_TOOL_NAMES.includes(name)) {
    return toolResult(`Unknown tool: ${JSON.stringify(name)}`, true);
  }
  if (resolveAgentAllow({ env: host.env, cwd: host.cwd }) !== "yes") {
    return toolResult(
      "ASK: set RULEBLAST_AGENT_ALLOW=yes or create .ruleblast-allow containing yes.",
      true,
    );
  }
  if (name === "scan") return toolResult(await runScan(host, args));
  if (name === "diff") return toolResult(await runDiff(host, args));
  if (name === "explain") return toolResult(await runExplain(host, args));
  return toolResult(await runCase(host, args));
}

export async function dispatchMcpRequest(
  request: JsonRpcRequest,
  host: McpHost,
): Promise<JsonRpcMessage | null> {
  if (request.id === null && request.method.startsWith("notifications/")) return null;
  const id = request.id;
  try {
    if (request.method === "initialize") {
      return ok(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "ruleblast", version: packageVersion() },
      });
    }
    if (request.method === "ping") return ok(id, {});
    if (request.method === "tools/list") return ok(id, { tools: TOOLS });
    if (request.method === "tools/call") return ok(id, await callTool(host, objectParams(request.params)));
    return fail(id, -32601, `Method not found: ${request.method}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "MCP tool failed";
    if (request.method === "tools/call") return ok(id, toolResult(message, true));
    return fail(id, -32000, message);
  }
}

export async function serveMcpStdio(
  stdin: Readable,
  stdout: Writable,
  host: McpHost,
): Promise<number> {
  let buffer = "";
  const write = (message: JsonRpcMessage): void => {
    stdout.write(encodeMcpFrame(message));
  };
  stdin.setEncoding("utf8");
  for await (const chunk of stdin) {
    buffer += typeof chunk === "string" ? chunk : String(chunk);
    const consumed = consumeMcpBuffer(buffer);
    buffer = consumed.rest;
    for (const raw of consumed.messages) {
      if (isJsonRpcParseError(raw)) {
        write(raw);
        continue;
      }
      const request = asJsonRpcRequest(raw);
      if (request === null) continue;
      const response = await dispatchMcpRequest(request, host);
      if (response !== null) write(response);
    }
  }
  return 0;
}
