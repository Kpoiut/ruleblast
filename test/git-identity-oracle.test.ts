import { describe, expect, it } from "vitest";
import {
  identityDeltaFromGit,
  parseIdentityDelta,
} from "./git-identity-oracle.js";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const Z = "0".repeat(40);

function raw(records: readonly string[]): Buffer {
  return Buffer.from(`${records.join("\0")}\0`);
}

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

describe("git identity oracle", () => {
  it("ignores mode and type flips that keep the same blob object", () => {
    expect(parseIdentityDelta(raw([
      `:100644 100755 ${A} ${A} M`,
      "mode.sh",
      `:100644 120000 ${A} ${A} T`,
      "kind.txt",
    ]))).toEqual([]);
  });

  it("keeps presence and blob-oid changes only", () => {
    expect(parseIdentityDelta(raw([
      `:000000 100644 ${Z} ${B} A`,
      "new.md",
      `:100644 000000 ${A} ${Z} D`,
      "gone.md",
      `:100644 100644 ${A} ${B} M`,
      "src/app.ts",
    ]))).toEqual([
      { path: "new.md", kind: "ADD" },
      { path: "gone.md", kind: "DELETE" },
      { path: "src/app.ts", kind: "MODIFY" },
    ]);
  });

  it("drops gitlinks even when their object name changes", () => {
    expect(parseIdentityDelta(raw([
      `:160000 160000 ${A} ${B} M`,
      "vendor/lib",
    ]))).toEqual([]);
  });

  it("agrees with git on a real mode-and-kind same-OID pair", () => {
    const root = mkdtempSync(join(tmpdir(), "ruleblast-identity-"));
    git(root, ["init"]);
    git(root, ["config", "user.email", "id@example.test"]);
    git(root, ["config", "user.name", "id"]);
    git(root, ["config", "core.autocrlf", "false"]);
    const write = (relative: string, content: string) => {
      const path = join(root, ...relative.split("/"));
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    };
    write("mode.sh", "echo hi\n");
    write("kind.txt", "hello");
    write("changed.txt", "before\n");
    git(root, ["add", "-A"]);
    git(root, ["commit", "-m", "seed"]);
    const before = git(root, ["rev-parse", "HEAD"]);
    git(root, ["update-index", "--chmod=+x", "mode.sh"]);
    const blob = git(root, ["rev-parse", "HEAD:kind.txt"]);
    git(root, ["update-index", "--add", "--cacheinfo", `120000,${blob},kind.txt`]);
    write("changed.txt", "after\n");
    git(root, ["add", "-A"]);
    git(root, ["commit", "-m", "mode kind and content"]);
    const after = git(root, ["rev-parse", "HEAD"]);
    expect(identityDeltaFromGit(root, before, after)).toEqual([
      { path: "changed.txt", kind: "MODIFY" },
    ]);
  });
});
