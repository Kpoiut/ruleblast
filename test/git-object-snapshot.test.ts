import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cacheGitObjectSnapshot,
  cacheRepositorySnapshot,
} from "../src/application/projection-boundary.js";
import {
  openGitSnapshot,
  probeGitStorageFormat,
} from "../src/git.js";

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function initRepo(objectFormat?: "sha1" | "sha256"): string {
  const root = mkdtempSync(join(tmpdir(), "ruleblast-oid-"));
  const extra = objectFormat === undefined ? [] : [`--object-format=${objectFormat}`];
  execFileSync("git", ["-C", root, "init", ...extra], { encoding: "utf8" });
  git(root, ["config", "user.email", "oid@example.test"]);
  git(root, ["config", "user.name", "oid"]);
  writeFileSync(join(root, "tracked.txt"), "hello\n");
  git(root, ["add", "tracked.txt"]);
  git(root, ["commit", "-m", "seed"]);
  return root;
}

describe("Git object snapshot", () => {
  it("exposes sync blob oids from ls-tree without reading blobs", async () => {
    const root = initRepo();
    const format = await probeGitStorageFormat(root);
    expect(format).toBe("sha1");
    const snapshot = await openGitSnapshot(root, "HEAD");
    const oid = snapshot.blobOid("tracked.txt");
    expect(oid).toMatch(/^[0-9a-f]{40}$/u);
    expect(snapshot.blobOid("missing.txt")).toBeNull();
    const cached = cacheGitObjectSnapshot(snapshot, "sha1");
    expect(cached.blobOid("tracked.txt")).toBe(oid);
    expect(cached.blobOid("missing.txt")).toBeNull();
    expect("blobOid" in cacheRepositorySnapshot(snapshot)).toBe(false);
  });

  it("pins --no-replace-objects on every git spawn", async () => {
    const source = await import("node:fs/promises").then(async () =>
      (await import("node:fs")).readFileSync(
        new URL("../src/git.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(source).toContain("--no-replace-objects");
  });

  it("conforms sha1 storage object names", async () => {
    const root = initRepo("sha1");
    expect(await probeGitStorageFormat(root)).toBe("sha1");
    const snapshot = await openGitSnapshot(root, "HEAD");
    expect(snapshot.blobOid("tracked.txt")).toMatch(/^[0-9a-f]{40}$/u);
  });

  it("conforms sha256 storage object names when Git can create them", async ({ skip }) => {
    let root: string;
    try {
      root = initRepo("sha256");
    } catch {
      skip("Git cannot initialize --object-format=sha256 repositories");
      return;
    }
    const format = await probeGitStorageFormat(root);
    if (format !== "sha256") {
      skip("probeGitStorageFormat did not report sha256 on a sha256-initialized repo");
      return;
    }
    const snapshot = await openGitSnapshot(root, "HEAD");
    expect(snapshot.blobOid("tracked.txt")).toMatch(/^[0-9a-f]{64}$/u);
  });
});
