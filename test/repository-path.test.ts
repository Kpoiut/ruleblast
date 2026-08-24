import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ancestorDirectories,
  compareCodePoints,
  decodeGitPathname,
  joinRepositoryPath,
  pathBasename,
  pathDirname,
} from "../src/domain/repository-path.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function walkSource(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkSource(path));
    else if (entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

function localHelpers(pattern: string): string[] {
  const duplicates: string[] = [];
  const sourceRoot = join(repositoryRoot, "src");
  for (const path of walkSource(sourceRoot)) {
    const relative = path.slice(repositoryRoot.length + 1).replaceAll("\\", "/");
    if (relative === "src/domain/repository-path.ts") continue;
    if (readFileSync(path, "utf8").includes(pattern)) duplicates.push(relative);
  }
  return duplicates;
}

describe("repository path primitives", () => {
  it("decodes Git pathnames as strict UTF-8 and rejects invalid bytes", () => {
    expect(decodeGitPathname(Buffer.from("src/file.ts"))).toBe("src/file.ts");
    expect(decodeGitPathname(Buffer.from("tiếng Việt.md", "utf8"))).toBe("tiếng Việt.md");
    expect(() => decodeGitPathname(Buffer.from([0xff, 0xfe]))).toThrow(/pathname encoding/i);
  });

  it("keeps one compareCodePoints implementation in production source", () => {
    expect(localHelpers("function compareCodePoints")).toEqual([]);
  });

  it("keeps one dirname, basename, ancestor, and join implementation in production source", () => {
    expect(localHelpers("function dirname(")).toEqual([]);
    expect(localHelpers("function basename(")).toEqual([]);
    expect(localHelpers("function ancestorDirectories(")).toEqual([]);
    expect(localHelpers("function candidatePath(")).toEqual([]);
    expect(localHelpers("function joinPath(")).toEqual([]);
    expect(localHelpers("function directoryOf(")).toEqual([]);
  });

  it("names dirname, basename, ancestors, and child paths the same way everywhere", () => {
    expect(pathDirname("src/a.ts")).toBe("src");
    expect(pathDirname("a.ts")).toBe(".");
    expect(pathBasename("src/a.ts")).toBe("a.ts");
    expect(pathBasename("a.ts")).toBe("a.ts");
    expect(ancestorDirectories("src/a/b.ts")).toEqual([".", "src", "src/a"]);
    expect(ancestorDirectories("b.ts")).toEqual(["."]);
    expect(joinRepositoryPath(".", "AGENTS.md")).toBe("AGENTS.md");
    expect(joinRepositoryPath("src", "AGENTS.md")).toBe("src/AGENTS.md");
    expect(compareCodePoints("a", "b")).toBeLessThan(0);
  });
});
