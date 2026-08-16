# Fresh replay — this tree

Compact `ruleblast.replay.v1` metrics. Not a replacement for the sealed openai/codex 2→206 proof in [PROOF.md](../../PROOF.md). Not a DEMO FIXTURE.

## Packaged teaching receipt

Command: `node dist/cli.js case --json` (same bytes as `ruleblast case --json`).

| Field | Value |
|---|---|
| mode | diff |
| candidatePathCount | 106 |
| changedStackPathCount | 106 |
| currentSplitPathCount | 0 |
| partialPathCount | 0 |
| unknownPathCount | 0 |
| indeterminatePathCount | 0 |
| profiles | `anthropic/claude-code-cli@1`, `openai/codex-cli@1` |
| receipt `coreDigest` | `1e907a88ed648ebbd68b4f588c3bd09058ab7714e8f85a3f2d4a1c60e5a40938` |

This receipt is bound to `27d52e2cd6ee` → `e420008a1c10` on `kpoiut/ruleblast`. It is the 33→106 teaching case, not the 2→206 Codex proof.

## Current worktree

Observed on this checkout after `npm run build`, dirty worktree versus `HEAD~1`. Command path: `replayMetricsFromResult` over `scanRepository` / `diffRepository`. Not a DEMO FIXTURE.

| Comparison | candidate | changed | split | partial | unknown | indeterminate |
|---|---:|---:|---:|---:|---:|---:|
| current scan, default two profiles | 237 | — | 0 | 0 | 0 | 0 |
| `HEAD~1` → `WORKTREE`, default two profiles | 237 | 0 | 0 | 0 | 0 | 0 |
| `HEAD~1` → `WORKTREE`, plus Copilot CLI and Gemini CLI | 237 | 0 | 237 | 237 | 0 | 237 |

Four-surface `byProfile` on that same diff: Claude Code 237 complete / 0 changed; Codex 237 complete / 0 changed; Gemini CLI 237 complete / 0 changed; Copilot CLI 0 complete / 0 changed. The default two-profile relation is aligned. The N-way split is a current-state Copilot incompleteness plus a Gemini/default payload difference, not a stack move caused by this worktree. Instruction sources did not change between `HEAD~1` and this worktree (`changedStackPathCount` is 0).

A later tree should replace these integers with a new observation. Do not invent counts.
