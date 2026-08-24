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

Cursor editor semantics, dashboards, linters, fixers, product MCP servers, and generic plugin APIs fail this test. A stdio transport of the four existing actions is not a product MCP server. `google/gemini-cli@1` passed (1) as the final bundled reality. A VS Code-compatible companion may pass (2) as a renderer of the same canonical result. Compatible VS Code-family editors share that one companion.

## How to read capability layers

This section is a reference map for the problem RuleBlast exists to solve. It is not a quality score of the checkout, not a star or marketplace rank, and not a plan to grow into a wider product.

The product-breadth ladder (CLI → tool → framework → harness → ecosystem → platform) is the wrong axis. RuleBlast keeps one analysis engine, four actions, and a local read-only deterministic contract on purpose. A later number on that other ladder does not grade this repository, and this roadmap does not treat the checkout as “at L4” on it.

The domain axis is narrower: how strong is instruction-semantics, instruction-inheritance, and blast-radius analysis of a repository?

| Layer | Capability on that domain |
|---|---|
| **L1** | Find instruction files. |
| **L2** | Compute directory scope and inheritance. |
| **L3** | Resolve according to each modeled agent's documented semantics. |
| **L4** | Diff two repository states and name the affected paths. |
| **L5** | Compare selected realities, carry provenance, preserve uncertainty, and explain the result. |
| **L6** | Deterministic, evidence-pinned semantic impact: same snapshot bytes, profiles, projection context, and resolver revision yield the same canonical core on every host, usable as ground truth or as a tool primitive. |

A general-purpose harness can read a repo, run commands, and coordinate agents and still lose this measurement: commit A → commit B; which tracked paths inherited a different stack under Codex CLI versus Claude Code; which sources caused it; where the result is `PARTIAL`, `UNKNOWN`, `UNSPECIFIED`, or `INDETERMINATE`; and whether the canonical bytes reproduce. That is the same category error as asking whether a kernel finds a regex faster than a specialized searcher.

On this domain ladder the current public product sits near **L6**, read as **L5.5–L6** because vendor loading rules can move and every resolver has to keep proving fidelity. That reservation is the only reason this document does not stamp an absolute L6. Breadth stays deliberately narrow. Depth is the work.

Numbers past L6 on this same axis, if they exist, are still a sharper knife in the same slice: stronger evidence, more sealed overlays, deeper replay. An L10 on a harness or platform map is reference-only speculation from another category, not a destination.

When a harness needs an exact instruction-stack delta, the intended relationship is that it calls this primitive. RuleBlast does not sit “under” that harness on a product ladder.

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

## **SHIPPED TO MAIN** — `v1.6.0`: Fourth Documented Reality

The last v1 engine dimension. `--reality google/gemini-cli@1` adds one evidence-pinned Gemini CLI repository surface. Default Codex + Claude canonical bytes stay put. Gemini Code Assist and hosted Gemini remain distinct unsupported surfaces.

This release also introduces the compile-time profile catalog, the analysis-authority facade, a shared explain presentation model, and semantic conformance bytes for the default two profiles. It does not add a fifth action, `--reality all`, or a fifth bundled reality.

Technical admission is evidence + fixtures + conformance. A public featured Blast Case is a marketing gate, not a semantics gate.

## **SHIPPED TO MAIN** — `v1.6.1`: Canonical Companion

One host class: a read-only VS Code-compatible companion under `hosts/vscode`. It imports the application facade, renders the shared explain model, and must produce byte-identical canonical JSON. It is not a second engine. File changes mark `STALE` and do not restart analysis. Cursor and Windsurf are compatible hosts only after acceptance tests. They are not modeled realities.

## **RELEASED** — `v1.6.2`: Last-Result Explain

Presentation and host-session logic on the existing four actions. Default explain text is the shared visual source tree. Receipt and source-blast lines use catalog badges. The companion explains from the last canonical result, keeps `STALE` when the worktree already moved, and treats Select Reality as a session option. It is not a fifth action, a second engine, or a new reality.

