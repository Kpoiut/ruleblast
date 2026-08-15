# Increment 0.5 — representability (no schema freeze)

Oracle: `adapter@MIGRATION_BASE_SHA` `38cb0f50bd03bc39a0046426b6fa3004103d4f4a`.  
That adapter is the **migration proof**, not the eternal pack language.

**Migration proof:** `assertProjectionEquivalent(pack, adapter)` = `canonicalJson(packProjection) === canonicalJson(adapterProjection)` plus `sourceDependencyPaths` **set** equality.

**Pack semantics (later):** finite constructs + evidence-backed parameters. Not started here. **No `src/packs/**`.** If any row would need pack-supplied executable code, `eval`, shell/network, or an unbounded generic graph: stop. None of the required rows below need that.

Zero required `???`.

Authority tags: `vendor-doc` | `vendor-implementation` | `ruleblast-compatibility`.

`vendor-implementation` pins **commit SHA**, not `main`.

---

## Cross-profile canonical obligations

| Obligation | Authority | Proof | Construct? |
|---|---|---|---|
| `ProjectionContext` | ruleblast-compatibility · CONTRACT § Projection context | fixtures per profile | pack `context` spec |
| Codex cwd/trigger | vendor-doc + implementation · `codex.ts` `makeProjection` | `test/fixtures/codex/*` | cwd=`dirname(target)`, `STARTUP` |
| Claude/Gemini/Copilot cwd/trigger | vendor-implementation · each `project` | profile tests | cwd=`.`, `READ_TARGET` |
| `status` COMPLETE/PARTIAL/UNKNOWN | CONTRACT § Completeness | profile fixtures | locus policies |
| `composition` | CONTRACT § Composition | Claude unspecified when memory+rules; Copilot always UNSPECIFIED | assemble mode |
| `sources[]` order | CONTRACT: do not alphabetize away encounter | profile tests | walk/select encounter order |
| `ResolvedSource` fields | CONTRACT | all profile tests | shared type |
| `normalizedPayloadUnits` | CONTRACT · `unitizePayloadContributions` | shared helper | shared, not per-pack hash DSL |
| `normalizedPayloadDigest` | CONTRACT · `digestNormalizedPayload(units, composition)` | shared | shared |
| `projectionDigest` | ruleblast-compatibility · four recipes below | each `makeProjection` | closed builtins |
| `evidence[]` order | ruleblast-compatibility · as each adapter pushes | profile tests | push order |
| `sourceDependencyPaths` set | ruleblast-compatibility · `profile-preparation.ts` unique+sort; Gemini at 38cb0f5 includes nested imports | `gemini-profile` two-hop test | prepare capture |

---

## Fingerprint recipes (compatibility builtins)

| Builtin | `sha256(canonicalJson({...}))` | Authority | Status at `MIGRATION_BASE_SHA` |
|---|---|---|---|
| `codex-v1` | profile, context, status, composition, assembledPayload, evidenceRevisions, effectiveSources, normalizedPayloadUnits | ruleblast-compatibility · `codex.ts` 245–254 | historical |
| `claude-v1` | profile, context, status, composition, evidenceRevisions, effectiveSources, normalizedPayloadUnits, evidence | ruleblast-compatibility · `claude.ts` 173–182 | historical |
| `gemini-v1` | profile, context, status, composition, full sources, `evidenceRevision` | ruleblast-compatibility · `gemini.ts` 251–262 | historical (D2a did not change this object) |
| `copilot-v1` | profile, context, sources `{path, disposition, digest}` only | ruleblast-compatibility · `copilot.ts` 203–211 | historical |

Not an expression language. Not vendor primitives.

---

## Codex

| Behavior | Source | Authority | Construct | Fixture |
|---|---|---|---|---|
| Ancestor walk root→cwd | `codex.ts` `resolve` | vendor-implementation · Codex commit `4ef836f883c38ba6d39e6920f335ce6452b7de33` (budget) + docs URL in `CODEX_EVIDENCE` | walk ancestors + first-per-directory | `nested`, `sibling` |
| `AGENTS.override.md` shadows even if empty | `resolveDirectory` | vendor-implementation · same module | names + shadows | `override`, `empty-override` |
| 32 KiB budget / truncate | `BYTE_LIMIT` | vendor-implementation · `4ef836f` claim in `CODEX_EVIDENCE` | byte-budget transform | `cap-exact`, `cap-truncated` |
| Instruction symlink unfollowed | `kind === "symlink"` | ruleblast-compatibility · CONTRACT snapshot (no follow) | onSymlink | `instruction-symlink` |
| Contribution / source order | ancestor then select | ruleblast-compatibility | encounter order | `order` |
| `assembledPayload` `\n\n` | `assembleCodexProjectInstructions` | ruleblast-compatibility | only inside `codex-v1` | digest tests |

