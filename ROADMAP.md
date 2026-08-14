# RuleBlast Roadmap

RuleBlast grows by proving one product dimension at a time. This roadmap shows direction and admission gates, not a calendar or a claim that unfinished integrations already work.

## How to read this roadmap

| Label | Meaning |
|---|---|
| **RELEASED** | A signed tag, npm version, and GitHub Release are public, and downloaded artifact bytes match the recorded manifest. |
| **SHIPPED TO MAIN** | Merged and verified development behavior. This is not an npm release unless a tag and artifact are named. |
| **RELEASE CANDIDATE** | Signed, reviewed source and exact package evidence exist on a release branch; merge, tag, npm, and GitHub Release remain separate authorized operations. |
| **IN BUILD** | Work inside the active release boundary; incomplete until authorized publication and every external verification pass. |
| **NEXT** | A selected, gated follow-up with no delivery date implied. |
| **HORIZON** | Ordered product direction, not a guarantee or current support claim. |
| **EXPLORING** | An open question or candidate that has not passed admission. |

## Feature admission test

A new feature may merge only when it answers YES to at least one question and stays inside the scope firewall:

1. Does it make the blast radius more exact?
2. Does it make the blast radius easier to explain or prove?
3. Does it make the blast radius more useful in a Git workflow without creating a second product?

Gemini CLI, Cursor, dashboards, linters, fixers, MCP servers, and generic plugin APIs currently fail this test. Source-centric attribution passed (2 and 3).

## **SHIPPED TO MAIN** — Ground-truth core

The proof-bearing path from repository bytes to an explainable terminal result includes:

- deterministic, read-only snapshots from a tracked manifest, Git commit, or current worktree;
- canonical result types with source disposition, completeness, ordering, and evidence provenance;
- evidence-pinned Codex CLI and Claude Code CLI resolvers exercised by positive, negative, ordering, ambiguity, and unknown fixtures;
- profile-neutral current, diff, transition, and impact analysis without vendor logic in the impact engine;
- one parser and application seam for the four public actions: scan, diff, explain, and case;
- semantic text rendering with golden views for aligned, split, changed, unchanged, unresolved, and no-source states;
- deterministic JSON kept separate from presentation aliases and terminal wording;
- a packaged verified case backed by one immutable, source-content-free receipt and presented through the same explanation and renderer path as repository analysis;
- packed-install verification for all four actions, deterministic JSON, side-effect boundaries, the published-file allowlist, and the measured performance budget;
- a completed local-only field pilot and a promoted, source-content-free receipt for one immutable public-repository comparison;
- a self-explaining README, maintained behavior contract, Blast Case contribution unit, changelog, and focused evidence forms whose claims are checked against behavior.

These capabilities are merged and verified as development behavior inside the `1.0.0` package boundary.

> Git shows the first diff. How large is the second?

## **RELEASED** — `v1.0.0`: The Second Diff

The first release was designed around one local npm CLI: three repository-analysis operations plus a synthetic teaching action. The changelog preserves that historical interface accurately. Current public onboarding uses `scan`, `diff`, `explain`, and `case`; the old teaching name survives only as a hidden byte-identical v1 compatibility alias.

The `v1.0.0` boundary completed four technical evidence gates and one independently verified publication gate:

