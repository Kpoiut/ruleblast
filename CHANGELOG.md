# Changelog

All notable user-visible changes to RuleBlast are recorded here.

## 1.4.3 — SHIPPED TO MAIN

- Dual skill discovery: Codex `.agents/skills` and Claude Code `.claude/skills` (official project path). Same four routes and ask-first allow gate. No new surface and no fifth action.

## 1.4.2 — SHIPPED TO MAIN

- Compact `--receipt` scoreboard box. User-owned on/off via `RULEBLAST_AGENT_ALLOW` or `.ruleblast-allow`. Agents default to ask. No fifth action, no product UI, no live agent telemetry, and RuleBlast never writes the allow file.

## 1.4.1 — SHIPPED TO MAIN

- Compact 1,200×360 visual scoreboard with Git/Codex/Claude/unchanged/uncertainty/budget dials and the commands that reproduce them.
- Moved the optional composite Action to `.github/actions/ruleblast` so the repository root is no longer a GitHub Marketplace Action draft. Not a hosted product.

## 1.4.0 — SHIPPED TO MAIN

- Visual benchmark on the README: the sealed 2→206 Codex/Claude split next to the packed 10,000-path, p95 < 2,000 ms budget. It does not measure model quality.
- GitHub community tabs keep a human first sentence so Code of conduct, Contributing, and Security read as a product, not a form dump.

## 1.3.1 — SHIPPED TO MAIN

- Longer causal-proof README loop: 28 held frames, 1,960 centiseconds, consequence opener, and a your-repo close. Same 2→206 evidence. No fifth action and no new surface.
- First-fold copy now sells the failure mode — Git will never show that second diff — then `npx --yes ruleblast@1.3.0 .` before the teaching `case`.
- GitHub community tabs (Code of conduct, Contributing, Security) lead with a human sentence. Latest verified public release remains `v1.3.0`.
- Repository skill at `.agents/skills/ruleblast` and an optional composite Action that comments a published-CLI `--receipt` on pull requests. Not a fifth CLI action and not a hosted product.

## 1.3.0 — RELEASED

### Changed

- Semantic `--help`, packaged `AGENT_USAGE.md`, and a shorter GitHub-first README. Four existing routes. No fifth action.
- Opt-in `--witness` prints why-edges, including same-directory override precedence. Default `--json` remains the canonical schema-1 result.
- Opt-in `--receipt` prints a pasteable proof card and an `RBCTX1` identity derived from existing projection bytes.
- Opt-in `--reality github/copilot-cli@1` adds one evidence-pinned Copilot CLI surface. Copilot VS Code and hosted Copilot stay unsupported.
- Advanced public install identity to exact `ruleblast@1.3.0` while preserving the historical `1.0.0` receipt command.

### Release artifact

