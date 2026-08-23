import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/args.js";
import { PROFILE_CATALOG, optInRealityIds } from "../src/application/profile-catalog.js";
import {
  MODELED_REALITY_IDS,
  OPT_IN_REALITY_IDS,
} from "../src/application/opt-in-realities.js";
import {
  classifyRuntimeSurfaceId,
  publicRealityRefusal,
} from "../src/application/runtime-surfaces.js";
import { isCandidateIdShape } from "../src/domain/runtime-id.js";
import { decodeCandidateSurface } from "../src/packs/candidate.js";

function candidate(id: string, extra: Record<string, unknown> = {}): unknown {
  return {
    schema: "ruleblast.candidate.v1",
    id,
    label: "Test",
    admission: "not-admitted",
    stability: "forming",
    surface: "cli",
    reason: "unit",
    evidence: [{
      claimId: "unit.1",
      sourceType: "vendor-doc",
      sourceUrl: "https://example.invalid/claim",
      retrievedAt: "2026-08-24",
      sourceRevision: "2026-08-24",
      claim: "unit",
    }],
    ...extra,
  };
}

describe("runtime surface ids", () => {
  it("keeps modeled ids identical to the packed catalog, not a parallel list", () => {
    expect([...MODELED_REALITY_IDS].sort()).toEqual(
      PROFILE_CATALOG.map((entry) => entry.id).sort(),
    );
    expect([...optInRealityIds()]).toEqual([...OPT_IN_REALITY_IDS].sort());
  });

  it.each([
    "openai/codex-cli@1",
    "xai/grok-build-cli",
    "qwen/qwen-code-cli",
  ])("accepts candidate id shape %s", (value) => {
    expect(isCandidateIdShape(value)).toBe(true);
  });

  it.each(["grok-4", "gpt-4", "all", "openai/gpt-4@01", ""]) (
    "rejects non-catalog shape %j",
    (value) => {
      expect(isCandidateIdShape(value)).toBe(false);
    },
  );

  it("classifies only exact catalog or candidate ids", () => {
    expect(classifyRuntimeSurfaceId("openai/codex-cli@1")).toBe("modeled");
    expect(classifyRuntimeSurfaceId("github/copilot-cli@1")).toBe("modeled");
    expect(classifyRuntimeSurfaceId("xai/grok-build-cli")).toBe("candidate");
    expect(classifyRuntimeSurfaceId("qwen/qwen-code-cli")).toBe("candidate");
    expect(classifyRuntimeSurfaceId("xai/grok-build-cli@1")).toBe("unknown");
    expect(classifyRuntimeSurfaceId("deepseek/dsh-harness")).toBe("unknown");
    expect(classifyRuntimeSurfaceId("moonshot/kimi-code-cli")).toBe("unknown");
    expect(classifyRuntimeSurfaceId("grok-4")).toBe("unknown");
    expect(classifyRuntimeSurfaceId("openai/o1")).toBe("unknown");
    expect(classifyRuntimeSurfaceId("zai/glm-5.3@1")).toBe("unknown");
  });

  it("refuses unknown ids without pretending to recognize model products", () => {
    expect(publicRealityRefusal("xai/grok-build-cli")).toMatch(
      /not-admitted candidate runtime/u,
    );
    expect(publicRealityRefusal("xai/grok-build-cli@1")).toMatch(/must be one of/u);
    expect(publicRealityRefusal("xai/grok-build-cli@1")).toMatch(
      /Catalog IDs name runtimes, not models/u,
    );
    expect(publicRealityRefusal("grok-4")).toMatch(/must be one of/u);
    expect(publicRealityRefusal("grok-4")).toMatch(/Catalog IDs name runtimes, not models/u);
    expect(publicRealityRefusal("grok-4")).not.toMatch(/is a model name/u);
    expect(() => parseArgs([".", "--reality", "xai/grok-build-cli"]))
      .toThrow(/not-admitted candidate runtime/u);
    expect(() => parseArgs([".", "--reality", "xai/grok-build-cli@1"]))
      .toThrow(/must be one of/u);
    expect(() => parseArgs([".", "--reality", "grok-4"]))
      .toThrow(/Catalog IDs name runtimes, not models/u);
    expect(() => parseArgs([".", "--reality", "deepseek/dsh-harness"]))
      .toThrow(/must be one of/u);
  });

  it("requires an explicit surface kind and does not infer one from the id spelling", () => {
    expect(() => decodeCandidateSurface(candidate("xai/grok-build-cli"))).not.toThrow();
    expect(() => decodeCandidateSurface(candidate("xai/grok-4", { surface: "cli" })))
      .not.toThrow();
    const missingSurface = candidate("xai/grok-build-cli") as Record<string, unknown>;
    delete missingSurface.surface;
    expect(() => decodeCandidateSurface(missingSurface)).toThrow(/missing fields/u);
    expect(() => decodeCandidateSurface(candidate("grok-4"))).toThrow(/runtime surface id/u);
    expect(decodeCandidateSurface(candidate("xai/grok-build-cli")).surface).toBe("cli");
  });
});
