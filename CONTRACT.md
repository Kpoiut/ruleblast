# RuleBlast Contract

This document is the public behavior and result contract for RuleBlast v1. It defines what a result means, which bytes are in scope, how uncertainty survives analysis, and what the product may claim. Implementation details may change while this contract and the canonical JSON remain compatible.

The v1 result schema remains `schemaVersion: 1` and `resolverRevision: 1`. This tree’s package version is `2.2.0`. Latest independently verified public npm distribution is `2.2.0`. An authorized distribution binds a published npm version to a signed source tag; registry and GitHub Release availability are external facts that this contract never infers from a source checkout.

v2.0 Reality Packs are a reviewed **bundled** representation and contributor format under `packs/bundled/`. Arbitrary third-party runtime pack loading (`--pack`) is not admitted. No fifth bundled reality is admitted in `2.0.0`. Catalog admission (default vs opt-in) is product policy, not a pack field. The four bundled packs are the profile source of truth; named engines reproduce the `MIGRATION_BASE_SHA` `38cb0f50bd03bc39a0046426b6fa3004103d4f4a` adapter oracle, including the Gemini two-hop `sourceDependencyPaths` correction (D2a).

## Product claims

RuleBlast is a local, read-only, Git-native debugger for repository instruction projection. The canonical analysis engine is the authority. The CLI is the reference host. The VS Code-compatible companion in `hosts/vscode` may only render and invoke the same four actions. Cursor, Windsurf, Kiro, and Antigravity IDE are compatible hosts of that same companion; they are not additional host classes and not modeled realities. `--mcp` is a stdio transport of the same four actions. It is not a fifth action and not a product MCP server. Given the same supported snapshot bytes, selected profiles, projection context, and resolver revision, every host produces the same canonical core result.

It answers four bounded questions:

1. `ruleblast [path]` — starting repository discovery from the optional filesystem path, what repository instruction payload does each bundled profile project now?
2. `ruleblast diff [base]` — which tracked paths changed instruction stack between two snapshots?
3. `ruleblast explain <path> [--from <base>]` — which sources and boundaries produced one path result?
4. `ruleblast case [--explain <path>]` — what did a verified immutable public-repository comparison produce?

“Two AI realities” is presentation language for a path whose normalized repository payload relation is proven `DIFFERENT`. It is not a prediction about model output.

### Command options and output

The optional scan `[path]` is a filesystem starting point for finding the repository; it does not select or filter one tracked result path. `diff` defaults to `HEAD` versus the tracked `WORKTREE`; `--to <ref|WORKTREE>` selects its after endpoint. `explain --from <ref>` selects diff explanation, while `--to <ref|WORKTREE>` selects the target endpoint. The `explain` target is a repository-relative Git-tracked path.

All four actions accept `--json` or deterministic text. Default explain text is the shared visual source tree (catalog badges, selected sources, changed markers, why-this-path, findings). Digests and full evidence remain in `--json`. Text accepts `--color=auto|always|never`; `NO_COLOR` disables color even when color is requested. `--witness` is opt-in: text appends why-edges derived from existing projection sources, and `--json --witness` wraps the unchanged canonical result in a `ruleblast.witness.v1` envelope. `--receipt` is opt-in: text prints a compact scoreboard box derived from the existing result plus the user-owned agent-allow state, and `--json --receipt` emits an `RBREC1` card with an `RBCTX1` identity. Agent-allow is `yes` only when the user set `RULEBLAST_AGENT_ALLOW` or created `.ruleblast-allow`; RuleBlast never writes that file and does not record live agent tool calls. `--reality github/copilot-cli@1` and `--reality google/gemini-cli@1` are opt-in documented surfaces. Both may be selected on one invocation. Default `--json` remains schema-1 two-profile result bytes with no envelope when neither flag is passed. Copilot VS Code, hosted Copilot, Gemini Code Assist, and Cursor editor semantics remain distinct unsupported surfaces. A host is not a reality: running RuleBlast inside VS Code, GitHub Copilot Chat, Cursor, Windsurf, Kiro, Antigravity, Codex IDE, Continue, Cline, Trae, Claude Desktop, or ChatGPT/Codex desktop does not model `cursor/editor@1` or `copilot/vscode@1`. `--mcp` speaks MCP stdio for those same four actions. `--help` prints usage and `--version` prints package metadata. JSON contains canonical field names and no color or presentation aliases.

Exit status is part of the CLI contract:

| Code | Meaning |
|---:|---|
| `0` | The action completed and either had no candidate paths or had a defensible `COMPLETE` result in the selected/aggregate scope. |
| `1` | Usage, repository, ref, tracked-path, or another known recoverable boundary error. |
| `2` | Candidate paths exist, but the selected path or every path in the aggregate action lacks a defensible complete projection; diff requires complete coverage at both endpoints. Output is still emitted for inspection. |
| `70` | An unexpected internal failure, invalid injected runtime boundary, or output failure. |

