import { readFileSync } from "node:fs";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  asJsonRpcRequest,
  consumeMcpBuffer,
  encodeMcpFrame,
} from "../src/mcp-protocol.js";
import { dispatchMcpRequest, MCP_TOOL_NAMES, serveMcpStdio } from "../src/mcp-stdio.js";
import {
  currentHostProcess,
  hostProcessDialect,
} from "../src/application/host-process.js";
import { hostShellDialect } from "../src/render-format.js";

const host = {
  cwd: process.cwd(),
  env: { RULEBLAST_AGENT_ALLOW: "yes" },
};

describe("MCP stdio transport", () => {
  it("writes newline-delimited JSON-RPC as MCP stdio requires", () => {
    const frame = encodeMcpFrame({ jsonrpc: "2.0", id: 1, method: "ping" });
    const text = frame.toString("utf8");
    expect(text.startsWith("{")).toBe(true);
    expect(text.endsWith("\n")).toBe(true);
    expect(text.trimEnd().includes("\n")).toBe(false);
    expect(text).not.toMatch(/^Content-Length:/iu);
    const { messages, rest, framing } = consumeMcpBuffer(frame);
    expect(rest.length).toBe(0);
    expect(framing).toBe("ndjson");
    expect(asJsonRpcRequest(messages[0])).toMatchObject({ method: "ping", id: 1 });
  });

  it("consumes newline-delimited JSON-RPC, including UTF-8 payloads", () => {
    const leftover = Buffer.from(
      '{"jsonrpc":"2.0","id":1,"method":"ping","params":{"q":"é khắc phục"}}\n',
      "utf8",
    );
    const { messages, rest, framing } = consumeMcpBuffer(leftover);
    expect(rest.length).toBe(0);
    expect(framing).toBe("ndjson");
    expect(asJsonRpcRequest(messages[0])).toMatchObject({
      method: "ping",
      id: 1,
      params: { q: "é khắc phục" },
    });
  });

  it("waits for an incomplete newline-delimited JSON line", () => {
    const leftover = Buffer.from('{"jsonrpc":"2.0","id":1,"method":"ping"}', "utf8");
    const { messages, rest } = consumeMcpBuffer(leftover);
    expect(messages).toEqual([]);
    expect(rest.equals(leftover)).toBe(true);
  });

  it("still consumes Content-Length host-dialect frames by UTF-8 bytes", () => {
    const frame = encodeMcpFrame({
      jsonrpc: "2.0",
      id: 7,
      method: "ping",
      params: { q: "é khắc phục" },
    }, "content-length");
    expect(frame.toString("ascii").startsWith("Content-Length:")).toBe(true);
    const { messages, rest, framing } = consumeMcpBuffer(frame);
    expect(rest.length).toBe(0);
    expect(framing).toBe("content-length");
    expect(asJsonRpcRequest(messages[0])).toMatchObject({ method: "ping", id: 7 });
    const splitAt = Math.floor(frame.length / 2);
    const first = consumeMcpBuffer(frame.subarray(0, splitAt));
    expect(first.messages).toEqual([]);
    const second = consumeMcpBuffer(Buffer.concat([first.rest, frame.subarray(splitAt)]));
    expect(second.rest.length).toBe(0);
    expect(asJsonRpcRequest(second.messages[0])).toMatchObject({ method: "ping", id: 7 });
  });

  it("fails closed when a Content-Length header is complete without a byte length", () => {
    const frame = Buffer.from(
      "Content-Length:\r\n\r\n{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"ping\"}",
      "utf8",
    );
    expect(() => consumeMcpBuffer(frame)).toThrow(/Content-Length/u);
  });

  it("does not answer a notification, and rejects null or fractional ids", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const chunks: Buffer[] = [];
    stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    const done = serveMcpStdio(stdin, stdout, host);
    stdin.write('{"jsonrpc":"2.0","method":"ping"}\n');
    stdin.write('{"jsonrpc":"2.0","id":null,"method":"ping"}\n');
    stdin.write('{"jsonrpc":"2.0","id":1.5,"method":"ping"}\n');
    stdin.end();
    await done;
    const messages = Buffer.concat(chunks).toString("utf8").split("\n").filter(Boolean).map(
      (line) => JSON.parse(line) as { id: unknown; error?: { code: number } },
    );
    expect(messages).toHaveLength(2);
    expect(messages.every((message) => message.error?.code === -32600)).toBe(true);
    expect(asJsonRpcRequest({ jsonrpc: "2.0", method: "ping" })).toBeNull();
    expect(asJsonRpcRequest({ jsonrpc: "2.0", id: null, method: "ping" })).toBeNull();
    expect(asJsonRpcRequest({ jsonrpc: "2.0", id: 1.5, method: "ping" })).toBeNull();
  });

  it("returns -32600 for a JSON object without method instead of swallowing it", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const chunks: Buffer[] = [];
    stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    const done = serveMcpStdio(stdin, stdout, host);
    stdin.write('{"jsonrpc":"2.0","id":3}\n');
    stdin.end();
    await done;
    const out = Buffer.concat(chunks).toString("utf8");
    expect(out.length).toBeGreaterThan(0);
    expect(JSON.parse(out.trimEnd())).toMatchObject({
      jsonrpc: "2.0",
      id: 3,
      error: { code: -32600 },
    });
  });

  it("echoes NDJSON replies to NDJSON requests", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const chunks: Buffer[] = [];
    stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    const done = serveMcpStdio(stdin, stdout, host);
    stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      },
    }) + "\n");
    stdin.write('{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
    stdin.end();
    await done;
    const messages = Buffer.concat(chunks).toString("utf8").split("\n").filter(Boolean).map(
      (line) => JSON.parse(line) as { id: unknown; result?: unknown },
    );
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ jsonrpc: "2.0", id: 1, result: {} });
  });

  it("echoes Content-Length replies to Content-Length host-dialect requests", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const chunks: Buffer[] = [];
    stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    const done = serveMcpStdio(stdin, stdout, host);
    stdin.write(encodeMcpFrame({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      },
    }, "content-length"));
    stdin.write(encodeMcpFrame({ jsonrpc: "2.0", id: 1, method: "ping" }, "content-length"));
    stdin.end();
    await done;
    const out = Buffer.concat(chunks);
    expect(out.toString("ascii")).toMatch(/^Content-Length:/u);
    const { messages } = consumeMcpBuffer(out);
    expect(messages[1]).toMatchObject({ jsonrpc: "2.0", id: 1, result: {} });
  });

  it("refuses initialize without negotiation params and unknown tools as protocol errors", async () => {
    const missing = await dispatchMcpRequest(
      { jsonrpc: "2.0", id: 1, method: "initialize" },
      host,
    );
    expect(missing).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32602 },
    });
    const unknown = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "scan-extra", arguments: {} },
    }, host);
    expect(unknown).toMatchObject({
      jsonrpc: "2.0",
      id: 2,
      error: { code: -32602 },
    });
    expect(unknown).not.toHaveProperty("result");
  });

  it("refuses requests before initialize on the stdio session", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const chunks: Buffer[] = [];
    stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    const done = serveMcpStdio(stdin, stdout, host);
    stdin.write('{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
    stdin.end();
    await done;
    expect(JSON.parse(Buffer.concat(chunks).toString("utf8").trimEnd())).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32600 },
    });
  });

  it("returns a JSON-RPC parse error instead of throwing on invalid frames", () => {
    const frame = Buffer.from("Content-Length: 12\r\n\r\n{not-json!!!", "utf8");
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
    const tools = (listed as {
      result: {
        tools: readonly {
          name: string;
          annotations?: {
            readOnlyHint?: boolean;
            destructiveHint?: boolean;
            openWorldHint?: boolean;
          };
        }[];
      };
    }).result.tools;
    expect(tools.map((tool) => tool.name)).toEqual([...MCP_TOOL_NAMES]);
    for (const tool of tools) {
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }

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
        receipt: { type: "boolean" },
      });
    }
    for (const tool of tools.filter((item) => item.name !== "explain")) {
      expect(tool.inputSchema.properties).toMatchObject({
        index: { type: "boolean" },
        pathsOnly: { type: "boolean" },
        witness: { type: "boolean" },
      });
    }
    const explain = tools.find((item) => item.name === "explain");
    expect(explain?.inputSchema.properties).toMatchObject({
      compare: { type: "boolean" },
      witness: { type: "boolean" },
    });
    expect(explain?.inputSchema.properties).not.toHaveProperty("pathsOnly");
  });

  it("returns paths-only and witness for the packaged case", async () => {
    const paths = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name: "case", arguments: { pathsOnly: true } },
    }, host);
    const pathText = (paths as { result: { content: readonly { text: string }[]; isError?: boolean } })
      .result;
    expect(pathText.isError).not.toBe(true);
    expect(pathText.content[0]!.text).toMatch(/^[^\n]+\n/u);
    expect(pathText.content[0]!.text).not.toContain("RULEBLAST");
    const witnessed = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: { name: "case", arguments: { witness: true } },
    }, host);
    const witnessText = (witnessed as { result: { content: readonly { text: string }[]; isError?: boolean } })
      .result;
    expect(witnessText.isError).not.toBe(true);
    expect(witnessText.content[0]!.text).toMatch(/WHY|witness|SELECTED|source/iu);
    const refused = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: { name: "explain", arguments: { path: "src/cli.ts", pathsOnly: true } },
    }, host);
    const failed = (refused as { result: { isError?: boolean; content: readonly { text: string }[] } })
      .result;
    expect(failed.isError).toBe(true);
    expect(failed.content[0]?.text).toMatch(/pathsOnly cannot be used with explain/u);
  });

  it("returns compare text for explain and refuses compare on case", async () => {
    const compared = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "explain",
        arguments: { path: "src/cli.ts", compare: true },
      },
    }, host);
    const text = (compared as { result: { content: readonly { text: string }[]; isError?: boolean } })
      .result;
    expect(text.isError).not.toBe(true);
    expect(text.content[0]!.text).toContain("RULEBLAST COMPARE · src/cli.ts");
    const refused = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "case", arguments: { compare: true } },
    }, host);
    const failed = (refused as { result: { isError?: boolean; content: readonly { text: string }[] } })
      .result;
    expect(failed.isError).toBe(true);
    expect(failed.content[0]?.text).toMatch(/compare applies only to explain/u);
  });

  it("returns a compact receipt for the packaged case without combining exclusive flags", async () => {
    const called = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "case", arguments: { receipt: true } },
    }, host);
    const text = (called as { result: { content: readonly { text: string }[]; isError?: boolean } })
      .result;
    expect(text.isError).not.toBe(true);
    expect(text.content[0]!.text).toContain("RULEBLAST PROOF");
    expect(text.content[0]!.text).toContain("LAB");
    const conflict = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "case", arguments: { receipt: true, index: true } },
    }, host);
    const failed = (conflict as { result: { isError?: boolean; content: readonly { text: string }[] } })
      .result;
    expect(failed.isError).toBe(true);
    expect(failed.content[0]?.text).toMatch(/cannot combine/u);
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

  it("quotes CTAs for the host platform instead of hardcoding posix", () => {
    expect(hostShellDialect("win32")).toBe("powershell");
    expect(hostShellDialect("darwin")).toBe("posix");
    expect(hostShellDialect("linux")).toBe("posix");
    expect(hostProcessDialect(currentHostProcess({ platform: "win32" }))).toBe("powershell");
    expect(hostProcessDialect(currentHostProcess({ platform: "darwin" }))).toBe("posix");
    const source = readFileSync(new URL("../src/mcp-stdio.ts", import.meta.url), "utf8");
    expect(source).toContain("hostTextContext");
    expect(source).toContain("hostProcessDialect");
    expect(source).not.toMatch(/shellDialect:\s*"posix"/u);
    expect(readFileSync(new URL("../src/cli.ts", import.meta.url), "utf8"))
      .toContain("hostProcessDialect(currentHostProcess())");
  });
});
