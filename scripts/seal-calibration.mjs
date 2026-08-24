import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../dist/canonical.js";
import {
  CALIBRATION_PROBE_SCHEMA_ID,
  CALIBRATION_SCHEMA_ID,
} from "../dist/packs/calibration.js";
import {
  CALIBRATION_PACK_IDS,
  calibrationEvidence,
  calibrationRuntime,
  observeProbes,
} from "../dist/packs/observe.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

for (const packId of CALIBRATION_PACK_IDS) {
  const probes = await observeProbes(packId);
  const runtime = calibrationRuntime(packId);
  const document = {
    schema: CALIBRATION_SCHEMA_ID,
    packId,
    observation: "vendor-dump",
    evidence: calibrationEvidence(packId),
    probes,
    runtime: {
      surfaceId: runtime.surfaceId,
      revision: runtime.revision,
      observationMethod: "sealed-offline-dump",
      artifactDigest: sha256(canonicalJson(probes)),
      probeSchema: CALIBRATION_PROBE_SCHEMA_ID,
    },
  };
  writeFileSync(
    join(repositoryRoot, "packs/bundled", packId.replaceAll("/", "-"), "calibration.json"),
    `${JSON.stringify(document, null, 2)}\n`,
  );
}
