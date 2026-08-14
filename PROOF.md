# Proof: openai/codex 8fcf2ad → f0f483e

This is the sealed public comparison behind the README headline. It is not a claim about model compliance or response behavior.

## Result

| Fact | Value |
|---|---|
| Repository | public Apache-2.0 [`openai/codex`](https://github.com/openai/codex) |
| Before | [`8fcf2ad931b90589dd29a571f367e3185d26bbe0`](https://github.com/openai/codex/commit/8fcf2ad931b90589dd29a571f367e3185d26bbe0) |
| After | [`f0f483e8b2a2630bf8dfa5f8451e81eba20def6c`](https://github.com/openai/codex/commit/f0f483e8b2a2630bf8dfa5f8451e81eba20def6c) |
| Git first diff | 3 files, 6 deleted lines · 2 instruction-line edits |
| Codex paths whose documented instruction stack changed | 206 |
| Claude Code paths whose documented instruction stack changed | 0 |
| Unchanged tracked paths | 4,476 |
| Candidates | 4,682 · 4.40% hit |
| Uncertainty | zero partial, zero unknown, and zero indeterminate |
| Newly split across profiles | none. Profiles `openai/codex-cli@1` and `anthropic/claude-code-cli@1` were already `DIFFERENT → DIFFERENT`. We do not invent a split. |
| Changed instruction source | nested [`codex-rs/tui/src/bottom_pane/AGENTS.md`](https://github.com/openai/codex/blob/8fcf2ad931b90589dd29a571f367e3185d26bbe0/codex-rs/tui/src/bottom_pane/AGENTS.md) |
| Example affected path | [`codex-rs/tui/src/bottom_pane/action_required_title.rs`](https://github.com/openai/codex/blob/f0f483e8b2a2630bf8dfa5f8451e81eba20def6c/codex-rs/tui/src/bottom_pane/action_required_title.rs) |

A `causes` entry is an evidence link: the path used that changed source. Counts per source can overlap. The rest of the 206 is in the command.

## Reproduction

```bash
ruleblast diff 8fcf2ad931b90589dd29a571f367e3185d26bbe0 --to f0f483e8b2a2630bf8dfa5f8451e81eba20def6c
```

## Sealed bytes

Sealed on implementation [`517cc07af9d2d7dafb48b9f2b3cfaecd85444a1d`](https://github.com/Kpoiut/ruleblast/commit/517cc07af9d2d7dafb48b9f2b3cfaecd85444a1d): 150,404,342 canonical bytes, SHA-256 `5659e4cb83051aeaa246c3b45fad75698754806db30f4e710849d220d12ee9d2`. Resolver revision 1. License at [`f73a072…/LICENSE`](https://github.com/openai/codex/blob/f73a07224653c2cc775b3f84f129b872b1e08f85/LICENSE).

The packaged `case` command is a different artifact (33→106 on this repo). It is not this 206 proof.
