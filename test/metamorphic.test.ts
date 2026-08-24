import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { canonicalJson, sha256 } from "../src/canonical.js";
import { openTrackedWorktree } from "../src/git.js";
import { analyzeCurrent, analyzeDiff } from "../src/impact.js";
import { digestProjectionIdentity } from "../src/domain/payload-relation.js";
import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
  type Projection,
  type ResolvedSource,
} from "../src/model.js";
import { claudeProfile } from "../src/profiles/claude.js";
import { codexProfile } from "../src/profiles/codex.js";
import {
  digestNormalizedPayload,
  unitizePayloadContributions,
  type PreparedProfile,
  type ProfileDefinition,
} from "../src/profiles/profile.js";
import { ManifestSnapshot, type RepositorySnapshot } from "../src/snapshot.js";

type EntryValue = string | { readonly link: string };

function snapshot(
  label: string,
  entries: Readonly<Record<string, EntryValue>>,
  reverse = false,
): ManifestSnapshot {
  const items = Object.entries(entries);
  if (reverse) items.reverse();
  return new ManifestSnapshot({
    schemaVersion: 1,
    label,
    entries: items.map(([path, value]) => ({
      path,
      kind: typeof value === "string" ? "file" : "symlink",
      executable: false,
      base64: Buffer.from(typeof value === "string" ? value : value.link)
        .toString("base64"),
    })),
  });
}

const profiles = [codexProfile, claudeProfile] as const;

function changedPaths(result: Awaited<ReturnType<typeof analyzeDiff>>, profile: string) {
  return result.paths
    .filter((path) => path.changedProfiles.includes(profile))
    .map((path) => path.path);
}

