import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeDiff } from "../src/impact.js";
import { GOOGLE_GEMINI_CLI_PROFILE_ID } from "../src/model.js";
import { claudeProfile } from "../src/profiles/claude.js";
import { codexProfile } from "../src/profiles/codex.js";
import { geminiProfile } from "../src/profiles/gemini.js";
import { ManifestSnapshot } from "../src/snapshot.js";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures/gemini");
const TARGET = "src/file.ts";
const PROFILES = Object.freeze([claudeProfile, codexProfile, geminiProfile]);

export type ProbeClass = "D" | "U" | "D1" | "D2a" | "D2b" | "C";

export interface ProbeObservation {
  readonly beforeStatus: string;
  readonly afterStatus: string;
  readonly normalizedPayloadDigestBefore: string | null;
  readonly normalizedPayloadDigestAfter: string | null;
  readonly projectionDigestBefore: string | null;
  readonly projectionDigestAfter: string | null;
  readonly sourceDependencyPaths: readonly string[];
  readonly changedProfiles: readonly string[];
  readonly changedInstructionSources: readonly string[];
  readonly causes: readonly string[];
  readonly editedLineCount: number;
}

function loadSnapshot(name: string): ManifestSnapshot {
  return new ManifestSnapshot(
    JSON.parse(readFileSync(join(fixtureRoot, name), "utf8")),
  );
}

function sortedUnique(paths: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(paths)].sort());
}

function geminiProjection(
  projections: readonly { readonly profile: string; readonly status: string;
    readonly normalizedPayloadDigest: string | null;
    readonly projectionDigest: string | null }[],
) {
  const found = projections.find((item) => item.profile === GOOGLE_GEMINI_CLI_PROFILE_ID);
  if (found === undefined) {
    throw new Error("Gemini projection missing for src/file.ts");
  }
  return found;
}

async function observe(
  beforeName: string,
  afterName: string,
): Promise<ProbeObservation> {
  const beforeSnap = loadSnapshot(beforeName);
  const afterSnap = loadSnapshot(afterName);
  const prepared = await geminiProfile.prepare(beforeSnap);
  const result = await analyzeDiff({
    before: beforeSnap,
    after: afterSnap,
    profiles: PROFILES,
  });
  const path = result.paths.find((item) => item.path === TARGET);
  if (path === undefined) {
    throw new Error("src/file.ts missing from diff paths");
  }
  const before = geminiProjection(path.before);
  const after = geminiProjection(path.after);
  return {
    beforeStatus: before.status,
    afterStatus: after.status,
    normalizedPayloadDigestBefore: before.normalizedPayloadDigest,
    normalizedPayloadDigestAfter: after.normalizedPayloadDigest,
    projectionDigestBefore: before.projectionDigest,
    projectionDigestAfter: after.projectionDigest,
    sourceDependencyPaths: sortedUnique(prepared.sourceDependencyPaths),
    changedProfiles: Object.freeze([...path.changedProfiles]),
    changedInstructionSources: Object.freeze(
      result.changedInstructionSources.flatMap((change) => {
        const names = [change.beforePath, change.afterPath].filter(
          (item): item is string => item !== null,
        );
        return names;
      }),
    ),
    causes: Object.freeze([...path.causes]),
    editedLineCount: result.diffStats.editedLineCount,
  };
}

export function classifyProbe(observation: ProbeObservation): ProbeClass {
  const payloadChanged = observation.normalizedPayloadDigestBefore !==
    observation.normalizedPayloadDigestAfter;
  const geminiChanged = observation.changedProfiles.includes(
    GOOGLE_GEMINI_CLI_PROFILE_ID,
  );
  if (!payloadChanged) return "D";
  if (observation.beforeStatus !== "COMPLETE" || observation.afterStatus !== "COMPLETE") {
    return "U";
  }
  if (!geminiChanged) return "D1";
  if (!observation.sourceDependencyPaths.includes("b.md")) return "D2a";
  if (!observation.changedInstructionSources.includes("b.md")) return "D2b";
  return "C";
}

function controlPass(observation: ProbeObservation): boolean {
  return observation.beforeStatus === "COMPLETE" &&
    observation.afterStatus === "COMPLETE" &&
    observation.normalizedPayloadDigestBefore !==
      observation.normalizedPayloadDigestAfter &&
    observation.changedProfiles.includes(GOOGLE_GEMINI_CLI_PROFILE_ID) &&
    observation.sourceDependencyPaths.includes("a.md") &&
    observation.changedInstructionSources.includes("a.md");
}

describe("increment 0.24 Gemini nested-import harness", () => {
  it("CONTROL one-hop: payload changes, Gemini detected, a.md attributed", async () => {
    const observation = await observe(
      "control-one-hop-before.json",
      "control-one-hop-after.json",
    );
    expect(controlPass(observation), JSON.stringify(observation, null, 2)).toBe(true);
  });

  it("PROBE two-hop: records observations and a single classifier class", async () => {
    const observation = await observe(
      "probe-two-hop-before.json",
      "probe-two-hop-after.json",
    );
    const classification = classifyProbe(observation);
    expect(["D", "U", "D1", "D2a", "D2b", "C"]).toContain(classification);
    expect(observation.sourceDependencyPaths).toEqual(
      sortedUnique(observation.sourceDependencyPaths),
    );
  });
});
