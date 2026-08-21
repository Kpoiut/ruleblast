# Which files inherit a changed AGENTS.md?

RuleBlast — Git diff for AI agent repository instructions.

Git shows the `AGENTS.md` or `CLAUDE.md` edit. It does not show every tracked path that inherits that change.

That missing second diff is the blast radius of repository instructions.

## Why `git diff` is insufficient

`git diff` answers: which instruction files changed?

It does not answer:

- which files inherit the nested `AGENTS.md`?
- did Codex pick up the edit while Claude Code did not?
- is `CLAUDE.md` vs `AGENTS.md` the same stack in this repository?

Those are instruction-inheritance questions. They are not first-diff questions.

## Nested AGENTS.md

A two-line edit in a nested `AGENTS.md` can move hundreds of Codex stacks and zero Claude Code stacks. The first diff still looks tiny.

Sealed public case on [`openai/codex`](https://github.com/openai/codex): 2 instruction-line edits → 206 Codex stacks changed → 0 Claude Code stacks → 4,476 paths unchanged. Evidence: [PROOF.md](PROOF.md).

## AGENTS.md vs CLAUDE.md

The same Git tree can project different instruction stacks. Codex, Claude Code, Gemini CLI, and Copilot CLI are distinct documented surfaces. A host that can run a tool is not thereby a modeled reality.

## RuleBlast

[RuleBlast](https://github.com/Kpoiut/ruleblast) is a local, read-only Git CLI. It shows the blast radius of `AGENTS.md` and `CLAUDE.md` changes across those four CLI surfaces. No network or model call during analysis. This tree is `2.4.6`. Published CLI is `ruleblast@2.4.6`.

```bash
npx --yes ruleblast@2.4.6 .
npx --yes ruleblast@2.4.6 diff HEAD~1
```

Which other path inherited the same nested source? The sealed case does not answer that for you.
