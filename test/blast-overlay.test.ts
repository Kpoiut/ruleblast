import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  alignmentGloss,
  buildOverlayP1,
  classifyChangeAlignment,
  classifyObserved,
  countObservedKinds,
  OVERLAY_SAMPLE_CAP,
  OVERLAY_UNAVAILABLE,
  reconstructWorkMap,
  renderBlastOverlay,
} from "../src/application/blast-overlay.js";
import type {
  DiffRuleBlastResult,
  PathTransition,
  Projection,
} from "../src/model.js";
import type { GitObjectSnapshot } from "../src/snapshot.js";
import {
  digestNormalizedPayload,
  digestProjectionIdentity,
} from "../src/domain/payload-relation.js";

function projection(
  profile: string,
  status: Projection["status"],
  payload: string | null,
): Projection {
  const units = payload === null ? [] : [[payload]];
  const base: Projection = {
    profile,
    context: {
      cwd: ".",
      trigger: "READ_TARGET",
      targetPath: "src/app.ts",
      repositoryOnly: true,
    },
    status,
    composition: "ORDERED",
    sources: [],
    normalizedPayloadUnits: units,
    projectionDigest: null,
    normalizedPayloadDigest: status === "UNKNOWN"
      ? null
      : digestNormalizedPayload(units, "ORDERED"),
    evidence: [],
  };
  if (status === "UNKNOWN") return base;
  return { ...base, projectionDigest: digestProjectionIdentity(base) };
}

function transition(
  changedProfiles: string[],
  before: Projection[],
  after: Projection[],
  extras: {
    readonly path?: string;
    readonly isSplit?: boolean | null;
    readonly afterPayloadRelation?: PathTransition["afterPayloadRelation"];
  } = {},
): PathTransition {
  return {
    path: extras.path ?? "src/app.ts",
    before,
    after,
    changedProfiles,
    beforePayloadRelation: "SAME",
    afterPayloadRelation: extras.afterPayloadRelation ?? "INDETERMINATE",
    wasSplit: false,
    isSplit: extras.isSplit ?? false,
    causes: [],
  };
}

function gitObject(blobs: Readonly<Record<string, string>>): GitObjectSnapshot {
  return {
    ref: { kind: "git", label: "fixture", oid: "c".repeat(40) },
    async listPaths() {
      return Object.keys(blobs);
    },
    async entry(path) {
      return Object.hasOwn(blobs, path)
        ? { path, kind: "file", executable: false }
        : null;
    },
    async read() {
      throw new Error("overlay must not read snapshot bytes");
    },
    blobOid(path) {
      return blobs[path] ?? null;
    },
  };
}

function overlayResult(rows: readonly PathTransition[]): DiffRuleBlastResult {
  return {
    mode: "diff",
    schemaVersion: 1,
    resolverRevision: 1,
    before: { kind: "git", label: "before", oid: "a".repeat(40) },
    after: { kind: "git", label: "after", oid: "b".repeat(40) },
    diffStats: {
      addedLineCount: 0,
      deletedLineCount: 0,
      editedLineCount: 0,
      binaryChangedSourceCount: 0,
    },
    changedInstructionSources: [],
    counts: {
      candidatePathCount: rows.length,
      changedStackPathCount: 0,
      newlySplitPathCount: 0,
      convergedPathCount: 0,
      currentSplitPathCount: 0,
      partialPathCount: 0,
      unknownPathCount: 0,
      indeterminatePathCount: 0,
      byProfile: [],
    },
    groups: [],
    paths: [...rows],
    findings: [],
  };
}

