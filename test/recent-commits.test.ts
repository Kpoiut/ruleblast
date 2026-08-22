import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listRecentCommits } from "../src/application/recent-commits.js";

const repositories: string[] = [];

function git(directory: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim();
}

function repository(): string {
  const directory = mkdtempSync(join(tmpdir(), "ruleblast-log-"));
  repositories.push(directory);
  git(directory, ["init"]);
  git(directory, ["config", "user.name", "Ruleblast Tests"]);
  git(directory, ["config", "user.email", "tests@example.invalid"]);
  return directory;
}

afterEach(() => {
  for (const directory of repositories.splice(0)) {
    rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

describe("listRecentCommits", () => {
  it("returns newest-first subject lines from git log", async () => {
    const root = repository();
    writeFileSync(join(root, "a.txt"), "one");
    git(root, ["add", "-A"]);
    git(root, ["commit", "-m", "first"]);
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "b.txt"), "two");
    git(root, ["add", "-A"]);
    git(root, ["commit", "-m", "second"]);
    const commits = await listRecentCommits(root);
    expect(commits.map((row) => row.subject)).toEqual(["second", "first"]);
    expect(commits[0]?.ref).toMatch(/^[0-9a-f]{7,}$/u);
    expect(git(root, ["rev-parse", "--verify", commits[0]!.ref])).toHaveLength(40);
  });

  it("returns an empty list when the repository has no commits", async () => {
    expect(await listRecentCommits(repository())).toEqual([]);
  });
});
