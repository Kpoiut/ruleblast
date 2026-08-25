/**
 * @fileoverview Git blob object-name identity for overlay OTHER membership.
 *
 * Overlay does not read blobs on the analysis path. Same object name is not a
 * change even when mode or kind flipped. Gitlinks are excluded elsewhere.
 */
import { createHash } from "node:crypto";
import type { GitStorageObjectFormat } from "../snapshot.js";

/** Object-name motion. null from {@link blobIdentityKind} means same OID. */
export type BlobIdentityKind = "ADD" | "DELETE" | "MODIFY";

/** Git object name for `blob <len>\0` plus bytes, sha1 or sha256. */
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
