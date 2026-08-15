# Changelog

All notable user-visible changes to RuleBlast are recorded here.

## 2.1.0 — SHIPPED TO MAIN

- Repeat `--reality` to add both bundled opt-in CLI surfaces on one invocation. Default two-profile JSON is unchanged when neither flag is passed.
- Compact `REALITY GROUPS` text groups paths by evidence-equivalent stacks. Clusters form only from pairwise `SAME`. Unresolved and runtime-decided states stay unresolved.
- No `--reality all`, no fifth action, no fifth reality, no extra IDE host class.

## 2.0.2 — RELEASED

- Shared identity sentence: blast radius of `AGENTS.md` and `CLAUDE.md` changes across Codex, Claude Code, Gemini CLI, and Copilot CLI. Same claim in package.json, README, `--help`, companion, skills, and `AGENT_USAGE.md`.
- Problem-query first fold: which files inherit an `AGENTS.md` / `CLAUDE.md` change. Keywords add `instruction-inheritance` and `instruction-provenance`.
- Bundled pack load is fail-closed and contained: nested names, Windows drive-relative names such as `C:secret`, and path-escaping names raise `INVALID_PACK` before join. Missing JSON and malformed JSON are distinct `INVALID_PACK` errors.
- Decoder rejects empty claim-id strings and `:` in repository-relative names. Catalog directory names must match `vendor-product@rev` for the pack id.
- No fifth action, no `--pack`, no fifth reality.

### Release artifact

