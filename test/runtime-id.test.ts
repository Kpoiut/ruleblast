import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/args.js";
import {
  classifyRuntimeSurfaceId,
  publicRealityRefusal,
} from "../src/application/runtime-surfaces.js";
import {
  isModelNameSurfaceId,
  isRuntimeClassId,
  unversionedRuntimeId,
} from "../src/domain/runtime-id.js";
import { decodeCandidateSurface } from "../src/packs/candidate.js";

function candidate(id: string): unknown {
  return {
    schema: "ruleblast.candidate.v1",
    id,
    label: "Test",
    admission: "not-admitted",
    stability: "forming",
    reason: "unit",
    evidence: [{
      claimId: "unit.1",
      sourceType: "vendor-doc",
      sourceUrl: "https://example.invalid/claim",
      retrievedAt: "2026-08-24",
      sourceRevision: "2026-08-24",
      claim: "unit",
    }],
  };
}

describe("runtime surface ids", () => {
  it.each([
    "openai/codex-cli@1",
    "anthropic/claude-code-cli@1",
    "github/copilot-cli@1",
    "google/gemini-cli@1",
    "xai/grok-build-cli",
    "qwen/qwen-code-cli",
    "deepseek/dsh-harness",
    "moonshot/kimi-code-cli",
  ])("accepts runtime class id %s", (value) => {
    expect(isRuntimeClassId(value)).toBe(true);
    expect(isModelNameSurfaceId(value)).toBe(false);
  });

  it.each([
    "grok-4",
    "gpt-4",
    "glm-5.3",
    "zai/glm-5",
    "openai/gpt-4",
    "xai/grok-4",
    "cursor/composer@1",
    "meta/llama@1",
  ])("treats %s as a model name, not a runtime", (value) => {
    expect(isRuntimeClassId(value)).toBe(false);
    expect(isModelNameSurfaceId(value)).toBe(true);
  });

  it("strips a revision from a runtime id without inventing a modeled pack", () => {
    expect(unversionedRuntimeId("xai/grok-build-cli@1")).toBe("xai/grok-build-cli");
    expect(unversionedRuntimeId("xai/grok-build-cli")).toBe("xai/grok-build-cli");
  });

  it("classifies modeled, candidate, and model-name ids without executing candidates", () => {
    expect(classifyRuntimeSurfaceId("openai/codex-cli@1")).toBe("modeled");
    expect(classifyRuntimeSurfaceId("github/copilot-cli@1")).toBe("modeled");
    expect(classifyRuntimeSurfaceId("xai/grok-build-cli")).toBe("candidate");
    expect(classifyRuntimeSurfaceId("xai/grok-build-cli@1")).toBe("candidate");
    expect(classifyRuntimeSurfaceId("qwen/qwen-code-cli")).toBe("candidate");
    expect(classifyRuntimeSurfaceId("deepseek/dsh-harness")).toBe("candidate");
    expect(classifyRuntimeSurfaceId("moonshot/kimi-code-cli")).toBe("candidate");
    expect(classifyRuntimeSurfaceId("grok-4")).toBe("model-name");
    expect(classifyRuntimeSurfaceId("zai/glm-5.3@1")).toBe("model-name");
    expect(classifyRuntimeSurfaceId("cursor/composer@1")).toBe("model-name");
  });

  it("refuses candidate runtimes and model names with distinct --reality text", () => {
    expect(publicRealityRefusal("xai/grok-build-cli")).toMatch(
      /not-admitted candidate runtime/u,
    );
    expect(publicRealityRefusal("xai/grok-build-cli")).toMatch(
      /IDs name runtimes, not models/u,
    );
    expect(publicRealityRefusal("grok-4")).toMatch(/model name, not a runtime surface id/u);
    expect(publicRealityRefusal("acme/unknown-cli@1")).toMatch(/must be one of/u);
    expect(() => parseArgs([".", "--reality", "xai/grok-build-cli"]))
      .toThrow(/not-admitted candidate runtime/u);
    expect(() => parseArgs([".", "--reality", "qwen/qwen-code-cli"]))
      .toThrow(/not-admitted candidate runtime/u);
    expect(() => parseArgs([".", "--reality", "grok-4"]))
      .toThrow(/model name, not a runtime surface id/u);
    expect(() => parseArgs([".", "--reality", "zai/glm-5.3@1"]))
      .toThrow(/model name, not a runtime surface id/u);
  });

  it("rejects packing a model name as a candidate surface id", () => {
    expect(() => decodeCandidateSurface(candidate("xai/grok-4")))
      .toThrow(/runtime surface id/u);
    expect(() => decodeCandidateSurface(candidate("openai/gpt-4")))
      .toThrow(/runtime surface id/u);
    expect(() => decodeCandidateSurface(candidate("xai/grok-build-cli"))).not.toThrow();
  });
});
