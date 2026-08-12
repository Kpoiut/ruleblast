# RuleBlast — Product, Narrative, and Scope Contract

**Status:** Approved direction, ready for implementation planning
**Date:** 2026-08-12
**Public launch target:** `v1.0.0`
**Product form:** local, text-first npm CLI

## 1. The decision

Build **RuleBlast**, a compact Git-native debugger for repository instructions used by AI coding agents.

The category sentence is:

> **RuleBlast is the second diff for AI repo instructions.**

The narrative prototype is:

> **DEMO FIXTURE · Your rule-file diff is 9 line edits. Its blast radius is 1,842 paths.**

The payoff is:

> Git shows what changed. RuleBlast shows where the rule lands—and where one repository becomes two AI realities.

This is deliberately more dramatic than the internal type names. The public launch replaces the synthetic values with one pinned public-repository case; the fixture remains the instant demo. The drama is backed by a reproducible count, not by a prediction about model behavior.

## 2. The problem it owns

Repositories increasingly contain `AGENTS.md`, `AGENTS.override.md`, `CLAUDE.md`, `.claude/rules/*.md`, and imported instruction files. Git can show the changed lines, but it does not answer:

1. Which tracked paths now resolve through a different repository instruction stack?
2. Which source entered, left, or became shadowed for one path?
3. Where do Codex and Claude Code project different repo-level instruction content?
4. Was a large-looking rule edit actually contained, or did a tiny edit cross a large subtree?

Existing sync/generation tools solve a different problem. RuleBlast does not create a universal source of truth; it makes the current split visible.

## 3. Why this wedge is timely

The product sits at the intersection of three active GitHub behaviors:

- AI coding agents are moving from novelty to daily repository work.
- Instruction files are multiplying, nesting, importing, and gaining path semantics.
- Maintainers can inspect source diffs but usually cannot inspect the *resolution diff* produced by those files.

Current official documentation already exposes meaningful differences. Codex assembles an `AGENTS.md` chain from project root to current working directory, with per-directory precedence and a default byte cap. Claude Code reads `CLAUDE.md`, supports imports, nested on-demand memory, and path-scoped `.claude/rules`. That difference is enough to create a real, deterministic local tool without an LLM.

Primary behavior sources:

