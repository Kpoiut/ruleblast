import { defineEvidenceRef, type ProfileDefinition } from "../profiles/profile.js";
import { InvalidPackError } from "./compile.js";
import { canInterpretResolver, interpretCompiledPack } from "./interpret.js";
import type { CompiledPack } from "./schema.js";

/**
 * Production pack engine: data-interpretable resolvers only.
 * Handwritten adapters remain test oracles and are not imported here.
 */
export function profileFromCompiledPack(pack: CompiledPack): ProfileDefinition {
  if (!canInterpretResolver(pack.resolver)) {
    throw new InvalidPackError(
      `resolver spec is not data-interpretable: ${pack.pack.id}`,
    );
  }
  return interpretCompiledPack(pack);
}

export function evidenceFromPack(pack: CompiledPack) {
  return Object.freeze(pack.evidence.map((item) => defineEvidenceRef({
    url: item.sourceUrl,
    retrievedAt: item.retrievedAt,
    revision: item.sourceRevision,
    claim: item.claim,
  })));
}
