import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { inventoryConformanceLab } from "../src/application/conformance-lab.js";
import { canonicalJson, sha256 } from "../src/canonical.js";
import { InvalidPackError } from "../src/packs/compile.js";
import { readPackDirectory } from "../src/packs/load.js";
import {
  CALIBRATION_FILE,
  CALIBRATION_PROBE_SCHEMA_ID,
  CALIBRATION_SCHEMA_ID,
  decodeRuntimeCalibration,
  verifyPackCalibration,
} from "../src/packs/calibration.js";
import { assembleObservation } from "../src/packs/observation.js";
import {
  CALIBRATION_PACK_IDS,
  observeProbes,
  observeSnapshot,
} from "../src/packs/observe.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundled = (id: string): string =>
  join(repositoryRoot, "packs/bundled", id.replaceAll("/", "-"));

function noIntrospection(packId: string): unknown {
  return {
    schema: CALIBRATION_SCHEMA_ID,
    packId,
    observation: "no-introspection",
    evidence: [{
      claimId: "cal.1",
      sourceType: "vendor-doc",
      sourceUrl: "https://learn.chatgpt.com/docs/agent-configuration/agents-md",
      retrievedAt: "2026-08-24",
      sourceRevision: "2026-08-24",
      claim: "Official loading docs do not publish a deterministic offline dump of the resolved instruction set.",
    }],
    probes: [],
  };
}

