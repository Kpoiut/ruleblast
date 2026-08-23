# Changelog

All notable user-visible changes to RuleBlast are recorded here.

## 2.5.2 — SHIPPED TO MAIN

- Claude Code is interpreted from `resolver.json`: `strip-html-comments`, `at-path-import` (`claude-markdown-v1`, four edges), `json-exclude-globs` on `.claude/settings.json`, frontmatter-glob `paths` with brace-budget matching, and same-basename partial for dual root memory. Live interpreter projections are byte-identical to `createClaudeProfile` on every packed Claude fixture. Lab `INTERPRET` / `ORACLE`. The adapter remains the test oracle and is not imported by the interpreter. Not a fifth action. Not a fifth bundled reality.
- Frontmatter apply is narrow YAML: one mapping field to a string scalar (comma-split) or a string sequence. Copilot `applyTo` and Claude `paths` share that decoder. Maps, aliases, and merge keys fail closed.
- Transform admission is the operations the engine executes (`byte-budget`, `strip-html-comments`, `at-path-import` with a named lexer, `json-exclude-globs`). Markdown tokenize/import and glob-budget matchers live under `src/packs/ops-*` and are reused by adapters as the same primitive, not a third vendor interpreter.
- Interpreter admission matches the two executable families: first-per-directory / ordered / byte-budget, or select-all / unspecified assemble. Gemini stays fingerprint on `onSymlink` (`partial-unfollowed`) and ordered `assemble`. Flipping the symlink policy does not admit a third family. Select-all prepares frontmatter, rule parse, and document tokens once, then caches projections.
- Lab `--detail` / `--receipt` records Codex, Copilot, and Claude as `INTERPRET` / `ORACLE` and Gemini as `FINGERPRINT` / `ADAPTER` with sealed probe counts. Benchmark lab recording counts ORACLE vs ADAPTER rows, missing operations, and probes. Overlay wall and the 5 s clock are unchanged.
- The published CLI people install is still `ruleblast@2.5.1`.

## 2.5.1 — RELEASED

