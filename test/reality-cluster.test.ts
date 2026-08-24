import { describe, expect, it } from "vitest";
import { sha256 } from "../src/canonical.js";
import type { CompositionState, Projection } from "../src/model.js";
import {
  clusterEquivalentProjections,
  tallyRealityGroups,
} from "../src/domain/reality-cluster.js";
import { digestNormalizedPayload } from "../src/domain/payload-relation.js";

const line = (value: string): string =>
  sha256(`ruleblast-payload-line-v1\0${value}`);

function projection(
  profile: string,
  units: string[][],
  composition: CompositionState = "ORDERED",
  status: Projection["status"] = "COMPLETE",
): Projection {
  return {
    profile,
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
    projectionDigest: status === "COMPLETE"
      ? sha256(JSON.stringify({ units, composition }))
      : null,
    normalizedPayloadDigest: status === "COMPLETE"
      ? digestNormalizedPayload(units, composition)
      : null,
    evidence: [],
  };
}

describe("N-way reality clusters", () => {
  it("clusters only evidence-equivalent complete projections", () => {
    const groups = clusterEquivalentProjections([
      projection("openai/codex-cli@1", [[line("A")]]),
      projection("anthropic/claude-code-cli@1", [[line("A")]]),
      projection("github/copilot-cli@1", [[line("B")]]),
      projection("google/gemini-cli@1", [[line("A")]], "ORDERED", "UNKNOWN"),
    ]);
    expect(groups.clusters).toEqual([
      { members: ["anthropic/claude-code-cli@1", "openai/codex-cli@1"] },
      { members: ["github/copilot-cli@1"] },
    ]);
    expect(groups.unresolved).toEqual(["google/gemini-cli@1"]);
  });

  it("never merges INDETERMINATE or RUNTIME_DECIDED pairs into a named same-stack", () => {
    const groups = clusterEquivalentProjections([
      projection("openai/codex-cli@1", [[line("A")]], "ORDERED"),
      projection("anthropic/claude-code-cli@1", [[line("A")]], "RUNTIME_DECIDED"),
      projection("github/copilot-cli@1", [[line("A")]], "UNSPECIFIED"),
    ]);
    expect(groups.clusters.map((cluster) => cluster.members)).toEqual([
      ["anthropic/claude-code-cli@1"],
      ["github/copilot-cli@1"],
      ["openai/codex-cli@1"],
    ]);
    expect(groups.unresolved).toEqual([]);
  });

  it("tallies compact path groups without inventing cluster brand names", () => {
    const tallies = tallyRealityGroups([
      {
        path: "src/a.ts",
        projections: [
          projection("openai/codex-cli@1", [[line("A")]]),
          projection("anthropic/claude-code-cli@1", [[line("A")]]),
        ],
      },
      {
        path: "src/b.ts",
        projections: [
          projection("openai/codex-cli@1", [[line("A")]]),
          projection("anthropic/claude-code-cli@1", [[line("B")]]),
        ],
      },
      {
        path: "src/c.ts",
        projections: [
          projection("openai/codex-cli@1", [[line("A")]]),
          projection("anthropic/claude-code-cli@1", [[line("A")]]),
        ],
      },
    ]);
    expect(tallies).toHaveLength(2);
    expect(tallies[0]).toMatchObject({
      pathCount: 2,
      samplePaths: ["src/a.ts"],
    });
    expect(tallies[0]!.clusters).toEqual([
      { members: ["anthropic/claude-code-cli@1", "openai/codex-cli@1"] },
    ]);
    expect(JSON.stringify(tallies)).not.toMatch(/agent-stack|cluster-[a-z]|brand/iu);
  });
});