describe("blast overlay classifier", () => {
  it("locks the presentation sample cap before any renderer exists", () => {
    expect(OVERLAY_SAMPLE_CAP).toBe(8);
  });

  it("caps each relation sample at K=8 and reports the remainder", () => {
    const observedPaths = Array.from({ length: 9 }, (_, index) => ({
      path: `src/f${String(index)}.ts`,
      kind: "MODIFY" as const,
      relation: "IN_BLAST" as const,
    }));
    const text = renderBlastOverlay({
      observedPathCount: 9,
      inBlastCount: 9,
      outsideBlastCount: 0,
      unresolvedCount: 0,
      splitObservedPathCount: 0,
      observedPaths,
    });
    expect(text).toContain("src/f0.ts");
    expect(text).toContain("src/f7.ts");
    expect(text).not.toContain("src/f8.ts");
    expect(text).toContain("… +1 more · ruleblast diff --index");
  });

  it("lifts the sample cap when a caller asks for the full list", () => {
    const observedPaths = Array.from({ length: 9 }, (_, index) => ({
      path: `src/f${String(index)}.ts`,
      kind: "MODIFY" as const,
      relation: "IN_BLAST" as const,
    }));
    const text = renderBlastOverlay({
      observedPathCount: 9,
      inBlastCount: 9,
      outsideBlastCount: 0,
      unresolvedCount: 0,
      splitObservedPathCount: 0,
      observedPaths,
    }, { sampleCap: Number.POSITIVE_INFINITY });
    expect(text).toContain("src/f8.ts");
    expect(text).not.toContain("… +1 more");
  });

  it("names deleted other paths as not after-snapshot targets", () => {
    const text = renderBlastOverlay({
      observedPathCount: 1,
      inBlastCount: 0,
      outsideBlastCount: 0,
      unresolvedCount: 1,
      splitObservedPathCount: 0,
      observedPaths: [{
        path: "gone.ts",
        kind: "DELETE",
        relation: "UNRESOLVED",
      }],
    });
    expect(text).toContain("gone.ts");
    expect(text).toMatch(/deleted.+not an after-snapshot target/iu);
  });

  it("forbids overlay from reading snapshot bytes", () => {
    const source = readFileSync(new URL("../src/application/blast-overlay.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/\.read\s*\(/u);
  });

  it("admits the Git pair overlay only on human text through injected capabilities", () => {
    const source = readFileSync(new URL("../src/cli-actions.ts", import.meta.url), "utf8");
    const admit = source.indexOf("const admitOverlay");
    expect(admit).toBeGreaterThan(-1);
    expect(source.slice(admit, admit + 360)).toContain('args.output.kind !== "json"');
    expect(source.slice(admit, admit + 360)).toContain("isWorktreeIdentitySource");
    expect(source).toContain("dependencies.probeGitStorageFormat");
    expect(source).toContain("analyzeOverlayPair");
    expect(source).not.toMatch(/from ["']\.\/git\.js["']/u);
    expect(source).not.toMatch(/as GitObjectSnapshot/u);
    expect(source).not.toContain("buildOverlayP2");
  });

  it("keeps companion hosts off the Git-pair overlay symbols", () => {
    const root = join(dirname(dirname(fileURLToPath(import.meta.url))), "hosts", "vscode", "src");
    const walk = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? walk(path) : [path];
      });
    for (const file of walk(root)) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toContain("buildOverlayP1");
      expect(text, file).not.toContain("OVERLAY_UNAVAILABLE");
      expect(text, file).not.toContain("classifyObserved");
    }
  });

  it("classifies DELETE as unresolved", () => {
    expect(classifyObserved("DELETE", transition(["p"], [], []))).toBe("UNRESOLVED");
    expect(classifyObserved("ADD", undefined)).toBe("UNRESOLVED");
    expect(classifyObserved("MODIFY", undefined)).toBe("UNRESOLVED");
  });

  it("is unresolved when an ADD has no complete before/after pair", () => {
    expect(classifyObserved("ADD", transition([], [], []))).toBe("UNRESOLVED");
    expect(classifyObserved(
      "ADD",
      transition([], [], [projection("openai/codex-cli@1", "COMPLETE", "a")]),
    )).toBe("UNRESOLVED");
  });

  it("is unresolved when after carries an incomplete profile absent from before", () => {
    const row = transition(
      [],
      [projection("openai/codex-cli@1", "COMPLETE", "a")],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "UNKNOWN", null),
      ],
    );
    expect(classifyObserved("MODIFY", row)).toBe("UNRESOLVED");
  });

  it("keeps MCP and explain hosts off overlay derivation", () => {
    const mcp = readFileSync(new URL("../src/mcp-stdio.ts", import.meta.url), "utf8");
    expect(mcp).not.toContain("buildOverlayP1");
    expect(mcp).toContain("diffRepositoryWithAdjunct");
    expect(mcp).toContain("probeGitStorageFormat");
    const gitSource = readFileSync(new URL("../src/git.ts", import.meta.url), "utf8");
    const blobOid = gitSource.slice(
      gitSource.indexOf("blobOid(path"),
      gitSource.indexOf("async read(path"),
    );
    expect(blobOid).not.toContain("cat-file");
  });

  it("lets a changed COMPLETE profile dominate UNKNOWN", () => {
    const row = transition(
      ["openai/codex-cli@1"],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "UNKNOWN", null),
      ],
      [
        projection("openai/codex-cli@1", "COMPLETE", "b"),
        projection("anthropic/claude-code-cli@1", "UNKNOWN", null),
      ],
    );
    expect(classifyObserved("MODIFY", row)).toBe("IN_BLAST");
  });

  it("is unresolved when no change witness exists and a pair is incomplete", () => {
    const row = transition(
      [],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "UNKNOWN", null),
      ],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "UNKNOWN", null),
      ],
    );
    expect(classifyObserved("MODIFY", row)).toBe("UNRESOLVED");
  });

  it("is outside when every selected pair is complete and unchanged", () => {
    const row = transition(
      [],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "COMPLETE", "c"),
      ],
      [
        projection("anthropic/claude-code-cli@1", "COMPLETE", "c"),
        projection("openai/codex-cli@1", "COMPLETE", "a"),
      ],
    );
    expect(classifyObserved("MODIFY", row)).toBe("OUTSIDE_BLAST");
    expect(row.afterPayloadRelation).toBe("INDETERMINATE");
  });

  it("renders scoped facts without verdict language", () => {
    const text = renderBlastOverlay({
      observedPathCount: 2,
      inBlastCount: 1,
      outsideBlastCount: 1,
      unresolvedCount: 0,
      splitObservedPathCount: 0,
      observedPaths: [
        { path: "src/in.ts", kind: "MODIFY", relation: "IN_BLAST" },
        { path: "docs/out.md", kind: "MODIFY", relation: "OUTSIDE_BLAST" },
      ],
    });
    expect(text).toContain("OTHER TRACKED CHANGES (selected realities)");
    expect(text).toContain("WORK MAP (selected realities; not actor telemetry)");
    expect(text).toContain("src/in.ts");
    expect(text).toContain("docs/out.md");
    expect(text).toContain("MIXED");
    expect(text).not.toMatch(
      /review first|effectiveness|Codex changed|wast(?:e|eful)|aligned with|did wrong|agent failed/iu,
    );
    expect(OVERLAY_UNAVAILABLE).toMatch(/unavailable/iu);
    expect(OVERLAY_UNAVAILABLE).not.toMatch(/aligned|WORK MAP/iu);
  });

  it("keeps isSplit orthogonal to blast membership", () => {
    const inBlast = transition(
      ["openai/codex-cli@1"],
      [projection("openai/codex-cli@1", "COMPLETE", "a")],
      [projection("openai/codex-cli@1", "COMPLETE", "b")],
      { isSplit: true, afterPayloadRelation: "DIFFERENT" },
    );
    expect(classifyObserved("MODIFY", inBlast)).toBe("IN_BLAST");

    const outside = transition(
      [],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "COMPLETE", "c"),
      ],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "COMPLETE", "c"),
      ],
      { isSplit: true, afterPayloadRelation: "DIFFERENT" },
    );
    expect(classifyObserved("MODIFY", outside)).toBe("OUTSIDE_BLAST");

    const incomplete = transition(
      [],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "UNKNOWN", null),
      ],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "UNKNOWN", null),
      ],
      { isSplit: true, afterPayloadRelation: "DIFFERENT" },
    );
    expect(classifyObserved("MODIFY", incomplete)).toBe("UNRESOLVED");
  });

  it("counts overlay splits only from proven DIFFERENT pair events, not an isSplit stamp", async () => {
    const inSplit = transition(
      ["openai/codex-cli@1"],
      [
        projection("openai/codex-cli@1", "COMPLETE", "same"),
        projection("anthropic/claude-code-cli@1", "COMPLETE", "same"),
      ],
      [
        projection("openai/codex-cli@1", "COMPLETE", "codex"),
        projection("anthropic/claude-code-cli@1", "COMPLETE", "claude"),
      ],
      {
        path: "src/in.ts",
        isSplit: true,
        afterPayloadRelation: "DIFFERENT",
      },
    );
    const incompleteSibling = transition(
      [],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "UNKNOWN", null),
      ],
      [
        projection("openai/codex-cli@1", "COMPLETE", "a"),
        projection("anthropic/claude-code-cli@1", "UNKNOWN", null),
      ],
      {
        path: "src/partial.ts",
        isSplit: true,
        afterPayloadRelation: "DIFFERENT",
      },
    );
    const outside = transition(
      [],
      [projection("openai/codex-cli@1", "COMPLETE", "a")],
      [projection("openai/codex-cli@1", "COMPLETE", "a")],
      { path: "docs/out.md", isSplit: false, afterPayloadRelation: "SAME" },
    );
    const deleted = transition(
      [],
      [projection("openai/codex-cli@1", "COMPLETE", "a")],
      [],
      { path: "gone.md", isSplit: true, afterPayloadRelation: "DIFFERENT" },
    );
    const overlay = await buildOverlayP1(
      gitObject({
        "src/in.ts": "1".repeat(40),
        "src/partial.ts": "2".repeat(40),
        "docs/out.md": "3".repeat(40),
        "gone.md": "4".repeat(40),
      }),
      gitObject({
        "src/in.ts": "5".repeat(40),
        "src/partial.ts": "6".repeat(40),
        "docs/out.md": "7".repeat(40),
      }),
      overlayResult([inSplit, incompleteSibling, outside, deleted]),
    );
    expect(overlay.observedPaths).toEqual([
      { path: "docs/out.md", kind: "MODIFY", relation: "OUTSIDE_BLAST" },
      { path: "gone.md", kind: "DELETE", relation: "UNRESOLVED" },
      { path: "src/in.ts", kind: "MODIFY", relation: "IN_BLAST" },
      { path: "src/partial.ts", kind: "MODIFY", relation: "UNRESOLVED" },
    ]);
    expect(overlay.splitObservedPathCount).toBe(1);
    expect(renderBlastOverlay(overlay)).toContain(
      "1 currently have a proven profile payload difference",
    );
    expect(classifyChangeAlignment(overlay)).toBe("UNRESOLVED");
  });

  it("names DIVERGENT only when an observed other path has a proven DIFFERENT pair", async () => {
    const overlay = await buildOverlayP1(
      gitObject({
        "src/in.ts": "1".repeat(40),
        "docs/out.md": "3".repeat(40),
      }),
      gitObject({
        "src/in.ts": "5".repeat(40),
        "docs/out.md": "7".repeat(40),
      }),
      overlayResult([
        transition(
          ["openai/codex-cli@1"],
          [
            projection("openai/codex-cli@1", "COMPLETE", "same"),
            projection("anthropic/claude-code-cli@1", "COMPLETE", "same"),
          ],
          [
            projection("openai/codex-cli@1", "COMPLETE", "codex"),
            projection("anthropic/claude-code-cli@1", "COMPLETE", "claude"),
          ],
          {
            path: "src/in.ts",
            isSplit: true,
            afterPayloadRelation: "DIFFERENT",
          },
        ),
        transition(
          [],
          [projection("openai/codex-cli@1", "COMPLETE", "same")],
          [projection("openai/codex-cli@1", "COMPLETE", "same")],
          { path: "docs/out.md", isSplit: false, afterPayloadRelation: "SAME" },
        ),
      ]),
    );
    expect(overlay.unresolvedCount).toBe(0);
    expect(overlay.splitObservedPathCount).toBe(1);
    expect(classifyChangeAlignment(overlay)).toBe("DIVERGENT");
  });

  it("joins the recorded openai/codex paste-burst blob oids into IN and OUTSIDE", async () => {
    const rootAgents = "9c14089e5f869f4cfe54c8189db86d0e5b5b26e1";
    const sources = {
      "codex-rs/tui/src/bottom_pane/AGENTS.md": "32d2037c13bae5a09c2563cc4fe607da819f3892",
      "codex-rs/tui2/src/bottom_pane/AGENTS.md": "44fac8e50af8c2279e19c0eb9788f7ac97c663c2",
    } as const;
    const inBlobs = {
      "codex-rs/tui/src/bottom_pane/chat_composer.rs": [
        "de3af3e844ba4f527a666c3d75504c8dba1e32b7",
        "7b8a8f215f7d566b32e7fe31ccca5ffeb19705dc",
      ],
      "codex-rs/tui/src/bottom_pane/paste_burst.rs": [
        "96ed095b8f306264f3eb48cd25efb29db8af2cda",
        "ae0234f1a73e31e95a429ff7f1d13278fffd1ecb",
      ],
      "codex-rs/tui/src/bottom_pane/textarea.rs": [
        "f2ed40758dab3a27e4e9b8e337a68d38f16ceb55",
        "903ebe9f82b54173a9a0c5fe5119fd481f7bc0ce",
      ],
      "codex-rs/tui2/src/bottom_pane/chat_composer.rs": [
        "c7e8af0c2ba6023a1b1023e53c6881f2cc2fb80e",
        "cf823b132bff1b820420191bbe47df500491371e",
      ],
      "codex-rs/tui2/src/bottom_pane/paste_burst.rs": [
        "96ed095b8f306264f3eb48cd25efb29db8af2cda",
        "ae0234f1a73e31e95a429ff7f1d13278fffd1ecb",
      ],
      "codex-rs/tui2/src/bottom_pane/textarea.rs": [
        "f2ed40758dab3a27e4e9b8e337a68d38f16ceb55",
        "903ebe9f82b54173a9a0c5fe5119fd481f7bc0ce",
      ],
    } as const;
    const outsideBlobs = {
      ".markdownlint-cli2.yaml": "15b472c61cb73bf14f6c327266e479229f555eca",
      "docs/tui-chat-composer.md": "cc3beb17fe1f5531789f16c6da65326e1a4c777f",
    } as const;
    const beforeBlobs: Record<string, string> = { "AGENTS.md": rootAgents };
    const afterBlobs: Record<string, string> = {
      "AGENTS.md": rootAgents,
      ...sources,
      ...outsideBlobs,
    };
    for (const [path, [beforeOid, afterOid]] of Object.entries(inBlobs)) {
      beforeBlobs[path] = beforeOid;
      afterBlobs[path] = afterOid;
    }
    const complete = (path: string) => [
      projection("openai/codex-cli@1", "COMPLETE", path),
    ];
    const result = overlayResult([
      ...Object.keys(inBlobs).map((path) =>
        transition(["openai/codex-cli@1"], complete(path), complete(`${path}-after`), {
          path,
        }),
      ),
      ...Object.keys(outsideBlobs).map((path) =>
        transition([], complete(path), complete(path), { path }),
      ),
    ]);
    result.changedInstructionSources = Object.keys(sources).map((path) => ({
      kind: "ADD" as const,
      beforePath: null,
      afterPath: path,
      beforeDigest: null,
      afterDigest: sources[path as keyof typeof sources],
      stats: {
        addedLineCount: 0,
        deletedLineCount: 0,
        editedLineCount: 0,
        binaryChangedSourceCount: 0,
      },
    }));
    const overlay = await buildOverlayP1(
      gitObject(beforeBlobs),
      gitObject(afterBlobs),
      result,
    );
    expect(overlay.observedPathCount).toBe(8);
    expect(overlay.inBlastCount).toBe(6);
    expect(overlay.outsideBlastCount).toBe(2);
    expect(overlay.unresolvedCount).toBe(0);
    expect(
      overlay.observedPaths.filter((row) => row.relation === "IN_BLAST").map((row) => row.path),
    ).toEqual(Object.keys(inBlobs));
    expect(
      overlay.observedPaths
        .filter((row) => row.relation === "OUTSIDE_BLAST")
        .map((row) => row.path),
    ).toEqual(Object.keys(outsideBlobs));
    expect(overlay.observedPaths.some((row) => row.path.endsWith("AGENTS.md"))).toBe(false);
  });

  it("keeps the recorded 2→206 public blob pair at OUTSIDE 0", async () => {
    const source = "codex-rs/tui/src/bottom_pane/AGENTS.md";
    const inBlobs = {
      "codex-rs/tui/src/bottom_pane/chat_composer.rs": [
        "9fc03764da9541c6a7e35c0f7892f012e9cf9eb1",
        "e62cab9e865ff28c3d3aae51ba29a01bb5abd8ef",
      ],
      "codex-rs/tui/src/bottom_pane/paste_burst.rs": [
        "44e3898db65618e02e5988a41716672928e88a90",
        "4ea8310c35d487a466fff61405a1e956ae4a5b54",
      ],
    } as const;
    const beforeBlobs: Record<string, string> = {
      [source]: "b5328217db73ae2e60c4ccb9aa1ceac7d3925334",
    };
    const afterBlobs: Record<string, string> = {
      [source]: "b07fa2eca8d566939def6860774eb3237f6fdc1a",
    };
    for (const [path, [beforeOid, afterOid]] of Object.entries(inBlobs)) {
      beforeBlobs[path] = beforeOid;
      afterBlobs[path] = afterOid;
    }
    const complete = (digest: string) => [
      projection("openai/codex-cli@1", "COMPLETE", digest),
    ];
    const result = overlayResult(
      Object.keys(inBlobs).map((path) =>
        transition(["openai/codex-cli@1"], complete("before"), complete("after"), {
          path,
        }),
      ),
    );
    result.changedInstructionSources = [{
      kind: "MODIFY",
      beforePath: source,
      afterPath: source,
      beforeDigest: beforeBlobs[source] ?? null,
      afterDigest: afterBlobs[source] ?? null,
      stats: {
        addedLineCount: 0,
        deletedLineCount: 0,
        editedLineCount: 0,
        binaryChangedSourceCount: 0,
      },
    }];
    const overlay = await buildOverlayP1(
      gitObject(beforeBlobs),
      gitObject(afterBlobs),
      result,
    );
    expect(overlay.observedPathCount).toBe(2);
    expect(overlay.inBlastCount).toBe(2);
    expect(overlay.outsideBlastCount).toBe(0);
    expect(overlay.unresolvedCount).toBe(0);
    expect(overlay.observedPaths.map((row) => row.path)).toEqual(Object.keys(inBlobs));
    expect(overlay.observedPaths.every((row) => row.relation === "IN_BLAST")).toBe(true);
  });
});

