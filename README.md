<h1 align="center">RuleBlast</h1>

<p align="center">
  <strong>Git diff for invisible repository instructions.</strong><br>
  See where <code>AGENTS.md</code> and <code>CLAUDE.md</code> changes land—and where evidence-pinned Codex and Claude Code projections differ.
</p>

<p align="center">
  <img src="assets/ruleblast-eye.webp" width="520" alt="The original RuleBlast eye">
</p>

<p align="center">
  <sub>Local · read-only · deterministic · zero telemetry · no model call</sub>
</p>

<p align="center">
  <img src="assets/ruleblast-causal-proof.gif" width="1200" alt="A verified RuleBlast causal proof: two instruction-line edits change 206 projected path stacks, then one affected path is traced to its exact source">
</p>

## Two lines. 206 path stacks. One exact cause.

**2 instruction-line edits → 206 tracked paths changed stack.**

This is an immutable comparison from the public Apache-2.0 [`openai/codex`](https://github.com/openai/codex) repository, not a synthetic fixture. The commit deletes six lines across three files. Two deleted lines belong to one nested [`AGENTS.md`](https://github.com/openai/codex/blob/8fcf2ad931b90589dd29a571f367e3185d26bbe0/codex-rs/tui/src/bottom_pane/AGENTS.md); RuleBlast traces the resulting projection change across the affected subtree.

| Git records | RuleBlast reveals |
|---|---|
| 3 files, 6 deleted lines | 2 instruction-line edits |
| 1 changed instruction source | 206 tracked paths changed stack |
| — | 4,476 tracked paths remained unchanged |
| — | Codex changed: 206 · Claude Code changed: 0 |

Those counts are projected-stack transitions for `openai/codex-cli@1` and `anthropic/claude-code-cli@1`. The profiles already differed before this edit (`DIFFERENT → DIFFERENT`), so no path newly split across profiles.

One affected path is [`codex-rs/tui/src/bottom_pane/action_required_title.rs`](https://github.com/openai/codex/blob/f0f483e8b2a2630bf8dfa5f8451e81eba20def6c/codex-rs/tui/src/bottom_pane/action_required_title.rs). Its root `AGENTS.md` source stayed unchanged; its nested source moved from digest `eee0eae7…` (757 bytes) to `d6e6791a…` (564 bytes). The Codex projection changed, while Claude Code selected no source for that path.

The [full comparison](https://github.com/openai/codex/compare/8fcf2ad931b90589dd29a571f367e3185d26bbe0...f0f483e8b2a2630bf8dfa5f8451e81eba20def6c) is pinned to [`8fcf2ad931b90589dd29a571f367e3185d26bbe0`](https://github.com/openai/codex/commit/8fcf2ad931b90589dd29a571f367e3185d26bbe0) → [`f0f483e8b2a2630bf8dfa5f8451e81eba20def6c`](https://github.com/openai/codex/commit/f0f483e8b2a2630bf8dfa5f8451e81eba20def6c), with repository license evidence pinned at [`f73a072…/LICENSE`](https://github.com/openai/codex/blob/f73a07224653c2cc775b3f84f129b872b1e08f85/LICENSE). It was evaluated on 2026-08-13 using RuleBlast implementation [`517cc07af9d2d7dafb48b9f2b3cfaecd85444a1d`](https://github.com/Kpoiut/ruleblast/commit/517cc07af9d2d7dafb48b9f2b3cfaecd85444a1d), resolver revision 1, and the two profile IDs above. Repeated production runs produced the same 150,404,342 canonical bytes, SHA-256 `5659e4cb83051aeaa246c3b45fad75698754806db30f4e710849d220d12ee9d2`.

Across 4,682 candidate paths, the tool reported exactly zero partial, zero unknown, and zero indeterminate results for the modeled surfaces. That is scoped projection evidence—not a claim about model compliance or response behavior.

Run the same comparison from an `openai/codex` checkout containing both immutable commits:

```bash
ruleblast diff 8fcf2ad931b90589dd29a571f367e3185d26bbe0 --to f0f483e8b2a2630bf8dfa5f8451e81eba20def6c
```

Git shows the changed source. RuleBlast shows every path that inherits the second diff—and why.

## Install

The commands below define the exact `1.0.2` install interface. First verify that npm exposes the pinned version; a source checkout never proves registry availability. RuleBlast requires Node.js 20 or newer:

```bash
node --version
npm view ruleblast@1.0.2 version
```

When npm reports `1.0.2`, start inside the Git repository whose tracked instruction projection you want to inspect. `npx` downloads and runs the complete pinned package through npm's cache without a permanent global install:

```bash
cd <your-git-repository>
npx --yes ruleblast@1.0.2 .
```

That single `npx` command downloads the full pinned CLI and immediately scans the repository. To inspect the interface before analysis, `--help` works from any directory:

```bash
npx --yes ruleblast@1.0.2 --help
```

Analysis commands require a Git repository; `NOT_REPOSITORY` means to `cd` into one first. If a diff reports `REF_NOT_FOUND`, replace `HEAD~1` with an existing commit or ref from that repository.

A global install will download the full CLI once and expose `ruleblast` on your command path:

```bash
npm install --global ruleblast@1.0.2
ruleblast --version
ruleblast --help
ruleblast
```

For a repository-owned tool version, install it locally and commit the resulting package lock:

```bash
npm install --save-dev --save-exact ruleblast@1.0.2
npx ruleblast --version
npx ruleblast --help
npx ruleblast
```

The release gate covers Node.js 20, 22, 24, and 26 on Windows and Linux. It executes the installed `.cmd` through both Command Prompt and PowerShell on Windows, and the POSIX shim through bash on Linux. A registry upgrade from exact `1.0.1` to `1.0.2` remains conditional until both versions exist publicly, each npm `dist.integrity` matches its authorized durable artifact, and the guarded `v1.0.2` tag workflow passes. That dispatched workflow proves the install lifecycle; it does not by itself prove publication or artifact parity. The four v1 actions stay available through the one-command form:

```bash
# scan the current repository
npx --yes ruleblast@1.0.2 .

# compare a base commit with the tracked worktree
npx --yes ruleblast@1.0.2 diff HEAD~1

# explain one tracked path across that transition
npx --yes ruleblast@1.0.2 explain packages/api/internal/refund.ts --from HEAD~1

# inspect the packaged verified public-repository case after installation
npx --yes ruleblast@1.0.2 case
```

Use an explicit uninstall before reinstalling the same scope. This makes the reversible boundary visible and avoids treating an in-place write as proof of cleanup:

```bash
# remove the global CLI
npm uninstall --global ruleblast

# reinstall the global CLI at the pinned version
npm install --global ruleblast@1.0.2

# remove the project-local CLI
npm uninstall --save-dev ruleblast

# reinstall the project-local CLI at the pinned version
npm install --save-dev --save-exact ruleblast@1.0.2
```

If a global install reports a permission error, use the `npx` or project-local form instead of elevating the installer. If npm reports damaged cache metadata, verify the cache and retry the exact version:

```bash
npm cache verify
npx --yes ruleblast@1.0.2 --help
```

For a source build, use the `v1.0.2` release-source tag after it is visible on GitHub. This path still requires npm dependency access or a populated npm cache; it is not a workaround for a complete registry outage:

```bash
git clone --branch v1.0.2 --depth 1 https://github.com/Kpoiut/ruleblast.git
cd ruleblast
npm ci --ignore-scripts
npm run build
node dist/cli.js --version
node dist/cli.js --help
node dist/cli.js .
node dist/cli.js case --json
```

## Run the verified case

RuleBlast has also captured its own public repository across two immutable commits: [`27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8`](https://github.com/Kpoiut/ruleblast/commit/27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8) → [`e420008a1c10c5c328e506247560117f4d40b855`](https://github.com/Kpoiut/ruleblast/commit/e420008a1c10c5c328e506247560117f4d40b855).

The 33 instruction-line edits changed the projected stack for all 106 of 106 tracked candidate paths. Both pinned profiles changed on all 106 paths, while the two resulting profile payloads remained aligned: zero current split paths, zero partial paths, zero unknown paths, and zero indeterminate paths. That distinction matters—a repository-wide blast does not necessarily create two different rule realities.

The checked-in [canonical receipt](cases/kpoiut__ruleblast/27d52e2cd6ee..e420008a1c10.json) binds those metrics to immutable refs, resolver revision 1, core digest `1e907a88ed648ebbd68b4f588c3bd09058ab7714e8f85a3f2d4a1c60e5a40938`, and producer provenance without copying source contents. Its historical `npx ruleblast@1.0.0 ...` reproduction command remains byte-for-byte intact.

`case` reads and verifies that exact promoted receipt. It works outside a Git checkout, performs no network or model call, and does not rerun the analysis from unavailable source bytes:

```bash
npx --yes ruleblast@1.0.2 case
npx --yes ruleblast@1.0.2 case --json
npx --yes ruleblast@1.0.2 case --explain .github/ISSUE_TEMPLATE/missing-blast.yml
```

<details>
<summary><strong>Exact packaged-case terminal transcript</strong></summary>

This is production CLI output over the packaged, verified receipt:

```text
RULEBLAST · VERIFIED CASE · kpoiut/ruleblast · 27d52e2cd6ee → e420008a1c10

33 instruction-line edits.

106
tracked paths changed stack.

No paths newly split across profiles.

The largest blast starts at ./.

Pick one path. See every source:
  ruleblast case --explain .github/ISSUE_TEMPLATE/missing-blast.yml

Scope: 106 tracked paths · repository-only · resolver revision 1
```

</details>

## Explain one path

The overview is a doorway, not the proof. Drill into the same immutable case and inspect each recorded selected, empty, imported, applied, excluded, or unresolved source:

```bash
npx --yes ruleblast@1.0.2 case --explain .github/ISSUE_TEMPLATE/missing-blast.yml
```

<details>
<summary>Receipt provenance and exact reproduction</summary>

The receipt was produced by the production Git snapshot, profile, impact, and canonicalization path. The packaged command verifies the full receipt SHA-256, canonical single-line encoding, repository and ref identity, resolver revision, and core digest before presenting its `resultCore` directly.

Run the source proof from the `v1.0.2` release source after the tag is visible:

```bash
git clone --branch v1.0.2 --depth 1 https://github.com/Kpoiut/ruleblast.git
cd ruleblast
npm ci --ignore-scripts
npm run build
node dist/cli.js --version
node dist/cli.js case --json
```

The receipt's historical reproduction command is retained exactly as captured:

```bash
npx ruleblast@1.0.0 diff 27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8 --to e420008a1c10c5c328e506247560117f4d40b855 --json
```

That command requires a checkout containing both commits. The packaged `case` command is the portable inspection path and never substitutes mutable refs for the recorded identities.

</details>

## Scope

RuleBlast v1 is deliberately one small instrument:

| In | Out |
|---|---|
| Git commit and tracked-worktree snapshots | untracked, ignored, user, managed, or session instructions |
| Codex CLI and Claude Code CLI repository projections | editor, hosted, or similarly branded surfaces with different semantics |
| `scan`, `diff`, `explain`, and `case` actions | mutation, sync, generation, scoring, or auto-fix |
| deterministic text and canonical JSON | network calls, model calls, telemetry, dashboard, or product UI |

An unresolved boundary remains visible as `PARTIAL`, `UNKNOWN`, or `INDETERMINATE`; it is never cleaned up for a stronger headline.

Read the stable [behavior and result contract](CONTRACT.md) for the exact comparison context, metric definitions, evidence boundary, and non-claims.

## How it works

1. Capture a deterministic snapshot from a Git commit or the tracked worktree; packaged cases load a verified immutable result receipt.
2. Project each tracked path through evidence-pinned profile semantics for `openai/codex-cli@1` and `anthropic/claude-code-cli@1`.
3. Compare normalized repository payloads and projection fingerprints without guessing through unknown order or unsupported boundaries.
4. Render the blast, then keep each count traceable to path transitions, changed instruction sources, and findings.

The core stays profile-neutral: resolver adapters produce the same canonical projection shape, and the impact engine does not branch on vendor names.

## Examples

The optional positional path is a filesystem starting point used to discover the repository; scan still analyzes the repository's tracked candidate inventory.

```bash
# Inspect the current tracked repository
npx --yes ruleblast@1.0.2 .

# Discover the repository from a nested filesystem path, then scan it
npx --yes ruleblast@1.0.2 packages/api/internal

# Compare a commit with the tracked worktree
npx --yes ruleblast@1.0.2 diff HEAD~1

# Inspect one path across that transition
npx --yes ruleblast@1.0.2 explain packages/api/internal/refund.ts --from HEAD~1

# Emit deterministic machine-readable output
npx --yes ruleblast@1.0.2 diff HEAD~1 --json
```

## Contribute a Blast Case

The most useful contribution is one small result that challenges the resolver or makes the second diff surprising. A Blast Case is atomic: official evidence, retrieval date, before manifest, after manifest, expected canonical JSON, and one sentence explaining the surprise.

Promoted public-repository evidence lives under [`cases/`](cases/README.md) as a source-content-free canonical receipt: immutable refs, resolver revision, result core, digest, producer provenance, and an exact versioned reproduction command. The capture tool analyzes an existing checkout through the same production pipeline and derives the receipt path; it cannot overwrite an accepted case. Only receipts that pass the field-evidence gate can become a packaged `case`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for immutable-ref, publication-permission, rejection, and test requirements, or open a focused [wrong blast](.github/ISSUE_TEMPLATE/wrong-blast.yml), [missing blast](.github/ISSUE_TEMPLATE/missing-blast.yml), [weird blast](.github/ISSUE_TEMPLATE/weird-blast.yml), or [profile evidence](.github/ISSUE_TEMPLATE/profile-evidence.yml) form.

The [pull request template](.github/PULL_REQUEST_TEMPLATE.md) keeps reviews test-first and inside the product boundary. Sensitive reports follow [SECURITY.md](SECURITY.md); project participation follows the [Code of Conduct](CODE_OF_CONDUCT.md). The original [RuleBlast eye](assets/ruleblast-eye.webp) remains the single repository and packaged mark shown above.

## Roadmap

The `1.0.2` build carries the hardened architecture, verified packaged case, exact install interface, packed-install proof, field pilot, first real receipt, and the adoption/operability work described in the roadmap. Registry, tag, and GitHub Release availability remain independently verifiable external facts rather than claims inferred from repository prose. Future stages are labeled by maturity and evidence gate rather than dates.

Today: Codex + Claude Code.

The profile seam is already there for the rest.

Two agents share this repo.
How many rule realities are still hiding in it…?

Read [ROADMAP.md](ROADMAP.md) for the release gates, Ground-Truth Hardening, Blast Receipts, one evidence-gated third reality, declarative Reality Packs, and an eventual many-reality diff. Candidate surfaces are not current support.

RuleBlast is licensed under [Apache-2.0](LICENSE). Changes are recorded in [CHANGELOG.md](CHANGELOG.md).
