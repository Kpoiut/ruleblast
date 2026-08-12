# RuleBlast Roadmap

The roadmap adds one product dimension at a time. Versions are evidence gates, not a schedule or a promise that an unbuilt integration already works.

## Published — planning release

The product contract and implementation plan are public for technical challenge before implementation.

## In build — v1.0.0: The Second Diff

One local npm CLI with four actions:

```text
ruleblast [path]
ruleblast diff [base]
ruleblast explain <path> [--from <base>]
ruleblast demo [--explain <path>]
```

The release ships only when current scan, diff, explain, and demo work end-to-end for the evidence-pinned Codex CLI and Claude Code CLI profiles, with deterministic text/JSON, a labeled demo, and one reproducible public-repository case.

Internal engineering checkpoints are not advertised as finished products:

| Checkpoint | Required proof |
|---|---|
| `v0.1.0` | Git/worktree snapshots are deterministic and read-only |
| `v0.2.0` | Codex projection passes pinned fixtures |
| `v0.3.0` | Claude projection passes pinned fixtures |
| `v0.4.0` | Diff, explain, demo, and packed CLI work end-to-end |
| `v1.0.0` | Public package, real case, documentation, and release gates pass |

## Next — v1.1.0: Blast Receipts

Portable Markdown receipts generated from the canonical result. No visual product and no new resolver behavior.

## Horizon — v1.2.0: Third Reality

One additional agent surface, admitted only when official evidence, positive/negative/ordering/unknown fixtures, and real user demand pass the profile gate. A CLI and editor integration from the same vendor remain separate surfaces when their loading semantics differ.

## Horizon — v2.0.0: Reality Packs

Explicitly installed, declarative, data-only profile packs. The core reads validated JSON and runs conformance fixtures; it never executes pack JavaScript or downloads packs during analysis.

## Horizon — v2.1.0: Many-Reality Diff

Pairwise output, named clustering, and a compact N-way reveal generated from canonical result fields:

```text
{profileCount} agent surfaces.
{documentedRealityCount} documented realities.

{alignedCount} align · {divergedCount} diverge · {runtimeDecidedCount} runtime-decided.
```

These are field tokens, not sample metrics. Public numbers appear only after a reproducible canonical result exists. Candidate surface names in planning documents are examples, not current support claims.

## Permanent scope firewall

RuleBlast does not become a hosted dashboard, security scanner, CI/CD product, prompt generator, agent framework, auto-fixer, or universal configuration registry. A proposal that requires one of those is a different project.
