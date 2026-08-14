# RuleBlast Contract

This document is the public behavior and result contract for RuleBlast v1. It defines what a result means, which bytes are in scope, how uncertainty survives analysis, and what the product may claim. Implementation details may change while this contract and the canonical JSON remain compatible.

The v1 package version is `1.5.1`. An authorized distribution binds it to signed source tag `v1.5.1`; registry and GitHub Release availability are external facts that this contract never infers from a source checkout.

## Product claims

RuleBlast is a local, read-only, Git-native debugger for repository instruction projection. Given the same supported snapshot bytes, selected profiles, projection context, and resolver revision, it produces the same canonical core result.

It answers four bounded questions:

1. `ruleblast [path]` — starting repository discovery from the optional filesystem path, what repository instruction payload does each bundled profile project now?
2. `ruleblast diff [base]` — which tracked paths changed instruction stack between two snapshots?
3. `ruleblast explain <path> [--from <base>]` — which sources and boundaries produced one path result?
4. `ruleblast case [--explain <path>]` — what did a verified immutable public-repository comparison produce?

“Two AI realities” is presentation language for a path whose normalized repository payload relation is proven `DIFFERENT`. It is not a prediction about model output.

### Command options and output

The optional scan `[path]` is a filesystem starting point for finding the repository; it does not select or filter one tracked result path. `diff` defaults to `HEAD` versus the tracked `WORKTREE`; `--to <ref|WORKTREE>` selects its after endpoint. `explain --from <ref>` selects diff explanation, while `--to <ref|WORKTREE>` selects the target endpoint. The `explain` target is a repository-relative Git-tracked path.

All four actions accept `--json` or deterministic text. Text accepts `--color=auto|always|never`; `NO_COLOR` disables color even when color is requested. `--witness` is opt-in: text appends why-edges derived from existing projection sources, and `--json --witness` wraps the unchanged canonical result in a `ruleblast.witness.v1` envelope. `--receipt` is opt-in: text prints a compact scoreboard box derived from the existing result plus the user-owned agent-allow state, and `--json --receipt` emits an `RBREC1` card with an `RBCTX1` identity. Agent-allow is `yes` only when the user set `RULEBLAST_AGENT_ALLOW` or created `.ruleblast-allow`; RuleBlast never writes that file and does not record live agent tool calls. `--reality github/copilot-cli@1` is opt-in and adds that one documented Copilot CLI surface; Copilot VS Code and hosted Copilot remain distinct unsupported surfaces. Default `--json` remains schema-1 two-profile result bytes with no envelope. `--help` prints usage and `--version` prints package metadata. JSON contains canonical field names and no color or presentation aliases.

Exit status is part of the CLI contract:

| Code | Meaning |
|---:|---|
| `0` | The action completed and either had no candidate paths or had a defensible `COMPLETE` result in the selected/aggregate scope. |
| `1` | Usage, repository, ref, tracked-path, or another known recoverable boundary error. |
| `2` | Candidate paths exist, but the selected path or every path in the aggregate action lacks a defensible complete projection; diff requires complete coverage at both endpoints. Output is still emitted for inspection. |
| `70` | An unexpected internal failure, invalid injected runtime boundary, or output failure. |

## Non-claims

RuleBlast does not observe or predict private model state, compliance, response quality, or downstream behavior. It does not model user, global, organization, managed, session, auto-memory, conversation, skill, plugin, MCP, hook, tool, or network state.

V1 does not mutate repositories, call a model or vendor API, access a network during analysis, score prompts, synchronize instruction files, generate fixes, run as a service, or provide a product UI. It models only documented repository-loading semantics for the named profile revision.

## Analysis boundary

Only Git-tracked repository entries are candidates. Untracked and ignored files are outside the result. Repository-relative paths use `/`, never an absolute checkout path.

The tracked worktree is captured before profile resolution begins. Every existing tracked regular file or symlink node is copied from the filesystem after type and stability checks, without following symlinks. Only a missing path marked skip-worktree falls back to its stage-zero blob; other missing tracked paths are absent from the worktree snapshot. Git discovery disables optional locks and fsmonitor. An unmerged index, unsupported node replacement, or worktree that changes during capture ends the analysis with an explicit error.

Tracked gitlinks (index mode `160000`) are excluded from snapshot inventory. Named instruction-file symlinks that remain in inventory are visible boundaries and are not followed. External or otherwise unresolved imports produce uncertainty instead of being treated as absent.

## Snapshots

Every result identifies its input with a `SnapshotRef`:

```ts
interface SnapshotRef {
  kind: "git" | "worktree" | "fixture";
  label: string;
  oid: string | null;
}
```

- `git` is an immutable commit tree. `oid` is its full object id.
- `worktree` is one consistent capture of tracked worktree state. It is not an ongoing live view, so `oid` is `null`.
- `fixture` is an immutable manifest-backed snapshot used by tests. It has a stable label and no Git oid.

