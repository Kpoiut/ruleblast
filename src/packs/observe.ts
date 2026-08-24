import { ManifestSnapshot } from "../snapshot.js";
import type { PackClaim } from "./schema.js";
import { calibrationSnapshots } from "./observe-fixtures.js";
import { observeGemini } from "./observe-gemini.js";
import {
  CALIBRATION_PACK_IDS,
  type CalibrationPackId,
  type TargetObservation,
} from "./observation.js";
import {
  observeClaude,
  observeCodex,
  observeCopilot,
  type IndexedFile,
} from "./observe-vendor.js";

export { CALIBRATION_PACK_IDS, type CalibrationPackId, type TargetObservation };

const OBSERVE = {
  "openai/codex-cli@1": observeCodex,
  "anthropic/claude-code-cli@1": observeClaude,
  "google/gemini-cli@1": observeGemini,
  "github/copilot-cli@1": observeCopilot,
} as const;

export interface ObservationProbe {
  readonly snapshot: unknown;
  readonly targets: Readonly<Record<string, TargetObservation>>;
}

async function indexSnapshot(raw: unknown): Promise<{
  readonly files: ReadonlyMap<string, IndexedFile>;
  readonly paths: readonly string[];
}> {
  const snapshot = new ManifestSnapshot(raw);
  const paths = await snapshot.listPaths();
  const files = new Map<string, IndexedFile>();
  for (const path of paths) {
    const entry = await snapshot.entry(path);
    const bytes = await snapshot.read(path);
    if (entry === null || bytes === null) continue;
    files.set(path, {
      path,
      kind: entry.kind,
      bytes,
      text: new TextDecoder().decode(bytes),
    });
  }
  return { files, paths };
}

export async function observeSnapshot(
  packId: CalibrationPackId,
  snapshotRaw: unknown,
): Promise<ObservationProbe> {
  const indexed = await indexSnapshot(snapshotRaw);
  const targets: Record<string, TargetObservation> = {};
  const observe = OBSERVE[packId];
  for (const target of indexed.paths) {
    targets[target] = observe(indexed.files, target);
  }
  return { snapshot: snapshotRaw, targets };
}

export function calibrationRuntime(packId: CalibrationPackId): {
  readonly surfaceId: string;
  readonly revision: string;
  readonly sourceUrl: string;
  readonly claim: string;
} {
  if (packId === "openai/codex-cli@1") {
    return {
      surfaceId: packId,
      revision: "4ef836f883c38ba6d39e6920f335ce6452b7de33",
      sourceUrl: "https://github.com/openai/codex/blob/4ef836f883c38ba6d39e6920f335ce6452b7de33/codex-rs/core/src/agents_md.rs",
      claim: "Pinned Codex agents_md.rs executed offline against fixture snapshots: AGENTS.override.md then AGENTS.md, root-to-cwd, 32 KiB budget, empty skip, project docs joined with a blank line. Not a live Codex CLI. Not interpreter self-match.",
    };
  }
  if (packId === "google/gemini-cli@1") {
    return {
      surfaceId: packId,
      revision: "google-gemini/gemini-cli@v0.55.1#41327e407da58aa01c409ef6685b7b5d379f295e",
      sourceUrl: "https://github.com/google-gemini/gemini-cli/blob/41327e407da58aa01c409ef6685b7b5d379f295e/packages/core/src/utils/memoryDiscovery.ts",
      claim: "Pinned Gemini memoryDiscovery.ts and processImports tree format executed offline: upward GEMINI.md variants, @path inlining, concatenateInstructions Context-from wrappers with repository-relative paths. Not a live Gemini CLI. Not interpreter self-match.",
    };
  }
  if (packId === "anthropic/claude-code-cli@1") {
    return {
      surfaceId: packId,
      revision: "code.claude.com/docs/en/memory@2026-08-24",
      sourceUrl: "https://code.claude.com/docs/en/memory",
      claim: "Pinned Claude Code memory docs executed offline: CLAUDE.md / CLAUDE.local.md / .claude/CLAUDE.md concatenation, HTML-comment strip, path-scoped .claude/rules. Not a live Claude CLI. Not interpreter self-match.",
    };
  }
  return {
    surfaceId: packId,
    revision: "docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions@2026-08-24",
    sourceUrl: "https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions",
    claim: "Pinned Copilot CLI custom-instruction docs executed offline: .github/copilot-instructions.md, applyTo-gated instruction files, AGENTS.md / CLAUDE.md / GEMINI.md. Not a live Copilot CLI. Not interpreter self-match.",
  };
}

export function calibrationEvidence(packId: CalibrationPackId): readonly PackClaim[] {
  const runtime = calibrationRuntime(packId);
  const vendorSource = packId === "google/gemini-cli@1" || packId === "openai/codex-cli@1"
    ? "vendor-implementation"
    : "vendor-doc";
  return Object.freeze([
    {
      claimId: `${packId.split("/")[0]}.calibration.dump.1`,
      sourceType: vendorSource,
      sourceUrl: runtime.sourceUrl,
      retrievedAt: "2026-08-24",
      sourceRevision: runtime.revision,
      claim: runtime.claim,
    },
  ]);
}

export async function observeProbes(
  packId: CalibrationPackId,
): Promise<readonly ObservationProbe[]> {
  const probes: ObservationProbe[] = [];
  for (const snapshot of calibrationSnapshots(packId)) {
    probes.push(await observeSnapshot(packId, snapshot));
  }
  return probes;
}
