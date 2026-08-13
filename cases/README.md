# Blast Case receipts

This directory accepts only promoted receipts from real, public repositories. A receipt records the output of RuleBlast's production Git snapshot and diff-analysis pipeline; it retains repository-relative result paths but does not copy instruction-file or source-file contents.

The path is derived from captured data:

```text
cases/{owner}__{repo}/{baseSha12}..{headSha12}.json
```

Each file is canonical single-line JSON with one trailing LF. It records the canonical public repository URL, full immutable base and head commit ids, resolver revision, canonical result core, SHA-256 digest of that core before any trailing LF, and producer provenance: the clean RuleBlast Git commit, package version, fresh build-artifact digest, and the committed-lock-bound digest of the build/runtime dependency closure. Local checkout paths are forbidden.

`releaseReproductionCommand` names the command intended for the future `1.0.0` artifact. It is not a claim that the package is currently published or runnable; the producer fields remain the current truth until release publication and byte-for-byte reproduction verify that pending command.

`scripts/capture-case.mjs` requires an existing local checkout and an installed development toolchain. It ties a canonical `https://github.com/{owner}/{repo}` identifier to one unambiguous configured GitHub remote, accepts only full commit ids that Git resolves back to those exact ids, builds the clean producer into a fresh contained artifact, computes the destination, and publishes with exclusive no-overwrite semantics. It performs no clone, fetch, model, or other network call; public visibility and publication permission remain promotion checks.

## Promotion gate

A JSON receipt enters this directory only after a local-only pilot covers at least 25 real instruction-changing commits, produces at least five useful non-obvious results, and leaves no unresolved count-changing P0/P1 defect. The chosen repository must be public, and its license or explicit permission must allow publication of the derived receipt.

No synthetic fixture, mutable branch, handwritten metric, or unverified pilot entry can satisfy that gate.

The gate is now complete. The first promoted case captures the public RuleBlast repository from [`27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8`](https://github.com/Kpoiut/ruleblast/commit/27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8) to [`e420008a1c10c5c328e506247560117f4d40b855`](https://github.com/Kpoiut/ruleblast/commit/e420008a1c10c5c328e506247560117f4d40b855). Its 33 instruction-line edits changed all 106 candidate stacks for both profiles, with zero current split, partial, unknown, or indeterminate paths. The [receipt](kpoiut__ruleblast/27d52e2cd6ee..e420008a1c10.json) records the full canonical result and producer provenance; its npm reproduction command remains pending until `1.0.0` is actually published.
