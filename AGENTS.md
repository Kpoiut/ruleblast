# RuleBlast repository instructions

RuleBlast is a small, local, read-only debugger for repository instruction projection. Keep every change inside the public boundary in [CONTRACT.md](CONTRACT.md) and the active maturity gate in [ROADMAP.md](ROADMAP.md). Agents working in this checkout: [`.agents/skills/ruleblast/SKILL.md`](.agents/skills/ruleblast/SKILL.md).

## Evidence before confidence

- Model only documented repository-loading semantics for one named surface and revision.
- Pin an official URL or implementation revision, retrieval date, and exact claim for resolver behavior.
- Preserve `PARTIAL`, `UNKNOWN`, `UNSPECIFIED`, `RUNTIME_DECIDED`, and `INDETERMINATE` when evidence does not justify certainty.
- Label synthetic public metrics `DEMO FIXTURE` before their first appearance.
- Never infer model compliance or response behavior from a repository projection.

## Change discipline

- Write the failing behavior test first and confirm the intended failure.
- Implement the smallest complete behavior, then simplify changed code.
- Keep vendor logic in profile adapters; snapshots, impact, canonicalization, and rendering stay profile-neutral.
- Do not add a fifth action, product UI, hosted component, network/model call, telemetry, mutation, auto-fix, or executable profile extension.
- Avoid duplicate adapters and wrappers that only rename an existing operation.
- Keep one production source module under 400 lines unless an extraction review justifies otherwise.

## Before a commit

Run focused tests, then:

```bash
npm run check
npm run build
git diff --check
```

Use a Conventional Commit subject. Update public docs only for behavior that is merged and verified; label incomplete work with the roadmap vocabulary.
