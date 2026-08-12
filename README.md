# RuleBlast

> **The second diff for AI repo instructions.**

## You changed the rules. How much of the repo changed sides?

Git shows the first diff. RuleBlast finds the second.

Codex and Claude Code can share one repository without reading the same repository instructions. RuleBlast is being built as a local, Git-native CLI that makes that hidden split inspectable—down to one path and every source that landed there.

**Status: ground-truth core on main · `v1.0.0` in build**

There is no installable release yet. Deterministic snapshots, evidence-pinned resolvers, profile-neutral impact analysis, the four-action command seam, and terminal rendering are merged to main while the release gates remain open to challenge.

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

## Read the contract while v1 is built

- [Product, narrative, and scope contract](docs/superpowers/specs/2026-08-12-ruleblast-design.md)
- [Release roadmap](ROADMAP.md)
- [How to challenge or contribute](CONTRIBUTING.md)

The public contract fixes what RuleBlast may claim. Canonical types, resolver evidence, fixture behavior, and release gates are enforced by tests and reviewed milestones on main. The roadmap separates what has landed from what remains.

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

Star or watch the repository if this is a problem you have hit. During the v1 build, the most useful contributions are:

- a documented resolver edge the contract gets wrong;
- a public repository/ref pair with a surprising instruction blast;
- an agent surface request backed by official, versionable loading semantics;
- a smaller way to preserve the same proof.

RuleBlast is licensed under [Apache-2.0](LICENSE).
