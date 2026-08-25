import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CliUsageError, parseArgs } from "../src/args.js";
import { canonicalJson } from "../src/canonical.js";
import { loadBundledPack } from "../src/packs/load.js";
import { profileFromCompiledPack } from "../src/packs/profile.js";
import { copilotProfile, GITHUB_COPILOT_CLI_PROFILE_ID } from "../src/profiles/copilot.js";
import { ManifestSnapshot } from "../src/snapshot.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtureRoot = join(repositoryRoot, "test/fixtures/copilot");

function fixture(name: string): ManifestSnapshot {
  return new ManifestSnapshot(
    JSON.parse(readFileSync(join(fixtureRoot, `${name}.json`), "utf8")),
  );
}

describe("github/copilot-cli@1", () => {
  it("selects repository-wide instructions and excludes a non-matching applyTo rule", async () => {
    const prepared = await copilotProfile.prepare(fixture("repo-wide"));
    const web = prepared.project("web/app.ts");
    const core = prepared.project("src/core.ts");
    expect(web.profile).toBe(GITHUB_COPILOT_CLI_PROFILE_ID);
    expect(web.composition).toBe("UNSPECIFIED");
    expect(web.sources.map((source) => [source.path, source.disposition])).toEqual(
      expect.arrayContaining([
        [".github/copilot-instructions.md", "SELECTED"],
        [".github/instructions/front.instructions.md", "SELECTED"],
      ]),
    );
    expect(core.sources.some((source) =>
      source.path === ".github/instructions/front.instructions.md" &&
      source.disposition === "EXCLUDED"
    )).toBe(true);
    expect(core.sources.some((source) =>
      source.path === ".github/copilot-instructions.md" &&
      source.disposition === "SELECTED"
    )).toBe(true);
  });

  it("keeps an instruction symlink UNKNOWN and does not follow it into payload", async () => {
    const prepared = await copilotProfile.prepare(fixture("symlink-instructions"));
    const projection = prepared.project("src/file.ts");
    expect(projection.status).toBe("UNKNOWN");
    expect(projection.sources).toEqual([
      expect.objectContaining({
        path: ".github/copilot-instructions.md",
        disposition: "SELECTED",
        bytesUsed: 0,
        truncated: false,
      }),
    ]);
    expect(projection.normalizedPayloadUnits).toEqual([]);
    expect(projection.evidence.some((item) => /symlink/iu.test(item))).toBe(true);
    expect(JSON.stringify(projection.normalizedPayloadUnits)).not.toContain("actual-body");
  });

  it("scopes nested .github/copilot-instructions.md to the documented standard-location subtree", async () => {
    const prepared = await copilotProfile.prepare(fixture("nested-instructions"));
    expect([...prepared.sourceDependencyPaths]).toEqual([
      ".github/copilot-instructions.md",
      "packages/api/.github/copilot-instructions.md",
    ]);
    const api = prepared.project("packages/api/src/app.ts");
    const ui = prepared.project("packages/ui/src/app.ts");
    expect(api.status).toBe("COMPLETE");
    expect(api.sources.map((source) => [source.path, source.disposition])).toEqual([
      [".github/copilot-instructions.md", "SELECTED"],
      ["packages/api/.github/copilot-instructions.md", "SELECTED"],
    ]);
    expect(ui.sources.map((source) => [source.path, source.disposition])).toEqual([
      [".github/copilot-instructions.md", "SELECTED"],
    ]);
    const resolver = JSON.parse(
      readFileSync(join(repositoryRoot, "packs/bundled/github-copilot-cli@1/resolver.json"), "utf8"),
    ) as {
      readonly discover: {
        readonly origins: readonly { readonly kind: string; readonly pattern?: string }[];
      };
    };
    expect(resolver.discover.origins.some((origin) =>
      origin.kind === "glob" && origin.pattern === "**/.github/copilot-instructions.md"
    )).toBe(true);
  });

  it("scopes nested .claude/CLAUDE.md as a Copilot agent file in standard locations", async () => {
    const prepared = await copilotProfile.prepare(fixture("nested-dot-claude"));
    expect([...prepared.sourceDependencyPaths]).toEqual([
      "packages/api/.claude/CLAUDE.md",
    ]);
    const api = prepared.project("packages/api/src/app.ts");
    const ui = prepared.project("packages/ui/src/app.ts");
    expect(api.sources.map((source) => source.path)).toEqual([
      "packages/api/.claude/CLAUDE.md",
    ]);
    expect(api.sources[0]?.disposition).toBe("SELECTED");
    expect(ui.sources).toEqual([]);
  });

  it("discovers tracked .claude/CLAUDE.md from the Copilot CLI instruction table", async () => {
    const resolver = JSON.parse(
      readFileSync(join(repositoryRoot, "packs/bundled/github-copilot-cli@1/resolver.json"), "utf8"),
    ) as {
      readonly discover: {
        readonly origins: readonly {
          readonly kind: string;
          readonly paths?: readonly string[];
          readonly pattern?: string;
        }[];
      };
    };
    expect(resolver.discover.origins.some((origin) =>
      origin.kind === "glob" && origin.pattern === "**/.claude/CLAUDE.md"
    )).toBe(true);
    const prepared = await copilotProfile.prepare(fixture("dot-claude"));
    const projection = prepared.project("src/file.ts");
    expect(projection.status).toBe("COMPLETE");
    expect(projection.sources.map((source) => source.path)).toEqual([".claude/CLAUDE.md"]);
    expect(projection.sources[0]?.disposition).toBe("SELECTED");
  });

  it("selects documented agent instruction files without claiming precedence", async () => {
    const prepared = await copilotProfile.prepare(fixture("agents-claude"));
    const projection = prepared.project("src/file.ts");
    expect(projection.composition).toBe("UNSPECIFIED");
    expect(projection.sources.map((source) => source.path).sort()).toEqual([
      "AGENTS.md",
      "CLAUDE.md",
    ]);
    expect(projection.sources.every((source) => source.disposition === "SELECTED")).toBe(true);
  });

  it("does not share Copilot applyTo material across two files in the same directory", async () => {
    const snapshot = new ManifestSnapshot({
      schemaVersion: 1,
      label: "same-dir-apply",
      entries: [
        {
          path: ".github/instructions/ts.instructions.md",
          kind: "file",
          executable: false,
          base64: Buffer.from("---\napplyTo: \"**/*.ts\"\n---\nts only\n").toString("base64"),
        },
        {
          path: "src/app.ts",
          kind: "file",
          executable: false,
          base64: Buffer.from("code\n").toString("base64"),
        },
        {
          path: "src/app.md",
          kind: "file",
          executable: false,
          base64: Buffer.from("doc\n").toString("base64"),
        },
      ],
    });
    const prepared = await copilotProfile.prepare(snapshot);
    const ts = prepared.project("src/app.ts");
    const md = prepared.project("src/app.md");
    expect(ts.sources.map((source) => [source.path, source.disposition])).toEqual([
      [".github/instructions/ts.instructions.md", "SELECTED"],
    ]);
    expect(md.sources.map((source) => [source.path, source.disposition])).toEqual([
      [".github/instructions/ts.instructions.md", "EXCLUDED"],
    ]);
    const engine = await profileFromCompiledPack(
      loadBundledPack("github-copilot-cli@1"),
    ).prepare(snapshot);
    expect(canonicalJson(engine.project("src/app.ts"))).toBe(canonicalJson(ts));
    expect(canonicalJson(engine.project("src/app.md"))).toBe(canonicalJson(md));
  });

  it("discovers nested .github/instructions modular files in documented standard locations", async () => {
    const prepared = await copilotProfile.prepare(fixture("nested-modular"));
    expect([...prepared.sourceDependencyPaths]).toEqual([
      "packages/api/.github/instructions/api.instructions.md",
    ]);
    const api = prepared.project("packages/api/src/app.ts");
    const ui = prepared.project("packages/ui/src/app.ts");
    expect(api.status).toBe("COMPLETE");
    expect(api.sources.map((source) => [source.path, source.disposition])).toEqual([
      ["packages/api/.github/instructions/api.instructions.md", "SELECTED"],
    ]);
    expect(ui.sources).toEqual([]);
    expect(ui.status).toBe("COMPLETE");
    const resolver = JSON.parse(
      readFileSync(join(repositoryRoot, "packs/bundled/github-copilot-cli@1/resolver.json"), "utf8"),
    ) as {
      readonly discover: {
        readonly origins: readonly { readonly kind: string; readonly pattern?: string }[];
      };
    };
    expect(resolver.discover.origins.some((origin) =>
      origin.kind === "glob" &&
      origin.pattern === "**/.github/instructions/**/*.instructions.md"
    )).toBe(true);
  });

  it("does not invent payload for a modular file without applyTo", async () => {
    const prepared = await copilotProfile.prepare(fixture("loose-instructions"));
    const projection = prepared.project("src/file.ts");
    expect(projection.sources).toEqual([
      expect.objectContaining({
        path: ".github/instructions/loose.instructions.md",
        disposition: "EXCLUDED",
      }),
    ]);
    expect(projection.normalizedPayloadUnits).toEqual([]);
  });
});