describe("real-profile metamorphic invariants", () => {
  it("produces zero impact for identical snapshots and unrelated code edits", async () => {
    const baseline = {
      "AGENTS.md": "root",
      "CLAUDE.md": "root",
      "src/app.ts": "one",
      "src/other.ts": "two",
    };
    const identical = await analyzeDiff({
      before: snapshot("same", baseline),
      after: snapshot("same", baseline),
      profiles,
    });
    expect(identical.counts).toMatchObject({
      changedStackPathCount: 0,
      newlySplitPathCount: 0,
      convergedPathCount: 0,
    });
    expect(identical.changedInstructionSources).toEqual([]);

    const codeOnly = await analyzeDiff({
      before: snapshot("before", baseline),
      after: snapshot("after", { ...baseline, "src/app.ts": "edited" }),
      profiles,
    });
    expect(codeOnly.counts.changedStackPathCount).toBe(0);
    expect(codeOnly.changedInstructionSources).toEqual([]);
  });

  it("is byte-deterministic across manifest enumeration, runs, cwd, and environment", async () => {
    const entries = {
      "AGENTS.md": "root",
      "CLAUDE.md": "root",
      ".claude/rules/api.md": "---\npaths: [\"src/api/**\"]\n---\napi",
      "src/api/app.ts": "code",
      "src/ui/app.ts": "code",
    };
    const first = await analyzeCurrent({ snapshot: snapshot("same", entries), profiles });
    const second = await analyzeCurrent({ snapshot: snapshot("same", entries, true), profiles });
    const old = process.env.RULEBLAST_METAMORPHIC;
    const cwd = vi.spyOn(process, "cwd").mockReturnValue("Z:\\irrelevant\\location");
    try {
      process.env.RULEBLAST_METAMORPHIC = "changed";
      const third = await analyzeCurrent({ snapshot: snapshot("same", entries), profiles });
      expect(canonicalJson(second)).toBe(canonicalJson(first));
      expect(canonicalJson(third)).toBe(canonicalJson(first));
    } finally {
      cwd.mockRestore();
      if (old === undefined) delete process.env.RULEBLAST_METAMORPHIC;
      else process.env.RULEBLAST_METAMORPHIC = old;
    }
  });

  it("limits root and nested Codex edits to their modeled directory scopes", async () => {
    const base = {
      "AGENTS.md": "root one",
      "packages/AGENTS.md": "package one",
      "packages/api/app.ts": "code",
      "packages/ui/app.ts": "code",
      "src/app.ts": "code",
    };
    const root = await analyzeDiff({
      before: snapshot("before", base),
      after: snapshot("after", { ...base, "AGENTS.md": "root two" }),
      profiles,
    });
    expect(changedPaths(root, OPENAI_CODEX_CLI_PROFILE_ID)).toEqual(
      Object.keys(base).sort(),
    );

    const nested = await analyzeDiff({
      before: snapshot("before", base),
      after: snapshot("after", { ...base, "packages/AGENTS.md": "package two" }),
      profiles,
    });
    expect(changedPaths(nested, OPENAI_CODEX_CLI_PROFILE_ID)).toEqual([
      "packages/AGENTS.md",
      "packages/api/app.ts",
      "packages/ui/app.ts",
    ]);
  });

  it("limits a Claude path-rule edit to matching targets", async () => {
    const rule = (body: string) =>
      `---\npaths: [\"src/api/**\"]\n---\n${body}`;
    const base = {
      ".claude/rules/api.md": rule("first"),
      "src/api/app.ts": "code",
      "src/ui/app.ts": "code",
    };
    const result = await analyzeDiff({
      before: snapshot("before", base),
      after: snapshot("after", { ...base, ".claude/rules/api.md": rule("second") }),
      profiles,
    });
    expect(changedPaths(result, ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID)).toEqual([
      "src/api/app.ts",
    ]);
  });

  it("models a non-empty override addition as same-directory shadowing", async () => {
    const before = {
      "AGENTS.md": "root",
      "packages/AGENTS.md": "package",
      "packages/app.ts": "code",
      "src/app.ts": "code",
    };
    const result = await analyzeDiff({
      before: snapshot("before", before),
      after: snapshot("after", {
        ...before,
        "packages/AGENTS.override.md": "override",
      }),
      profiles,
    });
    expect(changedPaths(result, OPENAI_CODEX_CLI_PROFILE_ID)).toEqual([
      "packages/AGENTS.md",
      "packages/AGENTS.override.md",
      "packages/app.ts",
    ]);
    expect(result.paths.find((path) => path.path === "packages/app.ts")!
      .after.find((item) => item.profile === OPENAI_CODEX_CLI_PROFILE_ID)!.sources)
      .toContainEqual(expect.objectContaining({
        path: "packages/AGENTS.md",
        disposition: "SHADOWED",
      }));
  });

  it("tracks nonstandard imported dependencies but ignores the same non-imported filename", async () => {
    const imported = {
      "CLAUDE.md": "@README.md",
      "README.md": "first",
      "src/app.ts": "code",
    };
    const changed = await analyzeDiff({
      before: snapshot("before", imported),
      after: snapshot("after", { ...imported, "README.md": "second" }),
      profiles,
    });
    expect(changed.changedInstructionSources).toEqual([
      expect.objectContaining({ afterPath: "README.md", kind: "MODIFY" }),
    ]);
    expect(changedPaths(changed, ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID))
      .toEqual(["CLAUDE.md", "README.md", "src/app.ts"]);

    const plain = { "README.md": "first", "src/app.ts": "code" };
    const unchanged = await analyzeDiff({
      before: snapshot("before", plain),
      after: snapshot("after", { ...plain, "README.md": "second" }),
      profiles,
    });
    expect(unchanged.changedInstructionSources).toEqual([]);
    expect(unchanged.counts.changedStackPathCount).toBe(0);
  });

  it("does not inflate blast for a supported exclude edit irrelevant to the target", async () => {
    const settings = (path: string) => JSON.stringify({
      claudeMdExcludes: [`**/${path}/CLAUDE.md`],
    });
    const base = {
      ".claude/settings.json": settings("vendor"),
      "CLAUDE.md": "root",
      "src/app.ts": "code",
    };
    const result = await analyzeDiff({
      before: snapshot("before", base),
      after: snapshot("after", {
        ...base,
        ".claude/settings.json": settings("generated"),
      }),
      profiles,
    });
    expect(changedPaths(result, ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID)).toEqual([]);
    expect(result.changedInstructionSources).toContainEqual(
      expect.objectContaining({ afterPath: ".claude/settings.json" }),
    );
  });

  it("keeps relocatable and unsupported absolute exclusions identical at two real checkout locations", async () => {
    const roots: string[] = [];
    const atLocation = async () => {
      const root = mkdtempSync(join(tmpdir(), "ruleblast-location-"));
      roots.push(root);
      mkdirSync(join(root, ".claude"), { recursive: true });
      mkdirSync(join(root, "vendor"), { recursive: true });
      writeFileSync(join(root, "CLAUDE.md"), "root");
      writeFileSync(join(root, "vendor", "CLAUDE.md"), "excluded nested");
      writeFileSync(join(root, "vendor", "app.ts"), "code");
      writeFileSync(join(root, ".claude", "settings.json"), JSON.stringify({
        claudeMdExcludes: [
          "**/vendor/CLAUDE.md",
          `${root.replace(/\\/g, "/")}/vendor/CLAUDE.md`,
        ],
      }));
      execFileSync("git", ["-C", root, "init"], { stdio: "ignore" });
      execFileSync("git", ["-C", root, "add", "-A"], { stdio: "ignore" });
      return analyzeCurrent({ snapshot: await openTrackedWorktree(root), profiles });
    };
    try {
      const left = await atLocation();
      const right = await atLocation();
      expect(canonicalJson(right)).toBe(canonicalJson(left));
      const projection = left.paths.find((item) => item.path === "vendor/app.ts")!
        .projections.find((item) => item.profile === ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID)!;
      expect(projection.status).toBe("PARTIAL");
      expect(projection.sources).toContainEqual(expect.objectContaining({
        path: "vendor/CLAUDE.md",
        disposition: "EXCLUDED",
      }));
      expect(new Set(projection.evidence)).toEqual(new Set([
        "UNSUPPORTED_EXCLUDE_PATTERN: 1 absolute or drive-prefixed project exclusions were not applied",
      ]));
      expect(JSON.stringify(left)).not.toContain(roots[0]);
      expect(JSON.stringify(right)).not.toContain(roots[1]);
    } finally {
      for (const root of roots) rmSync(root, { recursive: true, force: true });
    }
  }, 20_000);
});

