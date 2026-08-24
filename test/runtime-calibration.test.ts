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
  CALIBRATION_SCHEMA_ID,
  decodeRuntimeCalibration,
  verifyPackCalibration,
} from "../src/packs/calibration.js";
import { interpretCompiledPack } from "../src/packs/interpret.js";
import { ManifestSnapshot } from "../src/snapshot.js";

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
  it("records no-introspection on every bundled pack and does not treat that as a passing vendor oracle", async () => {
    const lab = await inventoryConformanceLab();
    expect(lab.bundled).toHaveLength(4);
    for (const row of lab.bundled) {
      expect(row.calibration).toBe("NO_INTROSPECTION");
      expect(row.proof).toBe("ORACLE");
      const decoded = decodeRuntimeCalibration(
        JSON.parse(readFileSync(join(bundled(row.id), CALIBRATION_FILE), "utf8")),
      );
      expect(decoded.observation).toBe("no-introspection");
      expect(decoded.probes).toEqual([]);
      expect(decoded.packId).toBe(row.id);
      expect(await verifyPackCalibration(bundled(row.id), readPackDirectory(bundled(row.id))))
        .toBe("NO_INTROSPECTION");
    }
    expect(lab.candidates.every((row) => row.calibration === "UNEXECUTED")).toBe(true);
  });

  it("calibrates a sealed vendor dump against the interpreter and fails closed on mismatch", async () => {
    const pack = readPackDirectory(bundled("openai/codex-cli@1"));
    const profile = interpretCompiledPack(pack);
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
    const snapshot = new ManifestSnapshot(snapshotRaw);
    const prepared = await profile.prepare(snapshot);
    const projectionDigests: Record<string, string> = {};
    for (const target of await snapshot.listPaths()) {
      projectionDigests[target] = sha256(canonicalJson(prepared.project(target)));
    }
    const probe = {
      snapshot: snapshotRaw,
      projectionDigests,
      sourceDependencyPaths: [...prepared.sourceDependencyPaths],
    };
    const root = mkdtempSync(join(tmpdir(), "ruleblast-cal-"));
    const directory = join(root, "openai-codex-cli@1");
    mkdirSync(directory);
    for (const name of ["pack.json", "evidence.json", "resolver.json", "oracle.json"]) {
      writeFileSync(
        join(directory, name),
        readFileSync(join(bundled("openai/codex-cli@1"), name)),
      );
    }
    writeFileSync(join(directory, CALIBRATION_FILE), JSON.stringify({
      schema: CALIBRATION_SCHEMA_ID,
      packId: "openai/codex-cli@1",
      observation: "vendor-dump",
      evidence: [{
        claimId: "cal.dump.1",
        sourceType: "vendor-doc",
        sourceUrl: "https://learn.chatgpt.com/docs/agent-configuration/agents-md",
        retrievedAt: "2026-08-24",
        sourceRevision: "fixture",
        claim: "Sealed vendor observation of selected paths and projection digest. Not a live vendor CLI.",
      }],
      probes: [probe],
    }));
    expect(await verifyPackCalibration(directory, readPackDirectory(directory))).toBe("CALIBRATED");

    const broken = JSON.parse(readFileSync(join(directory, CALIBRATION_FILE), "utf8")) as {
      probes: Array<{ projectionDigests: Record<string, string> }>;
    };
    const first = Object.keys(broken.probes[0]!.projectionDigests)[0]!;
    broken.probes[0]!.projectionDigests[first] = "0".repeat(64);
    writeFileSync(join(directory, CALIBRATION_FILE), JSON.stringify(broken));
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
    const source = readFileSync(join(repositoryRoot, "src/packs/calibration.ts"), "utf8");
    expect(source).not.toMatch(/child_process|fetch\(|https?:\/\//u);
    expect(source).not.toContain("node:net");
  });
});
