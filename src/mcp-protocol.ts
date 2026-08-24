export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const MCP_MAX_FRAME_BYTES = 32 * 1024 * 1024;
export type McpStdioFraming = "ndjson" | "content-length";

export interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly method: string;
  readonly params?: unknown;
}

export type ClassifiedJsonRpc =
  | { readonly kind: "parse-error"; readonly message: JsonRpcFailure }
  | { readonly kind: "invalid-request"; readonly message: JsonRpcFailure }
  | { readonly kind: "notification"; readonly method: string; readonly params?: unknown }
  | { readonly kind: "request"; readonly request: JsonRpcRequest };

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

function asBuffer(value: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === "string") return Buffer.from(value, "utf8");
  return Buffer.from(value);
}

export function encodeMcpFrame(
  payload: unknown,
  framing: McpStdioFraming = "ndjson",
): Buffer {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  if (framing === "content-length") {
    const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii");
    return Buffer.concat([header, body]);
  }
  return Buffer.concat([body, Buffer.from("\n", "ascii")]);
}

function parseJsonRpcBody(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    };
  }
}

function headerEnd(buffer: Buffer): number {
  for (let index = 0; index + 1 < buffer.length; index += 1) {
    if (buffer[index] === 0x0d && buffer[index + 1] === 0x0a &&
        buffer[index + 2] === 0x0d && buffer[index + 3] === 0x0a) {
      return index + 4;
    }
    if (buffer[index] === 0x0a && buffer[index + 1] === 0x0a) return index + 2;
  }
  return -1;
}

function contentLength(header: Buffer): number | null {
  const text = header.toString("ascii");
  const match = /^Content-Length:\s*(\d+)\r?$/imu.exec(text);
  if (match === null) return null;
  const length = Number(match[1]);
  return Number.isInteger(length) && length >= 0 ? length : null;
}

function isContentLengthPrefix(buffer: Buffer): boolean {
  const take = Math.min(buffer.length, 15);
  const text = buffer.subarray(0, take).toString("ascii").toLowerCase();
  return "content-length:".startsWith(text) || text.startsWith("content-length:");
}

function takeNdjsonLine(rest: Buffer): { readonly line: Buffer; readonly next: Buffer } | null {
  const lineEnd = rest.indexOf(0x0a);
  if (lineEnd === -1) {
    if (rest.length > MCP_MAX_FRAME_BYTES) {
      throw new RangeError("MCP frame exceeded maximum size");
    }
    return null;
  }
  const line = rest.subarray(0, rest[lineEnd - 1] === 0x0d ? lineEnd - 1 : lineEnd);
  if (line.length > MCP_MAX_FRAME_BYTES) {
    throw new RangeError("MCP frame exceeded maximum size");
  }
  return { line, next: rest.subarray(lineEnd + 1) };
}

export function consumeMcpBuffer(buffer: Buffer | Uint8Array | string): {
  readonly messages: unknown[];
  readonly rest: Buffer;
  readonly framing: McpStdioFraming | null;
} {
  const messages: unknown[] = [];
  let rest = asBuffer(buffer);
  let framing: McpStdioFraming | null = null;
  while (rest.length > 0) {
    if (rest[0] === 0x0a) {
      rest = rest.subarray(1);
      continue;
    }
    if (rest[0] === 0x0d && rest[1] === 0x0a) {
      rest = rest.subarray(2);
      continue;
    }
    if (!isContentLengthPrefix(rest)) {
      const taken = takeNdjsonLine(rest);
      if (taken === null) break;
      messages.push(parseJsonRpcBody(taken.line.toString("utf8")));
      rest = taken.next;
      framing = "ndjson";
      continue;
    }
    const end = headerEnd(rest);
    if (end === -1) {
      if (rest.length > MCP_MAX_FRAME_BYTES) {
        throw new RangeError("MCP frame exceeded maximum size");
      }
      break;
    }
    const length = contentLength(rest.subarray(0, end));
    if (length === null) {
      throw new RangeError("MCP frame missing Content-Length");
    }
    if (length > MCP_MAX_FRAME_BYTES) {
      throw new RangeError("MCP frame exceeded maximum size");
    }
    if (rest.length < end + length) break;
    messages.push(parseJsonRpcBody(rest.subarray(end, end + length).toString("utf8")));
    rest = rest.subarray(end + length);
    framing = "content-length";
  }
  return { messages, rest, framing };
}

export function isJsonRpcParseError(value: unknown): value is JsonRpcFailure {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const error = record.error;
  if (record.jsonrpc !== "2.0" || typeof error !== "object" || error === null) {
    return false;
  }
  return (error as { code?: unknown }).code === -32700;
}

function jsonRpcId(value: unknown): string | number | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isInteger(value) && Number.isSafeInteger(value)) {
    return value;
  }
  return null;
}

function invalidRequest(id: string | number | null, message = "Invalid Request"): JsonRpcFailure {
  return { jsonrpc: "2.0", id, error: { code: -32600, message } };
}

export function classifyJsonRpcMessage(value: unknown): ClassifiedJsonRpc {
  if (isJsonRpcParseError(value)) return { kind: "parse-error", message: value };
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { kind: "invalid-request", message: invalidRequest(null) };
  }
  const record = value as Record<string, unknown>;
  const id = Object.prototype.hasOwnProperty.call(record, "id")
    ? jsonRpcId(record.id)
    : undefined;
  if (record.jsonrpc !== "2.0" || typeof record.method !== "string" || record.method === "") {
    return {
      kind: "invalid-request",
      message: invalidRequest(id === undefined ? null : id),
    };
  }
  if (!Object.prototype.hasOwnProperty.call(record, "id")) {
    return { kind: "notification", method: record.method, params: record.params };
  }
  if (id === null || id === undefined) {
    return { kind: "invalid-request", message: invalidRequest(null) };
  }
  return {
    kind: "request",
    request: {
      jsonrpc: "2.0",
      id,
      method: record.method,
      params: record.params,
    },
  };
}

export function asJsonRpcRequest(value: unknown): JsonRpcRequest | null {
  const classified = classifyJsonRpcMessage(value);
  return classified.kind === "request" ? classified.request : null;
}
