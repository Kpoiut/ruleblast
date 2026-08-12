import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { sha256 } from "../src/canonical.js";
import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  type Projection,
} from "../src/model.js";
import { claudeProfile } from "../src/profiles/claude.js";
import {
  decideClaudeRule,
  expandClaudeBracesBounded,
  expandClaudePatternsBounded,
  parseClaudeRule,
} from "../src/profiles/claude-rules.js";
import { digestNormalizedPayload } from "../src/profiles/profile.js";
import { ManifestSnapshot } from "../src/snapshot.js";
import type { RepositorySnapshot, SnapshotEntry } from "../src/snapshot.js";

const fixtureDirectory = new URL("./fixtures/claude/", import.meta.url);

async function fixture(name: string): Promise<ManifestSnapshot> {
  return new ManifestSnapshot(
    JSON.parse(await readFile(new URL(`${name}.json`, fixtureDirectory), "utf8")),
  );
}

async function project(name: string, targetPath = "src/app.ts") {
  return (await claudeProfile.prepare(await fixture(name))).project(targetPath);
}

function snapshot(
  entries: Readonly<Record<string, string | { link: string }>>,
): ManifestSnapshot {
  return new ManifestSnapshot({
    schemaVersion: 1,
    label: "generated Claude case",
    entries: Object.entries(entries).map(([path, content]) => ({
      path,
      kind: typeof content === "string" ? "file" : "symlink",
      executable: false,
      base64: Buffer.from(
        typeof content === "string" ? content : content.link,
      ).toString("base64"),
    })),
  });
}

async function projectSnapshot(
  entries: Readonly<Record<string, string | { link: string }>>,
  targetPath = "src/app.ts",
): Promise<Projection> {
  return (await claudeProfile.prepare(snapshot(entries))).project(targetPath);
}

