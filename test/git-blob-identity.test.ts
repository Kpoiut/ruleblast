import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gitBlobOid } from "../src/domain/git-blob-identity.js";

describe("git blob identity", () => {
  it("matches git hash-object for captured SHA-1 bytes", () => {
    const bytes = Buffer.from("in changed\n", "utf8");
    const root = mkdtempSync(join(tmpdir(), "ruleblast-blob-"));
    const file = join(root, "in.ts");
    writeFileSync(file, bytes);
    const hashed = execFileSync("git", ["hash-object", file], { encoding: "utf8" }).trim();
    expect(gitBlobOid(bytes, "sha1")).toBe(hashed);
    expect(hashed).toMatch(/^[0-9a-f]{40}$/u);
  });
});