describe("sealed runtime calibration", () => {
  it("calibrates every bundled pack from a sealed vendor-source dump, not interpreter self-match", async () => {
    const lab = await inventoryConformanceLab();
    expect(lab.bundled).toHaveLength(4);
    expect(CALIBRATION_PROBE_SCHEMA_ID).toBe("ruleblast.runtime-observation.v1");
    for (const row of lab.bundled) {
      expect(row.calibration).toBe("CALIBRATED");
      expect(row.proof).toBe("ORACLE");
      const decoded = decodeRuntimeCalibration(
        JSON.parse(readFileSync(join(bundled(row.id), CALIBRATION_FILE), "utf8")),
      );
      expect(decoded.observation).toBe("vendor-dump");
      expect(decoded.probes.length).toBeGreaterThan(0);
      expect(decoded.runtime).not.toBeNull();
      expect(decoded.runtime?.observationMethod).toBe("sealed-offline-dump");
      expect(decoded.runtime?.probeSchema).toBe(CALIBRATION_PROBE_SCHEMA_ID);
      expect(decoded.runtime?.surfaceId).toBe(row.id);
      expect(decoded.runtime?.artifactDigest).toBe(sha256(canonicalJson(decoded.probes)));
      expect(decoded.packId).toBe(row.id);
      expect(JSON.stringify(decoded.probes)).not.toContain("projectionDigests");
      expect(JSON.stringify(decoded.probes)).not.toContain("sourceDependencyPaths");
      expect(JSON.stringify(decoded.probes)).not.toContain("\"contributions\"");
      const live = await observeProbes(row.id as typeof CALIBRATION_PACK_IDS[number]);
      expect(canonicalJson(decoded.probes)).toBe(canonicalJson(live));
      for (const probe of decoded.probes as Array<{
        snapshot: { label: string };
        targets: Record<string, {
          loadedPaths: string[];
          loadedTexts: string[];
          vendorAssembly: string;
        }>;
      }>) {
        for (const observation of Object.values(probe.targets)) {
          expect(observation.vendorAssembly).toBe(assembleObservation(
            row.id as typeof CALIBRATION_PACK_IDS[number],
            observation.loadedPaths.map((path, index) => ({
              path,
              text: observation.loadedTexts[index]!,
            })),
          ));
        }
      }
      expect(await verifyPackCalibration(bundled(row.id), readPackDirectory(bundled(row.id))))
        .toBe("CALIBRATED");
    }
    const gemini = JSON.parse(
      readFileSync(join(bundled("google/gemini-cli@1"), CALIBRATION_FILE), "utf8"),
    ) as { probes: Array<{
      snapshot: { label: string };
      targets: Record<string, { vendorAssembly: string }>;
    }> };
    expect(gemini.probes.map((probe) => probe.snapshot.label)).toEqual([
      "gemini-hierarchy",
      "gemini-import",
      "gemini-names",
    ]);
    const hierarchy = Object.values(gemini.probes[0]!.targets)[0]!.vendorAssembly;
    expect(hierarchy).toContain("--- Context from:");
    const imported = Object.values(gemini.probes[1]!.targets)[0]!.vendorAssembly;
    expect(imported).toContain("<!-- Imported from:");
    expect(imported).toContain("VALUE_B");
    expect(lab.candidates.every((row) => row.calibration === "UNEXECUTED")).toBe(true);
  });

  it("calibrates a sealed vendor dump by re-running the vendor-source observer, not the interpreter", async () => {
    const snapshotRaw = {
      schemaVersion: 1,
      label: "calibration probe",
      entries: [{
        path: "AGENTS.md",
        kind: "file",
        executable: false,
        base64: Buffer.from("root\n", "utf8").toString("base64"),
      }, {
        path: "src/file.ts",
        kind: "file",
        executable: false,
        base64: Buffer.from("", "utf8").toString("base64"),
      }],
    };
    const probe = await observeSnapshot("openai/codex-cli@1", snapshotRaw);
    const root = mkdtempSync(join(tmpdir(), "ruleblast-cal-"));
    const directory = join(root, "openai-codex-cli@1");
    mkdirSync(directory);
    for (const name of ["pack.json", "evidence.json", "resolver.json", "oracle.json"]) {
      writeFileSync(
        join(directory, name),
        readFileSync(join(bundled("openai/codex-cli@1"), name)),
      );
    }
    const probes = [probe];
    writeFileSync(join(directory, CALIBRATION_FILE), JSON.stringify({
      schema: CALIBRATION_SCHEMA_ID,
      packId: "openai/codex-cli@1",
      observation: "vendor-dump",
      evidence: [{
        claimId: "cal.dump.1",
        sourceType: "vendor-implementation",
        sourceUrl: "https://github.com/openai/codex/blob/4ef836f883c38ba6d39e6920f335ce6452b7de33/codex-rs/core/src/agents_md.rs",
        retrievedAt: "2026-08-24",
        sourceRevision: "fixture",
        claim: "Sealed vendor observation of selected paths and assembled payload. Not a live vendor CLI.",
      }],
      probes,
      runtime: {
        surfaceId: "openai/codex-cli@1",
        revision: "fixture",
        observationMethod: "sealed-offline-dump",
        artifactDigest: sha256(canonicalJson(probes)),
        probeSchema: CALIBRATION_PROBE_SCHEMA_ID,
      },
    }));
    expect(await verifyPackCalibration(directory, readPackDirectory(directory))).toBe("CALIBRATED");

    const broken = JSON.parse(readFileSync(join(directory, CALIBRATION_FILE), "utf8")) as {
      probes: Array<{ targets: Record<string, { loadedTexts: string[] }> }>;
      runtime: { artifactDigest: string };
    };
    const firstTarget = Object.keys(broken.probes[0]!.targets)[0]!;
    broken.probes[0]!.targets[firstTarget]!.loadedTexts = ["not-the-vendor-payload"];
    broken.runtime.artifactDigest = sha256(canonicalJson(broken.probes));
    writeFileSync(join(directory, CALIBRATION_FILE), JSON.stringify(broken));
    await expect(verifyPackCalibration(directory, readPackDirectory(directory)))
      .rejects.toBeInstanceOf(InvalidPackError);

    const forged = JSON.parse(JSON.stringify({
      schema: CALIBRATION_SCHEMA_ID,
      packId: "openai/codex-cli@1",
      observation: "vendor-dump",
      evidence: [{
        claimId: "cal.dump.1",
        sourceType: "vendor-implementation",
        sourceUrl: "https://github.com/openai/codex/blob/4ef836f883c38ba6d39e6920f335ce6452b7de33/codex-rs/core/src/agents_md.rs",
        retrievedAt: "2026-08-24",
        sourceRevision: "fixture",
        claim: "Sealed vendor observation of selected paths and assembled payload. Not a live vendor CLI.",
      }],
      probes,
      runtime: {
        surfaceId: "openai/codex-cli@1",
        revision: "fixture",
        observationMethod: "sealed-offline-dump",
        artifactDigest: sha256(canonicalJson(probes)),
        probeSchema: CALIBRATION_PROBE_SCHEMA_ID,
      },
    })) as {
      probes: Array<{ targets: Record<string, { vendorAssembly: string }> }>;
      runtime: { artifactDigest: string };
    };
    const forgeTarget = Object.keys(forged.probes[0]!.targets)[0]!;
    forged.probes[0]!.targets[forgeTarget]!.vendorAssembly = "forged-assembly";
    forged.runtime.artifactDigest = sha256(canonicalJson(forged.probes));
    writeFileSync(join(directory, CALIBRATION_FILE), JSON.stringify(forged));
    await expect(verifyPackCalibration(directory, readPackDirectory(directory)))
      .rejects.toThrow(/vendorAssembly is not assembled from loaded files/u);
  });

  it("refuses oracle-shaped probes as a vendor dump", async () => {
    const root = mkdtempSync(join(tmpdir(), "ruleblast-cal-oracle-"));
    const directory = join(root, "openai-codex-cli@1");
    mkdirSync(directory);
    for (const name of ["pack.json", "evidence.json", "resolver.json", "oracle.json"]) {
      writeFileSync(
        join(directory, name),
        readFileSync(join(bundled("openai/codex-cli@1"), name)),
      );
    }
    const probes = [{
      snapshot: {
        schemaVersion: 1,
        label: "copied",
        entries: [{
          path: "AGENTS.md",
          kind: "file",
          executable: false,
          base64: Buffer.from("root\n", "utf8").toString("base64"),
        }],
      },
      projectionDigests: { "AGENTS.md": "0".repeat(64) },
      sourceDependencyPaths: ["AGENTS.md"],
    }];
    writeFileSync(join(directory, CALIBRATION_FILE), JSON.stringify({
      schema: CALIBRATION_SCHEMA_ID,
      packId: "openai/codex-cli@1",
      observation: "vendor-dump",
      evidence: [{
        claimId: "cal.1",
        sourceType: "vendor-doc",
        sourceUrl: "https://learn.chatgpt.com/docs/agent-configuration/agents-md",
        retrievedAt: "2026-08-24",
        sourceRevision: "fixture",
        claim: "copied oracle",
      }],
      probes,
      runtime: {
        surfaceId: "openai/codex-cli@1",
        revision: "fixture",
        observationMethod: "sealed-offline-dump",
        artifactDigest: sha256(canonicalJson(probes)),
        probeSchema: CALIBRATION_PROBE_SCHEMA_ID,
      },
    }));
    await expect(verifyPackCalibration(directory, readPackDirectory(directory)))
      .rejects.toBeInstanceOf(InvalidPackError);
  });

  it("refuses vendor-dump without probes and no-introspection with probes", () => {
    expect(() => decodeRuntimeCalibration({
      ...noIntrospection("openai/codex-cli@1") as object,
      observation: "vendor-dump",
    })).toThrow(InvalidPackError);
    expect(() => decodeRuntimeCalibration({
      ...noIntrospection("openai/codex-cli@1") as object,
      probes: [{ snapshot: {}, projectionDigests: {}, sourceDependencyPaths: [] }],
    })).toThrow(InvalidPackError);
    expect(() => decodeRuntimeCalibration({
      ...noIntrospection("openai/codex-cli@1") as object,
      runtime: {
        surfaceId: "openai/codex-cli@1",
        revision: "fixture",
        observationMethod: "sealed-offline-dump",
        artifactDigest: "0".repeat(64),
        probeSchema: CALIBRATION_PROBE_SCHEMA_ID,
      },
    })).toThrow(InvalidPackError);
  });

  it("fails pack load when calibration.json is absent", () => {
    const root = mkdtempSync(join(tmpdir(), "ruleblast-cal-missing-"));
    const directory = join(root, "openai-codex-cli@1");
    mkdirSync(directory);
    for (const name of ["pack.json", "evidence.json", "resolver.json"]) {
      writeFileSync(
        join(directory, name),
        readFileSync(join(bundled("openai/codex-cli@1"), name)),
      );
    }
    expect(() => readPackDirectory(directory)).toThrow(InvalidPackError);
    expect(() => readPackDirectory(directory)).toThrow(/calibration\.json/u);
  });

  it("does not import a vendor CLI or network as calibration authority", () => {
    const calibration = readFileSync(join(repositoryRoot, "src/packs/calibration.ts"), "utf8");
    expect(calibration).not.toMatch(/child_process|fetch\(|https?:\/\//u);
    expect(calibration).not.toContain("node:net");
    for (const name of [
      "observe.ts",
      "observe-vendor.ts",
      "observe-gemini.ts",
      "observe-fixtures.ts",
      "observation.ts",
    ]) {
      const observer = readFileSync(join(repositoryRoot, "src/packs", name), "utf8");
      expect(observer, name).not.toMatch(/child_process|fetch\(|node:net/u);
      expect(observer, name).not.toContain("interpretCompiledPack");
      expect(observer, name).not.toContain("createCodexProfile");
      expect(observer, name).not.toContain("createClaudeProfile");
      expect(observer, name).not.toContain("createGeminiProfile");
      expect(observer, name).not.toContain("createCopilotProfile");
      expect(observer, name).not.toContain("oracle.json");
      expect(observer, name).not.toContain("assertSealedProbes");
    }
    const gemini = readFileSync(join(repositoryRoot, "src/packs/observe-gemini.ts"), "utf8");
    expect(gemini).not.toContain("stripHtmlComments");
    const verify = readFileSync(join(repositoryRoot, "src/packs/calibration.ts"), "utf8");
    expect(verify).not.toContain("composition === \"ORDERED\"");
    expect(verify).not.toContain("interpretCompiledPack");
    expect(verify).not.toContain("vendorPayloadUnits");
    expect(verify).not.toContain("interpreterPayloadUnits");
    expect(verify).not.toContain("effectiveLoadedPaths");
    expect(verify).toContain("observeSnapshot");
    expect(verify).toContain("assembleObservation");
  });
});
