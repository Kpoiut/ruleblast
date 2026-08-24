export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const MCP_MAX_FRAME_BYTES = 32 * 1024 * 1024;

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

function asBuffer(value: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === "string") return Buffer.from(value, "utf8");
  return Buffer.from(value);
}

export function encodeMcpFrame(payload: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii");
  return Buffer.concat([header, body]);
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

export function consumeMcpBuffer(buffer: Buffer | Uint8Array | string): {
  readonly messages: unknown[];
  readonly rest: Buffer;
} {
  const messages: unknown[] = [];
  let rest = asBuffer(buffer);
  while (rest.length > 0) {
    const end = headerEnd(rest);
    if (end === -1) {
      if (rest.length > MCP_MAX_FRAME_BYTES) {
        throw new RangeError("MCP frame exceeded maximum size");
      }
      const lineEnd = rest.indexOf(0x0a);
      if (lineEnd > 0 && rest[0] === 0x7b) {
        const line = rest.subarray(0, rest[lineEnd - 1] === 0x0d ? lineEnd - 1 : lineEnd);
        messages.push(parseJsonRpcBody(line.toString("utf8")));
        rest = rest.subarray(lineEnd + 1);
        continue;
      }
      break;
    }
    const length = contentLength(rest.subarray(0, end));
    if (length === null) break;
    if (length > MCP_MAX_FRAME_BYTES) {
      throw new RangeError("MCP frame exceeded maximum size");
    }
    if (rest.length < end + length) break;
    messages.push(parseJsonRpcBody(rest.subarray(end, end + length).toString("utf8")));
    rest = rest.subarray(end + length);
  }
  return { messages, rest };
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