describe("default two-profile gate", () => {
  it("keeps production DEFAULT_PROFILES as Claude then Codex", () => {
    const source = readFileSync(join(repositoryRoot, "src/cli.ts"), "utf8");
    expect(source).toContain("defaultProfileDefinitions()");
    expect(source).not.toContain("copilotProfile");
  });
});

describe("--reality", () => {
  it("accepts only the documented Copilot CLI surface on analysis actions", () => {
    expect(parseArgs([".", "--reality", "github/copilot-cli@1"])).toMatchObject({
      action: "scan", realities: ["github/copilot-cli@1"],
    });
    expect(parseArgs(["diff", "HEAD~1", "--reality", "github/copilot-cli@1"]))
      .toMatchObject({ action: "diff", realities: ["github/copilot-cli@1"] });
    expect(parseArgs(["."])).toMatchObject({ action: "scan", realities: [] });
  });

  it("rejects unknown surfaces, duplicates, and --reality on the packaged case", () => {
    expect(() => parseArgs([".", "--reality", "github/copilot-vscode@1"]))
      .toThrow(CliUsageError);
    expect(() => parseArgs([".", "--reality", "github/copilot-cli@1", "--reality", "github/copilot-cli@1"]))
      .toThrow(CliUsageError);
    expect(() => parseArgs(["case", "--reality", "github/copilot-cli@1"]))
      .toThrow(/packaged case/iu);
  });
});