---

## Claude

| Behavior | Source | Authority | Construct | Fixture |
|---|---|---|---|---|
| Dual root `CLAUDE.md` + `.claude/CLAUDE.md` | `liveRootCount === 2` | vendor-doc · CLAUDE_EVIDENCE `memory-locations` | onAmbiguous at root-memory | `ambiguous-root` |
| HTML+import lexer | `tokenizeMarkdown` | vendor-doc · CLAUDE_EVIDENCE `comments` | named prepare lexer `claude-markdown-v1` (not two sequential transforms) | `html-comments`, `import-code-literal` |
| Frontmatter → body | `parseClaudeRule` then `prepareClaudeDocument(body)` | vendor-implementation · `claude-rules.ts` | prepare artifact | `malformed-frontmatter` |
| Glob budget 1000 / 4 MiB | `claude-rules.ts` | vendor-implementation | existing budget | `glob-budget` |
| Import 4 edges → UNKNOWN | `MAX_IMPORT_EDGES = 4` | vendor-implementation · `claude-imports.ts` | import locus | `import-depth` |
| Cycle / missing / external → UNKNOWN | `expandFile` | vendor-implementation | import locus | `import-cycle`, `import-missing`, `import-external` |
| Recursive dependency capture | `captureDependencies` | ruleblast-compatibility | prepare worklist | Claude fixtures |
| Rules + memory composition UNSPECIFIED | `resolveTarget` | vendor-doc · path-globs / unspecified order | assemble unspecified | `rule-memory-order-unspecified` |
| Source/rule/import insertion order | code-point rules; token order | ruleblast-compatibility | encounter | existing fixtures |

---

## Gemini (`MIGRATION_BASE_SHA`)

| Behavior | Source | Authority | Construct | Fixture |
|---|---|---|---|---|
| JIT upward walk | `ancestorDirectories` in `project` | vendor-implementation · `41327e407da58aa01c409ef6685b7b5d379f295e` `memoryDiscovery.ts` (pinned in `GEMINI_EVIDENCE`) | per-target discover | `gemini-profile` ancestor tests |
| Filename union | `parseGeminiFileNames` | vendor-implementation · same revision `setGeminiMdFilename` | settings → names | settings tests |
| Import depth 5 → PARTIAL | `GEMINI_IMPORT_DEPTH = 5` | vendor-implementation + vendor-doc · `docs/reference/memport.md` @ `41327e4` | import locus (not Claude’s 4/UNKNOWN) | import tests |
| Tokenize: fences + ticks, **no HTML-comment state** | `gemini-imports.ts` `tokenize` | vendor-implementation · same file | named lexer `gemini-markdown-v1` | `treats @path inside an HTML comment as an import (no comment state)` |
| Nested import in `sourceDependencyPaths` | worklist @ 38cb0f5 | ruleblast-compatibility · D2a correction | same depth as expand | `includes a two-hop imported file…` |
| One-hop CONTROL | harness | ruleblast-compatibility | — | `control-one-hop-*` |
| Two-hop E2E (chosen in 0.25) | D2a then fix | ruleblast-compatibility | — | `probe-two-hop-*` |

---

## Copilot

| Behavior | Source | Authority | Construct | Fixture |
|---|---|---|---|---|
| Classification / scope | `classify`, `scopeOf`, `isAncestor` | vendor-doc · COPILOT_EVIDENCE 2026-08-14 GitHub docs | discover fixed + glob + agent names | `copilot-profile` |
| `applyTo` parse | `parseApplyTo` | vendor-doc | apply | same |
| `applyTo` match | `matchesApplyTo` | vendor-doc | path-glob | same |
| Modular missing `applyTo` → EXCLUDED | `applyTo === null` | vendor-implementation · `copilot.ts` | apply miss | same |
| `@file` PARTIAL only on repository-wide/agent | `FILE_REFERENCE` | vendor-doc · references visible not expanded | non-expansion + PARTIAL | same |
| Composition always UNSPECIFIED | `composition: "UNSPECIFIED"` | vendor-doc · no general precedence | assemble unspecified | same |
| Digest recipe | `copilot-v1` | ruleblast-compatibility | builtin | same |

---

## Four public actions (existing tests)

| Action | Existing proof |
|---|---|
| scan / current | `test/conformance/semantic/default-two-profile.test.ts`, profile fixtures |
| diff | profile diffs; Gemini two-hop after 0.30 |
| explain + SHADOWED | `test/witness.test.ts`, `test/explain-view.test.ts` |
| case | `test/case.test.ts` |

---

## Increment 0.5 gate

Required rows filled. No executable escape hatch. Schema `ruleblast.pack.v1` remains **blocked**. Increment 1 may start only from this inventory.
