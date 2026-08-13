# Changelog

All notable user-visible changes to RuleBlast are recorded here. The project has not published an npm release yet.

## Unreleased

### Added

- Deterministic Git commit, tracked-worktree, and manifest fixture snapshots.
- Evidence-pinned `openai/codex-cli@1` and `anthropic/claude-code-cli@1` repository profiles.
- Profile-neutral current and diff impact analysis with complete, partial, unknown, and indeterminate states preserved.
- Four CLI actions: scan, diff, explain, and demo, with deterministic text and canonical JSON output.
- A packaged `DEMO FIXTURE` that exercises the production pipeline and offers a one-path explanation.
- A stable public behavior contract, contribution unit, long-horizon roadmap, and focused issue forms.
- A no-overwrite Blast Case capture path for canonical, source-content-free receipts from immutable public Git commits; promotion is protected by the field-evidence gate.
- The first promoted real-repository receipt, covering RuleBlast commits `27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8` through `e420008a1c10c5c328e506247560117f4d40b855`: 33 instruction-line edits changed all 106 candidate stacks for both profiles, with zero split, partial, unknown, or indeterminate paths.

### Release state

- The ground-truth core is merged to main as development code.
- Packed-install, package allowlist, side-effect, performance, field-pilot, and first-receipt gates are complete on main.
- `v1.0.0` remains `IN BUILD`: explicit release authority, the `1.0.0` package version, an immutable tag, npm publication, and verification of the receipt's release reproduction command are still pending.
