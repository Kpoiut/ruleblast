import { createClaudeProfile } from "../profiles/claude.js";
import { createCopilotProfile } from "../profiles/copilot.js";
import { createGeminiProfile } from "../profiles/gemini.js";
import { defineEvidenceRef, type ProfileDefinition } from "../profiles/profile.js";
import { InvalidPackError } from "./compile.js";
import { canInterpretResolver, interpretCompiledPack } from "./interpret.js";
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
  if (canInterpretResolver(pack.resolver)) {
    return interpretCompiledPack(pack);
  }
  const bound = { id: pack.pack.id, evidence: evidenceFromPack(pack) };
  if (pack.resolver.fingerprint === "claude-v1") return createClaudeProfile(bound);
  if (pack.resolver.fingerprint === "gemini-v1") return createGeminiProfile(bound);
  if (pack.resolver.fingerprint === "copilot-v1") return createCopilotProfile(bound);
  throw new InvalidPackError(`Pack engine not implemented for fingerprint ${pack.resolver.fingerprint}`);
}
