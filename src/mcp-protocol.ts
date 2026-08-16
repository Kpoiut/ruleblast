export const MCP_PROTOCOL_VERSION = "2024-11-05";

export interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly method: string;
  readonly params?: unknown;
}

export interface JsonRpcSuccess {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly result: unknown;
}

export interface JsonRpcFailure {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly error: { readonly code: number; readonly message: string };
}

export type JsonRpcMessage = JsonRpcSuccess | JsonRpcFailure;

export function encodeMcpFrame(payload: unknown): string {
  const body = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

export function consumeMcpBuffer(buffer: string): {
  readonly messages: unknown[];
  readonly rest: string;
} {
  const messages: unknown[] = [];
  let rest = buffer;
  while (rest.length > 0) {
    const match = /^(?:Content-Length:\s*(\d+)\r?\n)(?:[A-Za-z0-9-]+:[^\n]*\n)*\r?\n/iu
      .exec(rest);
    if (match === null) {
      const line = /^([^\r\n]+)\r?\n/u.exec(rest);
      if (line !== null && line[1]!.startsWith("{")) {
        messages.push(JSON.parse(line[1]!));
        rest = rest.slice(line[0].length);
        continue;
      }
      break;
    }
    const length = Number(match[1]);
    const start = match[0].length;
    if (rest.length < start + length) break;
    const body = rest.slice(start, start + length);
    messages.push(JSON.parse(body));
    rest = rest.slice(start + length);
  }
  return { messages, rest };
}

export function asJsonRpcRequest(value: unknown): JsonRpcRequest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.jsonrpc !== "2.0" || typeof record.method !== "string") return null;
  const id = record.id;
  if (id !== undefined && id !== null && typeof id !== "string" && typeof id !== "number") {
    return null;
  }
  return {
    jsonrpc: "2.0",
    id: id === undefined ? null : id,
    method: record.method,
    params: record.params,
  };
}