const VERDICT = /effectiveness|wast(?:e|eful)|aligned with|did wrong|agent failed/iu;

describe("change alignment", () => {
  it("names ALIGNED, MIXED, DIVERGENT, and UNRESOLVED from overlay counts only", () => {
    expect(classifyChangeAlignment({
      observedPathCount: 1,
      inBlastCount: 1,
      outsideBlastCount: 0,
      unresolvedCount: 0,
      splitObservedPathCount: 0,
      observedPaths: [{ path: "src/in.ts", kind: "MODIFY", relation: "IN_BLAST" }],
    })).toBe("ALIGNED");
    expect(classifyChangeAlignment({
      observedPathCount: 2,
      inBlastCount: 1,
      outsideBlastCount: 1,
      unresolvedCount: 0,
      splitObservedPathCount: 0,
      observedPaths: [],
    })).toBe("MIXED");
    expect(classifyChangeAlignment({
      observedPathCount: 1,
      inBlastCount: 1,
      outsideBlastCount: 0,
      unresolvedCount: 0,
      splitObservedPathCount: 1,
      observedPaths: [],
    })).toBe("DIVERGENT");
    expect(classifyChangeAlignment({
      observedPathCount: 1,
      inBlastCount: 0,
      outsideBlastCount: 0,
      unresolvedCount: 1,
      splitObservedPathCount: 0,
      observedPaths: [],
    })).toBe("UNRESOLVED");
    expect(classifyChangeAlignment({
      observedPathCount: 0,
      inBlastCount: 0,
      outsideBlastCount: 0,
      unresolvedCount: 0,
      splitObservedPathCount: 0,
      observedPaths: [],
    })).toBeNull();
  });
});