describe("performance-shape invariant", () => {
  it("reads every snapshot blob at most once and relies on prepared-profile caches at 10k paths", async () => {
    const pathCount = 10_000;
    const entries = new Map<string, string>([["rules.md", "before"]]);
    for (let index = 0; index < pathCount; index += 1) {
      entries.set(`src/path-${String(index).padStart(5, "0")}.ts`, "code");
    }
    const reads = new Map<string, number>();
    const baseSnapshot: RepositorySnapshot = {
      ref: { kind: "fixture", label: "large", oid: null },
      async listPaths() { return [...entries.keys()]; },
      async entry(path) {
        return entries.has(path) ? { path, kind: "file", executable: false } : null;
      },
      async read(path) {
        reads.set(path, (reads.get(path) ?? 0) + 1);
        const value = entries.get(path);
        return value === undefined ? null : new TextEncoder().encode(value);
      },
    };
    const projectionCalls = new Map<string, number>();
    function cachedProfile(id: string): ProfileDefinition {
      return {
        id,
        evidence: [],
        isInstructionPath: (path) => path === "rules.md",
        async prepare(repository) {
          const bytes = await repository.read("rules.md");
          const content = new TextDecoder().decode(bytes!);
          const units = unitizePayloadContributions([content]);
          const cache = new Map<string, Projection>();
          return {
            id,
            sourceDependencyPaths: ["rules.md"],
            project(targetPath) {
              const directory = targetPath.slice(0, targetPath.lastIndexOf("/"));
              let value = cache.get(directory);
              if (value === undefined) {
                projectionCalls.set(id, (projectionCalls.get(id) ?? 0) + 1);
                const source: ResolvedSource = {
                  path: "rules.md", disposition: "SELECTED", digest: sha256(content),
                  bytesUsed: content.length, truncated: false,
                };
                value = {
                  profile: id,
                  context: { cwd: ".", trigger: "STARTUP", targetPath, repositoryOnly: true },
                  status: "COMPLETE", composition: "ORDERED", sources: [source],
                  normalizedPayloadUnits: units,
                  projectionDigest: null,
                  normalizedPayloadDigest: digestNormalizedPayload(units, "ORDERED"), evidence: [],
                };
                cache.set(directory, value);
              }
              const projection = { ...value, context: { ...value.context, targetPath } };
              return {
                ...projection,
                projectionDigest: digestProjectionIdentity(projection),
              };
            },
          } satisfies PreparedProfile;
        },
      };
    }
    const result = await analyzeDiff({
      before: baseSnapshot,
      after: baseSnapshot,
      profiles: [
        cachedProfile(OPENAI_CODEX_CLI_PROFILE_ID),
        cachedProfile(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID),
      ],
    });
    expect(result.counts.candidatePathCount).toBe(pathCount + 1);
    expect(result.changedInstructionSources).toEqual([]);
    expect(reads.get("rules.md")).toBe(1);
    expect([...reads.keys()]).toEqual(["rules.md"]);
    expect([...reads.values()].every((count) => count <= 1)).toBe(true);
    expect(projectionCalls).toEqual(new Map([
      [ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, 4],
      [OPENAI_CODEX_CLI_PROFILE_ID, 4],
    ]));
  }, 20_000);
});
