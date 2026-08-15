import { createClaudeProfile } from "../profiles/claude.js";
import { createCodexProfile } from "../profiles/codex.js";
import { createCopilotProfile } from "../profiles/copilot.js";
import { createGeminiProfile } from "../profiles/gemini.js";
import { defineEvidenceRef, type ProfileDefinition } from "../profiles/profile.js";
import type { CompiledPack } from "./schema.js";

function evidenceFromPack(pack: CompiledPack) {
  return Object.freeze(pack.evidence.map((item) => defineEvidenceRef({
    url: item.sourceUrl,
    retrievedAt: item.retrievedAt,
    revision: item.sourceRevision,
    claim: item.claim,
  })));
}

export function profileFromCompiledPack(pack: CompiledPack): ProfileDefinition {
  if (pack.resolver.fingerprint === "codex-v1") {
    const budget = pack.resolver.transform.find((item) => item.kind === "byte-budget");
    const names = pack.resolver.select.names;
    if (budget?.bytes === undefined || names.length < 2 || names[0] === undefined || names[1] === undefined) {
      throw new TypeError("INVALID_PACK: Codex pack is missing budget or two select names");
    }
    return createCodexProfile({
      id: pack.pack.id,
      evidence: evidenceFromPack(pack),
      overrideName: names[0],
      agentsName: names[1],
      byteLimit: budget.bytes,
    });
  }
  const bound = { id: pack.pack.id, evidence: evidenceFromPack(pack) };
  if (pack.resolver.fingerprint === "claude-v1") return createClaudeProfile(bound);
  if (pack.resolver.fingerprint === "gemini-v1") return createGeminiProfile(bound);
  if (pack.resolver.fingerprint === "copilot-v1") return createCopilotProfile(bound);
  throw new TypeError(`Pack engine not implemented for fingerprint ${pack.resolver.fingerprint}`);
}
