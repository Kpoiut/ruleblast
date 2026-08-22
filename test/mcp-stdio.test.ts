import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  asJsonRpcRequest,
  consumeMcpBuffer,
  encodeMcpFrame,
} from "../src/mcp-protocol.js";
import { dispatchMcpRequest, MCP_TOOL_NAMES } from "../src/mcp-stdio.js";

const host = {
  cwd: process.cwd(),
  env: { RULEBLAST_AGENT_ALLOW: "yes" },
};

describe("MCP stdio transport", () => {
  it("frames and parses Content-Length messages", () => {
    const frame = encodeMcpFrame({ jsonrpc: "2.0", id: 1, method: "ping" });
    const { messages, rest } = consumeMcpBuffer(frame);
    expect(rest).toBe("");
    expect(asJsonRpcRequest(messages[0])).toMatchObject({ method: "ping", id: 1 });
  });

  it("returns a JSON-RPC parse error instead of throwing on invalid frames", () => {
    const frame = `Content-Length: 12\r\n\r\n{not-json!!!`;
    expect(() => consumeMcpBuffer(frame)).not.toThrow();
    const { messages } = consumeMcpBuffer(frame);
    expect(messages).toEqual([{
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    }]);
  });

  it("lists exactly the four public actions and serves the packaged case", async () => {
    const listed = await dispatchMcpRequest(
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      host,
    );
    expect(listed).toMatchObject({ jsonrpc: "2.0", id: 1 });
    const tools = (listed as { result: { tools: readonly { name: string }[] } }).result.tools;
    expect(tools.map((tool) => tool.name)).toEqual([...MCP_TOOL_NAMES]);

    const called = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "case", arguments: {} },
    }, host);
    const text = (called as { result: { content: readonly { text: string }[]; isError?: boolean } })
      .result;
    expect(text.isError).not.toBe(true);
    const payload = JSON.parse(text.content[0]!.text) as {
      metrics: { mode: string; candidatePathCount: number; changedStackPathCount: number };
    };
    expect(payload.metrics.mode).toBe("diff");
    expect(payload.metrics.candidatePathCount).toBe(106);
    expect(payload.metrics.changedStackPathCount).toBe(106);
  });

  it("returns the compact result index for the packaged case", async () => {
    const called = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "case", arguments: { index: true } },
    }, host);
    const text = (called as { result: { content: readonly { text: string }[]; isError?: boolean } })
      .result;
    expect(text.isError).not.toBe(true);
    expect(text.content[0]!.text.startsWith("# ruleblast.index v1\n")).toBe(true);
    expect(text.content[0]!.text).toContain("MODE\tdiff\n");
    expect(text.content[0]!.text).toContain("CONTINUE\t");
  });

  it("lists detail as an optional presentation flag on the four tools", async () => {
    const listed = await dispatchMcpRequest(
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      host,
    );
    const tools = (listed as {
      result: { tools: readonly { name: string; inputSchema: { properties?: Record<string, unknown> } }[] };
    }).result.tools;
    for (const tool of tools) {
      expect(tool.inputSchema.properties).toMatchObject({
        detail: { type: "boolean" },
      });
    }
    for (const tool of tools.filter((item) => item.name !== "explain")) {
      expect(tool.inputSchema.properties).toMatchObject({
        index: { type: "boolean" },
      });
    }
  });

  it("returns detailed human text for the packaged case when requested", async () => {
    const called = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "case", arguments: { detail: true } },
    }, host);
    const text = (called as { result: { content: readonly { text: string }[] } }).result;
    const payload = JSON.parse(text.content[0]!.text) as { text?: string };
    expect(payload.text).toContain("DETAIL");
  });

  it("prepares overlay through the authority pair, not a local overlay builder", () => {
    const source = readFileSync(new URL("../src/mcp-stdio.ts", import.meta.url), "utf8");
    expect(source).toContain("diffRepositoryWithAdjunct");
    expect(source).toContain("probeGitStorageFormat");
    expect(source).not.toContain("buildOverlayP1");
  });

  it("refuses analysis when the human allow gate is ask", async () => {
    const denied = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "case", arguments: {} },
    }, { cwd: process.cwd(), env: { RULEBLAST_AGENT_ALLOW: "off" } });
    const result = (denied as { result: { isError: boolean; content: readonly { text: string }[] } })
      .result;
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/ASK/u);
  });
});
