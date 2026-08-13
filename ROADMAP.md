# RuleBlast Roadmap

RuleBlast grows by proving one product dimension at a time. This roadmap shows direction and admission gates, not a calendar or a claim that unfinished integrations already work.

## How to read this roadmap

| Label | Meaning |
|---|---|
| **SHIPPED TO MAIN** | Merged and verified development behavior. This is not an npm release unless a tag and artifact are named. |
| **IN BUILD** | Work inside the active release boundary; incomplete until authorized publication and every external verification pass. |
| **NEXT** | A selected, gated follow-up with no delivery date implied. |
| **HORIZON** | Ordered product direction, not a guarantee or current support claim. |
| **EXPLORING** | An open question or candidate that has not passed admission. |

## **SHIPPED TO MAIN** — Ground-truth core

The proof-bearing path from repository bytes to an explainable terminal result includes:

- deterministic, read-only snapshots from a tracked manifest, Git commit, or current worktree;
- canonical result types with source disposition, completeness, ordering, and evidence provenance;
- evidence-pinned Codex CLI and Claude Code CLI resolvers exercised by positive, negative, ordering, ambiguity, and unknown fixtures;
- profile-neutral current, diff, transition, and impact analysis without vendor logic in the impact engine;
- one parser and application seam for the four public actions: scan, diff, explain, and demo;
- semantic text rendering with golden views for aligned, split, changed, unchanged, unresolved, and no-source states;
- deterministic JSON kept separate from presentation aliases and terminal wording;
- a packaged, manifest-backed demo that expands deterministically and passes through the same snapshot, resolver, impact, explanation, and renderer path as repository analysis.
- packed-install verification for all four actions, deterministic JSON, side-effect boundaries, the published-file allowlist, and the measured performance budget;
- a completed local-only field pilot and a promoted, source-content-free receipt for one immutable public-repository comparison;
- a self-explaining README, maintained behavior contract, Blast Case contribution unit, changelog, and focused evidence forms whose claims are checked against behavior.

These capabilities are merged and verified as development behavior inside the `1.0.0` package boundary.

> Git shows the first diff. How large is the second?

## **IN BUILD** — `v1.0.0`: The Second Diff

The first release is one local npm CLI:

```text
ruleblast [path]
ruleblast diff [base]
ruleblast explain <path> [--from <base>]
ruleblast demo [--explain <path>]
```

The `v1.0.0` boundary carries four completed technical evidence gates and one remaining external gate:

1. **Packed-install and performance proof.** The packed artifact passes clean-location verification for the four actions, JSON determinism, read-only behavior, side-effect boundaries, file allowlist, and performance budget.
2. **Field pilot and canonical receipt.** The local-only pilot covered 25 immutable, real instruction-changing commits from the public Apache-2.0 `openai/codex` repository; its ledger was not published. It produced 24 useful non-obvious results and no unresolved count-changing P0/P1 defect. The promoted public case separately pins RuleBlast commits `27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8` → `e420008a1c10c5c328e506247560117f4d40b855`: 33 instruction-line edits changed 106 of 106 candidate stacks for each profile, with zero current split, partial, unknown, or indeterminate paths.
3. **Exact package identity.** Package and lock metadata carry `1.0.0`, every installation example pins `ruleblast@1.0.0`, and tag `v1.0.0` becomes the immutable source interface only when the authorized publication step creates it.
4. **Pack-once artifact proof.** One durable builder creates one contained tarball, records its SHA-512, SHA-256, byte size, and sorted inventory, then validates and smoke-tests those exact bytes offline without repacking. A source tree never substitutes for independent verification of npm or GitHub Release records.
5. **REMAINING — Authorized publication.** Create the signed immutable tag, publish the already-reviewed tarball without repacking, create the GitHub Release from those exact bytes, and verify the registry integrity and documented one-command installs before calling `1.0.0` released.

The `v1.0.0` boundary does not admit another agent surface, command, output product, hosted component, model call, or repository mutation. An attractive idea that crosses that line waits outside the release.

Earlier roadmap copy called this a “private-repository pilot.” The implementation gate has always required a **private/local-only pilot process** plus a separate license-or-permission check for any promoted public case; it did not require private source ownership. This wording is corrected here rather than claiming that public `openai/codex` commits came from a private repository.