1. **Packed-install and performance proof.** The packed artifact passes clean-location verification for the four actions, JSON determinism, read-only behavior, side-effect boundaries, file allowlist, and performance budget.
2. **Field pilot and canonical receipt.** The local-only pilot covered 25 immutable, real instruction-changing commits from the public Apache-2.0 `openai/codex` repository; its ledger was not published. It produced 24 useful non-obvious results and no unresolved count-changing P0/P1 defect. The promoted public case separately pins RuleBlast commits `27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8` → `e420008a1c10c5c328e506247560117f4d40b855`: 33 instruction-line edits changed 106 of 106 candidate stacks for each profile, with zero current split, partial, unknown, or indeterminate paths.
3. **Exact package identity.** Package and lock metadata carry `1.0.0`, every installation example pins `ruleblast@1.0.0`, and signed tag `v1.0.0` is the immutable source interface.
4. **Pack-once artifact proof.** One durable builder creates one contained tarball, records its SHA-512, SHA-256, byte size, and sorted inventory, then validates and smoke-tests those exact bytes offline without repacking. A source tree never substitutes for independent verification of npm or GitHub Release records.
5. **Verified publication receipt.** Signed tag [`v1.0.0`](https://github.com/Kpoiut/ruleblast/releases/tag/v1.0.0) targets `327cea48343b4018a0dca1d4c9dfae9a2b6b1bcb`. [npm `ruleblast@1.0.0`](https://www.npmjs.com/package/ruleblast/v/1.0.0) reports integrity `sha512-kXIWZtwFwtUVSQun3HcV0FN65fkojbhaODIxYvggOPeNSqsl8VxZK3ST5jkfMPYDVcuWPVYlX8V4iTC0cla+hA==`. The GitHub Release carries the reviewed 146,553-byte `ruleblast-1.0.0.tgz` and canonical manifest; the downloaded tarball SHA-256 is `8c552b0e749277376010a929c1f1c444db7f7fc02c9f5099e2f902d29e0ec136`. These are independently verified external records, not facts inferred from this checkout.

The `v1.0.0` boundary does not admit another agent surface, command, output product, hosted component, model call, or repository mutation. An attractive idea that crosses that line waits outside the release.

Earlier roadmap copy called this a “private-repository pilot.” The implementation gate has always required a **private/local-only pilot process** plus a separate license-or-permission check for any promoted public case; it did not require private source ownership. This wording is corrected here rather than claiming that public `openai/codex` commits came from a private repository.

> The blast can now be explained. Can it travel without losing the receipt?

## **RELEASED** — `v1.0.1`: Ground-Truth Hardening

This patch deepens the existing product without adding a fifth action or a new product dimension. Its technical gates and external publication records are complete.

Targeted work:

- make the architectural direction explicit: adapters → domain → application → presentation;
- keep canonical result behavior stable while expanding fixtures, metamorphic invariants, packed-install evidence, and actionable error coverage;
- reduce repeated boundary code instead of adding wrappers that merely rename the same operation;
- tighten large-repository performance only where a reproducible case proves the need;
- present the selected horizontal RuleBlast hero at README scale as repository presentation, not product UI or packaged runtime media;
- reframe the existing packaged teaching action around the promoted immutable real-repository case, preserve `demo` compatibility for v1 users, and keep canonical JSON stable without adding a fifth action;
- retain complete one-command, global, project-local, maintenance, troubleshooting, and source-build installation guidance with exact `ruleblast@1.0.1` commands;
- require every patch to carry at least one concrete correction, coverage, regression, or hardening delta.

Admission gates:

- no duplicate snapshot, resolver, impact, or render abstraction;
- no unexplained golden-output drift;
- no new runtime dependency without measured value and a smaller rejected alternative;
- the early Install section and packed-install test must prove the complete pinned package still downloads and runs through one command on Node.js 20 or newer;
- no behavior that cannot be expressed through the existing canonical result.

**Verified publication receipt.** Signed tag [`v1.0.1`](https://github.com/Kpoiut/ruleblast/releases/tag/v1.0.1) targets signed integration commit `02fcc41de50a32f31a1da96095fe72f8ca2e2b8d`. A clean rebuild at that integration commit proved a byte-identical package projection from reviewed candidate `7d643408eda5f7f435528e42dd187873ab792147`. [npm `ruleblast@1.0.1`](https://www.npmjs.com/package/ruleblast/v/1.0.1) reports integrity `sha512-PvJ6gKFMmB/cz6O+X22qQWmN9EPryZ3X8TMCP+/VGzuooB9yWc5AjVZPxY0wffw//vIDHGc+aiyX1+OcDnHQfg==`; direct tarball publication means registry `gitHead is absent` rather than invented. The registry download and GitHub Release asset both match the reviewed 99,047-byte tarball with SHA-256 `de9bc3db1ea209b48fd3a9108a40651f495b6ee4c2fd8dbbd0d9b88832283840`. These are independently verified external records, not facts inferred from this checkout.

## **RELEASED** — `v1.0.2`: Adoption and Operability

This release closed the path from a technically sound tool to one that can be found, installed, trusted, and maintained. It did not add an action, resolver surface, hosted component, or telemetry.

Targeted work:

- keep npm description, keywords, repository links, release checksums, and GitHub topics aligned with capabilities proven by tests;
- put the promoted real receipt before synthetic teaching material and make the first useful command obvious from a fresh Git repository;
- lead with an evidence-locked causal proof from immutable public `openai/codex` refs: 2 instruction-line edits, 206 tracked paths with changed projected stacks, 4,476 unchanged paths, and one exact source explanation; preserve the already-different profile relation and zero tool-reported partial, unknown, or indeterminate paths for the modeled surfaces instead of manufacturing a split;
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

**Verified publication receipt.** Signed tag object `136c56cb5f1ba2de0fcaf7ab899ebf4678bc824b` for [`v1.0.2`](https://github.com/Kpoiut/ruleblast/releases/tag/v1.0.2) targets signed commit `18c250b2b58910c81e5d5d9cefb7c31ca54304a0`. [npm `ruleblast@1.0.2`](https://www.npmjs.com/package/ruleblast/v/1.0.2) reports integrity `sha512-YNJp217L6g3PaEapgwcxmHRMxi/9aFwA1kNRp9HdlWOKv96ptWwLzLjjYkrGsh4fOD9ZGJ528oqlpoPbUVWMwA==`; exact-tarball publication means registry `gitHead is absent` rather than invented. The registry download and GitHub Release asset both match the reviewed 89,244-byte tarball with SHA-256 `0d40d2297924e70c93bad51a9a84d7bd8af174ffa4cd008567f926adb0b941a2`; the canonical manifest has SHA-256 `59134fd306cdd34f92da145e3a6671d4099023acefe2add73874448c5f27fc64`. The dispatched [eight-cell registry upgrade matrix](https://github.com/Kpoiut/ruleblast/actions/runs/31722775046) completed successfully across Windows and Linux on Node.js 20, 22, 24, and 26. These are independently verified external records, not facts inferred from this checkout.

## **SHIPPED TO MAIN** — `v1.0.3`: Agent Route Proof

Semantic `--help`, packaged `AGENT_USAGE.md`, and a shorter GitHub-first README. Four existing routes. No fifth action.

## **SHIPPED TO MAIN** — `v1.1.0`: Resolution Witness Graph

Opt-in `--witness` prints why-edges derived from existing projection sources. Default canonical JSON is unchanged.

## **SHIPPED TO MAIN** — `v1.2.0`: Blast Receipts

The current canonical JSON Blast Case is an evidence record for one immutable comparison. The `v1.2.0` target is a portable, user-facing Markdown receipt derived only from `RuleBlastResult`.

A receipt may carry:

- the compared refs or current-snapshot label;
- resolver profile identifiers and evidence revisions;
- repository scope, changed instruction sources, and canonical core digest;
- the same counts, classifications, and one-path explanation already present in the result.

It must not recalculate impact, fetch a web page, embed a generated image, introduce resolver behavior, or make claims absent from the canonical result. Given equivalent canonical bytes and normalized line endings, two environments must produce the same receipt bytes.

> The result can travel. What happens when a third agent reads the same repo?

## **RELEASED** — `v1.3.0`: Third Documented Reality

`--reality github/copilot-cli@1` adds one evidence-pinned Copilot CLI surface. Default two-profile bytes stay put. Copilot VS Code and hosted Copilot remain distinct unsupported surfaces.

The release remains exactly one additional surface, not a generic integration wave. Admission required all of the following:

- official, versionable evidence for discovery, precedence, applicability, and limits;
- positive, negative, ordering, ambiguity, and unknown fixtures;
- a pinned evidence revision and a documented failure mode when evidence is incomplete;
- demonstrated user demand and at least one reproducible repository shape where the surface changes the answer;
- implementation through the profile contract, with no vendor branch in snapshot, impact, transition, canonicalization, or rendering code.

A vendor's CLI, editor extension, and hosted agent count as distinct surfaces whenever their loading semantics differ. Similar branding is not evidence of equivalent reality.

**Verified publication receipt.** Signed tag object `f417ee350a6aa7431f23bbe698d58edd24dc8285` for [`v1.3.0`](https://github.com/Kpoiut/ruleblast/releases/tag/v1.3.0) targets signed commit `8b2d083e6ebedb43315a2135621bd237a06a5f5d`. [npm `ruleblast@1.3.0`](https://www.npmjs.com/package/ruleblast/v/1.3.0) reports integrity `sha512-BsVvo3OsYiQKZx961VTZH7tYMLoEJuNNYWqX+OXcYMZZz77Rtvfs5rJ3kiGTfoycn3f4h4ze++tySXrOTiIRIw==`; exact-tarball publication means registry `gitHead is absent` rather than invented. The registry download and GitHub Release asset both match the reviewed 93,562-byte tarball with SHA-256 `b4a2f04e4536d1859e3e80c2d4722b456d5194f47b7167df879af5577da5ec7c`; the canonical manifest has SHA-256 `9b5da71c2352b3273efeef5cdd228a602060e535ccbcf5804089a9ddacd9a664`. These are independently verified external records, not facts inferred from this checkout.

## **SHIPPED TO MAIN** — `v1.3.1`: Longer Causal Proof

A presentation patch on the released `v1.3.0` CLI. The README causal-proof loop is 28 held frames and 1,960 centiseconds. It now opens on the failure mode — Git will never show that second diff — walks the same 2→206 Codex/Claude split, and closes on `npx --yes ruleblast@1.3.0 .`. Community-health tabs lead with a human sentence. No fifth action, no new surface, no invented SAME→DIFFERENT split.

This tree is `1.3.1`. Latest independently verified public npm distribution remains `1.3.0`.

## **SHIPPED TO MAIN** — `v1.4.0`: Visual Benchmark

One explainable scoreboard on the README. It restates the sealed 2→206 public proof beside the packed 10,000-path budget (p95 < 2,000 ms). It does not measure model quality, invent a SAME→DIFFERENT split, or add a fifth action.

This tree is `1.4.0`. Latest independently verified public npm distribution remains `1.3.0`.

## **SHIPPED TO MAIN** — `v1.4.1`: Compact Scoreboard

A presentation patch. The visual benchmark is a 1,200×360 instrument strip, not a poster. The optional composite Action lives at `.github/actions/ruleblast` so GitHub does not treat the repository root as an unpublished Marketplace Action.

This tree is `1.4.1`. Latest independently verified public npm distribution remains `1.3.0`.

## **SHIPPED TO MAIN** — `v1.4.2`: User-Owned Scoreboard Gate

The visual scoreboard is a closable README box plus the opt-in `--receipt` card. Humans toggle agent use with `RULEBLAST_AGENT_ALLOW` or a user-created `.ruleblast-allow`. Default is ask. This is not live agent telemetry and not a product UI.

This tree is `1.4.2`. Latest independently verified public npm distribution remains `1.3.0`.

## **SHIPPED TO MAIN** — `v1.4.3`: Dual Skill Discovery

Codex keeps `.agents/skills`. Claude Code gains the official project path `.claude/skills/<name>/SKILL.md`. Same permission protocol. This is discovery compatibility, not a new resolver surface.

This tree is `1.4.3`. Latest independently verified public npm distribution remains `1.3.0`.

## **SHIPPED TO MAIN** — `v1.4.4`: CLI-First Front Page

Presentation only. The README leads with a terminal demo and a single 2→206 statement. Sealed bytes live in PROOF.md. Gemini CLI remains behind the admission gate.

This tree is `1.4.4`. Latest independently verified public npm distribution remains `1.3.0`.

## **SHIPPED TO MAIN** — `v1.5.0`: Source-Centric Blast Attribution

`diff` now answers “this instruction file changed — which agents and paths inherited it?” from existing `causes` and `changedProfiles`. Not a fifth action. Gemini CLI stays behind the admission gate.

This tree is `1.5.0`. Latest independently verified public npm distribution remains `1.3.0`.

## **RELEASED** — `v1.5.1`: Public Install Identity

Pins advertised `npx` and the optional Action to `ruleblast@1.5.1`. Adds the feature admission test. Gemini CLI remains gated.

**Verified publication receipt.** Signed tag object `1e1ee219b45c69da46a732ef215835eee11f33fc` for [`v1.5.1`](https://github.com/Kpoiut/ruleblast/releases/tag/v1.5.1) targets commit `ca6dea5efab263a11dbfc0221b88570cdcf50b7f`. [npm `ruleblast@1.5.1`](https://www.npmjs.com/package/ruleblast/v/1.5.1) reports integrity `sha512-0QRQ88yxOMrOPYME1I5IIZKaWlJ8PECP40L+rXZ4rKmPM2ANFfJjlaKJnCFOAMvxOCXcyXqqk2/ON6mHPZPA8g==`; exact-tarball publication means registry `gitHead is absent` rather than invented. The registry download and GitHub Release asset both match the reviewed 95,434-byte tarball with SHA-256 `d85e4f35233b1bd65f778c65eb83122b41405df42cd4ef72b4c602a18bb1a036`; the canonical manifest has SHA-256 `08711a24f3ed1a9c43e0c065337962c2ef229e9c8edf3f0051fdd97b402de590`. These are independently verified external records, not facts inferred from this checkout.

This tree is `1.5.1`.

## **SHIPPED TO MAIN** — `v1.5.2`: Evidence-Link Wording

Presentation. The public 206 example names the nested `AGENTS.md` as the changed instruction source and `action_required_title.rs` as one affected path. Source-centric counts remain overlapping attribution, not a counterfactual partition.

This tree is `1.5.2`. Latest independently verified public npm distribution remains `1.5.1`.

## **SHIPPED TO MAIN** — `v1.5.3`: Receipt Binding

The packaged `case` command discovers the single promoted receipt, binds `{owner}__{repo}/{base12}..{head12}.json` to the receipt identity, and checks `coreDigest` against `resultCore`. It does not keep a second copy of those hashes in source.

This tree is `1.5.3`. Latest independently verified public npm distribution remains `1.5.1`.

## **NEXT** — `v2.0.0`: Reality Packs

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

- Which third surface has both stable official semantics and enough demand to pass the `v1.3.0` gate?
- Can the finite Reality Pack representation reproduce every bundled golden result without an executable escape hatch?
- How should an offline run reveal that a pinned evidence revision may have drifted without making a network request?
- Can a licensed corpus of Blast Cases cover monorepos, nested instructions, imports, exclusions, and uncertain order without publishing sensitive content?
- How many documented rule realities are genuinely distinct once equivalent projections are clustered by evidence rather than brand?

`--reality github/copilot-cli@1` is the one admitted third surface. Copilot VS Code, hosted Copilot, Gemini CLI, and Cursor remain examples only. CLI, editor, and hosted modes remain distinct surfaces whenever their documented loading semantics differ.

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
