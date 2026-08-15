# Increment 0.25 — Gemini nested-import probe

Command output is authority for observations. CONTRACT and pinned evidence decide whether those observations are defensible.

```
BASELINE_SHA:           2cdd0ef7b202f1d35d1dbca4fcfef5c5906c2f12
PROBE_TREE_SHA:         f9e6833aeadcb3e3f23753ebf0f761df68749f0a
```

Observations were taken on `PROBE_TREE_SHA` with worktree dirty only `?? artifacts/` (untracked; not imported by the harness). After this artifact is committed, HEAD will move; the probe identity remains `PROBE_TREE_SHA`.

```
CONTRACT_BLOB_SHA:      3f0e37459b94f61b5f95e4de2301201139f68063
CONTRACT_SECTION:       Projection result
CONTRACT_WORDING:       projectionDigest fingerprints the profile revision, context, effective source decisions, transformed contributions, composition, completeness, and evidence revision. It answers whether that profile's instruction stack changed.
```

## Gemini topology evidence

```
repository:   https://github.com/google-gemini/gemini-cli
commit SHA:   41327e407da58aa01c409ef6685b7b5d379f295e
tag:          v0.55.1
path:         docs/reference/memport.md
retrievedAt:  2026-08-15
claim:        imported files may contain further imports; default maximum import depth is 5
```

Same commit is already `GEMINI_IMPLEMENTATION_REVISION` in this repository.

## CONTROL — one hop (`PROBE_TREE_SHA`)

Change: `a.md` `VALUE_A` → `VALUE_B`. Target `src/file.ts`.

| Field | Value |
|---|---|
| before.status / after.status | COMPLETE / COMPLETE |
| normalizedPayloadDigest before | `1dfbf058b18917b7896e4c785d551bbf7f74daa99f0bea00657adcea5b05fdee` |
| normalizedPayloadDigest after | `2645a55ef29a1bdb0677831838d551521f3b829cd18cfe90ac6fe49336034e8b` |
| projectionDigest before | `04f46d2ddbdb60ae689bb18cecb99f7e1c97b175ec810c0879ec7e14215e6d20` |
| projectionDigest after | `02f5faf1e8bdcee8f40d57328e40376ccc9d8e32621ca5c91ebc130cab0de950` |
| sourceDependencyPaths | `["GEMINI.md","a.md"]` |
| changedProfiles | `["google/gemini-cli@1"]` |
| changedInstructionSources | `a.md` |
| causes | `["a.md"]` |
| diffStats.editedLineCount | 2 (diagnostic) |

**CONTROL PASS.** All five predicates held. Harness is usable.

## PROBE — two hops (`PROBE_TREE_SHA`)

Change: `b.md` `VALUE_A` → `VALUE_B`. Target `src/file.ts`.

| Field | Value |
|---|---|
| before.status / after.status | COMPLETE / COMPLETE |
| normalizedPayloadDigest before | `57812850e62df5c60256b45432149f5ab34e38ba700847fe78fd467aa07b7ced` |
| normalizedPayloadDigest after | `8977161061151facf851ca5842d14acb8daca869916904d31ef1ed43a0a79560` |
| projectionDigest before | `225a534fb344e88ee4f17cdd3a87cfc2bf79027241962ada4f80c2e5d58121a6` |
| projectionDigest after | `80eae9a1f50c019b39780acfa66f372b956e78d5225b0b85f2ef019817be2e85` |
| sourceDependencyPaths | `["GEMINI.md","a.md"]` (`b.md` absent) |
| after Gemini sources | GEMINI.md SELECTED; a.md IMPORTED; **b.md IMPORTED** |
| changedProfiles | `["google/gemini-cli@1"]` |
| changedInstructionSources | `[]` |
| causes | `[]` |
| diffStats.editedLineCount | 0 (diagnostic; not a classifier input) |

## Classifier (first match)

1. Payload changed → not D  
2. Both COMPLETE → not U  
3. Gemini ∈ `changedProfiles` → not D1  
4. `b.md` ∉ `sourceDependencyPaths` → **D2a**

**Class: D2a (dependency-closure).** Detection works. Expand visits `b.md`. Prepare-time set is instruction files plus one hop (`GEMINI.md`, `a.md`).

## Increment 0.25 decision (not a physical SHA)

```
correction admitted:     yes
correction class:        attribution
fix vs preserve:         fix
intended revision policy: keep google/gemini-cli@1; do not bump resolverRevision unless 0.30 changes default two-profile goldens
old-id disposition:      n/a (id unchanged)
correction release strategy:  bundled into 2.0.0
Gemini E2E for later:    two-hop
```

Rationale: plan default for D2a is fix. Vendor loading already expands two hops (sources include `b.md`). Missing `b.md` from `sourceDependencyPaths` is RuleBlast attribution machinery, not a new vendor interpretation. Least reason to bump the vendor profile id.

Preserve is **not** chosen. D2a preserve wording is unused.

## Increment 0.30 lock (after the correction commit existed)

```
MIGRATION_BASE_SHA:     38cb0f50bd03bc39a0046426b6fa3004103d4f4a
final profile id:       google/gemini-cli@1
resolverRevision:       1
fingerprint contract:   historical
correction release:     bundled into 2.0.0 (not a 1.6.x release)
```

Failing test first (`includes a two-hop imported file in sourceDependencyPaths and diff sources`), then worklist walk to `GEMINI_IMPORT_DEPTH`. Default two-profile goldens unchanged. Measurement: [migration-base-benchmark.md](migration-base-benchmark.md).

