import { describe, expect, it } from "vitest";
import { sha256 } from "../src/canonical.js";
import type {
  CompositionState,
  PayloadRelation,
  Projection,
  ResolvedSource,
} from "../src/model.js";
import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
  parseProfileId,
} from "../src/model.js";
import {
  aggregatePayloadRelation,
  assertProjectionDigestSeal,
  comparePayloadRelation,
  digestProjectionIdentity,
  splitState,
} from "../src/domain/payload-relation.js";
import { compareCodePoints } from "../src/domain/repository-path.js";
import {
  cacheRepositorySnapshot,
  projectPreparedProfiles,
} from "../src/application/projection-boundary.js";
import { analyzeCurrent, analyzeDiff } from "../src/impact.js";
import {
  digestNormalizedPayload,
  unitizePayloadContributions,
} from "../src/profiles/profile.js";
import type {
  PreparedProfile,
  ProfileDefinition,
} from "../src/profiles/profile.js";
import { ManifestSnapshot, type RepositorySnapshot } from "../src/snapshot.js";

const line = (value: string): string =>
  sha256(`ruleblast-payload-line-v1\0${value}`);

function projection(
  units: string[][],
  composition: CompositionState,
  status: Projection["status"] = "COMPLETE",
  overrides: Partial<Projection> = {},
): Projection {
  const base: Projection = {
    profile: "example/profile@1",
    context: {
      cwd: ".",
      trigger: "READ_TARGET",
      targetPath: "src/app.ts",
      repositoryOnly: true,
    },
    status,
    composition,
    sources: [],
    normalizedPayloadUnits: units,
    projectionDigest: null,
    normalizedPayloadDigest: status === "UNKNOWN"
      ? null
      : digestNormalizedPayload(units, composition),
    evidence: [],
  };
  const merged = { ...base, ...overrides };
  if (merged.projectionDigest !== null || merged.status === "UNKNOWN") return merged;
  return { ...merged, projectionDigest: digestProjectionIdentity(merged) };
}

function manifest(
  label: string,
  entries: Readonly<Record<string, string>>,
): ManifestSnapshot {
  return new ManifestSnapshot({
    schemaVersion: 1,
    label,
    entries: Object.entries(entries).map(([path, content]) => ({
      path,
      kind: "file",
      executable: false,
      base64: Buffer.from(content).toString("base64"),
    })),
  });
}

type ProjectScript = (
  snapshotLabel: string,
  targetPath: string,
  profile: string,
) => Projection;

function scriptedProfile(
  id: string,
  script: ProjectScript,
  dependencies: readonly string[] = ["rules.md"],
): ProfileDefinition {
  return {
    id,
    evidence: [],
    isInstructionPath: (path) => dependencies.includes(path),
    async prepare(snapshot): Promise<PreparedProfile> {
      const label = snapshot.ref.label;
      return {
        id,
        sourceDependencyPaths: dependencies,
        project: (targetPath) => script(label, targetPath, id),
      };
    },
  };
}

function scriptedProjection(
  profile: string,
  targetPath: string,
  payload: string,
  digestRevision: string,
  status: Projection["status"] = "COMPLETE",
  sources: readonly ResolvedSource[] = [{
    path: "rules.md",
    disposition: "SELECTED",
    digest: sha256("rules"),
    bytesUsed: 5,
    truncated: false,
  }],
): Projection {
  const units = [[line(payload)]];
  return projection(units, "ORDERED", status, {
    profile,
    context: {
      cwd: ".",
      trigger: "READ_TARGET",
      targetPath,
      repositoryOnly: true,
    },
    sources: sources.map((source) => ({ ...source })),
    evidence: digestRevision === "stable" ? [] : [`stack:${digestRevision}`],
  });
}