**Verified publication receipt.** Signed tag object `4883efb6d5a82e0bcfe4ebd8375a0f024ff7943b` for [`v1.6.2`](https://github.com/Kpoiut/ruleblast/releases/tag/v1.6.2) targets commit `ef2206a40b44a1debb211bd131f23afb519ac32f`. [npm `ruleblast@1.6.2`](https://www.npmjs.com/package/ruleblast/v/1.6.2) reports integrity `sha512-JE3H3hE7Gp1/AuQIz8swceyFRlGnfFjLcJz/MOriBswDt69ObMatn3w/AzkjeqSSThsyhgGnnpdR4emkYKw1eg==`; exact-tarball publication means registry `gitHead is absent` rather than invented. The registry download and GitHub Release asset both match the reviewed 108,652-byte tarball with SHA-256 `0c93bc4c24410297ce0f20dc5cf7788ad4dfb3259c2b99662782969bec49101f`; the canonical manifest has SHA-256 `8725791048ff228835279abbcaa855002303aa5867a8971182fbac601f80fec4`. These are independently verified external records, not facts inferred from this checkout.

That release is `1.6.2`. Latest independently verified public npm distribution at that tag is `1.6.2`.

## **RELEASED** — `v2.0.0`: Reality Packs

That release is `2.0.0`. Latest independently verified public npm distribution at that tag is `2.0.0`.

**Verified publication receipt.** Signed tag object `250f54ff2a1ae354581919f471d3bb48dd231db4` for [`v2.0.0`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.0.0) targets commit `bf51ada55b7e34db2b8f5b6c0eebd468b35c0382`. [npm `ruleblast@2.0.0`](https://www.npmjs.com/package/ruleblast/v/2.0.0) reports integrity `sha512-RLiS2/bBUlzzRPiEoypRYowa3fUvSutpDrpv6IoXUjl9/t5NwwIgDXaZpPVaYzwlIApjixSr3xYYbqscWQFrYg==`; exact-tarball publication means registry `gitHead is absent` rather than invented. The registry download and GitHub Release asset both match the reviewed 118,042-byte tarball with SHA-256 `1059f9c02e474cb1f1376bb4664aee03f63ac13af8ac4817fcdb6fd7a94c0777`; the canonical manifest has SHA-256 `04b8fe547e684aef54af743ebdd1f6172a647834255d1ff3a4f11fa02087a52c`. These are independently verified external records, not facts inferred from this checkout.

Bundled, reviewed, data-only packs under `packs/bundled` now define the four realities. The fail-closed decoder rejects unknown keys and dangling claim ids. Catalog admission stays product policy. No `--pack`, no fifth reality, no executable pack extension.

Increment 0.25 classified Gemini two-hop as D2a on `PROBE_TREE_SHA` `f9e6833aeadcb3e3f23753ebf0f761df68749f0a`. Increment 0.30 closed prepare-time `sourceDependencyPaths` at `MIGRATION_BASE_SHA` `38cb0f50bd03bc39a0046426b6fa3004103d4f4a`. The correction is bundled into this 2.0.0 line; it is not a 1.6.x release. Default two-profile goldens are unchanged. `resolverRevision` remains 1. Fingerprint recipes stay historical.

A finite, reviewed, declarative profile format—not an executable plugin system. External packs remain unadmitted.

A local, explicitly installed pack would contain:

- a manifest and evidence revision;
- a discriminated, data-only JSON instruction-resolution representation;
- positive, negative, ordering, ambiguity, and unknown fixtures;
- expected canonical result bytes for conformance.

The reader must reject unknown operators and fail closed on traversal, escaping paths, unsafe symlinks, malformed evidence, or unsupported schema versions. It must never execute JavaScript or shell commands, contact a network, or auto-download a pack during analysis.

Before external packs are admitted, the bundled profiles must migrate to the same representation with result-equivalent canonical bytes. This release may expose raw N-profile projections and basic aggregates; named reality clusters remain outside its boundary.

## **SHIPPED TO MAIN** — `v2.0.1`: Honest PR engine pin

Signed tag object `7ead43338441bfd541a88096587257189939a1b7` for [`v2.0.1`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.0.1) targets commit `eddaf663ea489a3b5ab576a1763c9af42df43a82`. The GitHub Release serves the 118,124-byte tarball with SHA-256 `d4a6f3d677636ff61bfd1a2af1a5929d597c4ba77bf6a832afd0bba194f27c46`. Latest independently verified public npm distribution at that tag remains `2.0.0` until an authorized `2.0.1` publication.

The nested composite Action still defaulted to `1.6.2` after Reality Packs shipped, so pull-request receipts analyzed the previous engine. The default package pin is `2.0.1`. An optional `reality` input forwards the existing `--reality` flag. Help names two default realities and two opt-in CLI surfaces. No fifth action, no `--pack`, no fifth reality.

## **RELEASED** — `v2.0.2`: Retrievable identity and fail-closed pack load

That release is `2.0.2`. Latest independently verified public npm distribution at that tag is `2.0.2`.

**Verified publication receipt.** Signed tag object `7b0b169f49c6be0da5289b4afcb7bc0576607486` for [`v2.0.2`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.0.2) targets commit `1c926b6ee92915659c58cc140627a76480996b5b`. [npm `ruleblast@2.0.2`](https://www.npmjs.com/package/ruleblast/v/2.0.2) reports integrity `sha512-DsiHO5GR5xiGNioWxqjn5rtO9n/9d7sCM7+ND4OKECdVQDXMR4U0t0Sd8z2k+Ahaz4FwaGq5iyRDSF1+3UhAQg==`; exact-tarball publication means registry `gitHead is absent` rather than invented. The registry download and GitHub Release asset both match the reviewed 118,836-byte tarball with SHA-256 `9cec50fa91cbd13b3326f5aee5cdf98e0c31421ef483231560e8290a1b97387a`; the canonical manifest has SHA-256 `9a123b870a581d88b72089e1b5e5dcfd0b51b2ee361d16e302098dabdce0a9c9`. These are independently verified external records, not facts inferred from this checkout.

The npm description, README first fold, `--help`, companion blurb, agent skill frontmatter, and `AGENT_USAGE.md` now share one identity: blast radius of `AGENTS.md` / `CLAUDE.md` changes across the four modeled CLI surfaces. The first fold answers the problem query: which files inherit that change. Pack load rejects nested, drive-relative, and path-escaping directory names so a name such as `C:secret` cannot leave `packs/bundled`. Missing JSON and malformed JSON raise distinct `INVALID_PACK` errors. Catalog directories must match the pack id. No fifth action, no `--pack`, no fifth reality, no hosted discovery service.

## **RELEASED** — `v2.1.0`: Many-Reality Diff

That release is `2.1.0`. Latest independently verified public npm distribution at that tag is `2.1.0`.

**Verified publication receipt.** Signed tag object `d89cc19599583ec7d81e379381ebd8fe13bb829f` for [`v2.1.0`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.1.0) targets commit `1cb9e6b7e1344c70b8d5dec0563c86efc3fd225b`. [npm `ruleblast@2.1.0`](https://www.npmjs.com/package/ruleblast/v/2.1.0) reports integrity `sha512-tNxO7l++PZ02JIYyZNJGZvwtlb0l/lTM5aYhZUXFBFo22t2uv29nUWacYRzROQ/cwp7pkLbJAIpJCE2slJ6UvQ==`; exact-tarball publication means registry `gitHead is absent` rather than invented. The registry download and GitHub Release asset both match the reviewed 120,388-byte tarball with SHA-256 `1a8c94fd7b2d1a5875d64552ff001f9fdbdfc641b8e889d40094d744d83a982d`; the canonical manifest has SHA-256 `08b9104ced23ff298a54f8d465d42eaf10509927291e0e05b9be697b6f8ed093`. These are independently verified external records, not facts inferred from this checkout.

Compact N-way reveal from existing canonical projections. Repeat `--reality` to add both bundled opt-in CLI surfaces on one invocation. Profiles cluster only when pairwise payload relation is `SAME`. Incomplete, `INDETERMINATE`, `UNSPECIFIED`, and `RUNTIME_DECIDED` states stay unresolved and are never coerced into a named alignment. Pairwise projections remain the inspectable ground truth. Default two-profile `--json` is unchanged when neither flag is passed. No `--reality all`, no fifth action, no fifth reality, no extra host class.

## **RELEASED** — `v2.1.1`: Retrievable problem documents

That release is `2.1.1`. Latest independently verified public npm distribution at that tag is `2.1.1`.

**Verified publication receipt.** Signed tag object `52d3e8cb76948ab0698c0e4fda6d8ada81a5a9d2` for [`v2.1.1`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.1.1) targets commit `d324e8ebc2752437db1702879b896430bc961f6d`. [npm `ruleblast@2.1.1`](https://www.npmjs.com/package/ruleblast/v/2.1.1) reports integrity `sha512-eJFLnTidG0DrFabzNDktmh7QhypR29coKI69EZ2/JebsZML4I4aMnqNCaQdO+IlacLAhHye3X+tReWOgtWK56A==`; exact-tarball publication means registry `gitHead is absent` rather than invented. The registry download and GitHub Release asset both match the reviewed 120,404-byte tarball with SHA-256 `c736da718b54a6877d8c54167f06b199fcf9ac28cecb8c2e351c595eb4f56900`; the canonical manifest has SHA-256 `56b1c8210bd80dd6c7a877889db131ba305a650913f834451ea07de433e39e6c`. These are independently verified external records, not facts inferred from this checkout.

GitHub and npm metadata were already correct. This patch adds independent crawlable documents so problem queries can resolve to RuleBlast: which files inherit a changed `AGENTS.md`, why `git diff` is insufficient, and the sealed 2→206 case title. A root Action wrapper makes `uses: Kpoiut/ruleblast@v2.1.1` a discoverable GitHub Action entity without a second engine. No fifth action, no extra host class, no keyword stuffing.

## **RELEASED** — `v2.2.0`: Compatible hosts

That release is `2.2.0`. Latest independently verified public npm distribution at that tag is `2.2.0`.

**Verified publication receipt.** Signed tag object `b6c93afb91c0c7b12b97c163cb12dcd2b0b4a864` for [`v2.2.0`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.2.0) targets commit `6f3732fef48ba9a6c0ec4f7a6f9b7381786fb737`. [npm `ruleblast@2.2.0`](https://www.npmjs.com/package/ruleblast/v/2.2.0) reports integrity `sha512-ddfCo5MbaFjUyQa9eHr6D/pBzV9byQzhi30OzfkFSMnLmKdngHMHZsndIqAtNLPlHP6zs9fHeBSz+8lXVtuWZA==`. The registry download is the 128,262-byte tarball with SHA-256 `0d2d9c56e54e032981492afc9e49bad727a26c71526d13a68e6896595622f823`. Registry `gitHead` at publish was `0e2059cf163bcec2cb5c9051be46c6ba68b54365` and is not the 2.2.0 source commit. The GitHub Release serves that same tarball and `ruleblast-companion-2.2.0.vsix`.

One companion adapter at `hosts/vscode` is HOSTED on VS Code and COMPATIBLE on GitHub Copilot Chat, Cursor, Windsurf, Kiro, Antigravity IDE, Codex IDE, Continue, Cline, and Trae. Claude Desktop, ChatGPT/Codex desktop, and Zed reach the same four actions through `--mcp`. Those surfaces are not modeled realities.

Official Agent Skills copies share one canonical body. Workspace MCP configs launch `npx --yes ruleblast@2.2.0 --mcp`. Compact replay metrics compare the packaged 33→106 receipt and a current-worktree diff without adding a fifth action.

No per-editor engine fork, no fifth reality, no product MCP server, no `cursor/editor@1`.

## **SHIPPED TO MAIN** — `v2.2.1`: Companion icon and Windows verify

Signed tag object `aca42df18070b98c3ca2b52c5e3ea6b5ae83f76c` for [`v2.2.1`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.2.1) targets commit `2541576ebc9d8ea3db31bbd62e3df9b78d410c69`. The GitHub Release serves the 115,113-byte `ruleblast-companion-2.2.1.vsix` with SHA-256 `eac0ccbcf4287de56c810481a78fe25597d99484310e5e9cfec9bf13f3dc8bd3`. Companion version is `2.2.1`. Latest independently verified public npm distribution remains `2.2.0`. Do not overwrite Marketplace `2.2.0`.

The companion ships a 128×128 PNG Marketplace icon. Verify builds once before `npm run check`. Candidate install smoke reuses `dist/cli.js` instead of compiling again. Capture-case Windows 8.3 resolution uses `cmd %~sI` with the path in an env var and `windowsVerbatimArguments`. Node's default quoting produced `D:\"C:`. Timeouts stay 15s / 120s. No fifth action, no second engine, no new npm CLI.

## **SHIPPED TO MAIN** — `v2.2.2`: Git-pair overlay

Human `ruleblast diff` Git→Git and Git→WORKTREE can append OTHER TRACKED CHANGES (selected realities) from Git storage blob-object identity, then restate membership as a WORK MAP so later work can tell inherited stacks from independent Git motion, unclassified paths, and already-split surfaces. Companion Diff From renders the prepared adjunct and can explain a listed path. It does not derive overlay membership. Companion and CLI share one control chord (`Ctrl+Alt+R` then `S`/`D`/`E`/`C`) with view-title buttons and explorer/editor explain menus. Scoreboard order is status → control → facts → overlay → sources → explain. The activity bar icon is a `currentColor` SVG so it tints with the workbench; the 128×128 PNG stays the Marketplace icon. Companion version in this increment was `2.2.2`. Not actor telemetry. Not a fifth action. `--json` stays canonical. Probe failure prints an unavailable adjunct line and keeps today's canonical exit.

Verify no longer repeats package or install smoke after `npm run check`; those bodies already run inside check. Published npm CLI remains `2.2.0`. Companion Diff From stays Git→WORKTREE and renders the prepared overlay adjunct.

## **RELEASED** — `v2.3.0`: Overlay, work map, and companion control

That release is `2.3.0`. Latest independently verified public npm distribution is `2.3.0`. Companion version is `2.3.0`. Pack `ruleblast-companion-2.3.0.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

**Verified publication receipt.** Signed tag object `73e0fdf25f68c18380c9db5b459406419f72fc06` for [`v2.3.0`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.3.0) targets commit `7ca69ba262f3250e6e33630ca05c205d9f01e14c`. [npm `ruleblast@2.3.0`](https://www.npmjs.com/package/ruleblast/v/2.3.0) reports integrity `sha512-1G1yAOUMnMQUfVX64YoLbBVKPNrFsX7ivIZ8OhJwL5YQUFyC6EyWYk4mNokyDIh+q7KqeLt9djgQSXxlQ2fn2Q==`. The registry download is the 138,135-byte tarball with SHA-256 `1672bdd9133f960d8658e003b8d7cb77a13b3fbd79c9238a2b009abf2839ba2e`. Registry `gitHead` at publish was `67280fd8b43a53cd262d68058e3b4680410c8d2d` and is not the 2.3.0 source commit. The GitHub Release serves that same tarball and the 125,885-byte `ruleblast-companion-2.3.0.vsix` with SHA-256 `40aca6dbb59bf2b5d19938788f0454baa80abb806802290429aff8c3f255ab60`. These are independently verified external records, not facts inferred from this checkout.

Human `diff` Git↔Git and Git→WORKTREE join Git storage blob-object identity with selected-realities stack delta. The adjunct names that identity law, other-path kinds (added / modified / deleted), WORK MAP membership, and CHANGE ALIGNMENT (`ALIGNED`, `MIXED`, `DIVERGENT`, or `UNRESOLVED`) with an operational gloss. Companion renders the prepared adjunct, themed SVG activity icon, welcome scan/diff/explain/case, toolbar, and `Ctrl+Alt+R` then `S`/`D`/`E`/`C`. Hosts do not derive overlay. `--json` stays canonical. Full-tree replay of 2651980→58e8f75 remains unsealed.

## **SHIPPED TO MAIN** — `v2.3.1`: Identity fixture and Windows root

That increment is `2.3.1`. Latest independently verified public npm distribution remains `2.3.0`. Companion version was `2.3.1`. Pack `ruleblast-companion-2.3.1.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`. Not an npm release.

Staged-index commits prove same-OID mode/kind and gitlink exclusion against `ls-tree`. Repository root is the realpath of `--show-toplevel`, so Windows 8.3 and the long path are one directory. Overlay join uses `blobIdentityKind` and `unionSortedPaths`. Scoreboard control rows are the four actions. Status names CHANGE ALIGNMENT. `--json` stays canonical.

## **RELEASED** — `v2.4.0`: Progressive disclosure

That increment shipped glance, `--paths-only`, `explain --compare`, and explain `PROOF`. Signed tag object `430115f28b62a90bc5838fc696cc5747d46f9ab5` for [`v2.4.0`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.4.0) targets commit `82514d7dc03614094001ec737a7d2bb13402d45a`. The npm version `2.4.0` was unpublished on 18 August 2026 because its tarball README still advertised `ruleblast@2.3.0`; npm does not allow that version number to be reused. Install `ruleblast@2.4.1`. The GitHub tag remains.

Human CLI and the companion renderer project the same canonical result at increasing depth: one-line glance, `--paths-only`, `explain --compare`, then explain `PROOF`. `--json` is unchanged. Glance lives in the editor adapter.

## **RELEASED** — `v2.4.1`: Republished progressive disclosure

This tree is `2.4.1`. Latest independently verified public npm distribution is `2.4.1`. Companion version is `2.4.1`. Pack `ruleblast-companion-2.4.1.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

**Verified publication receipt.** Signed tag object `b26859f3a31bd4b1c3985f966d70bf32432d174f` for [`v2.4.1`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.4.1) targets commit `f80b0d0fb2af6ab0c37d703b1d36a094c9a0cc58`. [npm `ruleblast@2.4.1`](https://www.npmjs.com/package/ruleblast/v/2.4.1) reports integrity `sha512-MTTZpr2qhuMaR4BN9z5LsMe1pORPkbDeNV5Gr8f2GXb0jLI3MoPYaM5rX1CQqtyMePcNEfU4JdHXFYQWiGglOA==`. The registry download is the 144,495-byte tarball with SHA-256 `6c89d285e938fae0e9f5aa717fc0a6403fc48f57d825c1b7310ea01c52231483`. The GitHub Release serves that same tarball and the 137,302-byte `ruleblast-companion-2.4.1.vsix` with SHA-256 `29efd185756292c136312f900eb89115b7a7707b8d30a3d58adc8534f654ebf6`. These are independently verified external records, not facts inferred from this checkout.

Same disclosure as `v2.4.0`, packaged so the tarball README, Action default, and skills advertise `ruleblast@2.4.1`. The GitHub README leads with that disclosure and keeps install, host map, and replay behind details.

## **SHIPPED TO MAIN** — `v2.4.2`: One public descriptor

That increment is `2.4.2`. The independently verified public npm package remains `2.4.1`. The companion version is `2.4.2`. Pack `ruleblast-companion-2.4.2.vsix`. Marketplace listings `2.2.0` and `2.2.1` stay as they are. This increment is on main; people still install `ruleblast@2.4.1`.

Every surface RuleBlast owns now introduces itself the same way: **RuleBlast — Git diff for AI agent repository instructions**. The package, repository, and Marketplace id stay `ruleblast`.

## **SHIPPED TO MAIN** — `v2.4.3`: Domain capability layers

That increment is `2.4.3`. The independently verified public npm package remains `2.4.1`. The companion version is `2.4.3`. Pack `ruleblast-companion-2.4.3.vsix`. Marketplace listings `2.2.0` and `2.2.1` stay as they are. This increment is on main; people still install `ruleblast@2.4.1`.

The roadmap now states the domain ladder this product is built for — instruction files, inheritance, per-agent resolvers, two-state blast, multi-reality provenance, then a deterministic evidence-pinned canonical result. Product-breadth scores are reference-only and do not grade this checkout. On that domain axis the current public product sits near L6, read as L5.5–L6 because vendor loading rules can move.

## **SHIPPED TO MAIN** — `v2.4.4`: Summary and detail of one result

That increment is `2.4.4`. The independently verified public npm package remains `2.4.1`. The companion version is `2.4.4`. Pack `ruleblast-companion-2.4.4.vsix`. Marketplace listings `2.2.0` and `2.2.1` stay as they are. This increment is on main; people still install `ruleblast@2.4.1`.

Default human text stays the summary. `--detail` is the complete human projection of the same canonical bytes: counts, findings, changed and split paths, source digests, line stats, groups, and explain before/after stacks. Packed worktree capture copies tracked files through a bounded pool. Instruction-line restatements, `--compare` pair selection, overlay delete gloss, and MCP parse errors match the contract.

## **RELEASED** — `v2.4.5`: Packed hosts of one result

This tree is `2.4.5`. Latest independently verified public npm distribution is `2.4.5`. Companion version is `2.4.5`. Pack `ruleblast-companion-2.4.5.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

**Verified publication receipt.** Signed tag object `1bbdb7b276bede8e862e1b8c5ccc3d3f32497a13` for [`v2.4.5`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.4.5) targets commit `c599195b1c64cdff215e7380b7fee9d737e0a10e`. [npm `ruleblast@2.4.5`](https://www.npmjs.com/package/ruleblast/v/2.4.5) reports integrity `sha512-nnrLHacDTodnWAypkJZIiolXIMVIOo0TgHy711FK2bT3K3eimc3v6p61AdaH40Y1gSJQ8Z6SBOjYOYAQ55tt4Q==`. Exact-tarball publication means registry `gitHead is absent` rather than invented. The registry download is the 147,397-byte tarball with SHA-256 `9a8b228b0bcf42fc862704fa43f0a27c0b35a2b988a0f67bfd8e276998f950da`. The GitHub Release serves that same tarball and the 142,254-byte `ruleblast-companion-2.4.5.vsix` with SHA-256 `5b45c7fb9daf0e4674de1ab1007a0612e57d8cf11516551aba49739c0a865ea5`. These are independently verified external records, not facts inferred from this checkout.

`--help` and `--version` stay off the analysis graph. The packaged case verifies once. Gemini prepare no longer reads every tracked blob. MCP `diff` uses the same prepared overlay pair as the CLI and accepts `detail`. The companion can show last-result detail without a fifth action.

## **RELEASED** — `v2.4.6`: Spec-driven pack interpreter

This tree is `2.4.6`. Latest independently verified public npm distribution is `2.4.6`. Companion version is `2.4.6`. Pack `ruleblast-companion-2.4.6.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

**Verified publication receipt.** Signed tag object `137dec9cb431d6b6f20869e14252d3f5b8c838b8` for [`v2.4.6`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.4.6) targets commit `44124475babc60bbb73186debe311ab6753d2f6b`. [npm `ruleblast@2.4.6`](https://www.npmjs.com/package/ruleblast/v/2.4.6) reports integrity `sha512-MpYQzjNive82VKCJWqhUCx32/NXHgy8Hm878oCSt4u33y9bZgqLlTpYXPxNWHODZn+CL838IyzKZ1j/ip3SL8g==`. Exact-tarball publication means registry `gitHead is absent` rather than invented. The registry download is the 153,122-byte tarball with SHA-256 `c8438947be110f783b66e2f9746b5bbc6f9941a2bc5776a2a22af23fc063cdd9`. The GitHub Release serves that same tarball and the 148,086-byte `ruleblast-companion-2.4.6.vsix` with SHA-256 `877c565790c2e4b7366ef4ba467c9dd02efc7b0638ddca4fc95fb1faa67d0404`. These are independently verified external records, not facts inferred from this checkout.

The catalog Codex engine is interpreted from `resolver.json`. `createCodexProfile` remains the adapter oracle. The interpreter does not import that adapter. Claude, Gemini, and Copilot still use fingerprint engines because their specs are not yet data-complete. No fifth bundled reality. No `--pack`. A model name is never a reality.

An offline run can say a pinned bundled evidence digest is `CURRENT` or `POSSIBLY_STALE` by comparing committed candidate evidence, without contacting a network. `--json` stays canonical.

Human overlay restates membership as CONTINUE or REJECT so a later agent reading the same result can continue inherited work or reject independent Git motion. That is presentation of the overlay, not a stored session and not repository mutation.

Candidate `npm pack` is offline. Timed-out child commands name their argv, not only `node.exe`. Sequential profile capture stays the prepare-method security property. Fingerprint builtins stay four.

## **SHIPPED TO MAIN** — `v2.4.7`: Sealed evidence and interpreter admission

This tree is `2.4.7`. Latest independently verified public npm distribution remains `2.4.6`. Companion version is `2.4.7`. Pack `ruleblast-companion-2.4.7.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

Offline `--detail` / `--receipt` names a bundled evidence digest `SEALED`, `NO_KNOWN_DRIFT`, or `POSSIBLY_STALE` from committed candidate inventory. That is not a claim the vendor runtime is unchanged. Companion last-result lifecycle stays `CURRENT` / `STALE`. `--json` stays canonical.

Interpreter admission is the list of uninterpretable resolver operations. Fingerprint is not an admission input. Codex remains the only bundled spec the interpreter can execute; `createCodexProfile` stays the adapter oracle. Claude, Gemini, and Copilot stay fingerprint engines because their specs are not data-complete. No fifth bundled reality. No `--pack`. A model name is never a reality.

Overlay REJECT restates OUTSIDE THIS BLAST and says it is not a recommendation to discard the Git change.

The GitHub README causal-proof GIF types the published `ruleblast@2.4.6` CLI and prints output in batches on the sealed 2→206 pair. Those assets are not in the npm tarball.

## **SHIPPED TO MAIN** — `v2.4.8`: Demo chrome and eight-card scoreboard

This tree is `2.4.8`. Latest independently verified public npm distribution remains `2.4.6`. Companion version is `2.4.8`. Pack `ruleblast-companion-2.4.8.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

The README causal-proof GIF is a 35-frame Windows Terminal + PowerShell session of the published `ruleblast@2.4.6` CLI on the sealed 2→206 pair. Loop 10.08 s. No HUD. The visual scoreboard is an eight-card 1,200×630 board. Not a fifth action. Not a product UI. Those assets are not in the npm tarball.

## **SHIPPED TO MAIN** — `v2.4.9`: Flush Windows Terminal tab chrome

This tree is `2.4.9`. Latest independently verified public npm distribution remains `2.4.6`. Companion version is `2.4.9`. Pack `ruleblast-companion-2.4.9.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

The README causal-proof GIF keeps the 35-frame PowerShell session of `ruleblast@2.4.6` on the sealed 2→206 pair. The active tab is flush title-bar chrome (`tab.background` = terminalBackground). Not a fifth action. Not a product UI. Those assets are not in the npm tarball.

## **SHIPPED TO MAIN** — `v2.4.10`: Everyday CLI in the demo, git-log Diff From

This tree is `2.4.10`. Latest independently verified public npm distribution remains `2.4.6`. Companion version is `2.4.10`. Pack `ruleblast-companion-2.4.10.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

The README causal-proof GIF types `git diff --stat HEAD~1`, `ruleblast diff HEAD~1`, and `ruleblast explain <path> --from HEAD~1` on the sealed 2→206 pair. Loop 15 s. Print is snappy; holds are for reading. Companion Diff From can pick HEAD, HEAD~1, a remembered base, or a commit from `git log`. Same four actions. Not a product UI. Those assets are not in the npm tarball.

## **SHIPPED TO MAIN** — `v2.4.11`: Agent index for large repositories

This tree is `2.4.11`. Latest independently verified public npm distribution remains `2.4.6`. Companion version is `2.4.11`. Pack `ruleblast-companion-2.4.11.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

`--index` is presentation of the same four-action result: snapshot FROM/TO, overlay LAW, STACK count, SOURCE, CONTINUE, REJECT, SPLIT. Every row. No sample cap. Truncated overlay remainder names `--index`. MCP `index` and companion Show Index render that map. Not a fifth action. Not a hosted index. RuleBlast does not write that map into the repository. `--json` stays canonical.

## **RELEASED** — `v2.5.0`: Candidate Reality Conformance Lab

This tree is `2.5.0`. Latest independently verified public npm distribution is `2.5.0`. Companion version is `2.5.0`. Pack `ruleblast-companion-2.5.0.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

**Verified publication receipt.** Signed tag object `a6ab195c517815cddfcbea326452e67782477fc9` for [`v2.5.0`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.5.0) targets commit `0afa7e251f70454078b50391cf93e5d7dc19cac5`. [npm `ruleblast@2.5.0`](https://www.npmjs.com/package/ruleblast/v/2.5.0) reports integrity `sha512-+L5dINRsAs5/vW2nSYbBpzwL4NTCAF7/P9corxZtjd/Ats/0VvKTlU61vYVL1xqW5S4MIo9e2LpqHeKS2f1Eag==`. Exact-tarball publication means registry `gitHead is absent` rather than invented. The registry download is the 174,972-byte tarball with SHA-256 `4fede04c92030ed7e98fdf44868f1c334f24b4d66b233ad2bf68cc6967272e4f`. The GitHub Release serves that same tarball and the 157,848-byte `ruleblast-companion-2.5.0.vsix` with SHA-256 `a1933630a594ae617defe530ea2e3bcaa44bba054a797f88e123710f90db1606`. These are independently verified external records, not facts inferred from this checkout.

`--detail` and `--receipt` print the Candidate Reality Conformance Lab. Each bundled pack carries a sealed `oracle.json`. Codex `INTERPRET`/`ORACLE` is a live interpreter match of `sourceDependencyPaths` and projection digests on every existing Codex fixture snapshot packed beside the resolver. Tests still compare those probes to the adapter oracle. Claude, Gemini, and Copilot `FINGERPRINT`/`ADAPTER` is a live fingerprint-adapter match of the same digest fields on every existing fixture snapshot for that surface, plus the sealed missing-operation list; the interpreter still rejects those resolvers. Candidate fixtures carry loadable snapshots and record UNKNOWN only. Projection of a candidate remains `UNEXECUTED`. `RECORDED` is not a passing oracle. Grok Build CLI may grow those fixtures without becoming a public `--reality`. A mismatched oracle fails closed. The lab does not score model quality, compliance, or downstream behavior. Canonical JSON is unchanged. Packed installs include `packs/candidate`. Not a fifth action. Not a fifth bundled reality. Not a `--pack` loader. TypeScript remains the analysis authority; a native capture sidecar is not admitted while the packed 10,000-path budget holds. The 10,000-path packed budget keeps a 2,000 ms ceiling and an efficiency gate at p95 < 1,000 ms. `explain` KEEP is presentation of the last result identity so a later agent can reuse it; RuleBlast does not write a session file.

## **RELEASED** — `v2.5.1`: Copilot interpreted from resolver.json

This tree is `2.5.1`. Latest independently verified public npm distribution is `2.5.1`. Companion version is `2.5.1`. Pack `ruleblast-companion-2.5.1.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

**Verified publication receipt.** Signed tag object `761f547ca00d911cf5c5b826461b82c01ccac900` for [`v2.5.1`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.5.1) targets commit `e60fd18ec4a83ce8aff7488b0bb9203ab4a8cedc`. [npm `ruleblast@2.5.1`](https://www.npmjs.com/package/ruleblast/v/2.5.1) reports integrity `sha512-cAchQ4It9MM4E+CmOMvnviX/zGic+28DvxbHIK908NN+qJ9aLAsi7iPiIEelKBJiY/N4Ie0RxiVeOqhB1TbfhQ==`. Exact-tarball publication means registry `gitHead is absent` rather than invented. The registry download is the 177,160-byte tarball with SHA-256 `32e3cc817f0dd915764f2f9d67c8b3f3f8aa4bc9215c11c8439842ed52ee6c4a`. The GitHub Release serves that same tarball and the 160,281-byte `ruleblast-companion-2.5.1.vsix` with SHA-256 `26ed18e60cf4f4bad0dfef78514f2924d2f14878355547c5644a6220e1b09869`. These are independently verified external records, not facts inferred from this checkout.

The interpreter executes Copilot’s pack: multi-origin discover, select-all, unspecified assemble, frontmatter-glob `applyTo`, unexpanded `@` mention. Projections match `createCopilotProfile` on every packed Copilot fixture. Lab `INTERPRET` / `ORACLE`. The adapter stays the oracle and is not imported by the interpreter. Claude remains fingerprint on `transform`. Gemini remains fingerprint on `onSymlink` and `transform`. Those lists shrank because generic operations now run, not because gaps were hidden. One path primitive. Codex prefix-directory cache. Overlay wall still four analysis pairs. Not a kernel. Not a fifth action. Not a fifth bundled reality.

## **SHIPPED TO MAIN** — `v2.5.2`: Claude interpreted from resolver.json

This tree is `2.5.2`. Latest independently verified public npm distribution remains `2.5.1`. Companion version is `2.5.2`. Pack `ruleblast-companion-2.5.2.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

The interpreter executes Claude’s pack: `strip-html-comments`, `@path` import with the `claude-markdown-v1` lexer, `json-exclude-globs`, frontmatter `paths` with brace-budget matching, and dual-root same-basename partial. Projections match `createClaudeProfile` on every packed Claude fixture. Lab `INTERPRET` / `ORACLE`. The adapter stays the oracle and is not imported by the interpreter. Admission matches the two executable families; Gemini remains fingerprint on `onSymlink` (`partial-unfollowed`) and ordered `assemble`. Frontmatter apply is narrow YAML shared with Copilot and Claude rules. Markdown tokenize is shared with the Gemini adapter (HTML comments stay when that lexer does not strip). Lab recording counts three ORACLE realities, one ADAPTER, and sealed probe counts. Overlay wall still four analysis pairs. Not a kernel. Not a fifth action. Not a fifth bundled reality.

## **SHIPPED TO MAIN** — `v2.5.3`: Gemini interpreted by composed operations

This tree is `2.5.3`. Latest independently verified public npm distribution remains `2.5.1`. Companion version is `2.5.3`. Pack `ruleblast-companion-2.5.3.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

The interpreter executes Gemini’s pack by composing operations the engine already has: select-all, ordered assemble, partial-unfollowed symlinks, `markdown-v1` imports, and `json-union-names`. Projections match `createGeminiProfile` on every packed Gemini fixture. Lab `INTERPRET` / `ORACLE` for Codex, Copilot, Claude, and Gemini. Lexer `markdown-v1` is the shared mechanism; pack id is the lookup key on `--detail`, not on compact `--receipt`. Admission is capability-based, not a third family. Benchmark 10k/GIF uses catalog interpreters and records all four engines. Overlay wall still four analysis pairs. Not a kernel. Not a fifth action. Not a fifth bundled reality.

## **SHIPPED TO MAIN** — `v2.5.4`: Host platform quoting and macOS verify

This tree is `2.5.4`. Latest independently verified public npm distribution remains `2.5.1`. Companion version is `2.5.4`. Pack `ruleblast-companion-2.5.4.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

CLI, MCP, and companion explain CTAs use `hostShellDialect()`: PowerShell on Windows, POSIX on Linux and macOS. MCP no longer hardcodes POSIX. Verify matrix adds `macos-latest` beside ubuntu and windows on Node 20/22/24/26. Select-all prepare keeps the matching origin with each captured path. Overlay wall still four analysis pairs. Not a kernel. Not a fifth action. Not a fifth bundled reality.

## **SHIPPED TO MAIN** — `v2.5.5`: Host Git spawn and shared snapshot entry

This tree is `2.5.5`. Latest independently verified public npm distribution remains `2.5.1`. Companion version is `2.5.5`. Pack `ruleblast-companion-2.5.5.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

Git analysis and Diff From `git log` share `runGit()` with `windowsHide`. Omitted presentation context uses `hostShellDialect()`, so companion Show Detail matches CLI/MCP quoting. Interpreter and Codex/Claude adapter prepare capture entries through `ownSnapshotEntry()`. Overlay wall still four analysis pairs. Not a kernel. Not a fifth action. Not a fifth bundled reality.

## **SHIPPED TO MAIN** — `v2.5.6`: Runtime IDs, not model names

This tree is `2.5.6`. Latest independently verified public npm distribution remains `2.5.1`. Companion version is `2.5.6`. Pack `ruleblast-companion-2.5.6.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

IDs name runtimes, not models. Candidate roster is generic: `xai/grok-build-cli`, `qwen/qwen-code-cli`, `deepseek/dsh-harness`, `moonshot/kimi-code-cli`. `--reality grok-4` is a model name. `--reality xai/grok-build-cli` is a known not-admitted candidate. No public fifth `--reality`. Overlay wall still four analysis pairs. Not a kernel. Not a fifth action. Not a fifth bundled reality.

## **RELEASED** — `v2.5.7`: Exact runtime allowlist

This tree is `2.5.7`. Latest independently verified public npm distribution is `2.5.7`. Companion version is `2.5.7`. Pack `ruleblast-companion-2.5.7.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

**Verified publication receipt.** Annotated tag object `dd46f4a9c08d10a9de1f113092b6036091e0f2da` for [`v2.5.7`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.5.7) targets commit `cf6badd2ab376f1aa7f6f9b1d3be9559c1457503`. [npm `ruleblast@2.5.7`](https://www.npmjs.com/package/ruleblast/v/2.5.7) reports integrity `sha512-SzTP41slyb4hvPPYZ0KHj97SLf8sesfHz2morW/O55tQ9FTG4QoIhYgprxgNNT1YhXdTq5kQBJKDLD+Wm/eQVQ==`. Exact-tarball publication means registry `gitHead is absent` rather than invented. The registry download is the 185,439-byte tarball with SHA-256 `8873e179d261ecb7715b88c9268abcd7233720b40fcb7657bbd024f419c5d426`. The GitHub Release serves that same tarball and the 167,204-byte `ruleblast-companion-2.5.7.vsix` with SHA-256 `afac7b99c17afd07fee7255e6abca78fa04c518416f2cb8a2309b9728b93155e`. These are independently verified external records, not facts inferred from this checkout.

Catalog and candidate ids are an allowlist. No model-name denylist. No invented empty stubs. Forming candidates keep their unversioned id; `@1` is not implied. Candidate JSON names `surface` as data. CLI and MCP share one `HostProcess` for platform quoting. This package includes `2.5.2`–`2.5.6`: Claude and Gemini interpreted from `resolver.json` (all four bundled realities `INTERPRET` / `ORACLE`), host quoting and macOS verify, shared Git spawn and `ownSnapshotEntry()`. Included development commits: `cda8834b3bc79f52123eb4f05019b35d775c9655`, `796c5d9abdde755f5827351358b747ce30260cb1`, `f4154fd063e99f0f6e43e78b2e62ce2516cbdf0e`, `7b99d529355383977ad4589d746fe83c87a59185`, `742e27d07cec76e72a18c40598315e0b11b2b146`, `cf6badd2ab376f1aa7f6f9b1d3be9559c1457503`. Overlay wall still four analysis pairs. Not a kernel. Not a fifth action. Not a fifth bundled reality.

## **SHIPPED TO MAIN** — `v2.5.8`: Sealed runtime calibration and host discovery

This tree is `2.5.8`. Latest independently verified public npm distribution remains `2.5.7`. Companion version is `2.5.8`. Pack `ruleblast-companion-2.5.8.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

Human text, `--index`, `--receipt`, `--detail`, and the companion scoreboard measure runtime-pair disagreement on the same snapshot (`CX≠CC` and the other pairs), including the default two-profile path and newly split / converged pairs on diff. One aggregate split count is not which pair moved. Profile prepare captures each `project` method before the next prepare runs. Pack load fails closed without sealed `calibration.json`. A sealed four-runtime matrix counts every disagreeing catalog pair on one snapshot. Benchmark times all four catalog interpreters on one 10k snapshot. MCP configs pin `ruleblast@2.5.7`. MCP `receipt` is the compact scoreboard. MCP explain accepts `compare`. Companion activates on `.git` without scanning. Empty Select Reality is the default two-profile set. VSCodium and Roo Code share the companion. JetBrains, Visual Studio, Neovim, Windsurf Cascade, and Roo are MCP-discoverable. Sealed `calibration.json` can match a vendor dump or record `NO_INTROSPECTION` on `--detail` only. Compact lab stays engine/proof/probes. Candidate promotion requires an unversioned id, versioned modeled id, evidence revision, resolver digest, five axes, `ORACLE`, and calibration. Overlay wall still four analysis pairs. Not a kernel. Not a fifth action. Not a fifth bundled reality.

## **RELEASED** — `v2.5.9`: Honest calibration, macOS realpath, and MCP flags

This tree is `2.5.9`. Latest independently verified public npm distribution is `2.5.9`. Companion version is `2.5.9`. Pack `ruleblast-companion-2.5.9.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

**Verified publication receipt.** Annotated tag object `f924055b3f646d6ef53d5215a58cdee9e8ad8fdd` for [`v2.5.9`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.5.9) targets commit `8cc3a9f737c344c6f360ba9df5eceeceb170dfa8`. [npm `ruleblast@2.5.9`](https://www.npmjs.com/package/ruleblast/v/2.5.9) reports integrity `sha512-6u2kdervEjkbPjXgEKxJ3oBGmi+b2j3TpkIZJ7kKwWKv9g/cgIH+YtEDBOXq/rcQX+mXqzsl6+EpfUUHWd12hw==`. Exact-tarball publication means registry `gitHead is absent` rather than invented. The registry download is the 204,749-byte tarball with SHA-256 `96debe28b646e914cbb60ed53b8f2c72202b3f241e3cf3958e25cd8f8c22493f`. The GitHub Release serves that same tarball and the 185,323-byte `ruleblast-companion-2.5.9.vsix` with SHA-256 `6aadb190b06442ece123811cc950010cfa4616906553da6bd8f904122aa7ff7f`. These are independently verified external records, not facts inferred from this checkout.

macOS `/var` is a system symlink to `/private/var`. Packing and case capture reject a leaf symlink, not that ancestor. CLI direct-entry compares realpath-canonical file URLs. Compact lab prints `ORACLE` beside `CALIBRATED` so implementation proof is not a vendor dump. Bundled `calibration.json` seals vendor-source observations (`agents_md.rs`, Gemini `memoryDiscovery.ts` / `processImports`, Claude memory docs, Copilot instruction docs) executed offline against fixture snapshots. Probe schema is `ruleblast.runtime-observation.v1`: loaded files, `vendorAssembly` recomputed from those files. Verify re-runs the vendor-source observer; interpreter payload equality is `ORACLE`, not the `CALIBRATED` gate. It is not `oracle.json`, not `projectionDigests`, and not interpreter-shaped `contributions`. A vendor-dump record must name the observed runtime, revision, `sealed-offline-dump`, artifact digest of the sealed probes, and probe schema; mismatch fails closed. `NO_INTROSPECTION` remains the label when a dump is absent. The vendor CLI is not live analysis authority. MCP `pathsOnly` and `witness` are the same presentation flags as the CLI. Candidate `admission.json` is not a public `--reality`. Payload relation uses units as the law; `normalizedPayloadDigest` is a seal of those units and fails closed when it lies. `projectionDigest` is the semantic stack identity seal and fails closed when it lies. `ORACLE` stores that identity seal. Overlay `DIVERGENT` is a proven DIFFERENT pair event on an observed other path. Replay metrics fold from path rows. Pair topology is one path-event walk: PAIR/NEWPAIR/CONVPAIR/INDPAIR counts are the fold of PAIRPATH/NEWPAIRPATH/CONVPAIRPATH/INDPAIRPATH rows. Path `isSplit` / `payloadRelation` and split counts fold from those same events. Benchmark counts six catalog pairs and four `CALIBRATED` rows. This package includes `2.5.8`: `384d4c621d6226854a67773e2000ddeb0b0b139f`. Identity, vendor-source calibration, and pair topology: `e841da784e18b87f706bd266aad7c07b2f1d2b60`. Companion `Uri.joinPath`: `8cc3a9f737c344c6f360ba9df5eceeceb170dfa8`. Overlay wall and the 5 s clock are unchanged. Not a kernel. Not a fifth action. Not a fifth bundled reality.

## **SHIPPED TO MAIN** — `v2.5.10`: Fail-closed allow, MCP bytes, and Git path encoding

This tree is `2.5.10`. Latest independently verified public npm distribution remains `2.5.9`. Companion version is `2.5.10`. Pack `ruleblast-companion-2.5.10.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

`.ruleblast-allow` empty/garbage/unreadable is `ask`. MCP `Content-Length` is UTF-8 bytes with a 32 MiB ceiling; tools carry read-only annotations. Git pathnames that are not UTF-8 fail closed. Copilot discover includes `.claude/CLAUDE.md` from the vendor-doc table retrieved 24 August 2026. Extraction reviews bind over-limit modules by path and digest; none currently exceed 400 lines. Benchmark counts `NO_INTROSPECTION`. Gemini pin is not restated as a new loader. Overlay wall still four analysis pairs. Not a kernel. Not a fifth action. Not a fifth bundled reality.

## **NEXT** — Vendor CLI dump when a surface publishes one

Bundled packs are `CALIBRATED` from sealed vendor-source observation in `2.5.9`. A later vendor-published CLI dump (`codex debug agents-md` or equivalent) can replace that observation without making that CLI the analysis authority.

## **HORIZON** — `v3`: Prove the overlay at corpus scale

Ordered product direction after `v2.3.0`. Not current support. Each step sharpens the same instruction-semantics knife. None of these is a climb toward a harness, dashboard, or platform.

- **`v3.0`** — Corpus-scale evidence-revision: every sealed pack and candidate sidecar compared offline. The first packed reveal is in `v2.4.6`.
- **`v3.1`** — Sealed full-tree public overlay replay of a licensed pair (the 2651980→58e8f75 shape, not a changed-set subset). Fail closed if OTHER disagrees with the Git identity oracle.
- **`v3.2`** — Recomputable overlay card: same prepared pair, same adjunct bytes, never an independent authority. Canonical JSON stays adjunct-free.
- **`v3.3`** — Instruction-pressure corpus: N instruction-line edits → M inherited OTHER paths, each row a Blast Case, no model-quality claim.

Each step must still answer the feature admission test. A corpus that needs a hosted index or a fifth action waits outside.

## **HORIZON** — `v4`: Stack debugger, still one product

Crazier, still the same small knife: deeper replay and last-result explain, not a wider product. Not a calendar. Not a promise that editor magic already exists.

- **`v4.0`** — Time-travel explain: one path, two immutable refs, selected realities, from Git bytes only. No claim that a model would have answered the same way.
- **`v4.1`** — Public identity-oracle adjunct: prove OTHER equals `git diff-tree --raw` minus same-OID mode/type and gitlinks, without the engine calling `diff-tree` on the analysis path.
- **`v4.2`** — First data-only external Reality Pack that reproduces a bundled golden without an executable escape hatch. Still no fifth bundled reality before packs.
- **`v4.3`** — Multi-worktree join: two tracked worktrees, one storage format, one overlay, no network.
- **`v4.4`** — Companion as stack debugger: from the last result, select an instruction source line and list inherited consumers. Last-result explain, not a fifth action, not a WebView dashboard.
- **`v4.5`** — User-owned signed overlay witness, offline, no telemetry, discarded when the prepared pair is gone.
- **`v4.6`** — “What would this path have inherited” at an arbitrary historical commit, Git-only, uncertainty preserved.

A `v4` idea that needs actor attribution, quality scores, auto-fix, or a hosted graph is a different project.

## **EXPLORING** — Questions before commitments

These are unresolved questions, not current support or promised work:

- Which third surface has both stable official semantics and enough demand to pass the `v1.3.0` gate?
- Can the finite Reality Pack representation reproduce every bundled golden result without an executable escape hatch?
- How should an offline run reveal that a pinned evidence revision may have drifted without making a network request? The first packed reveal is in `v2.4.6`; corpus-scale drift remains open.
- Can Qwen Code CLI, DeepSeek Harness, Kimi Code CLI, or ZCode pass the admission gate as data-only Reality Packs without becoming model-name realities? Grok Build CLI is a forming candidate with lab fixtures, not public `--reality`.
- Can an optional native worktree capture sidecar beat the TypeScript packed 10,000-path budget on a measured million-path repository without becoming a second analysis engine? Not admitted in `2.5.0`. npm must not require rustc or a Go toolchain.
- Cursor Composer, GLM, Grok the model, and Llama are not realities. A host or a model behind a host is not a modeled runtime.
- Can a licensed corpus of Blast Cases cover monorepos, nested instructions, imports, exclusions, and uncertain order without publishing sensitive content?
- How many documented rule realities are genuinely distinct once equivalent projections are clustered by evidence rather than brand?
- Can a Git storage blob-object identity join with selected-realities stack delta be admitted as a public product dimension? Human Git-pair and Git→WORKTREE overlay plus CHANGE ALIGNMENT are in `v2.3.0` RELEASED. Full-tree replay of 2651980→58e8f75 is still unsealed.
- How should a pinned resolver keep proving fidelity after a vendor loading change without treating the old pin as current truth?
- When a general-purpose harness needs an exact instruction-stack delta between two Git states, is the right move to call this analysis primitive rather than re-derive it?

`--reality github/copilot-cli@1` and `--reality google/gemini-cli@1` are the admitted opt-in surfaces. Copilot VS Code, hosted Copilot, Gemini Code Assist, and Cursor editor semantics remain examples only. CLI, editor, and hosted modes remain distinct surfaces whenever their documented loading semantics differ. A host that can run RuleBlast is not thereby MODELED.

## Permanent scope firewall

Across every stage, RuleBlast remains:

- one analysis npm package and four public actions;
- local, read-only, deterministic, and text-first;
- free of a hosted service, dashboard, second analysis engine, model call, telemetry, auto-fix, and repository mutation;
- free of a CI/CD product, security scanner, agent framework, and universal configuration registry;
- capped at three runtime dependencies unless removing the cap is supported by measured, reviewable evidence;
- capped at four bundled realities; no fifth before Reality Packs;
- at most two host classes: the terminal reference host and one VS Code-compatible companion renderer. Cursor, Windsurf, Kiro, Antigravity, VSCodium, and Roo Code share that companion. `--mcp` is a transport of the four actions, not a third host class.

The 1.6 line admits one product dimension per release: 1.6.0 is the fourth reality, 1.6.1 is the companion host, 1.6.2 is last-result explain and shared visual presentation. A proposal that needs a fifth action, arbitrary executable extension, hidden network access, or host-specific resolver is a different project.

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
