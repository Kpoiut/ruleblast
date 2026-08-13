# RuleBlast

![RuleBlast eye](assets/ruleblast-eye.webp)

## 33 instruction-line edits. 106 tracked paths changed stack.

### One verified public repository. Both profiles changed. Zero uncertainty.

Git shows the first diff. RuleBlast finds the second.

That result comes from RuleBlast's own public repository across two immutable Git commits. The packaged receipt records every path transition for `AGENTS.md` and `CLAUDE.md`, binds the result to its core digest, and carries no copied source contents. Codex and Claude Code can share a repository without receiving the same repository instructions. RuleBlast makes that difference inspectable—locally, without calling a model, and with every counted path tied back to its sources.

## Install

The commands below define the exact `1.0.1` install interface. First verify that npm exposes the pinned version; a source checkout never proves registry availability. RuleBlast requires Node.js 20 or newer:

```bash
node --version
npm view ruleblast@1.0.1 version
```

When npm reports `1.0.1`, the shortest path needs no permanent global install. `npx` downloads and runs the complete pinned package through npm's cache:

```bash
npx --yes ruleblast@1.0.1 --help
cd <your-git-repository>
npx --yes ruleblast@1.0.1 .
```

`--help` works from any directory. Analysis commands require a Git repository; `NOT_REPOSITORY` means to `cd` into one first. If a diff reports `REF_NOT_FOUND`, replace `HEAD~1` with an existing commit or ref from that repository.

A global install will download the full CLI once and expose `ruleblast` on your command path:

```bash
npm install --global ruleblast@1.0.1
ruleblast --version
ruleblast --help
ruleblast
```

For a repository-owned tool version, install it locally and commit the resulting package lock:

```bash
npm install --save-dev --save-exact ruleblast@1.0.1
npx ruleblast --version
npx ruleblast --help
npx ruleblast
```

These npm commands are verified in PowerShell or Command Prompt on Windows and in bash on Linux. The four v1 actions stay available through the one-command form:

```bash
# scan the current repository
npx --yes ruleblast@1.0.1 .

# compare a base commit with the tracked worktree
npx --yes ruleblast@1.0.1 diff HEAD~1

# explain one tracked path across that transition
npx --yes ruleblast@1.0.1 explain packages/api/internal/refund.ts --from HEAD~1

# inspect the packaged verified public-repository case after installation
npx --yes ruleblast@1.0.1 case
```

Use an explicit uninstall before reinstalling the same scope. This makes the reversible boundary visible and avoids treating an in-place write as proof of cleanup:

```bash
# remove the global CLI
npm uninstall --global ruleblast

# reinstall the global CLI at the pinned version
npm install --global ruleblast@1.0.1

# remove the project-local CLI
npm uninstall --save-dev ruleblast

# reinstall the project-local CLI at the pinned version
npm install --save-dev --save-exact ruleblast@1.0.1
```

If a global install reports a permission error, use the `npx` or project-local form instead of elevating the installer. If npm reports damaged cache metadata, verify the cache and retry the exact version:

```bash
npm cache verify
npx --yes ruleblast@1.0.1 --help
```

For a source build, use the `v1.0.1` release-source tag after it is visible on GitHub. This path still requires npm dependency access or a populated npm cache; it is not a workaround for a complete registry outage:

```bash
git clone --branch v1.0.1 --depth 1 https://github.com/Kpoiut/ruleblast.git
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
npx --yes ruleblast@1.0.1 case
npx --yes ruleblast@1.0.1 case --json
npx --yes ruleblast@1.0.1 case --explain .github/ISSUE_TEMPLATE/missing-blast.yml
```

## Terminal transcript

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

## Explain one path

The overview is a doorway, not the proof. Drill into the same immutable case and inspect each recorded selected, empty, imported, applied, excluded, or unresolved source:

```bash
npx --yes ruleblast@1.0.1 case --explain .github/ISSUE_TEMPLATE/missing-blast.yml
```

<details>
<summary>Receipt provenance and exact reproduction</summary>

The receipt was produced by the production Git snapshot, profile, impact, and canonicalization path. The packaged command verifies the full receipt SHA-256, canonical single-line encoding, repository and ref identity, resolver revision, and core digest before presenting its `resultCore` directly.

Run the source proof from the `v1.0.1` release source after the tag is visible:

```bash
git clone --branch v1.0.1 --depth 1 https://github.com/Kpoiut/ruleblast.git
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
npx --yes ruleblast@1.0.1 .

# Discover the repository from a nested filesystem path, then scan it
npx --yes ruleblast@1.0.1 packages/api/internal

# Compare a commit with the tracked worktree
npx --yes ruleblast@1.0.1 diff HEAD~1

# Inspect one path across that transition
npx --yes ruleblast@1.0.1 explain packages/api/internal/refund.ts --from HEAD~1

# Emit deterministic machine-readable output
npx --yes ruleblast@1.0.1 diff HEAD~1 --json
```

## Contribute a Blast Case

The most useful contribution is one small result that challenges the resolver or makes the second diff surprising. A Blast Case is atomic: official evidence, retrieval date, before manifest, after manifest, expected canonical JSON, and one sentence explaining the surprise.

Promoted public-repository evidence lives under [`cases/`](cases/README.md) as a source-content-free canonical receipt: immutable refs, resolver revision, result core, digest, producer provenance, and an exact versioned reproduction command. The capture tool analyzes an existing checkout through the same production pipeline and derives the receipt path; it cannot overwrite an accepted case. Only receipts that pass the field-evidence gate can become a packaged `case`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for immutable-ref, publication-permission, rejection, and test requirements, or open a focused [wrong blast](.github/ISSUE_TEMPLATE/wrong-blast.yml), [missing blast](.github/ISSUE_TEMPLATE/missing-blast.yml), [weird blast](.github/ISSUE_TEMPLATE/weird-blast.yml), or [profile evidence](.github/ISSUE_TEMPLATE/profile-evidence.yml) form.

## Roadmap

The `1.0.1` release tree carries the hardened architecture, verified packaged case, exact install interface, packed-install proof, field pilot, and first real receipt. Registry, tag, and GitHub Release availability remain independently verifiable external facts rather than claims inferred from repository prose. Future stages are labeled by maturity and evidence gate rather than dates.

Today: Codex + Claude Code.

The profile seam is already there for the rest.

Two agents share this repo.
How many rule realities are still hiding in it…?

Read [ROADMAP.md](ROADMAP.md) for the release gates, Ground-Truth Hardening, Blast Receipts, one evidence-gated third reality, declarative Reality Packs, and an eventual many-reality diff. Candidate surfaces are not current support.

RuleBlast is licensed under [Apache-2.0](LICENSE). Changes are recorded in [CHANGELOG.md](CHANGELOG.md).
