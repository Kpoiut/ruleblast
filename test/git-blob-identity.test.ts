import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blobIdentityKind, gitBlobOid } from "../src/domain/git-blob-identity.js";
import { unionSortedPaths } from "../src/domain/repository-path.js";

describe("git blob identity", () => {
  it("classifies OTHER from blob object names only", () => {
    const a = "a".repeat(40);
    const b = "b".repeat(40);
    expect(blobIdentityKind(null, a)).toBe("ADD");
    expect(blobIdentityKind(a, null)).toBe("DELETE");
    expect(blobIdentityKind(a, b)).toBe("MODIFY");
    expect(blobIdentityKind(a, a)).toBeNull();
    expect(blobIdentityKind(null, null)).toBeNull();
  });

  it("merges two code-point-sorted path lists without a set", () => {
    expect(unionSortedPaths(["docs/out.md", "src/app.ts"], ["src/app.ts", "z.md"]))
      .toEqual(["docs/out.md", "src/app.ts", "z.md"]);
    expect(unionSortedPaths(["b"], ["a", "c"])).toEqual(["a", "b", "c"]);
    expect(unionSortedPaths([], ["only"])).toEqual(["only"]);
  });

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