describe("payload relation", () => {
  const a = [line("A")];
  const b = [line("B")];
  const cases: readonly [
    string,
    Projection,
    Projection,
    PayloadRelation,
  ][] = [
    ["equal ordered sequences", projection([a, b], "ORDERED"), projection([a, b], "ORDERED"), "SAME"],
    ["reordered ordered sequences", projection([a, b], "ORDERED"), projection([b, a], "ORDERED"), "DIFFERENT"],
    ["equal unordered multisets", projection([a, b], "UNORDERED"), projection([b, a], "UNORDERED"), "SAME"],
    ["ordered versus unordered equal multisets", projection([a, b], "ORDERED"), projection([b, a], "UNORDERED"), "INDETERMINATE"],
    ["ordered versus unspecified equal multisets", projection([a, b], "ORDERED"), projection([b, a], "UNSPECIFIED"), "INDETERMINATE"],
    ["ordered versus unspecified unequal multisets", projection([a, b], "ORDERED"), projection([a], "UNSPECIFIED"), "DIFFERENT"],
    ["runtime-decided", projection([a], "RUNTIME_DECIDED"), projection([b], "ORDERED"), "INDETERMINATE"],
    ["partial", projection([a], "ORDERED", "PARTIAL"), projection([b], "ORDERED"), "INDETERMINATE"],
    ["unknown", projection([], "ORDERED", "UNKNOWN"), projection([b], "ORDERED"), "INDETERMINATE"],
  ];

  it.each(cases)("classifies %s", (_name, left, right, expected) => {
    expect(comparePayloadRelation(left, right)).toBe(expected);
  });

  it("preserves duplicate contribution multiplicity", () => {
    expect(comparePayloadRelation(
      projection([a, a], "UNORDERED"),
      projection([a], "UNORDERED"),
    )).toBe("DIFFERENT");
  });

  it("keeps canonical contribution boundaries, empty semantics, and multiplicity distinct", () => {
    const oneContribution = unitizePayloadContributions(["a\nb"]);
    const twoContributions = unitizePayloadContributions(["a", "b"]);
    const joined = unitizePayloadContributions(["ab"]);
    expect(oneContribution).toEqual([[line("a"), line("b")]]);
    expect(twoContributions).toEqual([[line("a")], [line("b")]]);
    expect(joined).toEqual([[line("ab")]]);
    expect(new Set([
      JSON.stringify(oneContribution),
      JSON.stringify(twoContributions),
      JSON.stringify(joined),
    ]).size).toBe(3);
    expect(unitizePayloadContributions([""])).toEqual([]);
    expect(unitizePayloadContributions(["\n"])).toEqual([[line("")]]);
    expect(unitizePayloadContributions(["a\na", "a", "a"]))
      .toEqual([[line("a"), line("a")], [line("a")], [line("a")]]);
  });

  it("covers the complete 4x4 composition relation table", () => {
    const compositions: readonly CompositionState[] = [
      "ORDERED", "UNORDERED", "UNSPECIFIED", "RUNTIME_DECIDED",
    ];
    for (const leftComposition of compositions) {
      for (const rightComposition of compositions) {
        const runtime = leftComposition === "RUNTIME_DECIDED" ||
          rightComposition === "RUNTIME_DECIDED";
        const documentedEqual = leftComposition === rightComposition &&
          (leftComposition === "ORDERED" || leftComposition === "UNORDERED");
        expect(comparePayloadRelation(
          projection([a, b], leftComposition),
          projection([a, b], rightComposition),
        ), `${leftComposition}/${rightComposition} equal`).toBe(
          runtime ? "INDETERMINATE" : documentedEqual ? "SAME" : "INDETERMINATE",
        );
        expect(comparePayloadRelation(
          projection([a], leftComposition),
          projection([b], rightComposition),
        ), `${leftComposition}/${rightComposition} unequal`).toBe(
          runtime ? "INDETERMINATE" : "DIFFERENT",
        );
      }
    }
  });

  it("rejects a COMPLETE projection without its required digest", () => {
    const invalid = { ...projection([a], "ORDERED"), projectionDigest: null };
    expect(() => comparePayloadRelation(invalid, projection([a], "ORDERED")))
      .toThrow(/COMPLETE.*projectionDigest/);
  });

  it("fails closed when projectionDigest is not the identity seal", () => {
    const left = projection([a, b], "ORDERED");
    const forged = {
      ...left,
      projectionDigest: "0".repeat(64),
    };
    expect(() => assertProjectionDigestSeal(forged)).toThrow(/identity seal/u);
    expect(left.projectionDigest).toBe(digestProjectionIdentity(left));
    const unitsMoved = projection([b, a], "ORDERED");
    expect(unitsMoved.projectionDigest).not.toBe(left.projectionDigest);
  });

  it("fails closed when an ORDERED payload digest is not the units seal", () => {
    const left = projection([a, b], "ORDERED");
    const forged = {
      ...projection([a, b], "ORDERED"),
      normalizedPayloadDigest: "0".repeat(64),
    };
    expect(() => comparePayloadRelation(left, forged)).toThrow(/units seal/u);
    const missing = {
      ...projection([a, b], "ORDERED"),
      normalizedPayloadDigest: null,
    };
    expect(comparePayloadRelation(missing, projection([a, b], "ORDERED"))).toBe("SAME");
    expect(comparePayloadRelation(left, projection([a, b], "ORDERED"))).toBe("SAME");
    expect(comparePayloadRelation(left, projection([b, a], "ORDERED"))).toBe("DIFFERENT");
  });

  it("captures snapshot methods before callers can replace them", async () => {
    const source: RepositorySnapshot = {
      ref: { kind: "fixture", label: "mutable", oid: null },
      async listPaths() { return ["a.ts"]; },
      async entry(path) { return { path, kind: "file", executable: false }; },
      async read() { return new TextEncoder().encode("stable"); },
    };
    const cached = cacheRepositorySnapshot(source);
    source.listPaths = async () => { throw new Error("replaced list"); };
    source.entry = async () => { throw new Error("replaced entry"); };
    source.read = async () => { throw new Error("replaced read"); };
    expect(await cached.listPaths()).toEqual(["a.ts"]);
    expect(await cached.entry("a.ts")).toEqual({
      path: "a.ts", kind: "file", executable: false,
    });
    expect(new TextDecoder().decode((await cached.read("a.ts"))!)).toBe("stable");
  });

  it("summarizes a proven N-way difference without erasing unresolved coverage", () => {
    const projections = [
      projection([[line("A")]], "ORDERED"),
      projection([[line("B")]], "ORDERED"),
      projection([], "ORDERED", "UNKNOWN"),
    ];
    const aggregate = aggregatePayloadRelation(projections);
    expect(aggregate).toEqual({
      relation: "DIFFERENT",
      hasIndeterminateCoverage: true,
    });
    expect(splitState(aggregate.relation)).toBe(true);
  });
});

