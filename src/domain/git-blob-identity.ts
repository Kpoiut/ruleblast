import { createHash } from "node:crypto";
import type { GitStorageObjectFormat } from "../snapshot.js";

export type BlobIdentityKind = "ADD" | "DELETE" | "MODIFY";

export function gitBlobOid(
  bytes: Uint8Array,
  format: GitStorageObjectFormat,
): string {
  return createHash(format)
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
}

/** OTHER membership: blob object name only. Same OID is not a change. */
export function blobIdentityKind(
  beforeOid: string | null,
  afterOid: string | null,
): BlobIdentityKind | null {
  if (beforeOid === afterOid) return null;
  if (beforeOid === null) return "ADD";
  if (afterOid === null) return "DELETE";
  return "MODIFY";
}
