# RuleBlast

> **The second diff for AI repo instructions.**

## You changed the rules. How much of the repo changed sides?

Git shows the first diff. RuleBlast finds the second.

Codex and Claude Code can share one repository without reading the same repository instructions. RuleBlast is being built as a local, Git-native CLI that makes that hidden split inspectable—down to one path and every source that landed there.

**Status: design locked · implementation starting · `v1.0.0` in build**

There is no installable release yet. This repository is public now so the resolution contract, product boundary, and implementation order can be challenged before the code hardens around them.

## What v1 will answer

- Which Git-tracked paths changed instruction stack after an `AGENTS.md` or `CLAUDE.md` edit?
- Where do the documented Codex and Claude Code projections provably differ?
- For one path, which sources were selected, shadowed, imported, truncated, partial, or unknown?
- Can another developer reproduce the same result from the same refs and resolver revision?

The complete v1 loop is intentionally small:

```text
scan → see the blast → pick a path → explain every source
```

One npm package. Four CLI actions. Two evidence-pinned profiles. No product UI, cloud service, model call, telemetry, auto-fix, or repository mutation.

## Read the build before it ships

- [Product, narrative, and scope contract](docs/superpowers/specs/2026-08-12-ruleblast-design.md)
- [v1.0 implementation plan](docs/superpowers/plans/2026-08-12-ruleblast-v1-implementation.md)
- [Release roadmap](ROADMAP.md)
- [How to challenge or contribute](CONTRIBUTING.md)

The implementation plan locks the public types, snapshot boundary, resolver evidence, fixture matrix, TDD order, package gates, and release criteria. Code lands in reviewed milestones; placeholder subsystems and speculative integrations do not.

## The larger reveal

Today, the target is Codex CLI plus Claude Code CLI. The schema is N-profile-capable from v1, without pretending more agents are already supported.

Later, evidence-gated **Reality Packs** can add distinct surfaces without turning the core into a plugin platform that executes arbitrary code.

```text
Today: Codex + Claude Code.

The profile seam is already there for the rest.

Two agents share this repo.
How many rule realities are still hiding in it…?
```

See [ROADMAP.md](ROADMAP.md) for the release boundary. Candidate surfaces are evaluated there as future evidence work, never presented here as current support.

## Follow the work

Star or watch the repository if this is a problem you have hit. During the planning release, the most useful contributions are:

- a documented resolver edge the contract gets wrong;
- a public repository/ref pair with a surprising instruction blast;
- an agent surface request backed by official, versionable loading semantics;
- a smaller way to preserve the same proof.

RuleBlast is licensed under [Apache-2.0](LICENSE).
