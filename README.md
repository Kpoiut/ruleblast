# RuleBlast

**DEMO FIXTURE**

## 9 instruction-line edits. 1,842 tracked paths changed stack.

### 1,229 paths now live in two AI realities.

Git shows the first diff. RuleBlast finds the second.

That result comes from a packaged, deterministic change to `AGENTS.md` and `CLAUDE.md`, projected across 3,906 synthetic Git-tracked paths. Codex and Claude Code can share a repository without receiving the same repository instructions. RuleBlast makes that difference inspectable—locally, without calling a model, and with every counted path tied back to its sources.

## Terminal transcript — DEMO FIXTURE

This is production CLI output over the packaged fixture, not prewritten animation:

```text
RULEBLAST · DEMO FIXTURE

9 instruction-line edits.

1,842
tracked paths changed stack.

1,229 paths now live in two AI realities.

The largest fracture starts at packages/api/internal/.

Pick one path. See every source:
  ruleblast demo --explain packages/api/internal/refund.ts

Scope: 3,906 tracked paths · repository-only · resolver revision 1
```

### Run the development build now

The npm release does not exist yet. The current source checkout is runnable:

```bash
git clone https://github.com/Kpoiut/ruleblast.git
cd ruleblast
git checkout --detach 27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8
npm ci
npm run build
node dist/cli.js demo --color=never
```

### First-release quick start

`ruleblast` is not published yet. These two commands are the release interface and activate only after npm publication:

```bash
npx ruleblast@latest
```

Then compare a commit with the tracked worktree:

```bash
npx ruleblast@latest diff HEAD~1
```

## Explain one path

The reveal is a doorway, not the proof. Drill into the same demo and inspect each selected, empty, imported, applied, excluded, or unresolved source:

```bash
npx ruleblast@latest demo --explain packages/api/internal/refund.ts
```

<details>
<summary>Demo provenance and exact reproduction</summary>

The checked-in recipe is [`fixtures/demo/case.json`](fixtures/demo/case.json). It expands into immutable before/after fixture snapshots, then passes through the same profile, impact, and text-rendering path as repository analysis. The generator validates the checked-in recipe and recomputes the result; terminal copy does not own a second set of counts.

Run the source proof:

```bash
npm ci
npm run build
node scripts/generate-demo.mjs
node dist/cli.js demo --json
node dist/cli.js demo --explain packages/api/internal/refund.ts --color=never
```

The fixture implementation entered main at immutable Git revision [`27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8`](https://github.com/Kpoiut/ruleblast/commit/27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8). After the first release is published, reproduce that artifact without following `latest`:

```bash
npx ruleblast@1.0.0 demo --json
npx ruleblast@1.0.0 demo --explain packages/api/internal/refund.ts
```

The synthetic inventory contains 613 matching-change paths, 1,229 Codex-only change paths, and 2,064 unaffected paths. Their sum and every headline count are asserted by [`test/demo.test.ts`](test/demo.test.ts).

</details>

## Scope

RuleBlast v1 is deliberately one small instrument:

| In | Out |
|---|---|
| Git commit and tracked-worktree snapshots | untracked, ignored, user, managed, or session instructions |
| Codex CLI and Claude Code CLI repository projections | editor, hosted, or similarly branded surfaces with different semantics |
| `scan`, `diff`, `explain`, and `demo` actions | mutation, sync, generation, scoring, or auto-fix |
| deterministic text and canonical JSON | network calls, model calls, telemetry, dashboard, or product UI |

An unresolved boundary remains visible as `PARTIAL`, `UNKNOWN`, or `INDETERMINATE`; it is never cleaned up for a stronger headline.

Read the stable [behavior and result contract](CONTRACT.md) for the exact comparison context, metric definitions, evidence boundary, and non-claims.

## How it works

1. Capture a deterministic snapshot from a Git commit, the tracked worktree, or the packaged fixture.
2. Project each tracked path through evidence-pinned profile semantics for `openai/codex-cli@1` and `anthropic/claude-code-cli@1`.
3. Compare normalized repository payloads and projection fingerprints without guessing through unknown order or unsupported boundaries.
4. Render the blast, then keep each count traceable to path transitions, changed instruction sources, and findings.

The core stays profile-neutral: resolver adapters produce the same canonical projection shape, and the impact engine does not branch on vendor names.

## Examples

After building from source, replace `ruleblast` below with `node dist/cli.js`. The optional positional path is a filesystem starting point used to discover the repository; scan still analyzes the repository's tracked candidate inventory.

```bash
# Inspect the current tracked repository
ruleblast

# Discover the repository from a nested filesystem path, then scan it
ruleblast packages/api/internal

# Compare a commit with the tracked worktree
ruleblast diff HEAD~1

# Inspect one path across that transition
ruleblast explain packages/api/internal/refund.ts --from HEAD~1

# Emit deterministic machine-readable output
ruleblast diff HEAD~1 --json
```

## Contribute a Blast Case

The most useful contribution is one small result that challenges the resolver or makes the second diff surprising. A Blast Case is atomic: official evidence, retrieval date, before manifest, after manifest, expected canonical JSON, and one sentence explaining the surprise.

Promoted public-repository evidence lives under [`cases/`](cases/README.md) as a source-content-free canonical receipt: immutable refs, resolver revision, result core, digest, producer provenance, and a future release reproduction command. The capture tool analyzes an existing checkout through the same production pipeline and derives the receipt path; it cannot overwrite an accepted case. Promotion remains gated by the field pilot, so a synthetic fixture can never stand in for real evidence.

See [CONTRIBUTING.md](CONTRIBUTING.md) for immutable-ref, publication-permission, rejection, and test requirements, or open a focused [wrong blast](.github/ISSUE_TEMPLATE/wrong-blast.yml), [missing blast](.github/ISSUE_TEMPLATE/missing-blast.yml), [weird blast](.github/ISSUE_TEMPLATE/weird-blast.yml), or [profile evidence](.github/ISSUE_TEMPLATE/profile-evidence.yml) form.

## Roadmap

The development core and reproducible demo are merged to main; the public npm release remains `IN BUILD`. Future stages are labeled by maturity and evidence gate rather than dates.

Today: Codex + Claude Code.

The profile seam is already there for the rest.

Two agents share this repo.
How many rule realities are still hiding in it…?

Read [ROADMAP.md](ROADMAP.md) for the release gates, Ground-Truth Hardening, Blast Receipts, one evidence-gated third reality, declarative Reality Packs, and an eventual many-reality diff. Candidate surfaces are not current support.

RuleBlast is licensed under [Apache-2.0](LICENSE). Changes are recorded in [CHANGELOG.md](CHANGELOG.md).
