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

describe("witness domain purity", () => {
  it("keeps bundled profile ids out of witness.ts", () => {
    const text = readFileSync(join(repositoryRoot, "src/domain/witness.ts"), "utf8");
    expect(text).not.toContain("OPENAI_CODEX_CLI_PROFILE_ID");
    expect(text).not.toContain("ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID");
    expect(text).not.toContain("GITHUB_COPILOT_CLI_PROFILE_ID");
    expect(text).not.toContain("GOOGLE_GEMINI_CLI_PROFILE_ID");
    expect(text).not.toContain("openai/codex-cli@1");
    expect(text).not.toContain("anthropic/claude-code-cli@1");
    expect(text).not.toContain("github/copilot-cli@1");
    expect(text).not.toContain("google/gemini-cli@1");
  });
});

describe("companion host purity", () => {
  it("ships a 128x128 PNG Marketplace icon", () => {
    const icon = readFileSync(join(repositoryRoot, "hosts/vscode/media/icon.png"));
    const manifest = JSON.parse(
      readFileSync(join(repositoryRoot, "hosts/vscode/package.json"), "utf8"),
    ) as { readonly icon?: string; readonly version: string };
    expect(icon.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(icon.readUInt32BE(16)).toBe(128);
    expect(icon.readUInt32BE(20)).toBe(128);
    expect(manifest.icon).toBe("media/icon.png");
    expect(manifest.version).toBe("2.5.9");
  });

  it("uses a currentColor SVG on the activity bar instead of the opaque marketplace PNG", () => {
    const manifest = JSON.parse(
      readFileSync(join(repositoryRoot, "hosts/vscode/package.json"), "utf8"),
    ) as {
      readonly contributes: {
        readonly viewsContainers: { readonly activitybar: readonly { readonly icon: string }[] };
        readonly viewsWelcome?: readonly { readonly view: string; readonly contents: string }[];
      };
    };
    expect(manifest.contributes.viewsContainers.activitybar[0]?.icon).toBe("media/icon.svg");
    const svg = readFileSync(join(repositoryRoot, "hosts/vscode/media/icon.svg"), "utf8");
    expect(svg).toContain("currentColor");
    expect(svg).not.toContain("#C5C5C5");
    expect(manifest.contributes.viewsWelcome?.[0]?.view).toBe("ruleblast.scoreboard");
    expect(manifest.contributes.viewsWelcome?.[0]?.contents).toContain("command:ruleblast.scanWorkspace");
    expect(manifest.contributes.viewsWelcome?.[0]?.contents).toContain("command:ruleblast.showDetail");
    expect(manifest.contributes.viewsWelcome?.[0]?.contents).toContain("command:ruleblast.showIndex");
    expect(manifest.contributes.viewsWelcome?.[0]?.contents).toContain("command:ruleblast.selectReality");
    const pkg = JSON.parse(
      readFileSync(join(repositoryRoot, "hosts/vscode/package.json"), "utf8"),
    ) as {
      readonly contributes: {
        readonly menus: {
          readonly "view/title": readonly { readonly command: string }[];
        };
      };
    };
    const titleCommands = pkg.contributes.menus["view/title"].map((item) => item.command);
    expect(titleCommands).toContain("ruleblast.showDetail");
    expect(titleCommands).toContain("ruleblast.showIndex");
    expect(titleCommands).toContain("ruleblast.selectReality");
  });

  it("activates in a Git or instruction workspace without auto-analyzing", () => {
    const manifest = JSON.parse(
      readFileSync(join(repositoryRoot, "hosts/vscode/package.json"), "utf8"),
    ) as { readonly activationEvents?: readonly string[] };
    expect(manifest.activationEvents).toContain("workspaceContains:.git");
    expect(manifest.activationEvents).toContain("workspaceContains:AGENTS.md");
    expect(manifest.activationEvents).toContain("workspaceContains:CLAUDE.md");
    const source = readFileSync(join(repositoryRoot, "hosts/vscode/src/extension.ts"), "utf8");
    const activate = source.indexOf("export function activate");
    const firstScan = source.indexOf("registerCommand(\"ruleblast.scanWorkspace\"");
    expect(activate).toBeGreaterThan(-1);
    expect(firstScan).toBeGreaterThan(activate);
    const idle = source.slice(activate, firstScan);
    expect(idle).toContain("commitPresentation(state, status)");
    expect(idle).not.toContain("scanRepository");
  });

  it("quotes companion explain for the process host and asks to rescan after Select Reality", () => {
    const source = readFileSync(join(repositoryRoot, "hosts/vscode/src/extension.ts"), "utf8");
    expect(source).toContain("hostProcessDialect(currentHostProcess())");
    expect(source).toContain("Scan or Diff again to apply selected realities.");
    expect(source).not.toContain("Default only");
    expect(source).toContain("None = Codex + Claude Code");
  });

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
    const commands = manifest.contributes.commands.map((item) => item.command);
    const analysis = commands.filter((command) =>
      command !== "ruleblast.selectReality" &&
      command !== "ruleblast.explainScoreboardPath" &&
      command !== "ruleblast.showDetail" &&
      command !== "ruleblast.showIndex"
    );
    expect(analysis.sort()).toEqual([
      "ruleblast.diffFrom",
      "ruleblast.explainActiveFile",
      "ruleblast.openVerifiedCase",
      "ruleblast.scanWorkspace",
    ]);
    expect(commands).toContain("ruleblast.explainScoreboardPath");
    expect(commands).toContain("ruleblast.showDetail");
    expect(commands).toContain("ruleblast.showIndex");
    const extension = readFileSync(join(repositoryRoot, "hosts/vscode/src/extension.ts"), "utf8");
    expect(extension).toContain("renderDetail(");
    expect(extension).toContain("hostTextContext(host");
    expect(extension).toContain("workspaceFileUri");
    expect(readFileSync(join(repositoryRoot, "hosts/vscode/src/tree.ts"), "utf8"))
      .toContain("workspaceFileUri");
    expect(readFileSync(join(repositoryRoot, "hosts/vscode/src/workspace-uri.ts"), "utf8"))
      .toContain("vscode.Uri.joinPath");
    for (const command of commands) {
      expect(command.startsWith("ruleblast.")).toBe(true);
    }
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
