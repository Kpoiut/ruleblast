import { createHash } from "node:crypto";
import type { GitStorageObjectFormat } from "../snapshot.js";

export function gitBlobOid(
  bytes: Uint8Array,
  format: GitStorageObjectFormat,
): string {
  return createHash(format)
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
}