> The blast can now be explained. Can it travel without losing the receipt?

## **NEXT** — `v1.0.1`: Ground-Truth Hardening

This patch target deepens the existing product; it does not add a fifth action or a new product dimension.

Targeted work:

- make the architectural direction explicit: adapters → domain → application → presentation;
- keep canonical result behavior stable while expanding fixtures, metamorphic invariants, packed-install evidence, and actionable error coverage;
- reduce repeated boundary code instead of adding wrappers that merely rename the same operation;
- tighten large-repository performance only where a reproducible case proves the need;
- add the half-closed RuleBlast eye to repository presentation as a README asset, not a product UI;
- reframe the existing packaged teaching action around the promoted immutable real-repository case, preserve `demo` compatibility for v1 users, and keep canonical JSON stable without adding a fifth action;
- retain complete one-command, global, project-local, maintenance, troubleshooting, and source-build installation guidance with exact `ruleblast@1.0.1` commands;
- require every patch to carry at least one concrete correction, coverage, regression, or hardening delta.

Admission gates:

- no duplicate snapshot, resolver, impact, or render abstraction;
- no unexplained golden-output drift;
- no new runtime dependency without measured value and a smaller rejected alternative;
- the early Install section and packed-install test must prove the complete pinned package still downloads and runs through one command on Node.js 20 or newer;
- no behavior that cannot be expressed through the existing canonical result.

## **NEXT** — `v1.0.2`: Adoption and Operability

This second patch closes the path from a technically sound tool to one that can be found, installed, trusted, and maintained. It does not add an action, resolver surface, hosted component, or telemetry.

Targeted work:

- keep npm description, keywords, repository links, release checksums, and GitHub topics aligned with capabilities proven by tests;
- put the promoted real receipt before synthetic teaching material and make the first useful command obvious from a fresh Git repository;
- verify fresh `npx`, global, and project-local install, upgrade, reinstall, and uninstall paths across supported Node.js versions and host shells;
- provide a pull-request template, issue chooser, evidence checklist, and short contribution path that lead a report to one reproducible Blast Case;
- turn only reproduced field failures into actionable diagnostics or maintenance guidance instead of guessing at user behavior;
- measure downloads, traffic, referrers, stars, and forks through public npm and GitHub APIs, outside the product and without repository telemetry.

Admission gates:

- no star, fork, or download count is a release guarantee, and no synthetic number is presented as adoption evidence;
- discovery metadata contains no unsupported agent name, capability, or comparison claim;
- release assets and documented commands resolve to the exact tested package bytes;
- growth work may improve the evidence and contribution funnel, but cannot weaken read-only analysis, uncertainty, determinism, or offline behavior.

No star, fork, or download count is a release guarantee; the patch succeeds by making a useful result easier to discover and reproduce, then reporting observed public evidence honestly.

## **NEXT** — `v1.1.0`: Blast Receipts

The current canonical JSON Blast Case is an evidence record for one immutable comparison. The `v1.1.0` target is a portable, user-facing Markdown receipt derived only from `RuleBlastResult`.

A receipt may carry:

- the compared refs or current-snapshot label;
- resolver profile identifiers and evidence revisions;
- repository scope, changed instruction sources, and canonical core digest;
- the same counts, classifications, and one-path explanation already present in the result.

It must not recalculate impact, fetch a web page, embed a generated image, introduce resolver behavior, or make claims absent from the canonical result. Given equivalent canonical bytes and normalized line endings, two environments must produce the same receipt bytes.

> The result can travel. What happens when a third agent reads the same repo?

## **HORIZON** — `v1.2.0`: Third Reality

The target is exactly one additional surface, not a generic integration wave. Admission requires all of the following:

- official, versionable evidence for discovery, precedence, applicability, and limits;
- positive, negative, ordering, ambiguity, and unknown fixtures;
- a pinned evidence revision and a documented failure mode when evidence is incomplete;
- demonstrated user demand and at least one reproducible repository shape where the surface changes the answer;
- implementation through the profile contract, with no vendor branch in snapshot, impact, transition, canonicalization, or rendering code.

