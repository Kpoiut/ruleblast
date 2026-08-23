import { defineEvidenceRef, type EvidenceRef } from "./profile.js";

export const GEMINI_IMPLEMENTATION_REVISION =
  "google-gemini/gemini-cli@v0.55.1#41327e407da58aa01c409ef6685b7b5d379f295e";

export const GEMINI_EVIDENCE: readonly EvidenceRef[] = Object.freeze([
  defineEvidenceRef({
    url: "https://github.com/google-gemini/gemini-cli/blob/v0.55.1/packages/core/src/utils/memoryDiscovery.ts",
    retrievedAt: "2026-08-14",
    revision: GEMINI_IMPLEMENTATION_REVISION,
    claim: "JIT subdirectory memory resolves a target to its directory and walks upward to the git or trusted root; it does not scan sibling or untouched descendant directories.",
  }),
  defineEvidenceRef({
    url: "https://github.com/google-gemini/gemini-cli/blob/v0.55.1/packages/core/src/utils/memoryDiscovery.ts",
    retrievedAt: "2026-08-14",
    revision: GEMINI_IMPLEMENTATION_REVISION,
    claim: "findUpwardGeminiFiles orders files root-to-leaf by unshifting each directory's matches while walking upward.",
  }),
  defineEvidenceRef({
    url: "https://github.com/google-gemini/gemini-cli/blob/v0.55.1/packages/cli/src/config/config.ts",
    retrievedAt: "2026-08-14",
    revision: GEMINI_IMPLEMENTATION_REVISION,
    claim: "When merged settings.context.fileName is present, loadCliConfig calls setGeminiMdFilename, which unions the configured names with the process default GEMINI.md. Absence resets to GEMINI.md only.",
  }),
  defineEvidenceRef({
    url: "https://github.com/google-gemini/gemini-cli/blob/v0.55.1/packages/core/src/tools/memoryTool.ts",
    retrievedAt: "2026-08-14",
    revision: GEMINI_IMPLEMENTATION_REVISION,
    claim: "DEFAULT_CONTEXT_FILENAME is GEMINI.md. setGeminiMdFilename adds configured names then existing names; resetGeminiMdFilename replaces the list.",
  }),
  defineEvidenceRef({
    url: "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/reference/memport.md",
    retrievedAt: "2026-08-14",
    revision: GEMINI_IMPLEMENTATION_REVISION,
    claim: "Imports use @path syntax, skip fenced and inline code, detect cycles, default to a maximum depth of 5, and leave missing or out-of-scope paths unresolved.",
  }),
  defineEvidenceRef({
    url: "https://github.com/google-gemini/gemini-cli/blob/v0.55.1/packages/core/src/utils/memoryDiscovery.ts",
    retrievedAt: "2026-08-14",
    revision: GEMINI_IMPLEMENTATION_REVISION,
    claim: "concatenateInstructions wraps each file with absolute Context-from markers. Those wrappers are vendor presentation and are not model-visible repository payload units.",
  }),
  defineEvidenceRef({
    url: "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/gemini-ignore.md",
    retrievedAt: "2026-08-14",
    revision: GEMINI_IMPLEMENTATION_REVISION,
    claim: ".geminiignore is documented for tools such as @ file sharing. Hierarchical memory discovery does not cite that filter, so its memory effect stays unspecified.",
  }),
  defineEvidenceRef({
    url: "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/reference/configuration.md",
    retrievedAt: "2026-08-14",
    revision: GEMINI_IMPLEMENTATION_REVISION,
    claim: "Configuration prose still mentions downward subdirectory discovery and discoveryMaxDirs default 200. v0.55.1 implementation is JIT/upward and wins for resolver semantics.",
  }),
  defineEvidenceRef({
    url: "https://github.com/google-gemini/gemini-cli/blob/v0.55.1/packages/cli/src/config/config.ts",
    retrievedAt: "2026-08-14",
    revision: GEMINI_IMPLEMENTATION_REVISION,
    claim: "User, system, and runtime context.fileName settings are outside repository-only analysis.",
  }),
  defineEvidenceRef({
    url: "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/gemini-ignore.md",
    retrievedAt: "2026-08-14",
    revision: GEMINI_IMPLEMENTATION_REVISION,
    claim: "GEMINIIGNORE_MEMORY_EFFECT is UNSPECIFIED: .geminiignore is not modeled as a hierarchical-memory filter.",
  }),
  defineEvidenceRef({
    url: "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/reference/configuration.md",
    retrievedAt: "2026-08-14",
    revision: GEMINI_IMPLEMENTATION_REVISION,
    claim: "Configuration prose still describes downward discovery; v0.55.1 implementation is JIT/upward.",
  }),
]);