- Signed tag object `f417ee350a6aa7431f23bbe698d58edd24dc8285` targets signed commit `8b2d083e6ebedb43315a2135621bd237a06a5f5d`.
- npm and the GitHub Release serve the same 93,562-byte tarball with SHA-256 `b4a2f04e4536d1859e3e80c2d4722b456d5194f47b7167df879af5577da5ec7c`; the release manifest SHA-256 is `9b5da71c2352b3273efeef5cdd228a602060e535ccbcf5804089a9ddacd9a664`.
- [npm `ruleblast@1.3.0`](https://www.npmjs.com/package/ruleblast/v/1.3.0) reports integrity `sha512-BsVvo3OsYiQKZx961VTZH7tYMLoEJuNNYWqX+OXcYMZZz77Rtvfs5rJ3kiGTfoycn3f4h4ze++tySXrOTiIRIw==`; exact-tarball publication means registry `gitHead is absent` rather than invented.

## 1.2.0 — SHIPPED TO MAIN

- Opt-in `--receipt` prints a pasteable proof card and an `RBCTX1` identity derived from existing projection bytes. Default `--json` remains the canonical schema-1 result.

## 1.1.0 — SHIPPED TO MAIN

- Opt-in `--witness` prints why-edges, including same-directory override precedence. Default `--json` remains the canonical schema-1 result.

## 1.0.3 — SHIPPED TO MAIN

- Semantic `--help` and packaged `AGENT_USAGE.md`.
- README leads with the 206-stack GIF proof. `case` is labeled the 33→106 teaching receipt.
- Light surprising-result issue form.

## Unreleased — repository only

- Put the exact `npx --yes ruleblast@1.0.2 case` command and direct proof, install, and contribution links immediately below the README tagline.
- Added a low-friction documentation-correction form that does not require a Blast Case or canonical JSON.
- Enabled GitHub private vulnerability reporting and aligned focused issue forms with the repository's evidence and install labels.

Post-tag repository changes are not part of the published v1.0.2 package bytes.

## 1.0.2 — RELEASED

### Changed

- Kept the complete one-command `npx --yes ruleblast@1.0.2 .` install path early and moved the packaged RuleBlast self-case below the new causal proof as secondary, reproducible CLI evidence.
- Advanced package, contract, source-build, troubleshooting, and release-candidate identity to exact `1.0.2` while preserving the historical `1.0.0` receipt command and hidden v1 `demo` compatibility.
- Added an evidence-shaped issue chooser, pull request checklist, security policy, and code of conduct, then replaced the oversized square mark with the selected horizontal RuleBlast hero while keeping presentation media outside the CLI package.
- Extended the candidate install gate to Node.js 26, actual Command Prompt plus PowerShell execution on Windows, bash on Linux, and a tag-only exact-version registry upgrade path that cannot run in candidate mode.
- Replaced the weak synthetic-first README framing with an evidence-locked causal proof from immutable `openai/codex` refs: 2 instruction-line edits changed projected stacks for 206 tracked paths, while 4,476 remained unchanged; the proof traces one path to its exact changed source without inferring model behavior.

### Release artifact

- Signed tag object `136c56cb5f1ba2de0fcaf7ab899ebf4678bc824b` targets signed commit `18c250b2b58910c81e5d5d9cefb7c31ca54304a0`.
- npm and the GitHub Release serve the same 89,244-byte tarball with SHA-256 `0d40d2297924e70c93bad51a9a84d7bd8af174ffa4cd008567f926adb0b941a2`; the release manifest SHA-256 is `59134fd306cdd34f92da145e3a6671d4099023acefe2add73874448c5f27fc64`.
- The guarded eight-cell registry matrix verified exact `1.0.1 → 1.0.2` install lifecycles on Windows and Linux with Node.js 20, 22, 24, and 26.

## 1.0.1

### Changed

- Replaced the synthetic teaching surface with `case`, a packaged inspection flow backed by the promoted immutable RuleBlast receipt: 33 instruction-line edits changed all 106 candidate stacks with zero split, partial, unknown, or indeterminate paths.
- The packaged command verifies the receipt bytes, canonical encoding, repository and commit identity, resolver revision, and core digest, then presents the recorded result without a repository checkout, network access, or reconstruction from absent source bytes.
- Kept `demo` as a hidden v1 compatibility alias that maps to the same semantic `case` action and produces byte-identical output; it is no longer advertised as a public action.
- Replaced the generated terminal animation with the RuleBlast eye and packaged the exact promoted receipt as the practical first-run experience.

## 1.0.0

### Added

- Deterministic Git commit, tracked-worktree, and manifest fixture snapshots.
- Evidence-pinned `openai/codex-cli@1` and `anthropic/claude-code-cli@1` repository profiles.
- Profile-neutral current and diff impact analysis with complete, partial, unknown, and indeterminate states preserved.
- Four CLI actions at release: scan, diff, explain, and demo, with deterministic text and canonical JSON output.
- A packaged `DEMO FIXTURE` that exercises the production pipeline and offers a one-path explanation.
- A stable public behavior contract, contribution unit, long-horizon roadmap, and focused issue forms.
- A no-overwrite Blast Case capture path for canonical, source-content-free receipts from immutable public Git commits; promotion is protected by the field-evidence gate.
- The first promoted real-repository receipt, covering RuleBlast commits `27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8` through `e420008a1c10c5c328e506247560117f4d40b855`: 33 instruction-line edits changed all 106 candidate stacks for both profiles, with zero split, partial, unknown, or indeterminate paths.

### Release artifact

- Package and lock metadata carry version `1.0.0` and the canonical repository, homepage, and issue tracker.
- A reusable pack-once builder records SHA-512, SHA-256, size, and sorted inventory before validating and smoke-testing that exact tarball offline.
- Package specifier `ruleblast@1.0.0`, signed source tag `v1.0.0`, npm distribution, and the GitHub Release are independently verified publication records; none is inferred from a source checkout.
