import { resolveAgentAllow } from "./domain/agent-allow.js";
import { attentionPaths } from "./domain/attention-paths.js";
import { renderWitness, witnessForProjection } from "./domain/witness.js";
import { packWitnessHint } from "./packs/witness-hints.js";
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
  readonly pathsOnly: boolean;
  readonly witness: boolean;
}

export function mcpPresentationFlags(
  params: Record<string, unknown>,
): McpPresentationFlags {
  return Object.freeze({
    detail: params.detail === true,
    index: params.index === true,
    receipt: params.receipt === true,
    compare: params.compare === true,
    pathsOnly: params.pathsOnly === true,
    witness: params.witness === true,
  });
}

export class McpInvalidParamsError extends TypeError {
  readonly code = -32602 as const;
  constructor(message: string) {
    super(message);
    this.name = "McpInvalidParamsError";
  }
}

export function assertMcpPresentation(
  flags: McpPresentationFlags,
  action: "scan" | "diff" | "explain" | "case",
): void {
  if (flags.compare && action !== "explain") {
    throw new McpInvalidParamsError("compare applies only to explain");
  }
  if (flags.pathsOnly && action === "explain") {
    throw new McpInvalidParamsError("pathsOnly cannot be used with explain");
  }
  const exclusive = [
    flags.index,
    flags.receipt,
    flags.detail,
    flags.compare,
    flags.pathsOnly,
    flags.witness,
  ].filter(Boolean).length;
  if (exclusive > 1) {
    throw new McpInvalidParamsError(
      "detail, index, receipt, compare, pathsOnly, and witness cannot combine",
    );
  }
}

export function mcpPathsOnlyText(
  result: CurrentRuleBlastResult | DiffRuleBlastResult,
): string {
  const paths = attentionPaths(result);
  return paths.length === 0 ? "" : `${paths.join("\n")}\n`;
}

export function mcpWitnessText(
  result: CurrentRuleBlastResult | DiffRuleBlastResult | ExplainResult,
): string {
  const projections = "analysisMode" in result
    ? ("projections" in result.path ? result.path.projections : [...result.path.before, ...result.path.after])
    : result.mode === "current"
      ? result.paths.flatMap((path) => path.projections)
      : result.paths.flatMap((path) => [...path.before, ...path.after]);
  return renderWitness(projections.map((projection) =>
    witnessForProjection(projection, packWitnessHint),
  ));
}

const MCP_TOOL_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

export const MCP_TOOLS = Object.freeze([
  Object.freeze({
    name: "scan",
    description:
      "Current instruction stacks. Same as ruleblast [path]. Ask the human before running.",
    annotations: MCP_TOOL_ANNOTATIONS,
    inputSchema: {
      type: "object",
      properties: {
        startPath: { type: "string" },
        realities: { type: "array", items: { type: "string" } },
        detail: { type: "boolean" },
        index: { type: "boolean" },
        receipt: { type: "boolean" },
        pathsOnly: { type: "boolean" },
        witness: { type: "boolean" },
      },
    },
  }),
  Object.freeze({
    name: "diff",
    description:
      "Which tracked stacks moved. Same as ruleblast diff [base]. Ask the human before running.",
    annotations: MCP_TOOL_ANNOTATIONS,
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
        pathsOnly: { type: "boolean" },
        witness: { type: "boolean" },
      },
    },
  }),
  Object.freeze({
    name: "explain",
    description:
      "Why one path inherited this stack. Same as ruleblast explain <path>. Ask the human first.",
    annotations: MCP_TOOL_ANNOTATIONS,
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
        witness: { type: "boolean" },
      },
    },
  }),
  Object.freeze({
    name: "case",
    description:
      "Packaged 33→106 teaching receipt. Same as ruleblast case. Ask the human first.",
    annotations: MCP_TOOL_ANNOTATIONS,
    inputSchema: {
      type: "object",
      properties: {
        explainPath: { type: "string" },
        detail: { type: "boolean" },
        index: { type: "boolean" },
        receipt: { type: "boolean" },
        pathsOnly: { type: "boolean" },
        witness: { type: "boolean" },
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
