import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

describe("companion host purity", () => {
  it("keeps the VS Code adapter off the npm analysis package", () => {
    const descriptor = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
      readonly files?: readonly string[];
    };
    expect(descriptor.files ?? []).not.toContain("hosts");
    expect(descriptor.files ?? []).not.toContain("hosts/vscode");
  });

  it("maps exactly the four public RuleBlast actions", () => {
    const manifest = JSON.parse(
      readFileSync(join(repositoryRoot, "hosts/vscode/package.json"), "utf8"),
    ) as { readonly contributes: { readonly commands: readonly { readonly command: string }[] } };
    expect(manifest.contributes.commands.map((item) => item.command).sort()).toEqual([
      "ruleblast.diffFrom",
      "ruleblast.explainActiveFile",
      "ruleblast.openVerifiedCase",
      "ruleblast.scanWorkspace",
    ]);
  });

  it("lets the VS Code host import only the application facade and vscode", () => {
    const root = join(repositoryRoot, "hosts/vscode/src");
    const sources = walk(root).filter((path) => path.endsWith(".ts") || path.endsWith(".js"));
    expect(sources.length).toBeGreaterThan(0);
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/from ["'].*\/(impact|snapshot|canonical|profiles\/|git|render-explain)/u);
      expect(text, file).not.toMatch(/from ["']vscode["'][\s\S]*analyzeCurrent/u);
    }
  });
});