describe("Claude profile", () => {
  it("uses root CLAUDE.md for a root-launched target-read projection", async () => {
    const projection = await project("root");

    expect(projection.profile).toBe(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID);
    expect(projection.context).toEqual({
      cwd: ".",
      trigger: "READ_TARGET",
      targetPath: "src/app.ts",
      repositoryOnly: true,
    });
    expect(projection.sources).toMatchObject([
      {
        path: "CLAUDE.md",
        disposition: "SELECTED",
        digest: sha256("root memory"),
      },
    ]);
  });

  it("uses .claude/CLAUDE.md as the documented root alternative", async () => {
    expect(await project("dot-claude-root")).toMatchObject({
      status: "COMPLETE",
      sources: [{ path: ".claude/CLAUDE.md", disposition: "SELECTED" }],
    });
  });

  it("does not invent an order or combined payload for ambiguous root alternatives", async () => {
    const projection = await project("ambiguous-root");
    expect(projection.status).toBe("PARTIAL");
    expect(projection.normalizedPayloadUnits).toEqual([]);
    expect(projection.evidence).toContain(
      "AMBIGUOUS_ROOT_MEMORY: both CLAUDE.md and .claude/CLAUDE.md are tracked; order is not pinned",
    );
  });

  it("loads nested memory only when the target read enters its subtree", async () => {
    expect(
      (await project("nested", "packages/api/app.ts")).sources.map(
        (source) => source.path,
      ),
    ).toEqual(["CLAUDE.md", "packages/CLAUDE.md"]);
    expect(
      (await project("nested", "packages/ui/app.ts")).sources.map(
        (source) => source.path,
      ),
    ).toEqual(["CLAUDE.md", "packages/CLAUDE.md"]);
    expect(
      (await project("nested", "README.md")).sources.map((source) => source.path),
    ).toEqual(["CLAUDE.md"]);
  });

  it("includes and labels tracked CLAUDE.local.md after project memory", async () => {
    const projection = await project("local");
    expect(projection.sources.map((source) => source.path)).toEqual([
      "CLAUDE.md",
      "CLAUDE.local.md",
    ]);
    expect(projection.evidence).toContain(
      "LOCAL_PROJECT_MEMORY: tracked CLAUDE.local.md included in repository-only projection",
    );
  });

  it("applies an unconditional recursive .claude/rules Markdown file", async () => {
    expect(await project("rule-unconditional", "src/api/app.ts")).toMatchObject({
      status: "COMPLETE",
      composition: "ORDERED",
      sources: [{ path: ".claude/rules/general.md", disposition: "APPLIED_RULE" }],
    });
  });

  it("applies a paths rule only to a documented glob match", async () => {
    const apiProjection = await project(
      "rule-path-match",
      "src/api/internal/refund.ts",
    );
    const uiProjection = await project("rule-path-match", "src/ui/app.ts");
    expect(apiProjection.sources.map((source) => source.path)).toContain(
      ".claude/rules/api.md",
    );
    expect(uiProjection.sources.map((source) => source.path)).not.toContain(
      ".claude/rules/api.md",
    );
    expect(apiProjection.context.trigger).toBe("READ_TARGET");
  });

  it("supports multiple documented patterns with bounded brace expansion", async () => {
    expect(
      (await project("rule-braces", "src/view/app.tsx")).sources.map(
        (source) => source.path,
      ),
    ).toContain(".claude/rules/code.md");
    expect(
      (await project("rule-braces", "lib/deep/a.ts")).sources.map(
        (source) => source.path,
      ),
    ).toContain(".claude/rules/code.md");
    expect(
      (await project("rule-braces", "src/view/app.js")).sources.map(
        (source) => source.path,
      ),
    ).not.toContain(".claude/rules/code.md");
  });

  it("marks multiple applicable rules as UNSPECIFIED without inventing precedence", async () => {
    const projection = await project("rule-order-unspecified");
    expect(projection.composition).toBe("UNSPECIFIED");
    expect(projection.sources.map((source) => source.path)).toEqual([
      ".claude/rules/one.md",
      ".claude/rules/two.md",
    ]);
  });

  it("marks project memory combined with an applicable rule as UNSPECIFIED", async () => {
    expect(await project("rule-memory-order-unspecified")).toMatchObject({
      status: "COMPLETE",
      composition: "UNSPECIFIED",
    });
  });

  it("does not promote undocumented glob edges to complete Claude parity", async () => {
    for (const targetPath of ["src/deep/a.ts", "src/deep/a.tsx"]) {
      const projection = await project("glob-edge-cases", targetPath);
      expect(projection.status).toBe("PARTIAL");
      expect(projection.sources.map((source) => source.path)).toContain(
        ".claude/rules/edges.md",
      );
      expect(projection.evidence.some((item) => item.startsWith(
        "UNSUPPORTED_GLOB_SEMANTIC:",
      ))).toBe(true);
    }
    expect((await project("glob-edge-cases", ".config/a.ts")).status).toBe(
      "UNKNOWN",
    );
    for (const targetPath of ["src/file[1].ts", "src/[.ts"]) {
      expect((await project("glob-edge-cases", targetPath)).status).toBe("PARTIAL");
    }
  });

  it("fails closed before materializing excessive brace alternatives or bytes", async () => {
    const projection = await project(
      "glob-budget",
      "src/a/a/a/a/deep/app.ts",
    );
    expect(projection.status).toBe("UNKNOWN");
    expect(projection.evidence.some((item) => item.startsWith(
      "GLOB_BUDGET_EXCEEDED:",
    ))).toBe(true);
    expect(() =>
      expandClaudeBracesBounded(`${"x".repeat(2 * 1024 * 1024)}{a,b,c}`),
    ).toThrow("4 MiB");
  });

  it("resolves recursive imports relative to each containing file", async () => {
    const projection = await project("import-relative");
    expect(projection.status).toBe("COMPLETE");
    expect(projection.sources.map(({ path, disposition }) => ({
      path,
      disposition,
    }))).toEqual([
      { path: "CLAUDE.md", disposition: "SELECTED" },
      { path: "docs/guide.md", disposition: "IMPORTED" },
      { path: "docs/shared.md", disposition: "IMPORTED" },
    ]);
  });

  it("keeps import-looking text inside inline and fenced code literal", async () => {
    const projection = await project("import-code-literal");
    expect(projection.sources.map((source) => source.path)).toEqual([
      "CLAUDE.md",
      "real.md",
    ]);
    expect(projection.normalizedPayloadUnits.flat()).toContain(
      sha256("ruleblast-payload-line-v1\0Use `@inline.md`."),
    );
    expect(projection.normalizedPayloadUnits.flat()).toContain(
      sha256("ruleblast-payload-line-v1\0@fenced.md"),
    );
  });

  it("allows four import edges and marks the fifth edge unknown", async () => {
    const projection = await project("import-depth");
    expect(projection.status).toBe("UNKNOWN");
    expect(projection.sources.map((source) => source.path)).toEqual([
      "CLAUDE.md",
      "one.md",
      "two.md",
      "three.md",
      "four.md",
      "five.md",
    ]);
    expect(projection.sources.at(-1)).toMatchObject({
      disposition: "UNRESOLVED_IMPORT",
      digest: sha256(""),
      bytesUsed: 0,
    });
    expect(projection.evidence).toContain(
      "IMPORT_DEPTH_EXCEEDED: import from four.md exceeds four edges: five.md",
    );
  });

  it("marks an external import unknown without leaking its absolute path", async () => {
    const projection = await project("import-external");
    expect(projection.status).toBe("UNKNOWN");
    expect(projection.sources).toContainEqual({
      path: "<external-import>",
      disposition: "UNRESOLVED_IMPORT",
      digest: sha256(""),
      bytesUsed: 0,
      truncated: false,
    });
    expect(JSON.stringify(projection)).not.toContain("/home/alice");
  });

  it("marks an untracked or missing import unknown rather than absent", async () => {
    const projection = await project("import-missing");
    expect(projection.status).toBe("UNKNOWN");
    expect(projection.sources).toContainEqual({
      path: "docs/missing.md",
      disposition: "UNRESOLVED_IMPORT",
      digest: sha256(""),
      bytesUsed: 0,
      truncated: false,
    });
  });

  it("detects an import cycle before reading the repeated path", async () => {
    const projection = await project("import-cycle");
    expect(projection.status).toBe("UNKNOWN");
    expect(projection.evidence).toContain(
      "IMPORT_CYCLE: CLAUDE.md -> a.md -> b.md -> a.md",
    );
  });

  it("applies location-independent project exclusions to memory, rules, and imports", async () => {
    const prepared = await claudeProfile.prepare(await fixture("excludes-relocatable"));
    const projection = prepared.project("vendor/src/app.ts");
    expect(projection.status).toBe("COMPLETE");
    expect(projection.sources.filter(
      (source) => source.disposition === "EXCLUDED",
    ).map((source) => source.path)).toEqual([
      "vendor/imported.md",
      "vendor/CLAUDE.md",
      ".claude/rules/vendor/no.md",
    ]);
    expect(prepared.sourceDependencyPaths).toContain(".claude/settings.json");
    expect(projection.normalizedPayloadUnits.flat()).not.toContain(
      sha256("ruleblast-payload-line-v1\0vendor import"),
    );
  });

  it("records but does not apply absolute project exclusions or leak checkout paths", async () => {
    const projection = await project("excludes-absolute");
    expect(projection.status).toBe("PARTIAL");
    expect(projection.sources).toMatchObject([
      { path: "CLAUDE.md", disposition: "SELECTED" },
    ]);
    expect(projection.evidence).toContain(
      "UNSUPPORTED_EXCLUDE_PATTERN: 2 absolute or drive-prefixed project exclusions were not applied",
    );
    expect(JSON.stringify(projection)).not.toMatch(/Alice|home\/alice|[A-Z]:\\/);
  });

  it("marks a memory symlink unknown, preserves raw link digest, and reads it once", async () => {
    const base = await fixture("instruction-symlink");
    const read = vi.fn((path: string) => base.read(path));
    const prepared = await claudeProfile.prepare({
      get ref() { return base.ref; },
      listPaths: () => base.listPaths(),
      entry: (path) => base.entry(path),
      read,
    });
    const projection = prepared.project("src/app.ts");
    expect(projection.status).toBe("UNKNOWN");
    expect(projection.sources).toMatchObject([
      { path: "CLAUDE.md", digest: sha256("outside"), bytesUsed: 0 },
    ]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("strips block HTML comments while preserving fenced-code comments", async () => {
    const projection = await project("html-comments");
    const lineDigests = projection.normalizedPayloadUnits.flat();
    expect(lineDigests).toContain(
      sha256("ruleblast-payload-line-v1\0<!-- kept -->"),
    );
    expect(lineDigests).not.toContain(
      sha256("ruleblast-payload-line-v1\0<!-- hidden"),
    );
    expect(lineDigests).not.toContain(
      sha256("ruleblast-payload-line-v1\0block -->"),
    );
  });

  it("marks malformed YAML frontmatter unknown, never unconditionally applicable", async () => {
    const projection = await project("malformed-frontmatter");
    expect(projection.status).toBe("UNKNOWN");
    expect(projection.sources).not.toContainEqual(
      expect.objectContaining({ disposition: "APPLIED_RULE" }),
    );
    expect(projection.evidence).toContain(
      "MALFORMED_RULE_FRONTMATTER: .claude/rules/bad.md",
    );
  });

  it("deduplicates reversed inventory, copies prepared bytes, and returns fresh projections", async () => {
    const raw = new Map([
      ["CLAUDE.md", new TextEncoder().encode("@README.md")],
      ["README.md", new TextEncoder().encode("imported")],
      ["src/app.ts", new TextEncoder().encode("ordinary target")],
    ]);
    const entry = vi.fn(async (path: string): Promise<SnapshotEntry | null> =>
      raw.has(path) ? { path, kind: "file", executable: false } : null,
    );
    const read = vi.fn(async (path: string) => raw.get(path) ?? null);
    const mutable: RepositorySnapshot = {
      ref: { kind: "fixture", label: "mutable Claude", oid: null },
      async listPaths() {
        return ["src/app.ts", "README.md", "CLAUDE.md", "CLAUDE.md"];
      },
      entry,
      read,
    };
    const prepared = await claudeProfile.prepare(mutable);
    raw.get("CLAUDE.md")?.fill("x".charCodeAt(0));
    mutable.entry = async () => { throw new Error("entry after prepare"); };
    mutable.read = async () => { throw new Error("read after prepare"); };
    expect(prepared.sourceDependencyPaths).toEqual(["CLAUDE.md", "README.md"]);
    expect(read.mock.calls.map(([path]) => path)).toEqual(["CLAUDE.md", "README.md"]);

    const first = prepared.project("src/app.ts");
    const expected = JSON.parse(JSON.stringify(first));
    first.sources[0]!.path = "mutated";
    first.normalizedPayloadUnits[0]![0] = "mutated";
    first.evidence.push("mutated");
    expect(prepared.project("src/app.ts")).toEqual(expected);
    expect(() => (prepared.sourceDependencyPaths as string[]).push("mutated"))
      .toThrow(TypeError);
  });

  it("fingerprints only effective Claude semantics and uses the shared payload digest", async () => {
    const base = await projectSnapshot({
      "CLAUDE.md": "visible\n<!-- comment one -->",
      "src/app.ts": "target",
    });
    const strippedChanged = await projectSnapshot({
      "CLAUDE.md": "visible\n<!-- a much longer comment two -->",
      "src/app.ts": "target",
    });
    const effectiveChanged = await projectSnapshot({
      "CLAUDE.md": "changed\n<!-- comment one -->",
      "src/app.ts": "target",
    });
    const nonapplicableChanged = await projectSnapshot({
      "CLAUDE.md": "visible\n<!-- comment one -->",
      ".claude/rules/ui.md": "---\npaths: [\"src/ui/**\"]\n---\nchanged but irrelevant",
      "src/app.ts": "target",
    });
    expect(strippedChanged.sources[0]!.digest).not.toBe(base.sources[0]!.digest);
    expect(strippedChanged.projectionDigest).toBe(base.projectionDigest);
    expect(nonapplicableChanged.projectionDigest).toBe(base.projectionDigest);
    expect(effectiveChanged.projectionDigest).not.toBe(base.projectionDigest);
    expect(base.normalizedPayloadDigest).toBe(
      digestNormalizedPayload(base.normalizedPayloadUnits, base.composition),
    );
  });

  it("enforces exact aggregate brace-count and UTF-8 byte boundaries", () => {
    const thousand = `{${Array.from({ length: 1_000 }, (_, index) => `a${index}`).join(",")}}`;
    const thousandOne = `{${Array.from({ length: 1_001 }, (_, index) => `a${index}`).join(",")}}`;
    expect(expandClaudeBracesBounded(thousand)).toHaveLength(1_000);
    expect(() => expandClaudeBracesBounded(thousandOne)).toThrow("1,000");
    expect(expandClaudePatternsBounded([
      "x".repeat(2 * 1024 * 1024),
      "y".repeat(2 * 1024 * 1024),
    ])).toHaveLength(2);
    expect(() => expandClaudePatternsBounded([
      "x".repeat(2 * 1024 * 1024),
      `y${"y".repeat(2 * 1024 * 1024)}`,
    ])).toThrow("4 MiB");
    const exactUtf8 = `é${"x".repeat(4 * 1024 * 1024 - 2)}`;
    expect(expandClaudePatternsBounded([exactUtf8])).toEqual([exactUtf8]);
    expect(() => expandClaudePatternsBounded([`${exactUtf8}x`])).toThrow("4 MiB");
    expect(expandClaudeBracesBounded("{a,{b,c}}{d,e}")).toEqual([
      "ad", "ae", "bd", "be", "cd", "ce",
    ]);
    expect(expandClaudeBracesBounded("src/{1..3}.ts")).toEqual([
      "src/{1..3}.ts",
    ]);
  });

  it("fails closed for adversarial YAML shapes and distinguishes missing paths from []", () => {
    const rule = (content: string) => parseClaudeRule({
      path: ".claude/rules/case.md",
      kind: "file",
      bytes: new TextEncoder().encode(content),
    });
    for (const content of [
      "---\npaths: [\"src/**\"]\npaths: [\"lib/**\"]\n---\nx",
      "---\npaths: &p [\"src/**\"]\n---\nx",
      "---\nbase: &b { paths: [\"src/**\"] }\n<<: *b\n---\nx",
      "---\npaths: [\"src/**\"\n---\nx",
      "---\npaths: src/**\n---\nx",
      "---\npaths: [1]\n---\nx",
    ]) {
      expect(rule(content).malformed).toBe(true);
    }
    expect(decideClaudeRule(rule("---\n{}\n---\nx"), "src/app.ts").applies)
      .toBe(true);
    expect(decideClaudeRule(rule("---\npaths: []\n---\nx"), "src/app.ts").applies)
      .toBe(false);
  });

  it("recognizes imports only in normal Markdown across varied code delimiters and comments", async () => {
    const projection = await projectSnapshot({
      "CLAUDE.md": [
        "@real.md",
        "``@inline.md``",
        "~~~~md",
        "@tilde.md",
        "~~~~",
        "````md",
        "@four.md",
        "````",
        "<!-- @comment.md -->",
      ].join("\n"),
      "real.md": "real",
      "inline.md": "not imported",
      "tilde.md": "not imported",
      "four.md": "not imported",
      "comment.md": "not imported",
      "src/app.ts": "target",
    });
    expect(projection.sources.map((source) => source.path)).toEqual([
      "CLAUDE.md",
      "real.md",
    ]);
  });

  it("captures a diamond import once but preserves both insertion contributions", async () => {
    const base = snapshot({
      "CLAUDE.md": "@left.md\n@right.md",
      "left.md": "@shared.md",
      "right.md": "@shared.md",
      "shared.md": "shared",
      "src/app.ts": "target",
    });
    const read = vi.fn((path: string) => base.read(path));
    const prepared = await claudeProfile.prepare({
      get ref() { return base.ref; },
      listPaths: () => base.listPaths(),
      entry: (path) => base.entry(path),
      read,
    });
    expect(read.mock.calls.filter(([path]) => path === "shared.md")).toHaveLength(1);
    expect(prepared.project("src/app.ts").sources.filter(
      (source) => source.path === "shared.md",
    )).toHaveLength(2);
  });

  it("keeps import failures local to applicable rules", async () => {
    const prepared = await claudeProfile.prepare(snapshot({
      ".claude/rules/ui.md": "---\npaths: [\"src/ui/**\"]\n---\n@missing.md",
      "src/app.ts": "target",
      "src/ui/view.ts": "target",
    }));
    expect(prepared.project("src/app.ts")).toMatchObject({ status: "COMPLETE" });
    expect(prepared.project("src/ui/view.ts")).toMatchObject({ status: "UNKNOWN" });
  });

  it("marks imported symlinks and repository-escape variants unknown without leaking paths", async () => {
    const importedLink = await projectSnapshot({
      "CLAUDE.md": "@linked.md",
      "linked.md": { link: "../../secret" },
      "src/app.ts": "target",
    });
    expect(importedLink.status).toBe("UNKNOWN");
    expect(importedLink.sources.at(-1)).toMatchObject({
      path: "linked.md",
      disposition: "UNRESOLVED_IMPORT",
      digest: sha256("../../secret"),
    });

    const escaped = await projectSnapshot({
      "CLAUDE.md": "@docs/inside.md\n@../escape.md\n@C:\\secret.md\n@\\\\server\\share.md",
      "docs/inside.md": "@../shared.md",
      "shared.md": "inside repository",
      "src/app.ts": "target",
    });
    expect(escaped.status).toBe("UNKNOWN");
    expect(escaped.sources.map((source) => source.path)).toContain("shared.md");
    expect(JSON.stringify(escaped)).not.toMatch(/C:\\|server|escape\.md/);
  });

  it("keeps punctuation after an import and import-position contributions deterministic", async () => {
    const projection = await projectSnapshot({
      "CLAUDE.md": "before @insert.md, after",
      "insert.md": "inside",
      "src/app.ts": "target",
    });
    const lines = projection.normalizedPayloadUnits;
    expect(lines).toEqual([
      [sha256("ruleblast-payload-line-v1\0before ")],
      [sha256("ruleblast-payload-line-v1\0inside")],
      [sha256("ruleblast-payload-line-v1\0, after")],
    ]);
  });

  it("isolates unsupported dot, bracket, extglob, and case-fold semantics", () => {
    const rule = (pattern: string) => parseClaudeRule({
      path: ".claude/rules/edge.md",
      kind: "file",
      bytes: new TextEncoder().encode(`---\npaths: [${JSON.stringify(pattern)}]\n---\nx`),
    });
    const cases: readonly (readonly [string, string])[] = [
      [".config/*.ts", ".config/a.ts"],
      ["src/file[[]1].ts", "src/file[1].ts"],
      ["src/[.ts", "src/[.ts"],
      ["src/@(api|ui)/**", "src/api/a.ts"],
      ["SRC/**/*.TS", "src/api/a.ts"],
    ];
    for (const [pattern, targetPath] of cases) {
      const decision = decideClaudeRule(rule(pattern), targetPath);
      expect(decision.status).toBe("UNKNOWN");
      expect(decision.evidence[0]).toMatch(/^UNSUPPORTED_GLOB_SEMANTIC:/);
    }
    expect(decideClaudeRule(rule("src/**/*.{ts,tsx}"), "src/api/a.ts"))
      .toMatchObject({ applies: true, status: "COMPLETE" });
  });

  it("fails closed for rule symlinks unless a supported exclusion removes the boundary", async () => {
    const entries = {
      ".claude/rules/link.md": { link: "outside" },
      "src/app.ts": "target",
    } as const;
    expect(await projectSnapshot(entries)).toMatchObject({ status: "UNKNOWN" });
    const excluded = await projectSnapshot({
      ...entries,
      ".claude/settings.json": JSON.stringify({
        claudeMdExcludes: ["**/.claude/rules/link.md"],
      }),
    });
    expect(excluded.status).toBe("COMPLETE");
    expect(excluded.sources).toContainEqual(
      expect.objectContaining({
        path: ".claude/rules/link.md",
        disposition: "EXCLUDED",
      }),
    );
  });

  it("fails preparation on accessor-backed or inconsistent candidate entries", async () => {
    const kind = vi.fn(() => "file");
    const accessor = { path: "CLAUDE.md", executable: false };
    Object.defineProperty(accessor, "kind", { get: kind, enumerable: true });
    await expect(claudeProfile.prepare({
      ref: { kind: "fixture", label: "accessor", oid: null },
      async listPaths() { return ["CLAUDE.md"]; },
      async entry() { return accessor as unknown as SnapshotEntry; },
      async read() { return new TextEncoder().encode("ignored"); },
    })).rejects.toThrow(TypeError);
    expect(kind).not.toHaveBeenCalled();

    await expect(claudeProfile.prepare({
      ref: { kind: "fixture", label: "missing", oid: null },
      async listPaths() { return ["CLAUDE.md"]; },
      async entry() { return null; },
      async read() { return null; },
    })).rejects.toThrow("Missing Claude snapshot entry");
  });

  it("keeps project exclusion fingerprints relocatable and raw-byte independent", async () => {
    const settings = (pattern: string, pretty = false) => JSON.stringify(
      { claudeMdExcludes: [pattern] },
      null,
      pretty ? 2 : undefined,
    );
    const first = await projectSnapshot({
      ".claude/settings.json": settings("**/vendor/CLAUDE.md"),
      "CLAUDE.md": "root",
      "vendor/CLAUDE.md": "first excluded raw bytes",
      "vendor/app.ts": "target",
    }, "vendor/app.ts");
    const rawChanged = await projectSnapshot({
      ".claude/settings.json": settings("**/vendor/CLAUDE.md", true),
      "CLAUDE.md": "root",
      "vendor/CLAUDE.md": "second excluded raw bytes",
      "vendor/app.ts": "target",
    }, "vendor/app.ts");
    const semanticChanged = await projectSnapshot({
      ".claude/settings.json": settings("**/other/CLAUDE.md"),
      "CLAUDE.md": "root",
      "vendor/CLAUDE.md": "first excluded raw bytes",
      "vendor/app.ts": "target",
    }, "vendor/app.ts");
    expect(rawChanged.projectionDigest).toBe(first.projectionDigest);
    expect(semanticChanged.projectionDigest).not.toBe(first.projectionDigest);
  });

  it("keeps ambiguous root alternatives inspectable in canonical display order", async () => {
    const projection = await project("ambiguous-root");
    expect(projection.sources).toEqual([
      {
        path: "CLAUDE.md",
        disposition: "SELECTED",
        digest: sha256("root"),
        bytesUsed: 0,
        truncated: false,
      },
      {
        path: ".claude/CLAUDE.md",
        disposition: "SELECTED",
        digest: sha256("dot root"),
        bytesUsed: 0,
        truncated: false,
      },
    ]);
  });

  it("fails malformed tracked project settings closed but ignores unrelated fields", async () => {
    for (const content of [
      "{",
      "null",
      "[]",
      JSON.stringify({ claudeMdExcludes: "**/vendor/**" }),
      JSON.stringify({ claudeMdExcludes: [1] }),
    ]) {
      expect(await projectSnapshot({
        ".claude/settings.json": content,
        "CLAUDE.md": "root",
        "src/app.ts": "target",
      })).toMatchObject({ status: "UNKNOWN" });
    }
    expect(await projectSnapshot({
      ".claude/settings.json": JSON.stringify({ unrelated: "ignored" }),
      "CLAUDE.md": "root",
      "src/app.ts": "target",
    })).toMatchObject({ status: "COMPLETE" });
    expect(await projectSnapshot({
      ".claude/settings.json": { link: "outside" },
      "CLAUDE.md": "root",
      "src/app.ts": "target",
    })).toMatchObject({ status: "UNKNOWN" });
  });

  it("discovers imports from rule bodies, never from their frontmatter", async () => {
    const prepared = await claudeProfile.prepare(snapshot({
      ".claude/rules/body.md": [
        "---",
        "paths: [\"@frontmatter.md\"]",
        "---",
        "@../../body.md",
      ].join("\n"),
      ".claude/rules/frontmatter.md": "not an import",
      "body.md": "body import",
      "src/app.ts": "target",
    }));
    expect(prepared.sourceDependencyPaths).toContain("body.md");
    expect(prepared.sourceDependencyPaths).not.toContain("frontmatter.md");
  });

  it("changes semantic fingerprints for imported payload and composition", async () => {
    const first = await projectSnapshot({
      "CLAUDE.md": "@README.md",
      "README.md": "first",
      "src/app.ts": "target",
    });
    const importedChanged = await projectSnapshot({
      "CLAUDE.md": "@README.md",
      "README.md": "second",
      "src/app.ts": "target",
    });
    const ruleAdded = await projectSnapshot({
      "CLAUDE.md": "@README.md",
      "README.md": "first",
      ".claude/rules/all.md": "rule",
      "src/app.ts": "target",
    });
    expect(importedChanged.projectionDigest).not.toBe(first.projectionDigest);
    expect(ruleAdded.composition).toBe("UNSPECIFIED");
    expect(ruleAdded.projectionDigest).not.toBe(first.projectionDigest);
    expect(await projectSnapshot({
      "CLAUDE.md": "",
      ".claude/rules/all.md": "rule",
      "src/app.ts": "target",
    })).toMatchObject({ composition: "UNSPECIFIED" });
  });

  it("projects only captured repository state without ambient reads", async () => {
    const base = snapshot({ "CLAUDE.md": "root", "src/app.ts": "target" });
    const prepared = await claudeProfile.prepare(base);
    const expected = prepared.project("src/app.ts");
    const cwd = vi.spyOn(process, "cwd").mockImplementation(() => {
      throw new Error("ambient cwd read");
    });
    const now = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("wall-clock read");
    });
    vi.stubGlobal("fetch", () => { throw new Error("network read"); });
    const previous = process.env.RULEBLAST_CLAUDE_TEST;
    try {
      process.env.RULEBLAST_CLAUDE_TEST = "changed";
      expect(prepared.project("src/app.ts")).toEqual(expected);
    } finally {
      previous === undefined
        ? delete process.env.RULEBLAST_CLAUDE_TEST
        : process.env.RULEBLAST_CLAUDE_TEST = previous;
      cwd.mockRestore();
      now.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("pins individual official evidence claims without runtime fetching", () => {
    expect(claudeProfile.evidence).toHaveLength(7);
    expect(claudeProfile.evidence.every((item) =>
      item.url === "https://code.claude.com/docs/en/memory" &&
      item.retrievedAt === "2026-08-12",
    )).toBe(true);
    expect(claudeProfile.evidence.map((item) => item.claim).join(" ")).toMatch(
      /locations.*ancestor.*imports.*rules.*glob.*exclude.*comment/is,
    );
  });

  it("turns dependency glob limits and leading magic into explicit unknown semantics", () => {
    const rule = (pattern: string) => parseClaudeRule({
      path: ".claude/rules/dependency.md",
      kind: "file",
      bytes: new TextEncoder().encode(`---\npaths: [${JSON.stringify(pattern)}]\n---\nx`),
    });
    for (const pattern of [
      "x".repeat(70_000),
      `${"x".repeat(70_000)}{a,b}`,
      "!src/**",
      "#src/**",
    ]) {
      expect(decideClaudeRule(rule(pattern), "src/app.ts")).toMatchObject({
        applies: null,
        status: "UNKNOWN",
      });
    }
    expect(() => expandClaudePatternsBounded([
      `${"x".repeat(70_000)}{a,b}`,
    ])).toThrow("matcher limits");
  });

  it("does not let unsupported exclusions hide instruction boundaries", async () => {
    const projection = await projectSnapshot({
      ".claude/settings.json": JSON.stringify({
        claudeMdExcludes: ["**/.claude/rules/[l]ink.md"],
      }),
      ".claude/rules/link.md": { link: "outside" },
      "src/app.ts": "target",
    });
    expect(projection.status).toBe("UNKNOWN");
    expect(projection.sources).not.toContainEqual(
      expect.objectContaining({ disposition: "EXCLUDED" }),
    );
    expect(projection.evidence.join(" ")).toMatch(/UNSUPPORTED_GLOB_SEMANTIC/);
  });

  it("does not let ambiguous roots mask a stronger applicable-rule boundary", async () => {
    const projection = await projectSnapshot({
      "CLAUDE.md": "root",
      ".claude/CLAUDE.md": "dot root",
      ".claude/rules/link.md": { link: "outside" },
      "src/app.ts": "target",
    });
    expect(projection.status).toBe("UNKNOWN");
    expect(projection.sources.map((source) => source.path)).toContain(
      ".claude/rules/link.md",
    );
  });

  it("bounds prepared dependency capture at four import edges", async () => {
    const base = snapshot({
      "CLAUDE.md": "@one.md",
      "one.md": "@two.md",
      "two.md": "@three.md",
      "three.md": "@four.md",
      "four.md": "@five.md",
      "five.md": "too deep",
      "src/app.ts": "target",
    });
    const read = vi.fn((path: string) => base.read(path));
    const prepared = await claudeProfile.prepare({
      get ref() { return base.ref; },
      listPaths: () => base.listPaths(),
      entry: (path) => base.entry(path),
      read,
    });
    expect(prepared.sourceDependencyPaths).not.toContain("five.md");
    expect(read.mock.calls.some(([path]) => path === "five.md")).toBe(false);
    expect(prepared.project("src/app.ts")).toMatchObject({ status: "UNKNOWN" });
  });

  it("treats lone-CR frontmatter-like rule text as malformed, never unconditional", async () => {
    const projection = await projectSnapshot({
      ".claude/rules/cr.md": "---\rpaths:\r  - src/api/**\r---\rNever global",
      "src/ui/app.ts": "target",
    }, "src/ui/app.ts");
    expect(projection.status).toBe("UNKNOWN");
    expect(projection.sources).not.toContainEqual(
      expect.objectContaining({ disposition: "APPLIED_RULE" }),
    );
  });

  it("applies root exclusions and symlink boundaries before root ambiguity", async () => {
    const symlinkedAlternative = await projectSnapshot({
      "CLAUDE.md": "root",
      ".claude/CLAUDE.md": { link: "outside" },
      "src/app.ts": "target",
    });
    expect(symlinkedAlternative.status).toBe("UNKNOWN");
    expect(symlinkedAlternative.sources).toContainEqual(
      expect.objectContaining({
        path: ".claude/CLAUDE.md",
        digest: sha256("outside"),
        bytesUsed: 0,
      }),
    );
    expect(symlinkedAlternative.evidence).not.toContain(
      "AMBIGUOUS_ROOT_MEMORY: both CLAUDE.md and .claude/CLAUDE.md are tracked; order is not pinned",
    );

    const excludedAlternative = await projectSnapshot({
      ".claude/settings.json": JSON.stringify({
        claudeMdExcludes: ["**/.claude/CLAUDE.md"],
      }),
      "CLAUDE.md": "root",
      ".claude/CLAUDE.md": "excluded dot root",
      "src/app.ts": "target",
    });
    expect(excludedAlternative.status).toBe("COMPLETE");
    expect(excludedAlternative.sources.map(({ path, disposition }) => ({
      path, disposition,
    }))).toEqual([
      { path: "CLAUDE.md", disposition: "SELECTED" },
      { path: ".claude/CLAUDE.md", disposition: "EXCLUDED" },
    ]);
  });

  it("reads a dependency once when deep and shallow discovery paths converge", async () => {
    const base = snapshot({
      ".claude/rules/early.md": "@../../imports/a.md",
      "imports/a.md": "@b.md",
      "imports/b.md": "@c.md",
      "imports/c.md": "@shared.md",
      "imports/shared.md": "shared",
      "z/CLAUDE.md": "@../imports/shared.md",
      "z/app.ts": "target",
    });
    const read = vi.fn((path: string) => base.read(path));
    const prepared = await claudeProfile.prepare({
      get ref() { return base.ref; },
      listPaths: () => base.listPaths(),
      entry: (path) => base.entry(path),
      read,
    });
    expect(read.mock.calls.filter(([path]) => path === "imports/shared.md"))
      .toHaveLength(1);
    expect(prepared.sourceDependencyPaths).toContain("imports/shared.md");
  });

  it("maps excessive brace nesting to unknown instead of overflowing the stack", () => {
    const nested = `${"{".repeat(5_000)}a,b${"}".repeat(5_000)}`;
    const rule = parseClaudeRule({
      path: ".claude/rules/nested.md",
      kind: "file",
      bytes: new TextEncoder().encode(
        `---\npaths: [${JSON.stringify(nested)}]\n---\nrule`,
      ),
    });
    expect(decideClaudeRule(rule, "src/app.ts")).toMatchObject({
      applies: null,
      status: "UNKNOWN",
    });
    expect(() => expandClaudeBracesBounded(nested)).toThrow("nesting");
  });

  it("does not treat email addresses or escaped at-signs as imports", async () => {
    const prepared = await claudeProfile.prepare(snapshot({
      "CLAUDE.md": "Contact dev@example.com\n\\@escaped.md\n@real.md",
      "example.com": "email domain, not import",
      "escaped.md": "escaped, not import",
      "real.md": "real import",
      "src/app.ts": "target",
    }));
    expect(prepared.sourceDependencyPaths).toEqual(["CLAUDE.md", "real.md"]);
    expect(prepared.project("src/app.ts").sources.map((source) => source.path))
      .toEqual(["CLAUDE.md", "real.md"]);
  });
});
