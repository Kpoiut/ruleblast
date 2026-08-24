import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTROL_BINDINGS, CONTROL_CHORD } from "../src/application/control-keys.js";
import { renderCliHelp } from "../src/cli-help.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe("control keys", () => {
  it("freezes one S D E C chord for the four existing actions", () => {
    expect(CONTROL_CHORD).toBe("Ctrl+Alt+R");
    expect(CONTROL_BINDINGS.map((row) => row.id)).toEqual([
      "scan", "diff", "explain", "case",
    ]);
    expect(CONTROL_BINDINGS.map((row) => row.token)).toEqual(["S", "D", "E", "C"]);
    expect(CONTROL_BINDINGS.map((row) => row.cli)).toEqual([".", "diff", "explain", "case"]);
    expect(CONTROL_BINDINGS.map((row) => row.command)).toEqual([
      "ruleblast.scanWorkspace",
      "ruleblast.diffFrom",
      "ruleblast.explainActiveFile",
      "ruleblast.openVerifiedCase",
    ]);
  });

  it("prints the same chord on CLI help", () => {
    const help = renderCliHelp();
    expect(help).toContain("Ctrl+Alt+R");
    expect(help).toContain("S scan");
    expect(help).toContain("D diff");
    expect(help).toContain("E explain");
    expect(help).toContain("C case");
    expect(help).not.toMatch(/ruleblast scan\b/u);
  });

  it("binds the companion chord and view toolbar to those four commands", () => {
    const manifest = JSON.parse(
      readFileSync(join(repositoryRoot, "hosts/vscode/package.json"), "utf8"),
    ) as {
      readonly contributes: {
        readonly keybindings?: readonly { readonly key: string; readonly command: string }[];
        readonly menus?: {
          readonly commandPalette?: readonly { readonly command: string; readonly when?: string }[];
          readonly "view/title"?: readonly { readonly command: string }[];
          readonly "explorer/context"?: readonly { readonly command: string }[];
          readonly "editor/context"?: readonly { readonly command: string }[];
          readonly "editor/title/context"?: readonly { readonly command: string }[];
        };
      };
    };
    const keys = manifest.contributes.keybindings ?? [];
    expect(keys.map((row) => row.command)).toEqual([
      "ruleblast.scanWorkspace",
      "ruleblast.diffFrom",
      "ruleblast.explainActiveFile",
      "ruleblast.openVerifiedCase",
    ]);
    expect(keys.every((row) => row.key.startsWith("ctrl+alt+r "))).toBe(true);
    expect(keys.map((row) => row.key.slice(-1))).toEqual(["s", "d", "e", "c"]);
    const title = manifest.contributes.menus?.["view/title"] ?? [];
    expect(title.map((row) => row.command).slice(0, 4)).toEqual([
      "ruleblast.scanWorkspace",
      "ruleblast.diffFrom",
      "ruleblast.explainActiveFile",
      "ruleblast.openVerifiedCase",
    ]);
    expect(title.map((row) => row.command)).toEqual([
      "ruleblast.scanWorkspace",
      "ruleblast.diffFrom",
      "ruleblast.explainActiveFile",
      "ruleblast.openVerifiedCase",
      "ruleblast.showDetail",
      "ruleblast.showIndex",
      "ruleblast.selectReality",
    ]);
    expect(manifest.contributes.menus?.["explorer/context"]?.some(
      (row) => row.command === "ruleblast.explainActiveFile",
    )).toBe(true);
    expect(manifest.contributes.menus?.["editor/context"]?.some(
      (row) => row.command === "ruleblast.explainActiveFile",
    )).toBe(true);
    expect(manifest.contributes.menus?.["editor/title/context"]?.some(
      (row) => row.command === "ruleblast.explainActiveFile",
    )).toBe(true);
    expect(manifest.contributes.menus?.commandPalette).toContainEqual({
      command: "ruleblast.explainScoreboardPath",
      when: "false",
    });
  });
});