- Signed tag object `7b0b169f49c6be0da5289b4afcb7bc0576607486` targets commit `1c926b6ee92915659c58cc140627a76480996b5b`.
- npm and the GitHub Release serve the same 118,836-byte tarball with SHA-256 `9cec50fa91cbd13b3326f5aee5cdf98e0c31421ef483231560e8290a1b97387a`; the release manifest SHA-256 is `9a123b870a581d88b72089e1b5e5dcfd0b51b2ee361d16e302098dabdce0a9c9`.
- [npm `ruleblast@2.0.2`](https://www.npmjs.com/package/ruleblast/v/2.0.2) reports integrity `sha512-DsiHO5GR5xiGNioWxqjn5rtO9n/9d7sCM7+ND4OKECdVQDXMR4U0t0Sd8z2k+Ahaz4FwaGq5iyRDSF1+3UhAQg==`; exact-tarball publication means registry `gitHead is absent` rather than invented.

## 2.0.1 — SHIPPED TO MAIN

- Nested composite Action default package pin is `2.0.1`. After Reality Packs, the previous default `1.6.2` made PR receipts analyze the old engine.
- Optional Action input `reality` forwards the existing `--reality` flag. Default JSON stays two-profile.
- `--help` names two default realities and two opt-in CLI surfaces.
- No fifth action, no `--pack`, no fifth reality.

## 2.0.0 — RELEASED

- Bundled Reality Packs (`packs/bundled`) are the profile source of truth. The catalog loads four reviewed packs. No `--pack`, no fifth reality, no executable pack code.
- Gemini `sourceDependencyPaths` now includes nested `@import` targets up to the documented depth 5 (D2a). Detection was already correct; attribution was not. `google/gemini-cli@1` and `resolverRevision: 1` are unchanged.
- `--witness` why-edges for Codex `SHADOWED` and Claude `EXCLUDED` come from pack presentation hints, not profile-id branches in `witness.ts`.
- `npm run test:pack-schema` checks JSON Schema (dev) and the fail-closed TypeScript decoder. No runtime schema-validator dependency.
- Default two-profile canonical goldens are unchanged.
- Public visual benchmark is a 1200×1200 scoreboard of the sealed 2→206 proof: split, why-this-path, CLI and companion surfaces, and the user-owned allow gate. It is not a second product UI.

### Release artifact

- Signed tag object `250f54ff2a1ae354581919f471d3bb48dd231db4` targets commit `bf51ada55b7e34db2b8f5b6c0eebd468b35c0382`.
- npm and the GitHub Release serve the same 118,042-byte tarball with SHA-256 `1059f9c02e474cb1f1376bb4664aee03f63ac13af8ac4817fcdb6fd7a94c0777`; the release manifest SHA-256 is `04b8fe547e684aef54af743ebdd1f6172a647834255d1ff3a4f11fa02087a52c`.
- [npm `ruleblast@2.0.0`](https://www.npmjs.com/package/ruleblast/v/2.0.0) reports integrity `sha512-RLiS2/bBUlzzRPiEoypRYowa3fUvSutpDrpv6IoXUjl9/t5NwwIgDXaZpPVaYzwlIApjixSr3xYYbqscWQFrYg==`; exact-tarball publication means registry `gitHead is absent` rather than invented.

## 1.6.2 — RELEASED

- Default `explain` text is the shared visual source tree: catalog badges, cwd, changed markers, why-this-path, and findings. Digests stay in `--json`.
- `--receipt` and `diff` source-blast lines use catalog badges instead of raw profile ids. Canonical JSON is unchanged.
- Companion explain uses the last canonical result, keeps `STALE` when the worktree already moved, and shows explain plus source-blast on the scoreboard tree. Select Reality is a session option, not a fifth action.

### Release artifact

- Signed tag object `4883efb6d5a82e0bcfe4ebd8375a0f024ff7943b` targets commit `ef2206a40b44a1debb211bd131f23afb519ac32f`.
- npm and the GitHub Release serve the same 108,652-byte tarball with SHA-256 `0c93bc4c24410297ce0f20dc5cf7788ad4dfb3259c2b99662782969bec49101f`; the release manifest SHA-256 is `8725791048ff228835279abbcaa855002303aa5867a8971182fbac601f80fec4`.
- [npm `ruleblast@1.6.2`](https://www.npmjs.com/package/ruleblast/v/1.6.2) reports integrity `sha512-JE3H3hE7Gp1/AuQIz8swceyFRlGnfFjLcJz/MOriBswDt69ObMatn3w/AzkjeqSSThsyhgGnnpdR4emkYKw1eg==`; exact-tarball publication means registry `gitHead is absent` rather than invented.

## 1.6.1 — SHIPPED TO MAIN

- Read-only VS Code-compatible companion under `hosts/vscode`. Four commands map to scan, diff, explain, and case. File changes mark the last result stale. Unsaved buffers are not worktree snapshots.
- Companion imports the application facade only. Cross-host tests require CLI engine bytes and companion session bytes to match.

## 1.6.0 — SHIPPED TO MAIN

- Fourth documented reality: opt-in `--reality google/gemini-cli@1` models repository-only Gemini CLI JIT context from `google-gemini/gemini-cli@v0.55.1`. Default Codex + Claude JSON bytes are unchanged.
- Compile-time profile catalog and analysis-authority facade. Hosts must not import snapshot, impact, or renderer internals.
- Shared explain presentation model and split analysis lifecycle from completeness. No fifth action, no `--reality all`.

## 1.5.3 — SHIPPED TO MAIN

- Packaged `case` binds the single promoted receipt by path convention and internal digest. Receipt SHA, core digest, and commit ids are no longer duplicated as source literals. Advertised pin is `ruleblast@1.5.3`. Public preview images name `v1.5.3`. No fifth action.

## 1.5.2 — SHIPPED TO MAIN

- Separates the public 206 example into a changed instruction source (nested `AGENTS.md`) and an affected consumer path. `causes` stay evidence links. Advertised pin is `ruleblast@1.5.2`. No fifth action.

## 1.5.1 — RELEASED

- Public install identity `ruleblast@1.5.1`. Feature admission test on the roadmap. No fifth action.

### Release artifact

- Signed tag object `1e1ee219b45c69da46a732ef215835eee11f33fc` targets commit `ca6dea5efab263a11dbfc0221b88570cdcf50b7f`.
- npm and the GitHub Release serve the same 95,434-byte tarball with SHA-256 `d85e4f35233b1bd65f778c65eb83122b41405df42cd4ef72b4c602a18bb1a036`; the release manifest SHA-256 is `08711a24f3ed1a9c43e0c065337962c2ef229e9c8edf3f0051fdd97b402de590`.
- [npm `ruleblast@1.5.1`](https://www.npmjs.com/package/ruleblast/v/1.5.1) reports integrity `sha512-0QRQ88yxOMrOPYME1I5IIZKaWlJ8PECP40L+rXZ4rKmPM2ANFfJjlaKJnCFOAMvxOCXcyXqqk2/ON6mHPZPA8g==`; exact-tarball publication means registry `gitHead is absent` rather than invented.

## 1.5.0 — SHIPPED TO MAIN

- Source-centric blast attribution on `diff` text: each changed instruction source lists affected paths per profile. Derived from existing causes. No fifth action, no `--source`, no schema change.

## 1.4.4 — SHIPPED TO MAIN

- CLI-first README: terminal demo, one 2→206 statement, What Git missed, evidence in [PROOF.md](PROOF.md). No fifth action.

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