Current analysis has one `snapshot`. Diff analysis has `before` and `after`. Equal endpoints are rejected because they cannot describe a transition.

## Projection context

Every profile receives a snapshot and an explicit `ProjectionContext`:

```ts
interface ProjectionContext {
  cwd: string;
  trigger: "STARTUP" | "READ_TARGET";
  targetPath: string;
  repositoryOnly: true;
}
```

- `cwd` is the modeled repository-relative working directory.
- `STARTUP` asks what the profile discovers when starting in that directory.
- `READ_TARGET` asks what becomes applicable when the named tracked path is read.
- `targetPath` is the Git-tracked blob being projected.
- `repositoryOnly` is always `true` in schema version 1.

This is a deterministic comparison context, not an assertion that every developer launches an agent in that context. `explain` prints it and JSON records it.

The bundled Codex profile uses `cwd = dirname(targetPath)` with `STARTUP`. The bundled Claude Code profile uses repository-root `cwd` with `READ_TARGET`.

## Profile identity and the profile evidence boundary

A profile id names one product surface and resolver revision:

```text
vendor/product-surface@positive-integer-revision
```

V1 bundles exactly:

- `openai/codex-cli@1`
- `anthropic/claude-code-cli@1`

Profile ids are validated data, sorted before analysis, and unique. The schema can carry more than two profiles; that does not make another product, editor, or hosted mode supported.

Each profile definition carries evidence records with an official URL or pinned implementation URL, retrieval date, revision, and the narrow claim implemented from that source. Code may model only those claims. Missing discovery, precedence, applicability, composition, or boundary evidence becomes `PARTIAL`, `UNKNOWN`, `UNSPECIFIED`, or `RUNTIME_DECIDED`; an adapter may not invent a cleaner rule.

Codex CLI, an editor integration, and a hosted Codex surface would be separate profiles if their documented loading semantics differ. The same separation applies to Claude Code and to any future surface.

### Codex CLI revision 1

For every directory from repository root through `cwd`, the profile chooses the first tracked regular source in this order:

1. `AGENTS.override.md`
2. `AGENTS.md`

An existing empty override still shadows same-directory `AGENTS.md`. Non-empty selected contributions are assembled root-to-`cwd`, under the pinned 32 KiB repository instruction budget. The profile records empty selection, shadowing, bytes used, and truncation separately.

### Claude Code CLI revision 1

The profile models tracked project memory (`CLAUDE.md`, `.claude/CLAUDE.md`, and tracked ancestor/local memory), `.claude/rules/**/*.md`, bounded relative `@path` imports, supported path applicability, repository settings exclusions, and documented comment handling.

Ambiguous root alternatives, unsupported absolute exclusion semantics, malformed rules, unresolved imports, and instruction symlinks preserve uncertainty. Multiple applicable rules, or project memory plus an applicable rule, use `UNSPECIFIED` composition until evidence establishes total order.

## Projection result

One profile/path projection contains:

```ts
interface Projection {
  profile: string;
  context: ProjectionContext;
  status: "COMPLETE" | "PARTIAL" | "UNKNOWN";
  composition: "ORDERED" | "UNORDERED" | "UNSPECIFIED" | "RUNTIME_DECIDED";
  sources: ResolvedSource[];
  normalizedPayloadUnits: string[][];
  projectionDigest: string | null;
  normalizedPayloadDigest: string | null;
  evidence: string[];
}
```

`projectionDigest` fingerprints the profile revision, context, effective source decisions, transformed contributions, composition, completeness, and evidence revision. It answers whether that profile's instruction stack changed.

`normalizedPayloadUnits` remove vendor wrappers but retain model-visible repository contributions and their line boundaries. CRLF becomes LF; lone CR and whitespace remain; only the terminal empty line caused by a final LF is removed. Each logical line is domain-separated and SHA-256 hashed. Empty content adds no contribution; duplicates remain duplicates.

`normalizedPayloadDigest` is an explain/cache digest over units plus composition. The relation algorithm uses the units and uncertainty rules below; it never substitutes digest equality for those rules.

## Completeness

Every projection has exactly one completeness status:

- `COMPLETE` — all modeled inputs were resolved under the pinned profile evidence.
- `PARTIAL` — useful resolution exists, but a documented ambiguity or supported boundary affected it.
- `UNKNOWN` — no defensible projection can be produced for this context.

Definitive stack-change counts require complete before and after projections. Relation headlines require a decisive relation. Partial and unknown states remain in JSON and appear in terminal output when non-zero.

## Composition

Composition describes what is known about contribution ordering:

- `ORDERED` — one total contribution sequence is established.
- `UNORDERED` — order is irrelevant, but the contribution multiset is established.
- `UNSPECIFIED` — the sources are known while their authoritative total order is not.
- `RUNTIME_DECIDED` — runtime state outside this analysis decides composition.