- Copilot CLI is interpreted from `resolver.json`: multiple discover origins (fixed, glob, ancestors), `select.mode` all, `assemble.mode` unspecified, empty transform, `frontmatter-glob` `applyTo`, and `onAtReference: partial-unexpanded`. Live interpreter projections are byte-identical to `createCopilotProfile` on every packed Copilot fixture. Lab `INTERPRET` / `ORACLE`. The adapter remains the test oracle and is not imported by the interpreter. Not a fifth action. Not a fifth bundled reality.
- Interpreter admission is the operations the engine can execute, not a Codex-only shape filter. Claude’s remaining gap is `transform` (HTML comments and `@path` imports). Gemini’s remaining gaps are `onSymlink` (`partial-unfollowed`) and `transform` (`at-path-import`). Those resolvers still fingerprint. Missing-operation lists shrank because those operations now run, not because the lab hides them.
- One repository-path primitive (`compareCodePoints`, dirname, basename, ancestors, join) is shared by Git capture, snapshots, transitions, impact, the interpreter, and all four profile adapters.
- Codex ordered/byte-budget interpretation caches ancestor-directory resolution and hashes each candidate once at prepare. Same digest recipe. Same adapter-oracle bytes.
- Overlay wall still runs four baseline analyses and four analysis-plus-overlay samples. Overlay median/p95 add less than 500 ms. The 5 s test clock is unchanged. Public-pair Git identity seeds both commits through one `git fast-import` pack so Windows Node 24 stays inside that clock.
- [npm `ruleblast@2.5.1`](https://www.npmjs.com/package/ruleblast/v/2.5.1) reports integrity `sha512-cAchQ4It9MM4E+CmOMvnviX/zGic+28DvxbHIK908NN+qJ9aLAsi7iPiIEelKBJiY/N4Ie0RxiVeOqhB1TbfhQ==`. The registry download is the 177,160-byte tarball with SHA-256 `32e3cc817f0dd915764f2f9d67c8b3f3f8aa4bc9215c11c8439842ed52ee6c4a`. Pack `ruleblast-companion-2.5.1.vsix` (160,281 bytes, SHA-256 `26ed18e60cf4f4bad0dfef78514f2924d2f14878355547c5644a6220e1b09869`). Do not overwrite Marketplace `2.2.0` or `2.2.1`.

### Release artifact

- Signed tag object `761f547ca00d911cf5c5b826461b82c01ccac900` for [`v2.5.1`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.5.1) targets commit `e60fd18ec4a83ce8aff7488b0bb9203ab4a8cedc`.
- npm and the GitHub Release serve the same 177,160-byte tarball with SHA-256 `32e3cc817f0dd915764f2f9d67c8b3f3f8aa4bc9215c11c8439842ed52ee6c4a`. The GitHub Release also serves the 160,281-byte `ruleblast-companion-2.5.1.vsix` with SHA-256 `26ed18e60cf4f4bad0dfef78514f2924d2f14878355547c5644a6220e1b09869`.

## 2.5.0 — RELEASED

- Candidate Reality Conformance Lab: `--detail` and `--receipt` print bundled INTERPRET versus FINGERPRINT coverage from a sealed `oracle.json` per pack. Codex `INTERPRET`/`ORACLE` is a live interpreter match of `sourceDependencyPaths` and projection digests on every existing Codex fixture snapshot packed beside the resolver. Tests still compare those probes to `createCodexProfile`. Claude, Gemini, and Copilot `FINGERPRINT`/`ADAPTER` is a live fingerprint-adapter match of the same digest fields on every existing fixture snapshot for that surface, plus the sealed missing-operation list; the interpreter still rejects those resolvers. A mismatched oracle fails closed. Candidate fixtures carry loadable snapshots (`LOADED`) and may only record UNKNOWN. Projection of a candidate remains `UNEXECUTED`. `RECORDED` is not a passing oracle. Grok Build CLI has those five axes and remains `NOT_ADMITTED`. Not a fifth action. Not a public `--reality`. Not a `--pack` loader. Not a model-quality score. `--json` stays canonical.
- Packed installs include `packs/candidate` so the lab and evidence reveal are the same inventory in a source tree and in the npm CLI.
- TypeScript remains the analysis authority. A Go or Rust capture sidecar is not admitted; the packed 10,000-path budget still holds, and a second analysis engine is forbidden.
- Build wipes `dist/` before `tsc` so a deleted module cannot remain in the npm tarball.
- Packed 10,000-path analysis keeps the 2,000 ms ceiling and adds an efficiency gate at p95 < 1,000 ms. Same projection digest recipe. Same capture. `npm run benchmark` also times the sealed GIF fixture pair and explain KEEP text.
- `explain` prints KEEP (`rbctx` + reuse rule) so a later agent on the same repo can reuse the last explanation instead of repeating the path. Diff explain `--from` also names LATER WORK CONTINUE/REJECT from the overlay when that path is OTHER. Not a stored session file. Not actor telemetry.
- [npm `ruleblast@2.5.0`](https://www.npmjs.com/package/ruleblast/v/2.5.0) reports integrity `sha512-+L5dINRsAs5/vW2nSYbBpzwL4NTCAF7/P9corxZtjd/Ats/0VvKTlU61vYVL1xqW5S4MIo9e2LpqHeKS2f1Eag==`. The registry download is the 174,972-byte tarball with SHA-256 `4fede04c92030ed7e98fdf44868f1c334f24b4d66b233ad2bf68cc6967272e4f`. Pack `ruleblast-companion-2.5.0.vsix` (157,848 bytes, SHA-256 `a1933630a594ae617defe530ea2e3bcaa44bba054a797f88e123710f90db1606`). Do not overwrite Marketplace `2.2.0` or `2.2.1`.

### Release artifact

- Signed tag object `a6ab195c517815cddfcbea326452e67782477fc9` for [`v2.5.0`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.5.0) targets commit `0afa7e251f70454078b50391cf93e5d7dc19cac5`.
- npm and the GitHub Release serve the same 174,972-byte tarball with SHA-256 `4fede04c92030ed7e98fdf44868f1c334f24b4d66b233ad2bf68cc6967272e4f`. The GitHub Release also serves the 157,848-byte `ruleblast-companion-2.5.0.vsix` with SHA-256 `a1933630a594ae617defe530ea2e3bcaa44bba054a797f88e123710f90db1606`.

## 2.4.11 — SHIPPED TO MAIN

- `--index` prints a compact tab-separated SOURCE/CONTINUE/REJECT/SPLIT map of the same canonical result, including snapshot FROM/TO, overlay LAW, and STACK count. Every row. No overlay sample cap. Truncated overlay remainder points at `--index`. Agents use it on large repositories; humans can read it. Not a fifth action. Does not write a file. `--json` stays canonical.
- MCP `scan`, `diff`, and `case` accept `index`. Companion **Show Index** renders the last result the same way.
- The published CLI people install is still `ruleblast@2.4.6`.

## 2.4.10 — SHIPPED TO MAIN

- README causal-proof GIF types the everyday CLI: `git diff --stat HEAD~1`, `ruleblast diff HEAD~1`, `ruleblast explain <path> --from HEAD~1`. No npx pin and no commit hashes in the typed commands. Sealed 2→206 output is unchanged. Loop 15 s. Print is snappy; holds are for reading.
- Companion Diff From lists HEAD, HEAD~1, recent RuleBlast bases, and `git log`. Same diff action. Not a fifth action.
- The published CLI people install is still `ruleblast@2.4.6`.

## 2.4.9 — SHIPPED TO MAIN

- README causal-proof GIF uses a flush Windows Terminal title-bar tab: profile icon, PowerShell, close, new-tab, chevron. Not an inset glued pill. Tab title is the profile name, not a copied session string.
- The published CLI people install is still `ruleblast@2.4.6`.

## 2.4.8 — SHIPPED TO MAIN

- README causal-proof GIF is a Windows Terminal + PowerShell session (35 frames, 10.08 s). Commands type, output prints in batches, holds stay readable. No HUD. Not a fake macOS mock.
- Visual scoreboard keeps the eight-card layout. Source HTML profile ids stay catalog ids. Assets are not packed.
- The published CLI people install is still `ruleblast@2.4.6`.

## 2.4.7 — SHIPPED TO MAIN

- Evidence reveal names `SEALED`, `NO_KNOWN_DRIFT`, or `POSSIBLY_STALE` from committed candidate inventory. That is not a claim the vendor runtime is unchanged. Companion last-result lifecycle stays `CURRENT` / `STALE`. `--json` stays canonical.
- Interpreter admission is the list of missing resolver operations. Fingerprint is not an admission input. Codex remains the only bundled spec the interpreter can execute. Claude, Gemini, and Copilot stay fingerprint oracles. No fifth bundled reality. No `--pack`.
- Overlay REJECT restates OUTSIDE THIS BLAST and says it is not a recommendation to discard the Git change.
- GitHub README causal-proof GIF types the published `ruleblast@2.4.6` CLI, then prints output in batches, on the sealed openai/codex 2→206 pair. 24 frames, no HUD. The visual board is a compact 1,200×480 strip. Those assets are not in the npm tarball.
- The published CLI people install is still `ruleblast@2.4.6`.

## 2.4.6 — RELEASED

- Catalog Codex is interpreted from the pack `resolver.json`. `createCodexProfile` stays the adapter oracle. The interpreter does not import that adapter. No fifth bundled reality. No `--pack`.
- Offline evidence-revision reveal: bundled digests can be `CURRENT` or `POSSIBLY_STALE` from committed candidate evidence. `--json` stays canonical.
- Human overlay restates `IN_BLAST` / `OUTSIDE_BLAST` as CONTINUE / REJECT for the next reader of the same result. RuleBlast does not write intent files.
- Candidate `npm pack` is offline. Timed-out child commands name their argv. Sequential profile capture stays the prepare-method security property.
- [npm `ruleblast@2.4.6`](https://www.npmjs.com/package/ruleblast/v/2.4.6) reports integrity `sha512-MpYQzjNive82VKCJWqhUCx32/NXHgy8Hm878oCSt4u33y9bZgqLlTpYXPxNWHODZn+CL838IyzKZ1j/ip3SL8g==`. The registry download is the 153,122-byte tarball with SHA-256 `c8438947be110f783b66e2f9746b5bbc6f9941a2bc5776a2a22af23fc063cdd9`. Pack `ruleblast-companion-2.4.6.vsix` (148,086 bytes, SHA-256 `877c565790c2e4b7366ef4ba467c9dd02efc7b0638ddca4fc95fb1faa67d0404`). Do not overwrite Marketplace `2.2.0` or `2.2.1`.

### Release artifact

- Signed tag object `137dec9cb431d6b6f20869e14252d3f5b8c838b8` for [`v2.4.6`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.4.6) targets commit `44124475babc60bbb73186debe311ab6753d2f6b`.
- npm and the GitHub Release serve the same 153,122-byte tarball with SHA-256 `c8438947be110f783b66e2f9746b5bbc6f9941a2bc5776a2a22af23fc063cdd9`. The GitHub Release also serves the 148,086-byte `ruleblast-companion-2.4.6.vsix` with SHA-256 `877c565790c2e4b7366ef4ba467c9dd02efc7b0638ddca4fc95fb1faa67d0404`.

## 2.4.5 — RELEASED

- Packed CLI `--help` and `--version` no longer load Git capture, analysis, MCP, or the case receipt.
- The packaged case verifies its receipt once per process.
- Gemini prepare reads instruction files and followed imports, not every tracked blob.
- MCP `diff` prepares the same overlay adjunct as the CLI. All four MCP tools accept `detail`. The companion command **Show Detail** renders last-result detail without a fifth action.
- [npm `ruleblast@2.4.5`](https://www.npmjs.com/package/ruleblast/v/2.4.5) reports integrity `sha512-nnrLHacDTodnWAypkJZIiolXIMVIOo0TgHy711FK2bT3K3eimc3v6p61AdaH40Y1gSJQ8Z6SBOjYOYAQ55tt4Q==`. The registry download is the 147,397-byte tarball with SHA-256 `9a8b228b0bcf42fc862704fa43f0a27c0b35a2b988a0f67bfd8e276998f950da`. Pack `ruleblast-companion-2.4.5.vsix` (142,254 bytes, SHA-256 `5b45c7fb9daf0e4674de1ab1007a0612e57d8cf11516551aba49739c0a865ea5`). Do not overwrite Marketplace `2.2.0` or `2.2.1`.

### Release artifact

- Signed tag object `1bbdb7b276bede8e862e1b8c5ccc3d3f32497a13` for [`v2.4.5`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.4.5) targets commit `c599195b1c64cdff215e7380b7fee9d737e0a10e`.
- npm and the GitHub Release serve the same 147,397-byte tarball with SHA-256 `9a8b228b0bcf42fc862704fa43f0a27c0b35a2b988a0f67bfd8e276998f950da`. The GitHub Release also serves the 142,254-byte `ruleblast-companion-2.4.5.vsix` with SHA-256 `5b45c7fb9daf0e4674de1ab1007a0612e57d8cf11516551aba49739c0a865ea5`.

## 2.4.4 — SHIPPED TO MAIN

- Default human text is the summary of the same canonical result. `--detail` prints the fields that summary compresses: per-profile counts, findings, split and changed paths, source digests, added/deleted lines, groups, and explain before/after stacks.
- Worktree capture copies tracked files through a bounded pool so a downloaded package stays fast on real repositories.
- Instruction-line restatements use `editedLineCount`. `--compare` selects a proven `DIFFERENT` pair. Overlay names deleted other paths as not after-snapshot targets. Invalid MCP frames return JSON-RPC `-32700` instead of throwing.
- The published CLI people install is still `ruleblast@2.4.1`.

## 2.4.3 — SHIPPED TO MAIN

- Records the domain capability ladder this product is built for: find instruction files, compute inheritance, resolve each modeled agent, name the two-state blast, compare selected realities with provenance and uncertainty, then emit a deterministic evidence-pinned canonical result.
- Product-breadth scores (CLI → harness → platform) are reference-only and do not grade this checkout.
- On that domain axis the current public product sits near L6, read as L5.5–L6 because vendor loading rules can move.
- Horizon stays a sharper knife in the same slice. The published CLI people install is still `ruleblast@2.4.1`.

## 2.4.2 — SHIPPED TO MAIN

- Titles, listings, and social cards now introduce the tool the same way: **RuleBlast — Git diff for AI agent repository instructions**.
- The npm package, GitHub repository, and Marketplace id remain `ruleblast`.
- README, CLI help, package metadata, companion listing, Action blurb, landing page, `llms.txt`, citation, and official skills share that line and the blast-radius sentence.
- The published CLI people install is still `ruleblast@2.4.1`.

## 2.4.1 — RELEASED

- Replacement npm package after `ruleblast@2.4.0` was unpublished. npm does not allow that version number to be reused. Same progressive disclosure as `2.4.0`. Published `npx` is `ruleblast@2.4.1`.
- `--paths-only`, `explain --compare`, explain `PROOF`, and the companion file glance are in this package. `--json` stays canonical. Not a fifth action.
- [npm `ruleblast@2.4.1`](https://www.npmjs.com/package/ruleblast/v/2.4.1) reports integrity `sha512-MTTZpr2qhuMaR4BN9z5LsMe1pORPkbDeNV5Gr8f2GXb0jLI3MoPYaM5rX1CQqtyMePcNEfU4JdHXFYQWiGglOA==`. The registry download is the 144,495-byte tarball with SHA-256 `6c89d285e938fae0e9f5aa717fc0a6403fc48f57d825c1b7310ea01c52231483`. Pack `ruleblast-companion-2.4.1.vsix` (137,302 bytes, SHA-256 `29efd185756292c136312f900eb89115b7a7707b8d30a3d58adc8534f654ebf6`). Do not overwrite Marketplace `2.2.0` or `2.2.1`.

### Release artifact

- Signed tag object `b26859f3a31bd4b1c3985f966d70bf32432d174f` for [`v2.4.1`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.4.1) targets commit `f80b0d0fb2af6ab0c37d703b1d36a094c9a0cc58`.
- npm and the GitHub Release serve the same 144,495-byte tarball with SHA-256 `6c89d285e938fae0e9f5aa717fc0a6403fc48f57d825c1b7310ea01c52231483`. The GitHub Release also serves the 137,302-byte `ruleblast-companion-2.4.1.vsix` with SHA-256 `29efd185756292c136312f900eb89115b7a7707b8d30a3d58adc8534f654ebf6`.

## 2.4.0 — RELEASED

- Progressive disclosure of the same canonical result. Not a fifth action. `--json` stays canonical.
- The npm version `2.4.0` was unpublished on 2026-08-18 because its tarball README still advertised `ruleblast@2.3.0`. That version number cannot be reused. Install `ruleblast@2.4.1`. The GitHub tag [`v2.4.0`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.4.0) remains.
- `--paths-only` prints one attention path per line (diff and case: changed stacks; scan: current splits) for Unix pipes. Not `--json`.
- `explain --compare` prints two selected-reality source stacks as a text compare. Companion CodeLens opens the same stacks in `vscode.diff`.
- Explain text leads with a `PROOF` line derived from existing causes or sources. Same repository snapshot, profile, resolution rules, and configuration produce the same computed result. Not a model-compliance claim.
- Companion Status Bar morphs to the active file from the last result. Peripheral glance is a host projection, not a second engine.
- GitHub-facing README leads with that same disclosure: one-line glance, compare, `PROOF`. Install lists, host map, and replay sit behind `<details>`.
- The first npm tarball at `2.4.0` had integrity `sha512-s1K6hIOMOR/q+/+z+JN/6SAmYWq1CResaKSs3Y+J/ztzjRw6tUEbeR62yqcaAcIwDIGXLiL+gtKbmX5T9210oA==` (144,516 bytes, SHA-256 `bbc35dfb12e0c5557dba288f2208c4763e8aab52f2c04ece126fab24f17d8755`, `gitHead` `a0848463a493516eba64d5d73aecf0ea3b097e07`). That version is no longer on the registry.

### Release artifact

- Signed tag object `430115f28b62a90bc5838fc696cc5747d46f9ab5` for [`v2.4.0`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.4.0) targets commit `82514d7dc03614094001ec737a7d2bb13402d45a`.
- The GitHub Release still serves the 137,302-byte `ruleblast-companion-2.4.0.vsix` with SHA-256 `e4032b708cd98a92ac0dd17bcf7b35f1dec73ff7ca129ee7a8731eacb1988c50`. Do not install unpublished `ruleblast@2.4.0`.

## 2.3.1 — SHIPPED TO MAIN

- Identity fixtures commit the staged index. `git add -A` after `update-index --chmod` / `--cacheinfo` restored the worktree and produced an empty commit on Linux Git, so Verify never proved same-OID mode/kind or gitlink exclusion against real tree objects.
- `findRepositoryRoot` returns the real path of Git's toplevel. Windows 8.3 (`RUNNER~1`) and the long checkout path are the same directory; tests compare `dev`/`ino`, not path spelling. Overlay probe and snapshot share that root.
- Overlay OTHER membership uses one blob-object identity function and a merge of the two sorted path lists. `--json` stays canonical.
- Companion scoreboard is a result surface: Δ / ≠ / ? leaves, Changed sources expanded, Control folder removed (actions stay on the view toolbar and chord). One presentation snapshot owns Status Bar, badge, decorations, CodeLens, and the Explain tab. STALE clears live numbers. Human `diff` text leads with Δ STACK CHANGED / ≠ NEWLY SPLIT / ? UNRESOLVED. `--json` stays canonical. Public `npx` stays `ruleblast@2.3.0`. Not a fifth action.

## 2.3.0 — RELEASED

- Overlay join: Git↔Git and Git→WORKTREE human `diff` append OTHER TRACKED CHANGES from Git storage blob-object identity, then WORK MAP and a deterministic CHANGE ALIGNMENT (`ALIGNED` / `MIXED` / `DIVERGENT` / `UNRESOLVED`) with an operational gloss. The adjunct names the identity law and other-path kinds (added / modified / deleted). Companion Diff From renders that prepared adjunct, including work-map cues. `--json` stays canonical.
- Control: `Ctrl+Alt+R` then `S`/`D`/`E`/`C`. Welcome surface, toolbar, explorer/editor explain. Activity bar is `currentColor` SVG; Marketplace PNG stays 128×128.
- [npm `ruleblast@2.3.0`](https://www.npmjs.com/package/ruleblast/v/2.3.0) reports integrity `sha512-1G1yAOUMnMQUfVX64YoLbBVKPNrFsX7ivIZ8OhJwL5YQUFyC6EyWYk4mNokyDIh+q7KqeLt9djgQSXxlQ2fn2Q==`. The registry download is the 138,135-byte tarball with SHA-256 `1672bdd9133f960d8658e003b8d7cb77a13b3fbd79c9238a2b009abf2839ba2e`. Registry `gitHead` at publish was `67280fd8b43a53cd262d68058e3b4680410c8d2d` and is not the 2.3.0 source commit. Pack `ruleblast-companion-2.3.0.vsix`. Do not overwrite Marketplace `2.2.0` or `2.2.1`.

### Release artifact

- Signed tag object `73e0fdf25f68c18380c9db5b459406419f72fc06` for [`v2.3.0`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.3.0) targets commit `7ca69ba262f3250e6e33630ca05c205d9f01e14c`.
- npm and the GitHub Release serve the same 138,135-byte tarball with SHA-256 `1672bdd9133f960d8658e003b8d7cb77a13b3fbd79c9238a2b009abf2839ba2e`. The GitHub Release also serves the 125,885-byte `ruleblast-companion-2.3.0.vsix` with SHA-256 `40aca6dbb59bf2b5d19938788f0454baa80abb806802290429aff8c3f255ab60`.

## 2.2.2 — SHIPPED TO MAIN

- Human `ruleblast diff` Git→Git and Git→WORKTREE can append OTHER TRACKED CHANGES (selected realities) from Git storage blob-object identity, then restate membership as a WORK MAP (inherited / independent / unclassified / already-split). Companion Diff From renders that prepared adjunct and can explain a listed path. Companion and CLI share one control chord: `Ctrl+Alt+R` then `S`/`D`/`E`/`C`. Scoreboard nodes carry kind, mark, and intent so the host can bind keys, toolbar, and context menus. The activity bar uses a `currentColor` SVG; the Marketplace PNG stays 128×128. Empty scoreboard uses the native welcome surface. Pack `ruleblast-companion-2.2.2.vsix` with `npm run host:pack`. Do not overwrite Marketplace `2.2.0` or `2.2.1`. Not actor telemetry. Not a fifth action. `--json` is unchanged. If Git blob identity cannot be established, the adjunct prints unavailable and keeps today's canonical exit. This is not `v2.3.0` and not an npm release.
- Verify no longer repeats package/install smoke after `npm run check`; those bodies already run inside check.
- Published npm CLI remains `2.2.0`.

## 2.2.1 — SHIPPED TO MAIN

- Companion Marketplace icon is a 128×128 PNG. Upload `ruleblast-companion-2.2.1.vsix`. Do not overwrite Marketplace `2.2.0`.
- Verify builds once before `npm run check`. Candidate install smoke reuses `dist/cli.js` instead of compiling again.
- Capture-case Windows 8.3 path uses `cmd %~sI` with the path in an env var and `windowsVerbatimArguments`. Node's default quoting produced `D:\"C:`. Timeouts stay 15s / 120s.
- Published npm CLI remains `2.2.0`.

### Release artifact

- Signed tag object `aca42df18070b98c3ca2b52c5e3ea6b5ae83f76c` targets commit `2541576ebc9d8ea3db31bbd62e3df9b78d410c69`.
- GitHub Release [`v2.2.1`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.2.1) serves the 115,113-byte `ruleblast-companion-2.2.1.vsix` with SHA-256 `eac0ccbcf4287de56c810481a78fe25597d99484310e5e9cfec9bf13f3dc8bd3`.

## 2.2.0 — RELEASED

- One VS Code-family companion covers VS Code (HOSTED) plus GitHub Copilot Chat, Cursor, Windsurf, Kiro, Antigravity, Codex IDE, Continue, Cline, and Trae (COMPATIBLE). No per-editor fork. A host is not a modeled reality.
- Claude Desktop, ChatGPT/Codex desktop, and Zed use the same `--mcp` transport. Workspace MCP and skills call `npx --yes ruleblast@2.2.0 --mcp`.
- Same skill body at the official Codex, Claude Code, Cursor, Windsurf, and Kiro paths.
- `--mcp` is a stdio transport of scan, diff, explain, and case. Not a fifth action. Agents still need the allow gate.
- Companion Select Reality can add both opt-in CLI surfaces on the next run.
- Compact `ruleblast.replay.v1` metrics compare the packaged 33→106 receipt and a current-tree diff. The sealed openai/codex 2→206 proof is unchanged.

### Release artifact

- Signed tag object `b6c93afb91c0c7b12b97c163cb12dcd2b0b4a864` for [`v2.2.0`](https://github.com/Kpoiut/ruleblast/releases/tag/v2.2.0) targets commit `6f3732fef48ba9a6c0ec4f7a6f9b7381786fb737`.
- [npm `ruleblast@2.2.0`](https://www.npmjs.com/package/ruleblast/v/2.2.0) reports integrity `sha512-ddfCo5MbaFjUyQa9eHr6D/pBzV9byQzhi30OzfkFSMnLmKdngHMHZsndIqAtNLPlHP6zs9fHeBSz+8lXVtuWZA==`. The registry download is the 128,262-byte tarball with SHA-256 `0d2d9c56e54e032981492afc9e49bad727a26c71526d13a68e6896595622f823`. Registry `gitHead` at publish was `0e2059cf163bcec2cb5c9051be46c6ba68b54365` and is not the 2.2.0 source commit.

## 2.1.1 — RELEASED

- Independent retrieval documents: problem page for which files inherit a changed `AGENTS.md`, `llms.txt`, and `CITATION.cff`. Same identity sentence. No keyword stuffing.
- Root `action.yml` is a Marketplace-indexable wrapper of the nested composite. It still runs the published CLI. Not a hosted product.
- `PROOF.md` title is the sealed phenomenon: 2 `AGENTS.md` lines → 206 Codex stacks.
- No fifth action, no `--pack`, no fifth reality.

### Release artifact

- Signed tag object `52d3e8cb76948ab0698c0e4fda6d8ada81a5a9d2` targets commit `d324e8ebc2752437db1702879b896430bc961f6d`.
- npm and the GitHub Release serve the same 120,404-byte tarball with SHA-256 `c736da718b54a6877d8c54167f06b199fcf9ac28cecb8c2e351c595eb4f56900`; the release manifest SHA-256 is `56b1c8210bd80dd6c7a877889db131ba305a650913f834451ea07de433e39e6c`.
- [npm `ruleblast@2.1.1`](https://www.npmjs.com/package/ruleblast/v/2.1.1) reports integrity `sha512-eJFLnTidG0DrFabzNDktmh7QhypR29coKI69EZ2/JebsZML4I4aMnqNCaQdO+IlacLAhHye3X+tReWOgtWK56A==`; exact-tarball publication means registry `gitHead is absent` rather than invented.

## 2.1.0 — RELEASED

- Repeat `--reality` to add both bundled opt-in CLI surfaces on one invocation. Default two-profile JSON is unchanged when neither flag is passed.
- Compact `REALITY GROUPS` text groups paths by evidence-equivalent stacks. Clusters form only from pairwise `SAME`. Unresolved and runtime-decided states stay unresolved.
- No `--reality all`, no fifth action, no fifth reality, no extra IDE host class.

### Release artifact

- Signed tag object `d89cc19599583ec7d81e379381ebd8fe13bb829f` targets commit `1cb9e6b7e1344c70b8d5dec0563c86efc3fd225b`.
- npm and the GitHub Release serve the same 120,388-byte tarball with SHA-256 `1a8c94fd7b2d1a5875d64552ff001f9fdbdfc641b8e889d40094d744d83a982d`; the release manifest SHA-256 is `08b9104ced23ff298a54f8d465d42eaf10509927291e0e05b9be697b6f8ed093`.
- [npm `ruleblast@2.1.0`](https://www.npmjs.com/package/ruleblast/v/2.1.0) reports integrity `sha512-tNxO7l++PZ02JIYyZNJGZvwtlb0l/lTM5aYhZUXFBFo22t2uv29nUWacYRzROQ/cwp7pkLbJAIpJCE2slJ6UvQ==`; exact-tarball publication means registry `gitHead is absent` rather than invented.

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