- [OpenAI: Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Anthropic: How Claude remembers your project](https://code.claude.com/docs/en/memory)

## 4. What was learned from large GitHub repositories

Snapshot taken from the GitHub REST API on 2026-08-12. Counts will move after this date.

| Repository | Stars | Forks | Above-the-fold pattern worth borrowing |
|---|---:|---:|---|
| [obra/superpowers](https://github.com/obra/superpowers) | 270,872 | 24,200 | Emotional one-word brand, immediately anchored by one concrete category sentence |
| [anthropics/skills](https://github.com/anthropics/skills) | 168,286 | 20,046 | A simple unit people can copy, adapt, and contribute independently |
| [github/spec-kit](https://github.com/github/spec-kit) | 126,307 | 11,281 | Name, philosophy line, one strong value proposition, then quick start |
| [openai/codex](https://github.com/openai/codex) | 105,420 | 15,978 | One-sentence definition, visible artifact, install action, deeper docs later |
| [agentsmd/agents.md](https://github.com/agentsmd/agents.md) | 23,590 | 1,777 | Name is the interface; analogy and complete example make adoption immediate |
| [modelcontextprotocol/modelcontextprotocol](https://github.com/modelcontextprotocol/modelcontextprotocol) | 8,932 | 1,709 | Sharp repository boundaries and a small, reviewable contribution unit |

These numbers do **not** prove that README structure caused popularity; organization ownership and distribution are large confounders. The reusable pattern is still clear:

```text
memorable name → category sentence → visible proof → one action → deeper boundary
```

RuleBlast will copy that information order, not their feature breadth.

## 5. Brand contract

### 5.1 Name

**RuleBlast** is locked for implementation.

As of 2026-08-12:

- GitHub repository name search returned no exact `ruleblast` repository.
- npm returned `404` for the exact `ruleblast` package.

This is an availability snapshot, not trademark clearance. The GitHub repository and npm package must be reserved before any teaser or launch post.

The name contract learned from the strongest repositories is:

- one short, pronounceable compound word;
- brand and CLI command match exactly: `RuleBlast` / `ruleblast`;
- the name works as a noun and a verb;
- `AI`, `agent`, `tool`, and `CLI` stay in the subtitle/topics instead of bloating the brand;
- the product owns a small vocabulary: **blast**, **blast radius**, **blast case**, **blast receipt**, **reality pack**.

### 5.2 Category and copy

Use these exact layers:

| Placement | Copy |
|---|---|
| Category | **The second diff for AI repo instructions.** |
| Hero formula | **You changed `{editedLineCount}` instruction lines. `{changedStackPathCount}` files changed sides.** |
| Explanation | Git shows what changed. RuleBlast shows where the rule lands. |
| Second reveal formula | **`{newlySplitPathCount}` paths now live in two AI realities.** |
| CTA | **Pick one path. See every source.** |
| Short badge/card line | **See the second diff.** |
| GitHub description | Map where `AGENTS.md` and `CLAUDE.md` changes land across a repo—and where Codex and Claude Code split. |

Recommended GitHub topics:

```text
agents-md
claude-md
codex
claude-code
ai-coding-agents
developer-tools
cli
instruction-scope
git-diff
```

### 5.3 The curiosity contract

The marketing is intentionally incomplete in the *order of disclosure*, not false in the underlying result.

```text
changed lines
    ↓
blast count
    ↓
cross-agent fracture
    ↓
one surprising subtree
    ↓
explain(path)
    ↓
resolution contract
```

Rules:

1. The hero may use metaphor: “blast radius”, “changed sides”, “two AI realities”.
2. The first screen does not lead with methodology or limitations.
3. Every displayed number comes from the same canonical result object.
4. A demo number is visibly marked `DEMO FIXTURE` at the first place it appears as evidence.
5. A public-repo number carries repository, base ref, target ref, and RuleBlast version somewhere in the artifact.
6. `explain` exposes the exact profile context, sources, order, digest, and unknowns.
7. No output says a model obeyed a rule, behaved differently, or became safer/better.
8. No fake delay, fake benchmark, fake scarcity, fake user, or fake release is used.

The intended effect is:

> Make the impact feel larger than the line diff, while keeping the measured object real.

### 5.4 README first screen

The first screen is text and a real terminal recording—not a product UI.

The public first screen binds its numbers to the selected pinned case. Braces below are canonical result fields, not copy placeholders:

```markdown
# RuleBlast

## You changed `{diffStats.editedLineCount}` instruction lines.
## `{counts.changedStackPathCount}` files changed sides.

Git shows the first diff. RuleBlast finds the second.

Codex and Claude share the repo.
The rules? Not all the way down…

[6–8 second terminal recording generated from the packed release and pinned case]

```bash
npx ruleblast@latest
```

**See what changed since the last commit.**

```bash
npx ruleblast@latest diff HEAD~1
```

**Pick one path. See every source.**

<details>
<summary>Reproduce this result</summary>

REAL CASE · immutable base → head · reproducible with RuleBlast 1.0.0

Repository, full base/head SHAs, resolver revision, and the pinned command live here.
</details>
```

If no publishable case survives the pilot, the release does not invent one. The pre-release README uses the non-numeric question “You changed the rules. How much of the repo changed sides?” and links `ruleblast demo`. Privacy and scope copy comes after the personalized result and CTA, inside a short `<details>` block.

## 6. Product behavior

### 6.1 Four user actions

```bash
npx ruleblast .
npx ruleblast diff [base]
npx ruleblast explain <path> [--from <base>]
npx ruleblast demo [--explain <path>]
```

`--help`, `--version`, and `--json` are supporting options, not product surfaces.

#### `ruleblast .`

Projects the current Git-tracked repository through the two bundled profiles and reveals current cross-profile gaps.

If the repository has no tracked instruction source, it does not show a dead success screen:

```text
No repo instructions yet.

Want the 10-second reveal?
  npx ruleblast@latest demo
```

If sources exist but both profiles align, the positive result is “one documented reality” and `explain` remains available.

#### `ruleblast diff [base]`

Compares `base`—default `HEAD`—with the current tracked worktree. It reports changed instruction sources, paths whose profile stack changed, newly split paths, converged paths, and the largest affected subtree.

#### `ruleblast explain <path> [--from <base>]`

Shows the selected path’s before/after source chain for both profiles and explains exactly why it was counted. Without `--from`, it explains current resolution only.

#### `ruleblast demo [--explain <path>]`

Runs the packaged deterministic manifest fixture. It is the instant “easy win” for a user who is not inside a suitable repository. It uses the production resolver and renderer, not mocked terminal text. `--explain` drills into that same fixture so the first CTA cannot lead to an invalid Git ref.

### 6.2 Default terminal reveal

```text
$ npx ruleblast demo

RULEBLAST · DEMO FIXTURE

9 instruction-line edits.

1,842
tracked paths changed stack.

1,229 paths now live in two AI realities.

The largest fracture starts at packages/api/internal/.

Pick one path. See every source:
  ruleblast demo --explain packages/api/internal/refund.ts

Scope: tracked repo instructions · openai/codex-cli@1 · anthropic/claude-code-cli@1
```

There is no artificial spinner. The reveal comes from information hierarchy and line breaks.

### 6.3 `explain` payoff

```text
packages/api/internal/refund.ts

                    BEFORE                     WORKTREE
CODEX               /AGENTS.md                 /AGENTS.md
                                               /packages/api/AGENTS.md

CLAUDE CODE         /CLAUDE.md                 /CLAUDE.md

WHY THIS PATH COUNTS
+ packages/api/AGENTS.md entered the Codex projection
= Codex effective content changed
= Claude effective content did not
= the profiles are newly split for this path

PROJECTION CONTEXT
Codex        cwd = packages/api/internal
Claude Code  launch = repo root; trigger = read target path

Repository-only · Git-tracked sources · resolver revision 1
```

The headline says “two AI realities”; this view defines exactly what that means.

## 7. Resolution contract

### 7.1 The core abstraction

```ts
resolve(profile, snapshot, context) -> Projection
project(profile, snapshot, trackedPath) -> Projection
diff(before, after) -> RuleBlastResult
```

`profile`, `snapshot`, and `context` are mandatory. No resolver reads ambient process state.

### 7.2 Canonical path projection

For each Git-tracked blob path `p`:

- Codex projection uses `cwd = dirname(p)`. The result answers: “what repository instruction chain would Codex assemble if launched for this working directory under documented defaults?”
- Claude Code projection uses `cwd = repository root` and `trigger = READ_TARGET(p)`. The result answers: “what tracked project memory/rules are documented to enter context when this target is read from a root-launched session?”

This is a deterministic comparison context, not a claim about how every user launches an agent. The context is printed by `explain` and encoded in JSON.

### 7.3 Repository-only mode

Public `v1.0.0` includes only Git-tracked repository bytes.

The tracked worktree is captured as an immutable overlay on the index before any profile runs. Stable stage-0 index blobs back unchanged and sparse paths; modified paths are copied without following symlinks. All Git discovery runs with optional locks and fsmonitor disabled, so RuleBlast neither refreshes the index nor invokes repository hooks/daemons. Unmerged entries, special-file replacements, or a worktree that changes during capture stop analysis with an explicit boundary error instead of being reclassified as deletion. This is a consistency boundary, not a security feature.

Excluded:

- user, global, organization, and managed instructions;
- auto memory and session history;
- runtime prompt text and conversation messages;
- skills, plugins, MCP, hooks, and tools;
- untracked and ignored files;
- network state and vendor APIs.

An external import or unresolved boundary produces `UNKNOWN`; it is never silently treated as absent.
Instruction-file symlinks and gitlinks are unresolved boundaries in v1: the snapshot records their kind, `explain` names the boundary, and definitive counts exclude the affected projection.

### 7.4 Codex profile: `openai/codex-cli@1`

The profile models documented defaults:

1. Walk from Git root to the projection `cwd`.
2. In each directory, select the first existing regular-file source in this order:
   - `AGENTS.override.md`
   - `AGENTS.md`
3. An existing empty or whitespace-only override still shadows same-directory `AGENTS.md`; its content contributes no instruction entry.
4. Concatenate non-empty selected content root-to-cwd.
5. Apply the default `32 KiB` project instruction budget exactly as the pinned implementation does: truncate a selected file to the remaining bytes, decode with UTF-8 replacement, and decrement the budget by those truncated bytes only when the decoded text is not trim-empty. An empty/whitespace-only selected file consumes zero budget. Joining separators do not consume this discovery budget.
6. Assemble non-empty repository entries with `\n\n`, matching the pinned repository-only code path. The `--- project-doc ---` marker is a user/internal→project boundary and is absent because v1 excludes those scopes.
7. Record selected, selected-empty, shadowed, truncated, and assembled-payload evidence separately.

Custom `project_doc_fallback_filenames`, custom byte limits, and `CODEX_HOME` are deferred.

### 7.5 Claude Code profile: `anthropic/claude-code-cli@1`

The profile models tracked project semantics documented by Anthropic:

1. Project `CLAUDE.md` or `.claude/CLAUDE.md` at the repository root.
2. Tracked `CLAUDE.local.md` when present; it remains visible as a local-type source even though committing it is unusual.
3. Nested ancestor `CLAUDE.md` and `CLAUDE.local.md` activated by the target-read projection.
4. `.claude/rules/**/*.md` recursively.
5. Rules without `paths` apply unconditionally; rules with `paths` apply only on documented glob matches.
6. `@path` imports outside inline/fenced code, recursively to four hops.
7. Repository-tracked `claudeMdExcludes` from project settings only when the glob is location-independent (`**/...` with no absolute or drive prefix). Other patterns are recorded and make affected projections `PARTIAL`; RuleBlast never bakes a developer’s absolute checkout path into the canonical core.
8. Documented HTML-comment stripping while preserving comments in fenced code.

If both root project-memory alternatives exist and the official source does not establish the applicable order for the pinned profile revision, that projection becomes `PARTIAL` and records the ambiguity instead of inventing precedence.

Claude rule discovery and applicability can be complete even when general composition order is not documented. A projection with more than one applicable rule, or with both project memory and at least one applicable rule, uses `composition = UNSPECIFIED` unless pinned evidence establishes their total order. Source payloads remain inspectable, but RuleBlast does not sort them and call the resulting sequence authoritative.

### 7.6 Fingerprints

Do not fingerprint only raw instruction files. A projection fingerprint includes:

- validated profile id and revision;
- canonical projection context;
- selected source paths and order;
- normalized content units after profile transforms/import expansion;
- applicability decisions;
- byte-limit/truncation state;
- composition state;
- completeness state.

Every profile also emits `normalizedPayloadUnits` through one shared unitizer; adapters cannot choose their own boundaries. A **payload contribution** is one model-visible content contribution after profile-specific decoding, transforms, comment removal, and import expansion; splitting an import is allowed only at its documented insertion point. Empty content contributes zero sequences. For each non-empty contribution, the unitizer normalizes CRLF to LF, preserves lone CR and whitespace, splits into logical lines, and drops only the terminal empty line caused by a final LF. It hashes each line as `sha256("ruleblast-payload-line-v1\0" + UTF8(line))`, then stores that ordered line-digest sequence as one contribution unit. Duplicate contributions and duplicate lines remain duplicates. Vendor wrappers, joining separators, source paths, and profile ids never enter units. Thus `"ab"` is one one-line contribution; `"a\nb"` is one two-line contribution; two contributions `"a"`, `"b"` are not silently merged into either. `"" → []`, while `"\n"` is one contribution containing one empty-line digest.

Cross-profile comparison means **exact normalized repository-payload relation**, never semantic equivalence. Apply this truth table after unitization:

| A / B | Equal sequence or multiset | Unequal sequence or multiset |
|---|---|---|
| either projection `PARTIAL`/`UNKNOWN` | `INDETERMINATE` | `INDETERMINATE` |
| either composition `RUNTIME_DECIDED` | `INDETERMINATE` | `INDETERMINATE` |
| `ORDERED` / `ORDERED` | identical sequence → `SAME` | different sequence → `DIFFERENT` |
| `UNORDERED` / `UNORDERED` | equal multiset of ordered contribution sequences → `SAME` | different multisets → `DIFFERENT` |
| `ORDERED` / `UNORDERED` | equal contribution multiset → `INDETERMINATE` | different multisets → `DIFFERENT` |
| either composition `UNSPECIFIED` | equal contribution multiset → `INDETERMINATE` | different multisets → `DIFFERENT` |

`normalizedPayloadDigest` is a cache/explain field derived from the units and composition state; it never bypasses this table.

“Two AI realities” counts only paths proven `DIFFERENT`. It does not mean the models will behave differently.

For N profiles, `SAME` means every pair is proven equal, `DIFFERENT` means at least one pair is proven different, and `INDETERMINATE` means no difference is proven but at least one pair cannot be decided. `isSplit` is `false`, `true`, or `null` respectively. Proven split and unresolved coverage are orthogonal: A/B may prove `DIFFERENT` while C is unknown, so `isSplit = true` and the path also increments `indeterminatePathCount`.

### 7.7 Result vocabulary

Use separate fields; never collapse them into one ambiguous “split” count.

| Field | Meaning |
|---|---|
| `candidatePathCount` | Git-tracked blob paths in the modeled set |
| `changedStackPathCount` | Paths where at least one profile has complete before/after projections and a changed fingerprint |
| `byProfile[].changedStackPathCount` | Complete before/after fingerprint changes for the named validated profile id |
| `newlySplitPathCount` | Paths with `SAME → DIFFERENT` payload relation |
| `convergedPathCount` | Paths with `DIFFERENT → SAME` payload relation |
| `currentSplitPathCount` | Paths whose current/after payload relation is proven `DIFFERENT` across profiles |
| `partialPathCount` | Paths with at least one useful but incomplete projection |
| `unknownPathCount` | Paths with at least one projection that cannot be resolved defensibly |
| `indeterminatePathCount` | Paths with at least one unresolved/indeterminate pair or profile; may overlap a proven `DIFFERENT` aggregate relation in N-profile mode |

`InstructionDiffStats` supplies the first reveal:

| Field | Meaning |
|---|---|
| `addedLineCount` | Added normalized text lines across changed instruction sources |
| `deletedLineCount` | Deleted normalized text lines across changed instruction sources |
| `editedLineCount` | `addedLineCount + deletedLineCount`; a replacement counts as one deletion plus one addition |
| `binaryChangedSourceCount` | Changed instruction sources containing NUL bytes, excluded from line counts |

Line statistics normalize CRLF to LF, preserve lone CR characters, and ignore the presence/absence of only the final newline. Invalid UTF-8 is decoded with replacement consistently. The product says “line edits”, not “Git changed lines”, so the counting rule is not implied to be GitHub’s UI algorithm.

V1 never guesses renames from equal bytes. A moved instruction source is represented as one `DELETE` plus one `ADD`, and its line counts follow that explicit model. This can differ from a Git UI’s heuristic rename presentation, but it cannot silently turn two independent equal-content operations into a zero-line rename.

Terminal copy may shorten `changedStackPathCount` to “paths changed stack” and `newlySplitPathCount` to “paths now live in two AI realities.” JSON never uses the metaphor.

### 7.8 Completeness

Each projection has one status:

- `COMPLETE`: modeled inputs were resolved under the pinned profile.
- `PARTIAL`: useful resolution exists but a documented ambiguity or supported boundary affected it.
- `UNKNOWN`: no defensible projection can be produced.

Definitive headline counts use only complete projections and decisive relations. The terminal shows partial, unknown, and relation-indeterminate counts after the reveal when non-zero; JSON always carries all three.

## 8. Canonical result model

Profile ids are data, not a two-agent TypeScript union. V1 accepts only ids matching `^[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*@[1-9][0-9]*$`; it bundles exactly `openai/codex-cli@1` and `anthropic/claude-code-cli@1`. Arrays are sorted by validated id and duplicate ids fail before analysis. This keeps the v1 schema N-profile-capable without claiming extra support.

```ts
type ProfileId = string; // runtime-validated vendor/product-surface@revision
type Completeness = "COMPLETE" | "PARTIAL" | "UNKNOWN";
type CompositionState =
  | "ORDERED"
  | "UNORDERED"
  | "UNSPECIFIED"
  | "RUNTIME_DECIDED";
type PayloadRelation = "SAME" | "DIFFERENT" | "INDETERMINATE";

interface SnapshotRef {
  kind: "git" | "worktree" | "fixture";
  label: string;
  oid: string | null;
}

interface ProjectionContext {
  cwd: string;
  trigger: "STARTUP" | "READ_TARGET";
  targetPath: string;
  repositoryOnly: true;
}

interface ResolvedSource {
  path: string;
  disposition:
    | "SELECTED"
    | "SELECTED_EMPTY"
    | "IMPORTED"
    | "APPLIED_RULE"
    | "SHADOWED"
    | "EXCLUDED"
    | "UNRESOLVED_IMPORT";
  digest: string;
  bytesUsed: number;
  truncated: boolean;
}

interface Projection {
  profile: ProfileId;
  context: ProjectionContext;
  status: Completeness;
  composition: CompositionState;
  sources: ResolvedSource[];
  normalizedPayloadUnits: string[][];
  projectionDigest: string | null;
  normalizedPayloadDigest: string | null;
  evidence: string[];
}

interface InstructionDiffStats {
  addedLineCount: number;
  deletedLineCount: number;
  editedLineCount: number;
  binaryChangedSourceCount: number;
}

interface BaseImpactCounts {
  candidatePathCount: number;
  currentSplitPathCount: number;
  partialPathCount: number;
  unknownPathCount: number;
  indeterminatePathCount: number;
}

interface CurrentProfileCounts {
  profile: ProfileId;
  completePathCount: number;
  partialPathCount: number;
  unknownPathCount: number;
}

interface DiffProfileCounts extends CurrentProfileCounts {
  changedStackPathCount: number;
}

interface CurrentImpactCounts extends BaseImpactCounts {
  byProfile: CurrentProfileCounts[];
}

interface DiffImpactCounts extends BaseImpactCounts {
  changedStackPathCount: number;
  newlySplitPathCount: number;
  convergedPathCount: number;
  byProfile: DiffProfileCounts[];
}

interface InstructionSourceChange {
  kind: "ADD" | "DELETE" | "MODIFY";
  beforePath: string | null;
  afterPath: string | null;
  beforeDigest: string | null;
  afterDigest: string | null;
  stats: InstructionDiffStats;
}

interface CurrentPathProjection {
  path: string;
  projections: Projection[];
  payloadRelation: PayloadRelation;
  isSplit: boolean | null;
}

interface PathTransition {
  path: string;
  before: Projection[];
  after: Projection[];
  changedProfiles: ProfileId[];
  beforePayloadRelation: PayloadRelation;
  afterPayloadRelation: PayloadRelation;
  wasSplit: boolean | null;
  isSplit: boolean | null;
  causes: string[];
}

interface ImpactGroup {
  root: string;
  changedStackPathCount: number;
  newlySplitPathCount: number;
  samplePaths: string[];
}

interface Finding {
  code:
    | "PARTIAL_PROJECTION"
    | "UNKNOWN_PROJECTION"
    | "BINARY_SOURCE"
    | "UNSPECIFIED_COMPOSITION"
    | "UNSUPPORTED_GLOB_SEMANTIC"
    | "UNSUPPORTED_BOUNDARY";
  profile: ProfileId | null;
  path: string;
  detail: string;
}

interface CurrentRuleBlastResult {
  mode: "current";
  schemaVersion: 1;
  resolverRevision: 1;
  snapshot: SnapshotRef;
  counts: CurrentImpactCounts;
  paths: CurrentPathProjection[];
  findings: Finding[];
}

interface DiffRuleBlastResult {
  mode: "diff";
  schemaVersion: 1;
  resolverRevision: 1;
  before: SnapshotRef;
  after: SnapshotRef;
  diffStats: InstructionDiffStats;
  changedInstructionSources: InstructionSourceChange[];
  counts: DiffImpactCounts;
  groups: ImpactGroup[];
  paths: PathTransition[];
  findings: Finding[];
}

type RuleBlastResult = CurrentRuleBlastResult | DiffRuleBlastResult;
```

The deterministic core contains no timestamp, hostname, absolute repository path, username, or process id. A presentation envelope may add run metadata without changing the core digest.

## 9. Demo fixture contract

The packaged demo is a manifest-backed pair of snapshots passed through the same resolver and impact engine as Git snapshots.

It contains 3,906 synthetic tracked paths divided into three stable subtrees:

- 613 paths where both profiles receive matching changed content;
- 1,229 paths where only the Codex projection changes;
- 2,064 unaffected paths.

Expected reveal:

```text
9 instruction-line edits
1,842 tracked paths changed stack
1,229 newly split paths
```

The fixture manifest is generated and checked in. A test recomputes all counts; terminal output never stores the numbers as independent hard-coded strings.

## 10. Scope firewall

Every v1 feature must directly help one of these operations:

```text
resolve(profile, snapshot, context)
diff(before, after)
explain(path, transition)
```

Hard budgets through `v1.x`:

| Budget | Limit |
|---|---:|
| npm packages | 1 |
| User actions | 4 |
| Bundled profiles in public v1.0 | 2 |
| Bundled profiles before pack architecture | at most 3 |
| Runtime services | 0 |
| Network calls during analysis | 0 |
| LLM/API calls | 0 |
| Repository mutation | 0 |
| UI pages | 0 |
| Runtime dependencies | at most 3 |
| Production TypeScript | at most 3,000 non-generated lines |
| Single source module | at most 400 lines before extraction review |
| New product dimension per minor release | exactly 1 |

Permanent non-goals unless this contract is explicitly replaced:

- cloud account, database, daemon, hosted dashboard;
- CI/CD product, required status check, PR bot;
- security scanner, policy engine, risk score;
- prompt quality scoring or natural-language contradiction detection;
- auto-fix, sync, generator, converter, or universal rule registry;
- IDE extension;
- agent behavior/compliance prediction;
- arbitrary JavaScript profile plugins;
- telemetry in the CLI.

## 11. Release architecture: a large story in small layers

The repository launches publicly only when the full `v1.0.0` contract works. Internal `v0.x` tags are engineering checkpoints, not a public “half-product” campaign.

### Internal build staircase

| Milestone | One proof |
|---|---|
| `v0.1.0` | Git/worktree snapshots are deterministic and read-only |
| `v0.2.0` | Codex projection passes pinned fixtures |
| `v0.3.0` | Claude projection passes pinned fixtures |
| `v0.4.0` | Diff, explain, demo, and packed CLI work end-to-end |
| `v1.0.0` | Public release with docs, real case, release artifact, and contribution loop |

### `v1.0.0 — The Second Diff`

Ships:

- current scan, diff, explain, demo;
- Codex and Claude repository projections;
- deterministic text and JSON;
- one labeled demo and one reproducible public-repo case.

Release closing line:

> **The blast can now be explained. Can it travel without losing the receipt?**

### `v1.1.0 — Blast Receipts`

Adds one dimension: portable output.

- deterministic Markdown receipt generated from the canonical result;
- base/head ids, profile revisions, scope stamp, and core digest;
- no image generator, web app, or new resolver behavior.

Release closing line:

> **The result can travel. What happens when a third agent reads the same repo?**

### `v1.2.0 — Third Reality`

Adds one bundled agent surface only if all gates pass:

- official, versionable repository-discovery documentation exists;
- positive, negative, ordering, and unknown fixtures exist;
- at least five external users request the same client;
- the profile fits existing operators without adding a new product surface.

Candidate: GitHub Copilot CLI. If precedence remains unspecified, the existing v1 composition field preserves `UNSPECIFIED`; it never invents a total order. Copilot CLI and Copilot VS Code are different surfaces and can never share one profile merely because the product name matches.

Release closing line:

> **Three realities are visible. How many are still hiding in this repository…?**

### `v2.0.0 — Reality Packs`

Adds one dimension: explicitly installed, declarative profile packs for distinct agent surfaces. The Open Resolver IR is the internal mechanism of this release, not a separate public feature chapter.

The operator set must close around root anchoring, ancestor traversal, candidate selection, byte decoding/normalization, trim-empty selection, allowlisted YAML/frontmatter and settings reads, comment transforms, bounded imports, bounded glob/exclude applicability, ordered/unordered/unspecified composition, byte budgets, and explicit symlink/malformed/runtime-decided/unknown boundaries. A separate reviewed v2 IR specification freezes transform order and the discriminated JSON unions before code is written. Codex, Claude, and the evidence-gated third profile must migrate to that data form without changing any v1 golden result; otherwise Reality Packs do not ship.

A Reality Pack contains profile manifests, official evidence metadata, positive/negative/ordering/unknown fixtures, and expected canonical results. It contains no executable JavaScript, shell command, or runtime network source. RuleBlast loads only packs the user installed or addressed locally.

The exact load path is:

```bash
npm install --ignore-scripts --save-dev @ruleblast/profile-copilot-cli
npx ruleblast@latest --profile-pack @ruleblast/profile-copilot-cli
npx ruleblast@latest explain src/api/refund.ts \
  --compare all \
  --profile-pack @ruleblast/profile-copilot-cli
```

The pack must export `./ruleblast-pack.json`. RuleBlast anchors Node resolution at `<git-root>/package.json`; if that file is absent it uses a non-existent `<git-root>/__ruleblast_resolver__.cjs` anchor, which still searches that root’s `node_modules`. It resolves `<pack>/ruleblast-pack.json` and reads JSON bytes only—never the npm-exec cache, package entry point, or executable JavaScript. Fixture and expected-result references are relative `.json` paths under the resolved manifest directory; absolute paths, traversal, non-JSON files, and any symlink whose real path escapes that directory fail closed. Fixtures may instead be embedded as JSON values in the manifest. Before enabling a profile, RuleBlast runs every declared fixture through the IR interpreter and byte-compares canonical output with its declared expected JSON; one mismatch fails the pack closed. RuleBlast never auto-downloads a pack during analysis.

`v2.0` exposes basic N-profile scan/diff/explain through the schema already present in v1: load explicitly selected packs, project every selected profile, and show the aggregate relation plus per-profile projections with unknowns intact. Pairwise relations are derived internally to compute that aggregate but are not added to the public v1-shaped result. `--compare all` means all bundled plus explicitly loaded profiles; it does not yet expose pairwise records, invent, or name reality clusters.

Different surfaces remain different profiles when their loading semantics differ:

```text
openai/codex-cli@1
anthropic/claude-code-cli@1
github/copilot-cli@1
github/copilot-vscode@1
cursor/editor@1
google/gemini-cli@1
windsurf/editor@1
```

These are candidate identifiers, not current support claims.

Release closing line:

> **The agents are installed. How many realities are actually distinct?**

### `v2.1.0 — Many-Reality Diff`

Adds one dimension: named reality clustering and the compact N-way summary, built on the basic multi-profile comparison shipped in `v2.0`. It uses the existing scan/diff/explain actions.

The reveal becomes:

```text
8 agent surfaces.
3 documented realities.

5 align · 2 diverge · 1 runtime-decided.

Pick one path. See which world each agent sees:
  ruleblast explain src/api/refund.ts --compare all
```

The N-profile and composition fields already exist in schema v1, and `v2.0` already exposes aggregate multi-profile facts. This release adds pairwise output, product-level clustering, and the compact summary rather than rewriting the projection model. The count comes from clustering normalized payload relations. Partial/unknown projections and non-total composition states remain visible; they are never forced into a cleaner-looking cluster.

The public roadmap shows `v1.1` as **Next** and later releases as **Horizon**. It gives readers a larger world without presenting unbuilt features as available or promising dates that exist only for marketing. Multi-platform support is therefore a visible product mechanism, not a support-matrix promise that forces v1 to grow sideways.

## 12. Fork and contribution loop

The smallest useful contribution is one **blast case**:

```text
1 documented behavior
+ 1 official source URL and retrieval date
+ 1 before manifest
+ 1 after manifest
+ 1 expected canonical JSON result
```

The loop is:

```text
run RuleBlast
  → find a surprising path
  → reduce it to a blast case
  → fork and add the fixture
  → resolver improves
  → accepted cases enter the evidence corpus
```

Cases are batched into release evidence. A patch release is cut only for a resolver correction, a meaningful semantic-coverage addition, or a regression that changes a defensible result—not merely to simulate activity.

Accepted issue templates:

- `wrong-blast`: a complete path was counted incorrectly;
- `missing-blast`: a documented path was missed;
- `weird-blast`: a reproducible, surprising result worth turning into a case;
- `profile-evidence`: official evidence for a future profile.

The repository does not accept generic prompt collections, AI-generated rule dumps, undocumented clients, or feature-list PRs.

## 13. Launch plan

### 13.1 Launch gates

Do not publish the launch post until all are true:

1. Exact GitHub and npm names are reserved.
2. `npm pack` installs and runs on clean Node 20, 22, and 24 environments.
3. The terminal recording is generated from the packed tarball.
4. The demo counts are recomputed by tests.
5. One public repository case is reproducible with pinned refs and `ruleblast@1.0.0`.
6. At least 25 real instruction-changing commits have been evaluated privately.
7. Five outside maintainers can correctly explain why one selected path counts.
8. No P0/P1 correctness defect is open.

### 13.2 Launch post title

> **Show HN: RuleBlast – the second diff for AGENTS.md and CLAUDE.md**

Opening:

The final post is rendered from the pinned public case rather than copied from the synthetic demo:

```text
Git showed me {diffStats.editedLineCount} instruction-line edits.

It missed the second diff: {counts.changedStackPathCount} tracked paths
changed sides. {counts.newlySplitPathCount} of them split between Codex and
Claude Code.

So I built RuleBlast.

    npx ruleblast@latest
    npx ruleblast@latest diff HEAD~1
```

The post then links the reproducible case and asks for repositories with nested or imported instruction setups. It does not dump the whole roadmap.

### 13.3 Search surface

GitHub discovery cannot be guaranteed, but the repository can make its topic unambiguous:

- exact unique name in repository and npm;
- `AGENTS.md`, `CLAUDE.md`, Codex, Claude Code, and Git diff in the first 160 README words;
- one real terminal artifact above the fold;
- release titles with memorable chapter names;
- examples and issue titles that contain the concrete problem vocabulary;
- no badge wall, sponsor wall, or giant support matrix above the quick start.

### 13.4 Thirty-day outcome targets

These are targets, not promises:

- 25 external repositories scanned with results reported;
- 10 maintainers confirm a non-obvious useful blast;
- 5 external blast-case contributions;
- 3 independent repositories document RuleBlast usage;
- stretch: 1,000 organic stars and 100 forks;
- zero unresolved correctness issue that changes a headline count.

## 14. Codex for Open Source readiness

OpenAI states that core maintainers or maintainers of widely used public projects should apply, and that ecosystem-important projects may apply with an explanation. Acceptance is not guaranteed: [official Codex for Open Source page](https://learn.chatgpt.com/community/codex-for-oss).

RuleBlast should apply only after it has:

- an OSI license and public tagged release;
- active maintenance history and answered issues;
- reproducible public cases;
- outside users or maintainers confirming utility;
- a clear ecosystem role: making repository instruction resolution inspectable for tools including Codex;
- a concrete explanation of how Codex supports maintenance work.

The README must never say the project was built to qualify for the program. The application is a consequence of useful OSS, not the product story.

## 15. Acceptance and kill criteria

### Correctness gates

- Identical snapshots produce zero transitions.
- Git enumeration order cannot change canonical JSON.
- Unrelated source edits produce zero instruction impact.
- A nested Codex source changes only descendant path projections.
- An existing override shadows same-directory `AGENTS.md`; when the override is empty it contributes no instruction content and still does not fall through.
- Claude path rules affect only matching paths.
- External/untracked imports become unknown, not absent.
- Two identical runs produce byte-identical core JSON.
- Git status is identical before and after every command.

### Product kill criteria

Stop or reject work when any of these occurs:

1. A feature cannot be tied to resolve, diff, or explain.
2. It requires an LLM to produce a headline result.
3. A minor release adds more than one product dimension.
4. It adds a fifth user action, a UI page, a service, or repository mutation.
5. It tries to judge natural-language instruction quality.
6. A profile lacks official evidence for ordering/applicability and cannot preserve unknown state.
7. A new profile needs vendor-specific branches throughout the core.
8. A roadmap item is being built only to create release activity.
9. In 25 real instruction-changing commits, fewer than five produce a non-obvious blast.
10. Fewer than four of five usability testers can explain the selected demo path after using `explain`.

## 16. Final product test

RuleBlast passes the concept test when a new user can do this in under one minute:

```text
run one command
→ see one surprising, personalized number
→ inspect one path
→ understand every source in that result
→ want to try the same command on another repository
```

That loop—not a dashboard, feature matrix, or claim of perfect agent simulation—is the product.
