import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../src/canonical.js";
import { FIXTURE_AXES, decodeCandidateSurface, readCandidateSurface } from "../src/packs/candidate.js";
import { InvalidPackError } from "../src/packs/compile.js";
import { uninterpretableReasons } from "../src/packs/interpret-admit.js";
import { readPackDirectory } from "../src/packs/load.js";
import {
  ADMISSION_SCHEMA_ID,
  assertRealityAdmission,
  decodeRealityAdmission,
} from "../src/packs/admission.js";
import { isUnversionedRuntimeId, isVersionedRuntimeId } from "../src/domain/runtime-id.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

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

describe("reality admission invariant", () => {
  it("keeps forming candidates unversioned and modeled ids versioned", () => {
    expect(isUnversionedRuntimeId("xai/grok-build-cli")).toBe(true);
    expect(isVersionedRuntimeId("openai/codex-cli@1")).toBe(true);
    expect(isUnversionedRuntimeId("xai/grok-build-cli@1")).toBe(false);
    expect(isVersionedRuntimeId("xai/grok-build-cli")).toBe(false);
    expect(() => decodeCandidateSurface(candidate("xai/grok-build-cli@1")))
      .toThrow(/unversioned/u);
    expect(decodeCandidateSurface(candidate("xai/grok-build-cli")).id)
      .toBe("xai/grok-build-cli");
  });

  it("promotes only with evidence revision, resolver digest, five axes, oracle, and calibration", () => {
    const pack = readPackDirectory(
      join(repositoryRoot, "packs/bundled/openai-codex-cli@1"),
    );
    const record = decodeRealityAdmission({
      schema: ADMISSION_SCHEMA_ID,
      candidateId: "openai/codex-cli",
      modeledId: "openai/codex-cli@1",
      evidenceRevision: pack.evidence[0]!.sourceRevision,
      resolverDigest: sha256(canonicalJson(pack.resolver)),
      fixtureAxes: [...FIXTURE_AXES],
      oracleProof: "ORACLE",
      calibration: "NO_INTROSPECTION",
    });
    expect(() => assertRealityAdmission(record, {
      candidateId: "openai/codex-cli",
      resolver: pack.resolver,
      fixtureAxes: [...FIXTURE_AXES],
      evidenceRevision: pack.evidence[0]!.sourceRevision,
      oracleProof: "ORACLE",
      calibration: "NO_INTROSPECTION",
    })).not.toThrow();
  });

  it("refuses implied @1, missing axes, digest mismatch, and adapter-only proof", () => {
    const pack = readPackDirectory(
      join(repositoryRoot, "packs/bundled/openai-codex-cli@1"),
    );
    const digest = sha256(canonicalJson(pack.resolver));
    const base = {
      schema: ADMISSION_SCHEMA_ID,
      candidateId: "openai/codex-cli",
      modeledId: "openai/codex-cli@1",
      evidenceRevision: "rev",
      resolverDigest: digest,
      fixtureAxes: [...FIXTURE_AXES],
      oracleProof: "ORACLE" as const,
      calibration: "NO_INTROSPECTION" as const,
    };
    expect(() => decodeRealityAdmission({ ...base, modeledId: "openai/codex-cli" }))
      .toThrow(InvalidPackError);
    expect(() => decodeRealityAdmission({
      ...base,
      fixtureAxes: ["selection", "rejection", "precedence", "ambiguity"],
    })).toThrow(InvalidPackError);
    expect(() => assertRealityAdmission(decodeRealityAdmission(base), {
      candidateId: "openai/codex-cli",
      resolver: pack.resolver,
      fixtureAxes: [...FIXTURE_AXES],
      evidenceRevision: base.evidenceRevision,
      oracleProof: "ADAPTER",
      calibration: "NO_INTROSPECTION",
    })).toThrow(/ORACLE/u);
    expect(() => assertRealityAdmission(decodeRealityAdmission({
      ...base,
      resolverDigest: "0".repeat(64),
    }), {
      candidateId: "openai/codex-cli",
      resolver: pack.resolver,
      fixtureAxes: [...FIXTURE_AXES],
      evidenceRevision: base.evidenceRevision,
      oracleProof: "ORACLE",
      calibration: "NO_INTROSPECTION",
    })).toThrow(/resolverDigest/u);
    expect(() => assertRealityAdmission(decodeRealityAdmission(base), {
      candidateId: "openai/codex-cli",
      resolver: pack.resolver,
      fixtureAxes: [...FIXTURE_AXES],
      evidenceRevision: "other-revision",
      oracleProof: "ORACLE",
      calibration: "NO_INTROSPECTION",
    })).toThrow(/evidenceRevision/u);
  });

  it("does not branch interpreter admission on candidate surface kind", () => {
    const admit = readFileSync(
      join(repositoryRoot, "src/packs/interpret-admit.ts"),
      "utf8",
    );
    const interpret = readFileSync(join(repositoryRoot, "src/packs/interpret.ts"), "utf8");
    expect(admit).not.toMatch(/surface\s*===/u);
    expect(admit).not.toContain("CANDIDATE_SURFACES");
    expect(interpret).not.toMatch(/surface\s*===/u);
    expect(interpret).not.toContain("harness");
    const pack = readPackDirectory(
      join(repositoryRoot, "packs/bundled/openai-codex-cli@1"),
    );
    expect(uninterpretableReasons(pack.resolver)).toEqual([]);
    expect(decodeCandidateSurface(candidate("acme/tool-cli", { surface: "cli" })).surface)
      .toBe("cli");
    expect(decodeCandidateSurface(candidate("acme/tool-cli", { surface: "harness" })).surface)
      .toBe("harness");
    expect(uninterpretableReasons(pack.resolver)).toEqual([]);
  });

  it("refuses a candidate directory that carries admission.json", () => {
    const directory = join(mkdtempSync(join(tmpdir(), "ruleblast-admit-")), "xai-grok-build-cli");
    mkdirSync(directory);
    writeFileSync(
      join(directory, "candidate.json"),
      readFileSync(join(repositoryRoot, "packs/candidate/xai-grok-build-cli/candidate.json")),
    );
    writeFileSync(join(directory, "admission.json"), "{}");
    expect(() => readCandidateSurface(directory)).toThrow(/admission\.json/u);
  });
});
