import { resolveAgentAllow } from "./domain/agent-allow.js";
import type { ExplainResult } from "./cli-output.js";
import type {
  CurrentRuleBlastResult,
  DiffRuleBlastResult,
} from "./model.js";
import {
  receiptForCurrent,
  receiptForDiff,
  receiptForExplain,
} from "./render-receipt.js";

export interface McpPresentationFlags {
  readonly detail: boolean;
  readonly index: boolean;
  readonly receipt: boolean;
  readonly compare: boolean;
}

export function mcpPresentationFlags(
  params: Record<string, unknown>,
): McpPresentationFlags {
  return Object.freeze({
    detail: params.detail === true,
    index: params.index === true,
    receipt: params.receipt === true,
    compare: params.compare === true,
  });
}

export function assertMcpPresentation(
  flags: McpPresentationFlags,
  action: "scan" | "diff" | "explain" | "case",
): void {
  if (flags.compare && action !== "explain") {
    throw new TypeError("compare applies only to explain");
  }
  const exclusive = [flags.index, flags.receipt, flags.detail, flags.compare]
    .filter(Boolean).length;
  if (exclusive > 1) {
    throw new TypeError("detail, index, receipt, and compare cannot combine");
  }
}

export const MCP_TOOLS = Object.freeze([
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
        receipt: { type: "boolean" },
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
        receipt: { type: "boolean" },
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
        receipt: { type: "boolean" },
        compare: { type: "boolean" },
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
        receipt: { type: "boolean" },
      },
    },
  }),
]);

function allowOf(host: {
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}): "yes" | "ask" {
  return resolveAgentAllow({ env: host.env, cwd: host.cwd }) === "yes" ? "yes" : "ask";
}

export async function mcpReceiptText(
  result: CurrentRuleBlastResult | DiffRuleBlastResult | ExplainResult,
  host: {
    readonly cwd: string;
    readonly env: Readonly<Record<string, string | undefined>>;
  },
): Promise<string> {
  const allow = allowOf(host);
  if ("analysisMode" in result) {
    return (await receiptForExplain(result, allow)).markdown;
  }
  if (result.mode === "current") {
    return (await receiptForCurrent(result, allow)).markdown;
  }
  return (await receiptForDiff(result, allow)).markdown;
}