describe("work map reconstruction", () => {
  it("restates overlay membership without inventing a fifth class", () => {
    const view = {
      observedPathCount: 4,
      inBlastCount: 1,
      outsideBlastCount: 1,
      unresolvedCount: 2,
      splitObservedPathCount: 2,
      observedPaths: [
        { path: "docs/out.md", kind: "MODIFY" as const, relation: "OUTSIDE_BLAST" as const },
        { path: "gone.md", kind: "DELETE" as const, relation: "UNRESOLVED" as const },
        { path: "src/in.ts", kind: "MODIFY" as const, relation: "IN_BLAST" as const },
        { path: "src/partial.ts", kind: "MODIFY" as const, relation: "UNRESOLVED" as const },
      ],
    };
    expect(reconstructWorkMap(view)).toEqual([
      { kind: "inherited-stack", count: 1, samplePath: "src/in.ts" },
      { kind: "independent-git", count: 1, samplePath: "docs/out.md" },
      { kind: "unclassified", count: 2, samplePath: "gone.md" },
      { kind: "already-split", count: 2, samplePath: null },
    ]);
  });

  it("emits only empty-other when no other tracked path moved", () => {
    expect(reconstructWorkMap({
      observedPathCount: 0,
      inBlastCount: 0,
      outsideBlastCount: 0,
      unresolvedCount: 0,
      splitObservedPathCount: 0,
      observedPaths: [],
    })).toEqual([
      { kind: "empty-other", count: 0, samplePath: null },
    ]);
  });

  it("renders operational gloss and an explain next-step from existing facts", () => {
    const text = renderBlastOverlay({
      observedPathCount: 3,
      inBlastCount: 1,
      outsideBlastCount: 1,
      unresolvedCount: 1,
      splitObservedPathCount: 1,
      observedPaths: [
        { path: "docs/out.md", kind: "MODIFY", relation: "OUTSIDE_BLAST" },
        { path: "gone.md", kind: "DELETE", relation: "UNRESOLVED" },
        { path: "src/in.ts", kind: "MODIFY", relation: "IN_BLAST" },
      ],
    }, { from: "abc", to: "def" });
    expect(text).toContain("WORK MAP (selected realities; not actor telemetry)");
    expect(text).toContain("1 path inherited the changed stack");
    expect(text).toContain("later work here inherits the instruction edit");
    expect(text).toContain("1 path moved in Git without a selected-stack change");
    expect(text).toContain("later work here does not inherit the instruction edit");
    expect(text).toContain("1 path cannot be classified");
    expect(text).toContain("do not treat as inherited or independent");
    expect(text).toContain("1 path already has a proven profile payload difference");
    expect(text).toContain("one selected surface is not the other surface's stack");
    expect(text).toContain("first: src/in.ts");
    expect(text).toContain("first: docs/out.md");
    expect(text).toContain("first: gone.md");
    expect(text).toContain("next: ruleblast explain src/in.ts --from abc --to def --json");
    expect(text).not.toMatch(VERDICT);
  });

  it("omits the explain next-step when no sample path exists", () => {
    const text = renderBlastOverlay({
      observedPathCount: 0,
      inBlastCount: 0,
      outsideBlastCount: 0,
      unresolvedCount: 0,
      splitObservedPathCount: 0,
      observedPaths: [],
    });
    expect(text).toContain("no other tracked path moved");
    expect(text).not.toContain("next: ruleblast explain");
    expect(text).not.toMatch(VERDICT);
  });

  it("keeps work-map reconstruction inside the overlay adjunct", () => {
    const source = readFileSync(new URL("../src/application/blast-overlay.ts", import.meta.url), "utf8");
    expect(source).toContain("export function reconstructWorkMap");
    expect(source).not.toMatch(/from ["']\.\.\/impact\.js["']/u);
    expect(source).not.toMatch(/from ["']\.\.\/git\.js["']/u);
    expect(source.split(/\r?\n/u).length).toBeLessThan(400);
  });
});

const mixedView = {
  observedPathCount: 2,
  inBlastCount: 1,
  outsideBlastCount: 1,
  unresolvedCount: 0,
  splitObservedPathCount: 0,
  observedPaths: [
    { path: "src/in.ts", kind: "MODIFY" as const, relation: "IN_BLAST" as const },
    { path: "docs/out.md", kind: "MODIFY" as const, relation: "OUTSIDE_BLAST" as const },
  ],
};

describe("adjunct completeness", () => {
  it("prints CHANGE ALIGNMENT as its own heading with operational gloss", () => {
    const text = renderBlastOverlay(mixedView);
    expect(text).toContain("CHANGE ALIGNMENT (selected realities; not actor telemetry)");
    expect(text).toContain("MIXED");
    expect(text).toContain("other tracked motion is not one inherited class");
    expect(text.indexOf("CHANGE ALIGNMENT")).toBeGreaterThan(text.indexOf("OTHER TRACKED CHANGES"));
    expect(text.indexOf("INTENT")).toBeGreaterThan(text.indexOf("CHANGE ALIGNMENT"));
    expect(text.indexOf("WORK MAP")).toBeGreaterThan(text.indexOf("INTENT"));
    expect(text).not.toMatch(VERDICT);
  });

  it("restates blast membership as CONTINUE or REJECT for the next reader", () => {
    const text = renderBlastOverlay(mixedView);
    expect(text).toContain("INTENT (selected realities; not actor telemetry; not a stored session)");
    expect(text).toContain("CONTINUE");
    expect(text).toContain("REJECT");
    expect(text).toContain("later work inherits the instruction edit");
    expect(text).toContain("Git moved; selected stacks did not");
    expect(text).toContain("not a recommendation to discard the change");
    expect(text).not.toContain("UNRESOLVED  ");
  });

  it("names ALIGNED, DIVERGENT, and UNRESOLVED gloss from membership only", () => {
    expect(alignmentGloss("ALIGNED")).toBe(
      "every other tracked path inherited the changed stack",
    );
    expect(alignmentGloss("MIXED")).toBe(
      "other tracked motion is not one inherited class",
    );
    expect(alignmentGloss("DIVERGENT")).toBe(
      "a proven profile payload difference is present",
    );
    expect(alignmentGloss("UNRESOLVED")).toBe(
      "at least one other path cannot be classified",
    );
    expect(renderBlastOverlay({
      observedPathCount: 1,
      inBlastCount: 1,
      outsideBlastCount: 0,
      unresolvedCount: 0,
      splitObservedPathCount: 0,
      observedPaths: [{ path: "src/in.ts", kind: "MODIFY", relation: "IN_BLAST" }],
    })).toContain("every other tracked path inherited the changed stack");
    expect(renderBlastOverlay({
      observedPathCount: 1,
      inBlastCount: 1,
      outsideBlastCount: 0,
      unresolvedCount: 0,
      splitObservedPathCount: 1,
      observedPaths: [{ path: "src/in.ts", kind: "MODIFY", relation: "IN_BLAST" }],
    })).toContain("a proven profile payload difference is present");
    expect(renderBlastOverlay({
      observedPathCount: 1,
      inBlastCount: 0,
      outsideBlastCount: 0,
      unresolvedCount: 1,
      splitObservedPathCount: 0,
      observedPaths: [{ path: "gone.md", kind: "DELETE", relation: "UNRESOLVED" }],
    })).toContain("at least one other path cannot be classified");
  });

  it("omits CHANGE ALIGNMENT when no other tracked path moved", () => {
    const text = renderBlastOverlay({
      observedPathCount: 0,
      inBlastCount: 0,
      outsideBlastCount: 0,
      unresolvedCount: 0,
      splitObservedPathCount: 0,
      observedPaths: [],
    });
    expect(text).not.toContain("CHANGE ALIGNMENT");
    expect(text).not.toContain("INTENT");
    expect(text).not.toContain("added ·");
  });

  it("counts added, modified, and deleted other paths", () => {
    const view = {
      observedPathCount: 3,
      inBlastCount: 1,
      outsideBlastCount: 1,
      unresolvedCount: 1,
      splitObservedPathCount: 0,
      observedPaths: [
        { path: "src/new.ts", kind: "ADD" as const, relation: "IN_BLAST" as const },
        { path: "src/in.ts", kind: "MODIFY" as const, relation: "OUTSIDE_BLAST" as const },
        { path: "gone.md", kind: "DELETE" as const, relation: "UNRESOLVED" as const },
      ],
    };
    expect(countObservedKinds(view)).toEqual({ added: 1, modified: 1, deleted: 1 });
    expect(renderBlastOverlay(view)).toContain("1 added · 1 modified · 1 deleted");
  });

  it("prints the identity law when the prepared pair supplies it", () => {
    expect(renderBlastOverlay(mixedView, { identityLaw: "git-storage" }))
      .toContain("Git storage blob-object identity");
    expect(renderBlastOverlay(mixedView, { identityLaw: "worktree-captured" }))
      .toContain("captured worktree blob identity");
    expect(renderBlastOverlay(mixedView)).not.toContain("blob identity");
  });
});