An adapter may expose source content without converting `UNSPECIFIED` or `RUNTIME_DECIDED` into an authoritative sequence.

## Source dispositions

Every `ResolvedSource` carries repository path, `digest`, `bytesUsed`, `truncated`, and one disposition:

| Disposition | Meaning |
|---|---|
| `SELECTED` | The profile selected this source and it can contribute content. |
| `SELECTED_EMPTY` | The source won selection but contributed no non-empty content. |
| `IMPORTED` | A selected document imported this source at a modeled insertion point. |
| `APPLIED_RULE` | A conditional rule was proven applicable to the target. |
| `SHADOWED` | A higher-precedence source prevented this source from applying. |
| `EXCLUDED` | Documented exclusion semantics removed the source. |
| `UNRESOLVED_IMPORT` | An import was visible but could not be resolved inside the boundary. |

`SHADOWED` sources are explanatory but are not transition causes. Unresolved and unsupported sources also emit evidence or findings and affect completeness.

## Payload relation

Cross-profile relation means exact normalized repository-payload relation, not semantic equivalence:

| Pair | Equal units | Unequal units |
|---|---|---|
| either status is `PARTIAL` or `UNKNOWN` | `INDETERMINATE` | `INDETERMINATE` |
| either composition is `RUNTIME_DECIDED` | `INDETERMINATE` | `INDETERMINATE` |
| `ORDERED` / `ORDERED` | identical sequence → `SAME` | different sequence → `DIFFERENT` |
| `UNORDERED` / `UNORDERED` | equal multiset → `SAME` | different multiset → `DIFFERENT` |
| mixed ordered/unordered, or either `UNSPECIFIED` | equal multiset → `INDETERMINATE` | different multiset → `DIFFERENT` |

For N profiles, aggregate `SAME` means every pair is proven equal. `DIFFERENT` means at least one pair is proven different. `INDETERMINATE` means no difference is proven and at least one pair cannot be decided.

`isSplit` is `false`, `true`, or `null` for those three relations. Proven difference and incomplete coverage are orthogonal: a path may be `DIFFERENT` for one pair and still increment `indeterminatePathCount` because another pair is unresolved.

## Current metrics

Current mode emits one result for one snapshot:

| Field | Definition |
|---|---|
| `candidatePathCount` | Git-tracked blob paths in the modeled set. |
| `currentSplitPathCount` | Candidate paths whose aggregate payload relation is proven `DIFFERENT`. |
| `partialPathCount` | Candidate paths with at least one `PARTIAL` projection. |
| `unknownPathCount` | Candidate paths with at least one `UNKNOWN` projection. |
| `indeterminatePathCount` | Candidate paths with incomplete coverage or at least one unresolved pairwise relation. |
| `completePathCount` (`byProfile[]`) | Candidate paths resolved `COMPLETE` for that validated profile. |
| `byProfile[].partialPathCount` | Candidate paths resolved `PARTIAL` for that profile. |
| `byProfile[].unknownPathCount` | Candidate paths resolved `UNKNOWN` for that profile. |

Each current path stores `projections`, `payloadRelation`, and the tri-state `isSplit`.

## Diff metrics

Diff mode compares before and after snapshots. Completeness per profile/path pair is the worse endpoint status.

| Field | Definition |
|---|---|
| `candidatePathCount` | Git-tracked candidate entries present in the after/target snapshot inventory. Deleted before-only paths may still appear in changed instruction sources but are not target paths to project. |
| `changedStackPathCount` | Paths where at least one profile has complete endpoints and a changed `projectionDigest`. |
| `newlySplitPathCount` | Paths whose aggregate relation moves `SAME` → `DIFFERENT`. |
| `convergedPathCount` | Paths whose aggregate relation moves `DIFFERENT` → `SAME`. |
| `currentSplitPathCount` | Paths whose after relation is proven `DIFFERENT`. |
| `partialPathCount` | Paths whose worst before/after profile status includes `PARTIAL`. |
| `unknownPathCount` | Paths whose worst before/after profile status includes `UNKNOWN`. |
| `indeterminatePathCount` | Paths with incomplete endpoint coverage or an indeterminate before/after pair. |
| `completePathCount` (`byProfile[]`) | Paths with complete before and after projections for that profile. |
| `byProfile[].partialPathCount` | Paths whose worst endpoint status is `PARTIAL` for that profile. |
| `byProfile[].unknownPathCount` | Paths whose worst endpoint status is `UNKNOWN` for that profile. |
| `byProfile[].changedStackPathCount` | Complete endpoint pairs with a changed fingerprint for that profile. |

The metric sets overlap by design. For example, a path can count as changed, currently split, and indeterminate for different profile pairs.