A vendor's CLI, editor extension, and hosted agent count as distinct surfaces whenever their loading semantics differ. Similar branding is not evidence of equivalent reality.

## **HORIZON** — `v2.0.0`: Reality Packs

The target is a finite, reviewed, declarative profile format—not an executable plugin system.

A local, explicitly installed pack would contain:

- a manifest and evidence revision;
- a discriminated, data-only JSON instruction-resolution representation;
- positive, negative, ordering, ambiguity, and unknown fixtures;
- expected canonical result bytes for conformance.

The reader must reject unknown operators and fail closed on traversal, escaping paths, unsafe symlinks, malformed evidence, or unsupported schema versions. It must never execute JavaScript or shell commands, contact a network, or auto-download a pack during analysis.

Before external packs are admitted, the bundled profiles must migrate to the same representation with result-equivalent canonical bytes. This release may expose raw N-profile projections and basic aggregates; named reality clusters remain outside its boundary.

## **HORIZON** — `v2.1.0`: Many-Reality Diff

The target is a compact N-way reveal built from canonical projections:

- pairwise comparison remains available as the inspectable ground truth;
- named clusters are created only when evidence-equivalent projections justify the name;
- compact aggregate output links back to the paths and sources behind each grouping;
- unknown, partial, unordered, unspecified, and runtime-decided states are never coerced into a clean alignment.

Any public number must come from a reproducible canonical result with immutable refs. Placeholder field tokens are allowed in design discussion; invented metrics are not.

## **EXPLORING** — Questions before commitments

These are unresolved questions, not current support or promised work:

- Which third surface has both stable official semantics and enough demand to pass the `v1.2.0` gate?
- Can the finite Reality Pack representation reproduce every bundled golden result without an executable escape hatch?
- How should an offline run reveal that a pinned evidence revision may have drifted without making a network request?
- Can a licensed corpus of Blast Cases cover monorepos, nested instructions, imports, exclusions, and uncertain order without publishing sensitive content?
- How many documented rule realities are genuinely distinct once equivalent projections are clustered by evidence rather than brand?

Candidate examples for investigation include Copilot CLI, Copilot VS Code, Gemini CLI, and Cursor. These names are examples only; RuleBlast does not currently support them, and none enters the roadmap without passing the same evidence gate. CLI, editor, and hosted modes remain distinct surfaces whenever their documented loading semantics differ.

## Permanent scope firewall

Across every stage, RuleBlast remains:

- one npm package and four public actions;
- local, read-only, deterministic, and text-first;
- free of a hosted service, dashboard, product UI, model call, telemetry, auto-fix, and repository mutation;
- free of a CI/CD product, security scanner, agent framework, and universal configuration registry;
- capped at three runtime dependencies unless removing the cap is supported by measured, reviewable evidence;
- capped at three bundled profiles before the Reality Pack boundary is proven.

Each minor release may add exactly one product dimension. A proposal that needs a fifth action, arbitrary executable extension, hidden network access, or unrelated platform is a different project.

## Admission gate for a new reality

A surface request is ready for review only when it provides:

1. a stable surface identifier that distinguishes CLI, editor, and hosted behavior;
2. official URLs or pinned implementation revisions for each modeled rule;
3. retrieval metadata and the exact evidence claim;
4. the smallest fixtures that prove selection, rejection, precedence, ambiguity, and unknown behavior;
5. expected canonical outcomes, including partial or unspecified states;
6. one repository shape showing why the surface changes a real answer;
7. a profile-only implementation path with no core vendor condition.

Missing evidence produces an explicit unknown; it does not license a confident guess.

## Contribute a Blast Case

A Blast Case is the smallest reproducible story of a rule edit whose reach is not obvious from Git alone. Submit:

```text
case title
public repository URL
immutable before ref
immutable after ref
RuleBlast version or commit
resolver profile ids and evidence revisions
command and relevant options
expected canonical digest
the surprising path and its source explanation
permission or license for publishing the result
```

For private repositories, reduce the shape to a licensed fixture or report only non-identifying aggregate evidence. Never submit credentials, proprietary file content, or a claim about a model's private runtime prompt.

The best case leaves one useful question hanging: the rule diff was visible—why was its second diff not?