describe("impact analysis", () => {
  const paths = ["p1.ts", "p2.ts", "p3.ts", "p4.ts", "rules.md"];
  const before = manifest("before", Object.fromEntries(paths.map((path) => [path, "before"])));
  const after = manifest("after", Object.fromEntries(paths.map((path) => [
    path,
    path === "rules.md" ? "after" : "before",
  ])));

  const profiles = [
    scriptedProfile(OPENAI_CODEX_CLI_PROFILE_ID, (phase, target, profile) => {
      if (target === "rules.md") {
        return scriptedProjection(profile, target, "A", "stable", phase === "after" ? "UNKNOWN" : "COMPLETE");
      }
      if (target === "p1.ts") return scriptedProjection(profile, target, phase === "before" ? "A" : "B", phase);
      if (target === "p2.ts") return scriptedProjection(profile, target, phase === "before" ? "A" : "C", phase);
      if (target === "p3.ts") return scriptedProjection(profile, target, "A", phase);
      return scriptedProjection(profile, target, "A", "stable");
    }),
    scriptedProfile(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, (phase, target, profile) => {
      if (target === "p2.ts") return scriptedProjection(profile, target, phase === "before" ? "A" : "B", phase);
      return scriptedProjection(profile, target, "A", "stable");
    }),
  ];

  it("computes the locked definitive and unresolved count matrix", async () => {
    const result = await analyzeDiff({ before, after, profiles });
    expect(result.counts).toEqual({
      candidatePathCount: 5,
      changedStackPathCount: 3,
      newlySplitPathCount: 2,
      convergedPathCount: 0,
      currentSplitPathCount: 2,
      partialPathCount: 0,
      unknownPathCount: 1,
      indeterminatePathCount: 1,
      byProfile: [
        {
          profile: ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
          completePathCount: 5,
          partialPathCount: 0,
          unknownPathCount: 0,
          changedStackPathCount: 1,
        },
        {
          profile: OPENAI_CODEX_CLI_PROFILE_ID,
          completePathCount: 4,
          partialPathCount: 0,
          unknownPathCount: 1,
          changedStackPathCount: 3,
        },
      ],
    });
    expect(result.paths.map((item) => item.path)).toEqual(paths);
    expect(result.paths.find((item) => item.path === "p1.ts")).toMatchObject({
      beforePayloadRelation: "SAME",
      afterPayloadRelation: "DIFFERENT",
      wasSplit: false,
      isSplit: true,
    });
  });

  it("counts convergence and preserves a split when both profiles change realities", async () => {
    const changing = (id: string, side: "codex" | "claude") => scriptedProfile(
      id,
      (phase, target, profile) => {
        const payload = target === "converged.ts"
          ? phase === "before" ? side === "codex" ? "A" : "B" : "C"
          : phase === "before"
            ? side === "codex" ? "A" : "B"
            : side === "codex" ? "C" : "D";
        return scriptedProjection(profile, target, payload, `${phase}:${payload}`);
      },
      [],
    );
    const result = await analyzeDiff({
      before: manifest("before", { "converged.ts": "x", "still-split.ts": "x" }),
      after: manifest("after", { "converged.ts": "x", "still-split.ts": "x" }),
      profiles: [
        changing(OPENAI_CODEX_CLI_PROFILE_ID, "codex"),
        changing(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID, "claude"),
      ],
    });
    expect(result.counts).toMatchObject({
      changedStackPathCount: 2,
      newlySplitPathCount: 0,
      convergedPathCount: 1,
      currentSplitPathCount: 1,
    });
    expect(result.paths.find((path) => path.path === "converged.ts"))
      .toMatchObject({
        beforePayloadRelation: "DIFFERENT",
        afterPayloadRelation: "SAME",
        wasSplit: true,
        isSplit: false,
      });
    expect(result.paths.find((path) => path.path === "still-split.ts"))
      .toMatchObject({
        beforePayloadRelation: "DIFFERENT",
        afterPayloadRelation: "DIFFERENT",
        wasSplit: true,
        isSplit: true,
        changedProfiles: [
          ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
          OPENAI_CODEX_CLI_PROFILE_ID,
        ],
      });
  });

  it("uses the worst before/after completeness for definitive diff coverage", async () => {
    const partialFirst = scriptedProfile(
      OPENAI_CODEX_CLI_PROFILE_ID,
      (phase, target, profile) => scriptedProjection(
        profile,
        target,
        phase,
        phase,
        phase === "before" ? "PARTIAL" : "COMPLETE",
      ),
    );
    const unknownAfter = scriptedProfile(
      ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
      (phase, target, profile) => scriptedProjection(
        profile,
        target,
        phase,
        phase,
        phase === "after" ? "UNKNOWN" : "PARTIAL",
      ),
    );
    const result = await analyzeDiff({
      before: manifest("before", { "target.ts": "x", "rules.md": "a" }),
      after: manifest("after", { "target.ts": "x", "rules.md": "b" }),
      profiles: [partialFirst, unknownAfter],
    });
    expect(result.counts).toMatchObject({
      partialPathCount: 2,
      unknownPathCount: 2,
      indeterminatePathCount: 2,
      changedStackPathCount: 0,
    });
    expect(result.counts.byProfile).toEqual([
      expect.objectContaining({
        profile: ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
        completePathCount: 0,
        partialPathCount: 0,
        unknownPathCount: 2,
      }),
      expect.objectContaining({
        profile: OPENAI_CODEX_CLI_PROFILE_ID,
        completePathCount: 0,
        partialPathCount: 2,
        unknownPathCount: 0,
      }),
    ]);
  });

  it("builds causes from effective sources and groups by deepest cause directory", async () => {
    const changedSources: ResolvedSource[] = [
      { path: "AGENTS.md", disposition: "SHADOWED", digest: sha256("x"), bytesUsed: 0, truncated: false },
      { path: "excluded.md", disposition: "EXCLUDED", digest: sha256("e"), bytesUsed: 0, truncated: false },
      { path: "z/rules.md", disposition: "SELECTED", digest: sha256("y"), bytesUsed: 1, truncated: false },
      { path: "a/rules.md", disposition: "IMPORTED", digest: sha256("z"), bytesUsed: 1, truncated: false },
    ];
    const dependencies = changedSources.map((source) => source.path);
    const changing = (id: string) => scriptedProfile(
      id,
      (phase, target, profile) => scriptedProjection(profile, target, "A", phase, "COMPLETE", changedSources),
      dependencies,
    );
    const result = await analyzeDiff({
      before: manifest("before", {
        "AGENTS.md": "a", "excluded.md": "a", "a/rules.md": "a", "z/rules.md": "a",
        "src/a.ts": "x", "src/b.ts": "x", "src/c.ts": "x", "src/d.ts": "x",
      }),
      after: manifest("after", {
        "AGENTS.md": "b", "excluded.md": "b", "a/rules.md": "b", "z/rules.md": "b",
        "src/a.ts": "x", "src/b.ts": "x", "src/c.ts": "x", "src/d.ts": "x",
      }),
      profiles: [
        changing(OPENAI_CODEX_CLI_PROFILE_ID),
        scriptedProfile(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
          (_phase, target, profile) => scriptedProjection(profile, target, "A", "stable", "COMPLETE", changedSources),
          dependencies),
      ],
    });
    const target = result.paths.find((item) => item.path === "src/a.ts")!;
    expect(target.causes).toEqual(["a/rules.md", "excluded.md", "z/rules.md"]);
    expect(result.groups).toContainEqual({
      root: "a",
      changedStackPathCount: 8,
      newlySplitPathCount: 0,
      samplePaths: ["AGENTS.md", "a/rules.md", "excluded.md"],
    });
  });

  it("includes effective changed sources from an unchanged profile in a changed path cause", async () => {
    const source = (path: string): ResolvedSource => ({
      path, disposition: "SELECTED", digest: sha256(path), bytesUsed: 1, truncated: false,
    });
    const codex = scriptedProfile(
      OPENAI_CODEX_CLI_PROFILE_ID,
      (phase, target, profile) => scriptedProjection(
        profile, target, "same", phase, "COMPLETE", [source("codex.md")],
      ),
      ["codex.md"],
    );
    const claude = scriptedProfile(
      ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
      (_phase, target, profile) => scriptedProjection(
        profile, target, "same", "stable", "COMPLETE", [source("claude.md")],
      ),
      ["claude.md"],
    );
    const result = await analyzeDiff({
      before: manifest("before", { "codex.md": "a", "claude.md": "a", "target.ts": "x" }),
      after: manifest("after", { "codex.md": "b", "claude.md": "b", "target.ts": "x" }),
      profiles: [codex, claude],
    });
    expect(result.paths.find((item) => item.path === "target.ts")!.causes)
      .toEqual(["claude.md", "codex.md"]);
  });

  it("keeps current analysis current-only and sorted", async () => {
    const result = await analyzeCurrent({ snapshot: after, profiles: [...profiles].reverse() });
    expect(result.mode).toBe("current");
    expect(result.paths).toHaveLength(5);
    expect(result.paths[0]!.projections.map((item) => item.profile)).toEqual([
      ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
      OPENAI_CODEX_CLI_PROFILE_ID,
    ]);
    expect(result).not.toHaveProperty("before");
  });

  it("counts complete unspecified composition as indeterminate, not incomplete", async () => {
    const ordered = scriptedProfile(
      OPENAI_CODEX_CLI_PROFILE_ID,
      (_phase, target, profile) => scriptedProjection(profile, target, "same", "stable"),
      [],
    );
    const unspecified = scriptedProfile(
      ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
      (_phase, target, profile) => {
        const base = scriptedProjection(profile, target, "same", "stable");
        const resealed = {
          ...base,
          composition: "UNSPECIFIED" as const,
          normalizedPayloadDigest: digestNormalizedPayload(
            base.normalizedPayloadUnits,
            "UNSPECIFIED",
          ),
        };
        return {
          ...resealed,
          projectionDigest: digestProjectionIdentity(resealed),
        };
      },
      [],
    );
    const result = await analyzeCurrent({
      snapshot: manifest("current", { "target.ts": "x" }),
      profiles: [ordered, unspecified],
    });
    expect(result.paths[0]).toMatchObject({
      payloadRelation: "INDETERMINATE",
      isSplit: null,
    });
    expect(result.counts).toMatchObject({
      partialPathCount: 0,
      unknownPathCount: 0,
      indeterminatePathCount: 1,
      currentSplitPathCount: 0,
    });
  });

  it("projects newly added candidates hypothetically against the before tree", async () => {
    const stable = (id: string) => scriptedProfile(
      id,
      (_phase, target, profile) => scriptedProjection(profile, target, "same", "stable"),
      [],
    );
    const result = await analyzeDiff({
      before: manifest("before", { "existing.ts": "x" }),
      after: manifest("after", { "existing.ts": "x", "nested/new.ts": "x" }),
      profiles: [
        stable(OPENAI_CODEX_CLI_PROFILE_ID),
        stable(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID),
      ],
    });
    expect(result.counts.candidatePathCount).toBe(2);
    const added = result.paths.find((path) => path.path === "nested/new.ts")!;
    expect(added.before).toHaveLength(2);
    expect(added.before.every(
      (projection) => projection.context.targetPath === "nested/new.ts",
    )).toBe(true);
  });

  it("unions source dependencies discovered only before and only after", async () => {
    const changingDependencies = (id: string): ProfileDefinition => ({
      id,
      evidence: [],
      isInstructionPath: () => false,
      async prepare(snapshot): Promise<PreparedProfile> {
        const dependency = snapshot.ref.label === "before"
          ? "before-import.md"
          : "after-import.md";
        return {
          id,
          sourceDependencyPaths: [dependency],
          project(targetPath) {
            return scriptedProjection(id, targetPath, "same", "stable");
          },
        };
      },
    });
    const result = await analyzeDiff({
      before: manifest("before", { "before-import.md": "gone", "target.ts": "x" }),
      after: manifest("after", { "after-import.md": "new", "target.ts": "x" }),
      profiles: [
        changingDependencies(OPENAI_CODEX_CLI_PROFILE_ID),
        changingDependencies(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID),
      ],
    });
    expect(result.changedInstructionSources.map(
      ({ kind, beforePath, afterPath }) => ({ kind, beforePath, afterPath }),
    )).toEqual([
      { kind: "ADD", beforePath: null, afterPath: "after-import.md" },
      { kind: "DELETE", beforePath: "before-import.md", afterPath: null },
    ]);
  });

  it("sorts output paths by Unicode code point, not UTF-16 code unit", async () => {
    const stable = (id: string) => scriptedProfile(
      id,
      (_phase, target, profile) => scriptedProjection(profile, target, "same", "stable"),
      [],
    );
    const result = await analyzeCurrent({
      snapshot: manifest("unicode", {
        "😀.ts": "x",
        "\uE000.ts": "x",
        "a.ts": "x",
      }),
      profiles: [
        stable(OPENAI_CODEX_CLI_PROFILE_ID),
        stable(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID),
      ],
    });
    expect(result.paths.map((path) => path.path)).toEqual([
      "a.ts", "\uE000.ts", "😀.ts",
    ]);
  });

  it("emits sorted, deduplicated, phase-labelled findings and binary evidence", async () => {
    const noisy = scriptedProfile(
      OPENAI_CODEX_CLI_PROFILE_ID,
      (phase, target, profile) => {
        if (phase === "before") {
          return projection([[line("before")]], "UNSPECIFIED", "PARTIAL", {
            profile,
            context: { cwd: ".", trigger: "READ_TARGET", targetPath: target, repositoryOnly: true },
            evidence: [
              "UNSUPPORTED_GLOB_SEMANTIC: matcher edge",
              "UNSUPPORTED_GLOB_SEMANTIC: matcher edge",
            ],
          });
        }
        return projection([], "ORDERED", "UNKNOWN", {
          profile,
          context: { cwd: ".", trigger: "READ_TARGET", targetPath: target, repositoryOnly: true },
          evidence: ["UNSUPPORTED_BOUNDARY: unresolved source"],
        });
      },
      ["rules.md"],
    );
    const stable = scriptedProfile(
      ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
      (_phase, target, profile) => scriptedProjection(profile, target, "same", "stable"),
      ["rules.md"],
    );
    const result = await analyzeDiff({
      before: manifest("before", { "rules.md": "text", "target.ts": "x" }),
      after: manifest("after", { "rules.md": "\0binary", "target.ts": "x" }),
      profiles: [noisy, stable],
    });
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: "BINARY_SOURCE",
      profile: null,
      path: "rules.md",
      detail: expect.stringMatching(/^diff:/),
    }));
    for (const code of [
      "PARTIAL_PROJECTION",
      "UNKNOWN_PROJECTION",
      "UNSPECIFIED_COMPOSITION",
      "UNSUPPORTED_GLOB_SEMANTIC",
      "UNSUPPORTED_BOUNDARY",
    ] as const) {
      expect(result.findings.some((finding) => finding.code === code)).toBe(true);
    }
    expect(result.findings.filter(
      (finding) => finding.code === "UNSUPPORTED_GLOB_SEMANTIC" &&
        finding.path === "target.ts",
    )).toHaveLength(1);
    expect(result.findings.every((finding) =>
      finding.code === "BINARY_SOURCE" || /^(?:before|after):/.test(finding.detail),
    )).toBe(true);
    expect(result.findings.map((finding) => finding.path)).toEqual([
      ...result.findings.map((finding) => finding.path),
    ].sort(compareCodePoints));
  });

  it("rejects invalid v1 profile sets before profile or snapshot side effects", async () => {
    let touched = 0;
    const poisoned: RepositorySnapshot = {
      get ref(): RepositorySnapshot["ref"] { touched += 1; throw new Error("snapshot touched"); },
      async listPaths() { touched += 1; throw new Error("snapshot touched"); },
      async entry() { touched += 1; throw new Error("snapshot touched"); },
      async read() { touched += 1; throw new Error("snapshot touched"); },
    };
    const prepare = async (): Promise<PreparedProfile> => {
      touched += 1;
      throw new Error("profile touched");
    };
    const codex = { ...profiles[0]!, prepare };
    const unknown = {
      ...profiles[0]!,
      id: parseProfileId("example/unknown@1"),
      prepare,
    };
    for (const invalid of [[], [codex], [codex, codex], [codex, unknown]]) {
      await expect(analyzeCurrent({ snapshot: poisoned, profiles: invalid }))
        .rejects.toThrow(/exactly.*bundled|profile/i);
    }
    expect(touched).toBe(0);
  });

  it("rejects a prepared profile whose id does not match its definition", async () => {
    const mismatch = {
      ...profiles[0]!,
      async prepare(): Promise<PreparedProfile> {
        return {
          id: ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
          sourceDependencyPaths: [],
          project() { throw new Error("must not project"); },
        };
      },
    };
    await expect(analyzeCurrent({ snapshot: after, profiles: [mismatch, profiles[1]!] }))
      .rejects.toThrow(/prepared.*id/i);
  });

  it("captures a prepared project method before another prepare can replace it", async () => {
    const mutable = {
      id: ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
      sourceDependencyPaths: [] as string[],
      project(targetPath: string) {
        return scriptedProjection(
          ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
          targetPath,
          "stable",
          "stable",
        );
      },
    };
    const first: ProfileDefinition = {
      id: ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
      evidence: [],
      isInstructionPath: () => false,
      async prepare() { return mutable; },
    };
    const second: ProfileDefinition = {
      ...profiles[0]!,
      async prepare(snapshot) {
        mutable.project = () => { throw new Error("replaced after prepare"); };
        return profiles[0]!.prepare(snapshot);
      },
    };
    await expect(analyzeCurrent({ snapshot: after, profiles: [first, second] }))
      .resolves.toMatchObject({ mode: "current" });
  });

  it("captures every profile id and prepare method before the first prepare side effect", async () => {
    const codex = { ...scriptedProfile(
      OPENAI_CODEX_CLI_PROFILE_ID,
      (_phase, target, profile) => scriptedProjection(profile, target, "codex", "stable"),
      [],
    ) };
    const claude = { ...scriptedProfile(
      ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
      (_phase, target, profile) => scriptedProjection(profile, target, "claude", "stable"),
      [],
    ) };
    const originalClaudePrepare = claude.prepare;
    claude.prepare = async function prepareAndMutate(snapshot) {
      claude.prepare = async () => { throw new Error("replaced first prepare"); };
      codex.id = ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID;
      codex.prepare = async (): Promise<PreparedProfile> => ({
        id: ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
        sourceDependencyPaths: [],
        project(targetPath) {
          return scriptedProjection(
            ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
            targetPath,
            "hijacked",
            "hijacked",
          );
        },
      });
      return originalClaudePrepare.call(claude, snapshot);
    };

    const result = await analyzeCurrent({
      snapshot: manifest("profile-mutation", { "target.ts": "x" }),
      profiles: [codex, claude],
    });
    const expectedIds = [
      ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
      OPENAI_CODEX_CLI_PROFILE_ID,
    ];
    expect(result.counts.byProfile.map((counts) => counts.profile))
      .toEqual(expectedIds);
    expect(result.paths[0]!.projections.map((projection) => projection.profile))
      .toEqual(expectedIds);
  });

  it("reads a prepared profile id exactly once before validation and capture", async () => {
    let idReadCount = 0;
    const codex: ProfileDefinition = {
      id: OPENAI_CODEX_CLI_PROFILE_ID,
      evidence: [],
      isInstructionPath: () => false,
      async prepare(): Promise<PreparedProfile> {
        const hostile = {
          sourceDependencyPaths: [] as string[],
          project(targetPath: string) {
            return scriptedProjection(
              OPENAI_CODEX_CLI_PROFILE_ID,
              targetPath,
              "codex",
              "stable",
            );
          },
        };
        Object.defineProperty(hostile, "id", {
          enumerable: true,
          get() {
            idReadCount += 1;
            return idReadCount === 1
              ? OPENAI_CODEX_CLI_PROFILE_ID
              : ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID;
          },
        });
        return hostile as unknown as PreparedProfile;
      },
    };
    const claude = scriptedProfile(
      ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
      (_phase, target, profile) => scriptedProjection(profile, target, "claude", "stable"),
      [],
    );

    const result = await analyzeCurrent({
      snapshot: manifest("prepared-id-getter", { "target.ts": "x" }),
      profiles: [codex, claude],
    });
    expect(idReadCount).toBe(1);
    expect(result.paths[0]!.projections.map((projection) => projection.profile))
      .toEqual([
        ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
        OPENAI_CODEX_CLI_PROFILE_ID,
      ]);
  });

  it("rejects an accessor-backed projection without invoking the changing field", async () => {
    let profileReadCount = 0;
    const codex: ProfileDefinition = {
      id: OPENAI_CODEX_CLI_PROFILE_ID,
      evidence: [],
      isInstructionPath: () => false,
      async prepare(): Promise<PreparedProfile> {
        return {
          id: OPENAI_CODEX_CLI_PROFILE_ID,
          sourceDependencyPaths: [],
          project(targetPath) {
            const value = scriptedProjection(
              OPENAI_CODEX_CLI_PROFILE_ID,
              targetPath,
              "codex",
              "stable",
            );
            Object.defineProperty(value, "profile", {
              enumerable: true,
              get() {
                profileReadCount += 1;
                return profileReadCount === 1
                  ? OPENAI_CODEX_CLI_PROFILE_ID
                  : ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID;
              },
            });
            return value;
          },
        };
      },
    };
    const claude = scriptedProfile(
      ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
      (_phase, target, profile) => scriptedProjection(profile, target, "claude", "stable"),
      [],
    );
    await expect(analyzeCurrent({
      snapshot: manifest("projection-getter", { "target.ts": "x" }),
      profiles: [codex, claude],
    })).rejects.toThrow(/projection\.profile.*data property/i);
    expect(profileReadCount).toBe(0);
  });

  it("rejects undeclared projection fields without leaking their absolute values", () => {
    const invalid = projection([[line("x")]], "ORDERED", "COMPLETE", {
      profile: OPENAI_CODEX_CLI_PROFILE_ID,
      context: {
        cwd: ".", trigger: "STARTUP", targetPath: "target.ts", repositoryOnly: true,
      },
    }) as Projection & { checkoutRoot: string };
    invalid.checkoutRoot = "C:/Users/Alice/private/repository";
    const prepared: PreparedProfile = {
      id: OPENAI_CODEX_CLI_PROFILE_ID,
      sourceDependencyPaths: [],
      project: () => invalid,
    };
    let failure: unknown;
    try { projectPreparedProfiles([prepared], "target.ts"); }
    catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(TypeError);
    expect(String(failure)).toMatch(/missing or unknown fields/);
    expect(String(failure)).not.toContain("Alice");
  });

  it.each([
    ["context extra", (value: Projection) => Object.assign(value.context, { checkout: "C:/secret" })],
    ["source extra", (value: Projection) => Object.assign(value.sources[0]!, { checkout: "C:/secret" })],
    ["absolute cwd", (value: Projection) => { value.context.cwd = "/private/repo"; }],
    ["drive cwd", (value: Projection) => { value.context.cwd = "C:/private/repo"; }],
    ["traversing cwd", (value: Projection) => { value.context.cwd = "../private"; }],
    ["noncanonical cwd", (value: Projection) => { value.context.cwd = "a//b"; }],
    ["absolute target", (value: Projection) => { value.context.targetPath = "/target.ts"; }],
    ["absolute source", (value: Projection) => { value.sources[0]!.path = "C:/secret.md"; }],
    ["profile type", (value: Projection) => { (value as unknown as { profile: unknown }).profile = 1; }],
    ["status enum", (value: Projection) => { (value as unknown as { status: unknown }).status = "BROKEN"; }],
    ["composition enum", (value: Projection) => { (value as unknown as { composition: unknown }).composition = "BROKEN"; }],
    ["trigger enum", (value: Projection) => { (value.context as unknown as { trigger: unknown }).trigger = "WRITE"; }],
    ["repository scope", (value: Projection) => { (value.context as unknown as { repositoryOnly: unknown }).repositoryOnly = false; }],
    ["projection digest", (value: Projection) => { (value as unknown as { projectionDigest: unknown }).projectionDigest = 1; }],
    ["payload digest", (value: Projection) => { (value as unknown as { normalizedPayloadDigest: unknown }).normalizedPayloadDigest = 1; }],
    ["source disposition", (value: Projection) => { (value.sources[0] as unknown as { disposition: unknown }).disposition = "BROKEN"; }],
    ["source digest", (value: Projection) => { (value.sources[0] as unknown as { digest: unknown }).digest = 1; }],
    ["negative bytes", (value: Projection) => { value.sources[0]!.bytesUsed = -1; }],
    ["fractional bytes", (value: Projection) => { value.sources[0]!.bytesUsed = 1.5; }],
    ["truncated type", (value: Projection) => { (value.sources[0] as unknown as { truncated: unknown }).truncated = "no"; }],
    ["unit digest", (value: Projection) => { (value.normalizedPayloadUnits[0] as unknown[])[0] = 1; }],
    ["evidence type", (value: Projection) => { (value.evidence as unknown[])[0] = 1; }],
  ] as const)("rejects invalid adapter projection contract: %s", (_name, mutate) => {
    const value = scriptedProjection(
      OPENAI_CODEX_CLI_PROFILE_ID,
      "target.ts",
      "payload",
      "stable",
    );
    value.evidence.push("evidence");
    mutate(value);
    const prepared: PreparedProfile = {
      id: OPENAI_CODEX_CLI_PROFILE_ID,
      sourceDependencyPaths: [],
      project: () => value,
    };
    expect(() => projectPreparedProfiles([prepared], "target.ts")).toThrow(TypeError);
  });

  it.each([
    "/absolute.ts",
    "C:/drive.ts",
    "../traverse.ts",
    "a//double.ts",
    "a\\backslash.ts",
    "./dot.ts",
    "nul\0path.ts",
  ])("rejects a noncanonical snapshot inventory path %j", async (path) => {
    const cached = cacheRepositorySnapshot({
      ref: { kind: "fixture", label: "invalid-path", oid: null },
      async listPaths() { return [path]; },
      async entry() { return null; },
      async read() { return null; },
    });
    await expect(cached.listPaths()).rejects.toThrow(/canonical repository-relative/);
  });

  it("rejects a snapshot entry whose returned path differs from the request", async () => {
    const cached = cacheRepositorySnapshot({
      ref: { kind: "fixture", label: "wrong-entry", oid: null },
      async listPaths() { return ["target.ts"]; },
      async entry() { return { path: "other.ts", kind: "file", executable: false }; },
      async read() { return new Uint8Array(); },
    });
    await expect(cached.entry("target.ts")).rejects.toThrow(/does not match requested path/);
  });

  it("captures diff input getters exactly once before endpoint comparison", async () => {
    const before = manifest("before-input", { "rules.md": "before", "target.ts": "x" });
    const after = manifest("after-input", { "rules.md": "after", "target.ts": "x" });
    const stableProfiles = [
      scriptedProfile(
        OPENAI_CODEX_CLI_PROFILE_ID,
        (phase, target, profile) => scriptedProjection(profile, target, phase, phase),
      ),
      scriptedProfile(
        ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
        (phase, target, profile) => scriptedProjection(profile, target, phase, phase),
      ),
    ];
    let profilesReads = 0;
    let beforeReads = 0;
    let afterReads = 0;
    const hostileInput = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(hostileInput, {
      profiles: { enumerable: true, get() { profilesReads += 1; return stableProfiles; } },
      before: {
        enumerable: true,
        get() {
          beforeReads += 1;
          return beforeReads === 1 ? before : after;
        },
      },
      after: { enumerable: true, get() { afterReads += 1; return after; } },
    });
    const result = await analyzeDiff(hostileInput as unknown as Parameters<typeof analyzeDiff>[0]);
    expect({ profilesReads, beforeReads, afterReads }).toEqual({
      profilesReads: 1,
      beforeReads: 1,
      afterReads: 1,
    });
    expect(result.changedInstructionSources).toContainEqual(
      expect.objectContaining({ afterPath: "rules.md", kind: "MODIFY" }),
    );
  });

  it("freezes the shared cached snapshot before the first profile prepares", async () => {
    let mutationAccepted: boolean | null = null;
    let observedBytes = "";
    const claude: ProfileDefinition = {
      id: ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
      evidence: [],
      isInstructionPath: () => false,
      async prepare(snapshot): Promise<PreparedProfile> {
        mutationAccepted = Reflect.set(
          snapshot,
          "read",
          async () => new TextEncoder().encode("corrupted"),
        );
        return scriptedProfile(
          ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
          (_phase, target, profile) => scriptedProjection(profile, target, "claude", "stable"),
          [],
        ).prepare(snapshot);
      },
    };
    const codex: ProfileDefinition = {
      id: OPENAI_CODEX_CLI_PROFILE_ID,
      evidence: [],
      isInstructionPath: () => false,
      async prepare(snapshot): Promise<PreparedProfile> {
        observedBytes = new TextDecoder().decode((await snapshot.read("rules.md"))!);
        return scriptedProfile(
          OPENAI_CODEX_CLI_PROFILE_ID,
          (_phase, target, profile) => scriptedProjection(profile, target, "codex", "stable"),
          [],
        ).prepare(snapshot);
      },
    };
    await analyzeCurrent({
      snapshot: manifest("frozen-cache", { "rules.md": "original", "target.ts": "x" }),
      profiles: [codex, claude],
    });
    expect(mutationAccepted).toBe(false);
    expect(observedBytes).toBe("original");
  });
});
