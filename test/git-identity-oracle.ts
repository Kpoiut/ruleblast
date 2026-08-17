import { execFileSync } from "node:child_process";

export type IdentityKind = "ADD" | "DELETE" | "MODIFY";

export interface IdentityChange {
  readonly path: string;
  readonly kind: IdentityKind;
}

const ZERO_OID = /^0+$/u;

export function parseIdentityDelta(raw: Buffer): IdentityChange[] {
  const changes: IdentityChange[] = [];
  let offset = 0;
  while (offset < raw.length) {
    const metaEnd = raw.indexOf(0, offset);
    if (metaEnd < 0) throw new Error("Invalid git diff-tree raw metadata");
    const meta = raw.subarray(offset, metaEnd).toString("utf8");
    offset = metaEnd + 1;
    const pathEnd = raw.indexOf(0, offset);
    if (pathEnd < 0) throw new Error("Invalid git diff-tree raw path");
    const path = raw.subarray(offset, pathEnd).toString("utf8");
    offset = pathEnd + 1;
    const kind = identityKind(meta);
    if (kind !== null) changes.push({ path, kind });
  }
  return changes;
}

function identityKind(meta: string): IdentityKind | null {
  if (!meta.startsWith(":")) {
    throw new Error(`Invalid git diff-tree raw record: ${JSON.stringify(meta)}`);
  }
  const parts = meta.slice(1).split(" ");
  const oldMode = parts[0];
  const newMode = parts[1];
  const oldOid = parts[2]?.toLowerCase();
  const newOid = parts[3]?.toLowerCase();
  if (oldMode === undefined || newMode === undefined ||
      oldOid === undefined || newOid === undefined) {
    throw new Error(`Invalid git diff-tree raw record: ${JSON.stringify(meta)}`);
  }
  if (oldMode === "160000" || newMode === "160000") return null;
  const before = ZERO_OID.test(oldOid) ? null : oldOid;
  const after = ZERO_OID.test(newOid) ? null : newOid;
  if (before === after) return null;
  if (before === null && after !== null) return "ADD";
  if (before !== null && after === null) return "DELETE";
  return "MODIFY";
}

export function identityDeltaFromGit(
  root: string,
  beforeRef: string,
  afterRef: string,
): IdentityChange[] {
  const raw = execFileSync(
    "git",
    [
      "--no-optional-locks",
      "--no-replace-objects",
      "-c",
      "core.fsmonitor=false",
      "-C",
      root,
      "diff-tree",
      "-r",
      "--raw",
      "-z",
      "--no-renames",
      "--no-commit-id",
      beforeRef,
      afterRef,
    ],
    {
      encoding: "buffer",
      env: {
        ...process.env,
        GIT_NO_LAZY_FETCH: "1",
        GIT_OPTIONAL_LOCKS: "0",
      },
    },
  );
  return parseIdentityDelta(raw);
}