## Non-claims

RuleBlast does not observe or predict private model state, compliance, response quality, or downstream behavior. It does not model user, global, organization, managed, session, auto-memory, conversation, skill, plugin, MCP, hook, tool, or network state.

V1 does not mutate repositories, call a model or vendor API, access a network during analysis, score prompts, synchronize instruction files, generate fixes, run as a service, or provide a hosted dashboard. The VS Code-compatible companion is a renderer of the canonical result and may not add analysis semantics. Explain uses the last canonical result when one exists and does not flip `STALE` back to `CURRENT`. Select Reality is a host session option, not a fifth action. The companion does not write the repository, does not auto-analyze on file change, and does not treat an unsaved editor buffer as the tracked worktree. It models only documented repository-loading semantics for the named profile revision.

### Reality, host, and discovery

These words are not synonyms of “supported”:

- **MODELED** — a `ProfileDefinition` with pinned evidence, fixtures, and semantic conformance exists.
- **HOSTED** — a RuleBlast companion has passed acceptance tests on that editor host.
- **COMPATIBLE** — the editor is a VS Code-family host of the same companion adapter. Compatibility is the vscode engine contract plus the four-action mapping, not a measured run inside that vendor UI.
- **DISCOVERABLE** — the agent has an official repository skill path or workspace MCP config and RuleBlast ships a compatible artifact.

A surface may be MODELED without being HOSTED. A host may be HOSTED without being MODELED.

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

V1 defaults to exactly:

- `openai/codex-cli@1`
- `anthropic/claude-code-cli@1`

V1 may opt in exactly one additional bundled reality per invocation:

- `github/copilot-cli@1`
- `google/gemini-cli@1`

No fifth bundled reality is admitted before Reality Packs. Profile ids are validated data, sorted before analysis, and unique. The schema can carry more than two profiles; that does not make another product, editor, or hosted mode supported.

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

### Gemini CLI revision 1

The profile models repository-only JIT context from `google-gemini/gemini-cli@v0.55.1` (`41327e407da58aa01c409ef6685b7b5d379f295e`):

1. Projection context is repository-root `cwd` with `READ_TARGET`.
2. From `dirname(targetPath)` the resolver walks upward to the repository root.
3. In each directory it selects tracked files whose names are in the effective context filename list, then concatenates them root-to-leaf.
4. The default filename is `GEMINI.md`. A tracked `.gemini/settings.json` `context.fileName` is unioned with that default, matching `setGeminiMdFilename`. User, system, and runtime filename settings stay outside the repository boundary.
5. Relative `@path` imports expand to depth 5. Absolute, missing, cyclic, and escaped imports are unresolved and make the projection `PARTIAL`.
6. Vendor `Context from` wrappers and absolute checkout paths never enter payload units.
7. `.geminiignore` is not modeled as a hierarchical-memory filter; that interaction stays unspecified.
8. Global `~/.gemini/GEMINI.md`, extensions, and session memory are outside the boundary.

Configuration prose that still describes downward subdirectory discovery is recorded as evidence drift. Implementation v0.55.1 wins for resolver semantics.

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

Hosts consume a shared explain presentation model derived from the canonical result. A host may not infer explanation semantics by parsing terminal text or by walking `CanonicalResult` with its own rules.

Analysis lifecycle (`READY`, `ANALYZING`, `CURRENT`, `STALE`, `ERROR`) is a host observation. Completeness (`COMPLETE`, `PARTIAL`, `UNKNOWN`) is a projection fact. The two axes are not a single enum: a result may be `CURRENT · PARTIAL` or `STALE · UNKNOWN`.

## Schema and resolver revisions

`schemaVersion: 1` identifies the public result shape. `resolverRevision: 1` identifies the bundled interpretation boundary. Profile ids carry their own surface revision. A semantic correction that changes defensible canonical results requires tests, evidence, and an explicit revision decision; it cannot be hidden as copy-only drift.

## Packaged case contract

The packaged `case` action presents the single promoted real-public-repository receipt under `cases/`. It computes the complete receipt SHA-256, requires canonical single-line JSON plus trailing LF, binds the file path to `{owner}__{repo}/{base12}..{head12}.json`, checks the public GitHub URL against those identity fields, requires full immutable base and head commit ids, resolver revision 1, and that `coreDigest` equals the SHA-256 of `resultCore` before emitting output. A failed verification is an internal integrity failure and emits no result. Identity is taken from the receipt; it is not duplicated as source literals.

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