## Instruction-line metrics

`diffStats` describes changed instruction sources, not every candidate path:

| Field | Definition |
|---|---|
| `addedLineCount` | Added normalized text lines across changed instruction sources. |
| `deletedLineCount` | Deleted normalized text lines across changed instruction sources. |
| `editedLineCount` | Added plus deleted lines; replacement is one deletion and one addition. |
| `binaryChangedSourceCount` | Changed instruction sources containing NUL bytes and excluded from text-line counts. |

Line comparison normalizes CRLF to LF, preserves lone CR, and ignores only a final-newline presence difference. Invalid UTF-8 uses replacement decoding consistently. A move is represented as `DELETE` plus `ADD`; v1 does not guess renames.

## Transitions, causes, groups, and findings

`changedInstructionSources` is the sorted set of instruction-source `ADD`, `DELETE`, or `MODIFY` records. Each record carries before/after paths, content digests, and its own line stats.

Every diff path transition carries:

- `changedProfiles` — profile ids with complete endpoints and a changed projection fingerprint;
- `beforePayloadRelation` and `afterPayloadRelation` — aggregate `SAME`, `DIFFERENT`, or `INDETERMINATE` states;
- `wasSplit` and `isSplit` — the tri-state relation aliases;
- `causes` — changed instruction-source paths intersected with effective, non-shadowed sources across all before/after projections for that target, included only when `changedProfiles` is non-empty.

If `changedProfiles` is empty, `causes` is empty. Causes are evidence links, not a causal statement about a model's response.

`groups` collect affected paths by the directory of their nearest changed cause. Each group has `root`, `changedStackPathCount`, `newlySplitPathCount`, and at most three code-point-sorted `samplePaths`. Groups are a presentation aid derived from transitions.

`findings` preserve analysis boundaries. A finding has `code`, nullable `profile`, repository-relative `path`, and `detail`. Schema version 1 codes are:

- `PARTIAL_PROJECTION`
- `UNKNOWN_PROJECTION`
- `BINARY_SOURCE`
- `UNSPECIFIED_COMPOSITION`
- `UNSUPPORTED_GLOB_SEMANTIC`
- `UNSUPPORTED_BOUNDARY`

Findings are sorted and deduplicated. They do not silently remove a path from uncertainty metrics.

## Deterministic canonical JSON

`--json` serializes the canonical result, not terminal aliases. Object keys are sorted deterministically, array order is preserved, strings use JSON escaping, and finite JSON primitives retain their JSON representation. Sparse arrays, symbols, accessors, cycles, non-finite numbers, `undefined`, functions, and non-plain objects are rejected rather than coerced.

Canonical result construction defines deterministic order for profile ids, paths, source changes, groups, samples, causes, and findings. Each profile preserves its deterministic resolver order for sources and evidence instead of alphabetizing away precedence or encounter meaning. The core contains no timestamp, hostname, username, process id, or absolute repository path.

Text color, shell quoting, terminal labels, and explanatory metaphors are presentation context. They cannot change canonical JSON bytes.

## Schema and resolver revisions

`schemaVersion: 1` identifies the public result shape. `resolverRevision: 1` identifies the bundled interpretation boundary. Profile ids carry their own surface revision. A semantic correction that changes defensible canonical results requires tests, evidence, and an explicit revision decision; it cannot be hidden as copy-only drift.

## Packaged case contract

The packaged `case` action presents one promoted real-public-repository receipt. It verifies the complete receipt SHA-256, canonical single-line JSON plus trailing LF, repository identity, immutable full base and head commit ids, resolver revision, and the SHA-256 of `resultCore` before emitting output. A failed verification is an internal integrity failure and emits no result.

The action presents the verified `resultCore` directly. It does not reconstruct unavailable repository source bytes, rerun profile resolution or impact analysis, require a Git checkout, or access the network. `case --json` is exactly the canonical `resultCore` plus one LF. Text identifies the public repository and abbreviated immutable refs before its first metric; `case --explain <path>` selects only a path already recorded in that core.

For v1 command compatibility, the legacy token `demo` is a hidden alias parsed into the same semantic `case` action before dispatch. It is omitted from help and README, does not create a fifth action, and must remain byte-identical to the corresponding `case` invocation.

## Stability and change

Within schema version 1:

- field meanings do not change silently;
- uncertainty is not converted to certainty for presentation;
- profile-specific logic remains behind the profile contract;
- text aliases may improve if canonical behavior and golden intent remain intact;
- new product surfaces require official, versionable evidence and their own profile identity;
- a public release changes roadmap maturity atomically with the tag and artifact.

See [ROADMAP.md](ROADMAP.md) for maturity and admission gates, [CONTRIBUTING.md](CONTRIBUTING.md) for a reproducible Blast Case, and [CHANGELOG.md](CHANGELOG.md) for user-visible changes.
