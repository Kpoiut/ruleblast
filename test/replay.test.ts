import { describe, expect, it } from "vitest";
import { openPackagedCase } from "../src/case.js";
import {
  PACKAGED_CASE_CORE_DIGEST,
  replayDigest,
  replayMetricsFromResult,
  replayPackagedCase,
} from "../src/application/replay.js";

describe("replay metrics", () => {
  it("compares the packaged teaching receipt through compact metrics", async () => {
    const result = await openPackagedCase();
    const metrics = replayMetricsFromResult(result);
    expect(metrics.kind).toBe("ruleblast.replay.v1");
    expect(metrics.mode).toBe("diff");
    expect(metrics.candidatePathCount).toBe(106);
    expect(metrics.changedStackPathCount).toBe(106);
    expect(metrics.currentSplitPathCount).toBe(0);
    expect(metrics.partialPathCount).toBe(0);
    expect(metrics.unknownPathCount).toBe(0);
    expect(metrics.indeterminatePathCount).toBe(0);
    expect(metrics.profileIds).toEqual([
      "anthropic/claude-code-cli@1",
      "openai/codex-cli@1",
    ]);
    const replayed = await replayPackagedCase();
    expect(replayed.expectedCoreDigest).toBe(PACKAGED_CASE_CORE_DIGEST);
    expect(replayed.digest).toBe(replayDigest(metrics));
    expect(replayed.metrics).toEqual(metrics);
  });
});
