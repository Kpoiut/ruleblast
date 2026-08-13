# Contributing to RuleBlast

RuleBlast is in its `v1.0.1` build. The highest-value contribution is a small, reproducible challenge to the [public contract](CONTRACT.md), not a broad feature pitch.

## One atomic contribution: a Blast Case

A Blast Case is exactly one surprising repository-instruction transition with enough evidence to reproduce it:

```text
official source URL + retrieval date
before manifest
after manifest
expected canonical JSON
one sentence explaining the surprise
```

The manifests must be minimal, repository-relative, and free of credentials or proprietary content. If the case came from a public repository, also include its URL, immutable before and after Git refs, the RuleBlast commit or pinned package version, command, profile ids, and permission or license to publish the reduced case.

Expected JSON must preserve partial, unknown, and indeterminate states. A useful case includes the smallest positive and negative controls needed to distinguish the proposed rule from a coincidence.

Choose the focused form that matches the evidence:

- [Wrong blast](.github/ISSUE_TEMPLATE/wrong-blast.yml) — RuleBlast includes, classifies, or counts a path incorrectly.
- [Missing blast](.github/ISSUE_TEMPLATE/missing-blast.yml) — a documented affected path is absent.
- [Weird blast](.github/ISSUE_TEMPLATE/weird-blast.yml) — the result is reproducible but an uncertainty, source, grouping, or explanation is misleading.
- [Profile evidence](.github/ISSUE_TEMPLATE/profile-evidence.yml) — one future surface has official, versionable loading evidence.

## Rejection criteria

A case is not ready when it contains any of these:

- a generic prompt instead of repository manifests;
- an undocumented client or a surface identified only by a shared brand name;
- a feature dump that crosses more than one product dimension;
- fixtures with only positive cases and no negative or boundary control;
- mutable branch names instead of immutable refs;
- copied private content or no permission to publish the fixture;
- a confident expected result where the source evidence leaves order or applicability unresolved.

Rejection is a request for a smaller proof, not a verdict on the underlying problem.

## Profile evidence

Resolver changes need:

```text
surface id
official source URL or pinned implementation revision
retrieval date
exact discovery, precedence, applicability, limit, or composition claim
smallest positive fixture
smallest negative fixture
expected canonical outcome, including uncertainty
```

CLI, editor, and hosted modes are separate surfaces whenever their documented loading semantics differ. Missing evidence produces an explicit unknown; it does not authorize a guess.

## Implementation workflow

1. Write a failing behavior test.
2. Run it and confirm that it fails for the intended reason.
3. Implement the smallest complete change inside [CONTRACT.md](CONTRACT.md).
4. Run the focused test, `npm run check`, `npm run build`, and `git diff --check`.
5. Simplify changed code and remove duplicate paths or speculative abstractions.
6. Review contract compliance before code quality.
7. Commit one coherent change with a Conventional Commit subject.

Do not add generic plugin hooks, executable profile extensions, placeholder modules, or a new command to solve one fixture. A new surface must pass the [roadmap admission gate](ROADMAP.md#admission-gate-for-a-new-reality).

## Commit style

Examples:

```text
docs: tell the ruleblast story
test(snapshot): define immutable manifest behavior
fix(codex): preserve empty override shadowing
```

Keep the subject imperative and at most 72 characters.

## License

By contributing, you agree that your contribution is licensed under the repository's [Apache-2.0 license](LICENSE).
