# Contributing to RuleBlast

RuleBlast is in its public planning release. The highest-value contribution right now is a small, reproducible challenge to the contract—not a broad feature pitch.

## Useful contributions

- Point to an official source or pinned implementation revision that contradicts a resolver rule.
- Provide a minimal positive, negative, ordering, ambiguity, or unknown fixture.
- Provide immutable public repository refs that reveal a surprising instruction blast.
- Request an agent surface with official, versionable discovery and applicability evidence.
- Show how to remove an operator or dependency without weakening the result.

## Evidence format

Include:

```text
surface id
official source URL or pinned source revision
retrieval date
exact claim being tested
smallest before/after repository shape
expected canonical outcome
one sentence explaining why the result is surprising
```

Do not include credentials, private repository content, generated marketing numbers, or assumptions about what a model obeyed. RuleBlast models documented repository instruction projection; it does not claim to observe a model's private runtime prompt or behavior.

## Implementation contributions

Implementation follows the committed [v1.0 plan](docs/superpowers/plans/2026-08-12-ruleblast-v1-implementation.md) in small milestones:

1. write a failing behavior test;
2. confirm it fails for the intended reason;
3. implement the smallest complete behavior;
4. run focused tests and the repository checks;
5. simplify changed code;
6. pass spec-compliance review before code-quality review;
7. commit one coherent change with a Conventional Commit message.

Avoid duplicate adapters, generic plugin hooks, executable profile extensions, speculative abstractions, and placeholder modules. If a change is not required by the current milestone or a reproduced defect, keep it out.

## Commit style

Use Conventional Commits, for example:

```text
docs: publish ruleblast product contract
test(snapshot): define immutable manifest behavior
feat(snapshot): add deterministic repository snapshots
fix(codex): preserve empty override shadowing
```

Keep the subject imperative and at most 72 characters.

## License

By contributing, you agree that your contribution is licensed under the repository's [Apache-2.0 license](LICENSE).
