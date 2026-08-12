# RuleBlast v1.0 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to execute this plan task-by-task; use subagent-driven-development for isolated implementation/review cycles.

**Goal:** Ship a public `ruleblast@1.0.0` CLI that turns Git-tracked `AGENTS.md`/`CLAUDE.md` changes into reproducible per-path blast counts, cross-agent split counts, and source-level explanations.

**Architecture:** A read-only snapshot layer feeds two prepared repository-profile resolvers. Each resolver projects a canonical context for every tracked path. A profile-neutral impact engine compares fingerprints, and text/JSON renderers consume the same deterministic result. No resolver reads ambient user state; no command mutates the target repository or calls a network/LLM.

**Tech Stack:** Node.js 20/22/24, TypeScript 7.0.2, npm, Vitest 4.1.10, `yaml` 2.9.0, `minimatch` 10.2.6, native Git CLI, ESM.

---

## Before implementation

Read the approved design first:

- `docs/superpowers/specs/2026-08-12-ruleblast-design.md`

Then create a clean feature branch. Do not publish npm, create a remote repository, post launch content, or apply to Codex for Open Source during implementation. Those are separate external actions after the release gates pass.

### Fixed product decisions

- Public product name: `RuleBlast`.
- Public launch version: `1.0.0`; internal checkpoints may use prerelease tags.
- Terminal is the only v1 product surface.
- Bundled profiles: `openai/codex-cli@1`, `anthropic/claude-code-cli@1`.
- Analysis set: Git-tracked repository blobs only.
- Default diff: `HEAD` → tracked worktree.
- No model calls, API key, network analysis, telemetry, auto-fix, HTML, dashboard, TUI, IDE extension, CI product, or security product.
- The engine counts profile projections, not observed model behavior.

### Execution checklist

- [ ] Task 1 — bootstrap package and test harness
- [ ] Task 2 — lock canonical domain model
- [ ] Task 3 — build normalized snapshots
- [ ] Task 4 — read Git refs/worktrees without mutation
- [ ] Task 4A — pair snapshots and count instruction edits
- [ ] Task 5 — create the profile seam
- [ ] Task 6 — implement `openai/codex-cli@1`
- [ ] Task 7 — implement `anthropic/claude-code-cli@1`
- [ ] Task 8 — calculate current and diff impact
- [ ] Task 9 — parse the four-action CLI
- [ ] Task 10 — render the curiosity ladder
- [ ] Task 11 — build the instant demo
- [ ] Task 12 — write forkable repository docs
- [ ] Task 13 — verify package, side effects, and performance
- [ ] Task 14 — produce the real case and launch packet
- [ ] Task 15 — publish only with explicit authorization

### Source tree budget

Start from this exact `src/` tree; extraction is allowed only to keep modules under the review threshold:

```text
src/
├── args.ts
├── canonical.ts
├── cli.ts
├── demo.ts
├── git.ts
├── impact.ts
├── line-diff.ts
├── model.ts
├── project.ts
├── render-text.ts
├── snapshot.ts
├── transition.ts
└── profiles/
    ├── claude-imports.ts
    ├── claude-rules.ts
    ├── claude.ts
    ├── codex.ts
    └── profile.ts
```

Production TypeScript stays at or below 3,000 non-generated lines. Any module over 400 lines triggers an extraction review; it is not forced to remain large merely to satisfy a cosmetic file-count cap.

Do not create `packages/`, `server/`, `web/`, `dashboard/`, `registry/`, `governance/`, or `rfc/` directories.

## Task 1: Bootstrap the package and test harness

**Files:**

- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/cli.ts`
- Create: `test/cli-version.test.ts`

### Step 1: Write the first failing test

```ts
// test/cli-version.test.ts
import { describe, expect, it } from "vitest";
import { getVersionLine } from "../src/cli.js";

describe("version output", () => {
  it("uses the package version without extra copy", () => {
    expect(getVersionLine("1.0.0")).toBe("ruleblast 1.0.0");
  });
});
```

### Step 2: Create pinned package metadata

Use this package contract:

```json
{
  "name": "ruleblast",
  "version": "0.0.0-development",
  "description": "Map where AGENTS.md and CLAUDE.md changes land across a repo—and where Codex and Claude Code split.",
  "type": "module",
  "bin": {
    "ruleblast": "dist/cli.js"
  },
  "files": [
    "dist",
    "fixtures/demo",
    "README.md",
    "CONTRACT.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "check": "tsc -p tsconfig.json && vitest run",
    "test": "vitest run",
    "test:watch": "vitest",
    "pack:check": "npm run build && npm pack --dry-run"
  },
  "dependencies": {
    "diff": "9.0.0",
    "minimatch": "10.2.6",
    "yaml": "2.9.0"
  },
  "devDependencies": {
    "@types/node": "20.19.43",
    "typescript": "7.0.2",
    "vitest": "4.1.10"
  },
  "license": "Apache-2.0"
}
```

`tsconfig.json` type-checks `src`, `test`, and `vitest.config.ts` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `module`/`moduleResolution: NodeNext`, and `noEmit: true`.

`tsconfig.build.json` extends it, emits only `src/**/*.ts` to `dist/`, creates declarations, and preserves the CLI shebang.

### Step 3: Run the test to verify RED

Run:

```bash
npm install
npm test -- test/cli-version.test.ts
```

Expected: FAIL because `getVersionLine` is not exported.

### Step 4: Add the minimal implementation

```ts
// src/cli.ts
#!/usr/bin/env node

export function getVersionLine(version: string): string {
  return `ruleblast ${version}`;
}
```

### Step 5: Verify GREEN

Run:

```bash
npm run check
npm run build
```

Expected: one passing test, zero TypeScript errors, and `dist/cli.js` begins with the Node shebang.

### Step 6: Commit

```bash
git add package.json package-lock.json tsconfig.json tsconfig.build.json vitest.config.ts .gitignore src/cli.ts test/cli-version.test.ts
git commit -m "chore: bootstrap ruleblast cli"
```

## Task 2: Lock the canonical domain model

**Files:**

- Create: `src/model.ts`
- Create: `src/canonical.ts`
- Create: `test/canonical.test.ts`

### Step 1: Write failing canonicalization tests

Cover all of these in `test/canonical.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../src/canonical.js";

describe("canonical result", () => {
  it("sorts object keys without reordering arrays", () => {
    expect(canonicalJson({ z: 1, a: ["b", "a"] })).toBe(
      '{"a":["b","a"],"z":1}',
    );
  });

  it("is byte-equivalent across insertion orders", () => {
    const left = { counts: { changed: 2, total: 5 }, revision: 1 };
    const right = { revision: 1, counts: { total: 5, changed: 2 } };
    expect(canonicalJson(left)).toBe(canonicalJson(right));
  });

  it("returns lowercase sha256", () => {
    expect(sha256("ruleblast")).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

### Step 2: Define exact public types

`src/model.ts` must define and export:

```ts
export type ProfileId = string;
export type Completeness = "COMPLETE" | "PARTIAL" | "UNKNOWN";
export type Trigger = "STARTUP" | "READ_TARGET";
export type CompositionState =
  | "ORDERED"
  | "UNORDERED"
  | "UNSPECIFIED"
  | "RUNTIME_DECIDED";
export type PayloadRelation = "SAME" | "DIFFERENT" | "INDETERMINATE";
export type SourceDisposition =
  | "SELECTED"
  | "SELECTED_EMPTY"
  | "IMPORTED"
  | "APPLIED_RULE"
  | "SHADOWED"
  | "EXCLUDED"
  | "UNRESOLVED_IMPORT";

export interface SnapshotRef {
  kind: "git" | "worktree" | "fixture";
  label: string;
  oid: string | null;
}

export interface ProjectionContext {
  cwd: string;
  trigger: Trigger;
  targetPath: string;
  repositoryOnly: true;
}

export interface ResolvedSource {
  path: string;
  disposition: SourceDisposition;
  digest: string;
  bytesUsed: number;
  truncated: boolean;
}

export interface Projection {
  profile: ProfileId;
  context: ProjectionContext;
  status: Completeness;
  composition: CompositionState;
  sources: ResolvedSource[];
  normalizedPayloadUnits: string[][];
  projectionDigest: string | null;
  normalizedPayloadDigest: string | null;
  evidence: string[];
}

export interface PathTransition {
  path: string;
  before: Projection[];
  after: Projection[];
  changedProfiles: ProfileId[];
  beforePayloadRelation: PayloadRelation;
  afterPayloadRelation: PayloadRelation;
  wasSplit: boolean | null;
  isSplit: boolean | null;
  causes: string[];
}

export interface InstructionDiffStats {
  addedLineCount: number;
  deletedLineCount: number;
  editedLineCount: number;
  binaryChangedSourceCount: number;
}

export interface InstructionSourceChange {
  kind: "ADD" | "DELETE" | "MODIFY";
  beforePath: string | null;
  afterPath: string | null;
  beforeDigest: string | null;
  afterDigest: string | null;
  stats: InstructionDiffStats;
}

export interface CurrentPathProjection {
  path: string;
  projections: Projection[];
  payloadRelation: PayloadRelation;
  isSplit: boolean | null;
}

export interface BaseImpactCounts {
  candidatePathCount: number;
  currentSplitPathCount: number;
  partialPathCount: number;
  unknownPathCount: number;
  indeterminatePathCount: number;
}

export interface CurrentProfileCounts {
  profile: ProfileId;
  completePathCount: number;
  partialPathCount: number;
  unknownPathCount: number;
}

export interface DiffProfileCounts extends CurrentProfileCounts {
  changedStackPathCount: number;
}

export interface CurrentImpactCounts extends BaseImpactCounts {
  byProfile: CurrentProfileCounts[];
}

export interface DiffImpactCounts extends BaseImpactCounts {
  changedStackPathCount: number;
  newlySplitPathCount: number;
  convergedPathCount: number;
  byProfile: DiffProfileCounts[];
}

export interface ImpactGroup {
  root: string;
  changedStackPathCount: number;
  newlySplitPathCount: number;
  samplePaths: string[];
}

export type FindingCode =
  | "PARTIAL_PROJECTION"
  | "UNKNOWN_PROJECTION"
  | "BINARY_SOURCE"
  | "UNSPECIFIED_COMPOSITION"
  | "UNSUPPORTED_GLOB_SEMANTIC"
  | "UNSUPPORTED_BOUNDARY";

export interface Finding {
  code: FindingCode;
  profile: ProfileId | null;
  path: string;
  detail: string;
}

export interface CurrentRuleBlastResult {
  mode: "current";
  schemaVersion: 1;
  resolverRevision: 1;
  snapshot: SnapshotRef;
  counts: CurrentImpactCounts;
  paths: CurrentPathProjection[];
  findings: Finding[];
}

export interface DiffRuleBlastResult {
  mode: "diff";
  schemaVersion: 1;
  resolverRevision: 1;
  before: SnapshotRef;
  after: SnapshotRef;
  diffStats: InstructionDiffStats;
  changedInstructionSources: InstructionSourceChange[];
  counts: DiffImpactCounts;
  groups: ImpactGroup[];
  paths: PathTransition[];
  findings: Finding[];
}

export type RuleBlastResult = CurrentRuleBlastResult | DiffRuleBlastResult;
```

Also export `parseProfileId(value: string): ProfileId`, which accepts only `^[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*@[1-9][0-9]*$`. V1 constants are `openai/codex-cli@1` and `anthropic/claude-code-cli@1`. Duplicate ids fail before profile preparation; all profile-keyed arrays are sorted by id. Do not use `any`, positional arrays, timestamps, absolute host paths, or untyped metadata bags.

### Step 3: Implement canonical JSON and digesting

`canonicalJson` recursively sorts object keys, preserves array order, rejects `undefined`, functions, symbols, non-finite numbers, cycles, and non-plain objects, and appends no newline. `sha256` uses `node:crypto`.

### Step 4: Verify

Run:

```bash
npm test -- test/canonical.test.ts
npm run check
```

Expected: all canonical tests pass; zero `any` in `src/model.ts`.

### Step 5: Commit

```bash
git add src/model.ts src/canonical.ts test/canonical.test.ts
git commit -m "feat: define canonical blast result"
```

## Task 3: Build normalized snapshots and the fixture harness

**Files:**

- Create: `src/snapshot.ts`
- Create: `test/snapshot.test.ts`
- Create: `test/fixtures/snapshot/basic.json`

### Step 1: Write failing snapshot tests

Tests must prove:

- paths are normalized to `/`;
- absolute paths and `..` traversal are rejected;
- duplicate paths are rejected;
- `listPaths()` returns Unicode code-point sorted paths;
- `entry()` preserves regular-file/symlink kind and executable mode;
- missing bytes return `null`;
- snapshot bytes are immutable copies;
- fixture refs contain no current time or host path.

Use this interface:

```ts
export interface SnapshotEntry {
  path: string;
  kind: "file" | "symlink";
  executable: boolean;
}

export interface RepositorySnapshot {
  readonly ref: SnapshotRef;
  listPaths(): Promise<readonly string[]>;
  entry(path: string): Promise<SnapshotEntry | null>;
  read(path: string): Promise<Uint8Array | null>;
}
```

### Step 2: Verify RED

Run:

```bash
npm test -- test/snapshot.test.ts
```

Expected: FAIL because `ManifestSnapshot` does not exist.

### Step 3: Implement `ManifestSnapshot`

The checked-in manifest format is:

```json
{
  "schemaVersion": 1,
  "label": "fixture-basic",
  "entries": [
    {
      "path": "AGENTS.md",
      "kind": "file",
      "executable": false,
      "base64": "cnVuIHRlc3RzCg=="
    },
    {
      "path": "src/index.ts",
      "kind": "file",
      "executable": false,
      "base64": "ZXhwb3J0IHt9Owo="
    }
  ]
}
```

Entry values are base64 bytes. Do not allow filesystem references inside a manifest. Fixture tests include one symlink entry so profile adapters can fail visibly at that boundary instead of accidentally following it.

### Step 4: Verify and commit

Run:

```bash
npm test -- test/snapshot.test.ts
npm run check
```

Expected: snapshot tests pass.

```bash
git add src/snapshot.ts test/snapshot.test.ts test/fixtures/snapshot/basic.json
git commit -m "feat: add deterministic repository snapshots"
```

## Task 4: Read Git refs and tracked worktrees without mutation

**Files:**

- Create: `src/git.ts`
- Create: `test/git.test.ts`

### Step 1: Write failing integration tests

Each test creates its own temporary Git repository with `git init`, local test identity, and explicit commits. Cover:

1. `findRepositoryRoot` from a nested directory.
2. A commit snapshot lists blobs from `git ls-tree -rz --full-tree`.
3. A commit snapshot reads bytes from the object database.
4. A worktree snapshot lists only tracked paths.
5. Modified tracked bytes are visible in the worktree snapshot.
6. Deleted tracked files read as `null` and are absent from `listPaths()`.
7. Untracked `AGENTS.md` is absent.
8. Filenames containing spaces, Unicode, tabs, and newlines are not split incorrectly.
9. A tracked symlink is represented by its link-target blob bytes without following it outside the repository; gitlinks/submodule roots are excluded.
10. An unstaged regular-file → symlink replacement is captured as a symlink with `readlink`, never with `readFile`; symlink → regular is captured as a regular file.
11. A directory or special-file replacement fails with `UNSUPPORTED_WORKTREE_NODE` instead of looking deleted.
12. An unmerged stage-1/2/3 index fails with `UNMERGED_INDEX` before analysis.
13. A missing skip-worktree entry is backed by its immutable stage-0 index blob and remains in `listPaths()`.
14. Mutation during capture retries once and then fails with `WORKTREE_CHANGED_DURING_SNAPSHOT`; no half-old/half-new snapshot escapes.
15. A missing path restored during capture and a symlink target changed during capture are caught by the final full-inventory pass.
16. The raw Git index bytes and index mtime are identical before/after; a configured fsmonitor hook sentinel is never invoked.

The mutation test uses an injected capture hook/barrier to change a tracked file between the first and second fingerprint; it must not depend on sleeps or filesystem timing luck.

### Step 2: Implement with `execFile`, never a shell string

Required primitives:

```ts
export async function findRepositoryRoot(start: string): Promise<string>;
export async function openGitSnapshot(root: string, ref: string): Promise<RepositorySnapshot>;
export async function openTrackedWorktree(root: string): Promise<RepositorySnapshot>;
```

Use a typed adapter error with code `UNMERGED_INDEX | UNSUPPORTED_WORKTREE_NODE | WORKTREE_CHANGED_DURING_SNAPSHOT`; CLI rendering may explain it, but it never converts one of these states into a valid empty snapshot.

Rules:

- Resolve refs once with `git rev-parse --verify --end-of-options <ref>^{commit}`.
- Use NUL-delimited Git output.
- Use `git cat-file blob <oid>:<path>` or a batch equivalent for bytes.
- Run every Git discovery command as `git --no-optional-locks -c core.fsmonitor=false ...` with `GIT_OPTIONAL_LOCKS=0` in the child environment. Do not call `git status`, do not refresh index stat data, and do not invoke configured hooks/daemons.
- Build the worktree inventory from NUL-delimited `git ls-files --stage` plus the skip-worktree flags from `git ls-files -v`. Capture the raw index bytes and metadata before discovery. Reject any path with only stage 1/2/3 entries. Exclude mode `160000` gitlinks.
- Treat the index as the immutable base and capture the tracked worktree overlay eagerly before returning `RepositorySnapshot`; profile preparation never performs a later live-filesystem read.
- For every materialized overlay path, use `lstat` on the actual worktree node rather than trusting the index mode. Actual symlinks use `readlink`; regular files are opened with no-follow semantics where the platform exposes them, and the opened handle's `fstat` identity/type must match the preceding `lstat` before bytes are read. A mismatch retries capture. Directories and special nodes fail closed. This handles stable unstaged type changes without following a link target and detects a concurrent type swap.
- A missing path is `DELETE` only when it is not marked skip-worktree. A missing skip-worktree path uses its stage-0 index blob and kind.
- After all overlay bytes are copied, rerun the same read-only `ls-files` inventory and revalidate **every** stage-0 path: presence/absence, skip-worktree state, actual node kind, regular-file identity/size/high-resolution mtime, and exact `readlink` target bytes for symlinks. Also compare raw index bytes and metadata before/after. This catches delete→restore, symlink retarget/restore, and index changes. Retry the whole capture once on any mismatch, then fail with `WORKTREE_CHANGED_DURING_SNAPSHOT`. Returned entries and bytes are immutable copies.
- Never use `checkout`, `switch`, `reset`, `stash`, `clean`, `add`, or `update-index`.
- Never pass user-controlled text through `shell: true`.
- Cache object bytes per snapshot.
- Keep absolute root paths inside the adapter; never put them in canonical results.

### Step 3: Verify

Run:

```bash
npm test -- test/git.test.ts
```

Expected: all 16 Git tests pass, index bytes/mtime remain unchanged, the fsmonitor sentinel remains untouched, and no profile can observe the live filesystem after snapshot creation.

### Step 4: Commit

```bash
git add src/git.ts test/git.test.ts
git commit -m "feat: add read-only git snapshots"
```

## Task 4A: Pair snapshots and count the first diff

**Files:**

- Create: `src/line-diff.ts`
- Create: `src/transition.ts`
- Create: `test/line-diff.test.ts`
- Create: `test/transition.test.ts`

### Step 1: Write failing line-stat tests

Lock this contract:

```ts
export function diffInstructionBytes(
  before: Uint8Array | null,
  after: Uint8Array | null,
): InstructionDiffStats;
```

Tests cover add, delete, replacement, identical bytes, CRLF/LF equivalence, a missing final newline, invalid UTF-8, NUL-containing binary input, and an equal-content path move represented as delete plus add. The algorithm:

- decodes non-binary bytes with UTF-8 replacement;
- normalizes CRLF to LF and preserves lone CR;
- ignores only a final-newline-only difference;
- uses `diffLines` from `diff@9.0.0`;
- sums added and deleted chunk lines;
- defines `editedLineCount = addedLineCount + deletedLineCount`;
- sets all line counts to zero and `binaryChangedSourceCount = 1` when either changed side contains NUL.

### Step 2: Write failing transition tests

Define:

```ts
export interface RepositoryTransition {
  readonly before: RepositorySnapshot;
  readonly after: RepositorySnapshot;
  readonly candidatePaths: readonly string[];
  readonly sourceChanges: readonly InstructionSourceChange[];
  readonly diffStats: InstructionDiffStats;
}

export async function buildTransition(
  before: RepositorySnapshot,
  after: RepositorySnapshot,
  sourceDependencyPaths: ReadonlySet<string>,
): Promise<RepositoryTransition>;
```

`candidatePaths` contains sorted blobs that actually exist in the after snapshot. A genuinely deleted worktree path is not a candidate; a sparse skip-worktree path backed by its index blob is. Source changes use same-path bytes for `MODIFY`. Every path disappearance is `DELETE` and every new path is `ADD`, even when their bytes match. V1 deliberately performs no heuristic rename inference, because equal bytes do not prove identity and a false rename would corrupt the headline line count.

### Step 3: Verify RED, implement, and verify GREEN

```bash
npm test -- test/line-diff.test.ts test/transition.test.ts
```

Expected before implementation: missing exports. Expected after implementation: all line and transition edge cases pass.

### Step 4: Commit

```bash
git add src/line-diff.ts src/transition.ts test/line-diff.test.ts test/transition.test.ts
git commit -m "feat: pair snapshots and count instruction edits"
```

## Task 5: Create the profile seam before either vendor resolver

**Files:**

- Create: `src/profiles/profile.ts`
- Create: `test/profile-contract.test.ts`

### Step 1: Write a failing fake-profile contract test

The impact layer must be able to consume a profile without checking its id. Lock this interface:

```ts
export interface EvidenceRef {
  readonly url: string;
  readonly retrievedAt: string;
  readonly revision: string;
  readonly claim: string;
}

export interface ProfileDefinition {
  readonly id: ProfileId;
  readonly evidence: readonly EvidenceRef[];
  isInstructionPath(path: string): boolean;
  prepare(snapshot: RepositorySnapshot): Promise<PreparedProfile>;
}

export interface PreparedProfile {
  readonly id: ProfileId;
  readonly sourceDependencyPaths: readonly string[];
  project(targetPath: string): Projection;
}
```

`sourceDependencyPaths` is exhaustive for the prepared snapshot: direct instruction files, imported nonstandard files such as `README.md`, applicable settings files, and rule files whose bytes can change any projection. It is sorted and contains no ordinary target code path merely because that path can trigger a rule. Validate `EvidenceRef.retrievedAt` as a real ISO calendar date in `YYYY-MM-DD` form; do not freeze the type to the v1 retrieval date because later profile revisions need new evidence.

The test uses a fake prepared profile and proves projection does not depend on process cwd, environment variables, wall clock, network, or filesystem reads after `prepare`.

### Step 2: Implement the types and shared helpers

Shared helpers may normalize paths, build ancestor directory lists, and create unknown findings. Do not place Codex/Claude filename rules in this file.

### Step 3: Verify and commit

```bash
npm test -- test/profile-contract.test.ts
npm run check
git add src/profiles/profile.ts test/profile-contract.test.ts
git commit -m "feat: define evidence-backed profile contract"
```

## Task 6: Implement `openai/codex-cli@1`

**Files:**

- Create: `src/profiles/codex.ts`
- Create: `test/codex-profile.test.ts`
- Create: `test/fixtures/codex/root.json`
- Create: `test/fixtures/codex/nested.json`
- Create: `test/fixtures/codex/override.json`
- Create: `test/fixtures/codex/empty-override.json`
- Create: `test/fixtures/codex/whitespace-budget.json`
- Create: `test/fixtures/codex/empty-agents.json`
- Create: `test/fixtures/codex/sibling.json`
- Create: `test/fixtures/codex/order.json`
- Create: `test/fixtures/codex/cap-exact.json`
- Create: `test/fixtures/codex/cap-truncated.json`
- Create: `test/fixtures/codex/invalid-utf8.json`
- Create: `test/fixtures/codex/instruction-symlink.json`
- Create: `test/fixtures/codex/assembly.json`

### Step 1: Write resolver fixtures and failing tests

Create one small manifest per behavior:

1. root `AGENTS.md`;
2. root plus nested chain;
3. non-empty `AGENTS.override.md` shadows same-directory `AGENTS.md`;
4. existing empty override shadows same-directory `AGENTS.md` but contributes no instruction content;
5. a whitespace-only override shadows same-directory `AGENTS.md`, is recorded `SELECTED_EMPTY` with `bytesUsed = 0`, and leaves the full budget for a non-empty descendant source;
6. an empty selected `AGENTS.md` contributes no content;
7. sibling subtree is not included;
8. root-to-cwd order is stable;
9. exactly 32 KiB of non-trim-empty selected content is complete;
10. the final non-empty source is byte-truncated after the remaining budget;
11. invalid UTF-8 uses replacement decoding consistently;
12. untracked files cannot appear because the snapshot cannot expose them;
13. a named instruction symlink yields `UNKNOWN` with an explicit boundary finding rather than following an arbitrary target;
14. two project entries with contents `root` and `nested` assemble as `root\n\nnested`, while the byte budget counts only 10 source bytes and no `--- project-doc ---` marker appears in repository-only mode.

The central expectation must look like:

```ts
expect(projection.context).toEqual({
  cwd: "services/payments",
  trigger: "STARTUP",
  targetPath: "services/payments/refund.ts",
  repositoryOnly: true,
});
expect(projection.sources.map(({ path, disposition }) => ({ path, disposition }))).toEqual([
  { path: "AGENTS.md", disposition: "SELECTED" },
  { path: "services/AGENTS.md", disposition: "SELECTED" },
  { path: "services/payments/AGENTS.override.md", disposition: "SELECTED" },
  { path: "services/payments/AGENTS.md", disposition: "SHADOWED" },
]);
```

### Step 2: Pin evidence in the profile

Use:

- Docs URL: `https://learn.chatgpt.com/docs/agent-configuration/agents-md`
- Retrieved: `2026-08-12`
- Implementation evidence revision: OpenAI Codex commit `4ef836f883c38ba6d39e6920f335ce6452b7de33` for byte-budget/truncation fixtures.

Do not fetch either source at runtime.

### Step 3: Implement the prepared resolver

Implementation requirements:

- Index only paths named `AGENTS.override.md` or `AGENTS.md`.
- Read each candidate once during `prepare`.
- Build ancestor chains from repo root to `dirname(targetPath)`.
- Select the first existing regular-file candidate per directory, before examining content.
- Preserve `SELECTED_EMPTY` and `SHADOWED` evidence; an empty or decoded trim-empty override never falls through to same-directory `AGENTS.md`.
- Enforce `32 * 1024` bytes like pinned Codex: truncate a selected file to remaining bytes, decode with UTF-8 replacement, and decrement by the truncated byte count only when decoded text is not trim-empty. A trim-empty selection records `bytesUsed = 0` and consumes no budget.
- Keep raw discovery-budget accounting separate from assembly. Join non-empty repository entries with `\n\n`; the `\n\n--- project-doc ---\n\n` separator is only for a preceding user/internal entry, which v1 excludes.
- Compute the profile-specific projection digest plus normalized payload units/digest; the latter excludes vendor separators, wrappers, source paths, and profile id.
- Cache projections by target directory because all files in one directory share the Codex startup context.

### Step 4: Verify

```bash
npm test -- test/codex-profile.test.ts
npm run check
```

Expected: all 14 behaviors pass.

### Step 5: Commit

```bash
git add src/profiles/codex.ts test/codex-profile.test.ts test/fixtures/codex
git commit -m "feat: resolve codex repository instructions"
```

## Task 7: Implement `anthropic/claude-code-cli@1`

**Files:**

- Create: `src/profiles/claude.ts`
- Create: `src/profiles/claude-imports.ts`
- Create: `src/profiles/claude-rules.ts`
- Create: `test/claude-profile.test.ts`
- Create: `test/fixtures/claude/root.json`
- Create: `test/fixtures/claude/dot-claude-root.json`
- Create: `test/fixtures/claude/ambiguous-root.json`
- Create: `test/fixtures/claude/nested.json`
- Create: `test/fixtures/claude/local.json`
- Create: `test/fixtures/claude/rule-unconditional.json`
- Create: `test/fixtures/claude/rule-path-match.json`
- Create: `test/fixtures/claude/rule-braces.json`
- Create: `test/fixtures/claude/import-relative.json`
- Create: `test/fixtures/claude/import-code-literal.json`
- Create: `test/fixtures/claude/import-depth.json`
- Create: `test/fixtures/claude/import-external.json`
- Create: `test/fixtures/claude/import-missing.json`
- Create: `test/fixtures/claude/import-cycle.json`
- Create: `test/fixtures/claude/excludes-relocatable.json`
- Create: `test/fixtures/claude/excludes-absolute.json`
- Create: `test/fixtures/claude/rule-order-unspecified.json`
- Create: `test/fixtures/claude/rule-memory-order-unspecified.json`
- Create: `test/fixtures/claude/glob-edge-cases.json`
- Create: `test/fixtures/claude/glob-budget.json`
- Create: `test/fixtures/claude/instruction-symlink.json`
- Create: `test/fixtures/claude/html-comments.json`
- Create: `test/fixtures/claude/malformed-frontmatter.json`

### Step 1: Write failing fixtures before parser code

Cover:

1. root `CLAUDE.md`;
2. root `.claude/CLAUDE.md` alternative;
3. both alternatives present yields `PARTIAL` with an explicit evidence string unless pinned docs establish ordering;
4. nested `CLAUDE.md` enters on target read;
5. tracked `CLAUDE.local.md` is labeled and included;
6. unconditional `.claude/rules/**/*.md`;
7. one `paths` glob match and one non-match;
8. multiple patterns with brace expansion;
9. `@` import relative to the containing file;
10. imports inside inline/fenced code stay literal;
11. recursive imports stop after four hops;
12. external import yields `UNKNOWN`;
13. untracked/missing import yields `UNKNOWN`;
14. import cycle yields `UNKNOWN` with the cycle path;
15. a location-independent project `claudeMdExcludes` pattern removes a matching source;
16. an absolute/drive-prefixed exclude is recorded and makes the relevant projection `PARTIAL` without leaking checkout location;
17. multiple applicable rule files use `composition = UNSPECIFIED`, not invented alphabetical precedence;
18. one project-memory source plus one applicable rule also uses `composition = UNSPECIFIED` unless pinned evidence proves their total order;
19. fixed glob behavior covers dotfiles, escaped `[`, malformed `[`, `**`, and brace alternatives without platform-dependent matching;
20. brace/pattern expansion that would exceed 1,000 alternatives or 4 MiB fails as `UNKNOWN` before materializing the expansion;
21. block HTML comments are removed but fenced-code comments remain;
22. malformed YAML frontmatter yields `UNKNOWN`, never global applicability;
23. a symlinked memory/rule source yields `UNKNOWN` without following the target.

Central path-rule expectation:

```ts
expect(apiProjection.sources.map((source) => source.path)).toContain(
  ".claude/rules/api.md",
);
expect(uiProjection.sources.map((source) => source.path)).not.toContain(
  ".claude/rules/api.md",
);
expect(apiProjection.context.trigger).toBe("READ_TARGET");
```

### Step 2: Pin evidence

Use `https://code.claude.com/docs/en/memory`, retrieved `2026-08-12`. Record individual claims for memory locations, ancestor/on-demand loading, imports, rules, path globs, excludes, and comment stripping.

### Step 3: Implement bounded parsing

Rules:

- Parse frontmatter with `yaml`.
- Match only normalized forward-slash repository paths through one wrapper pinned to `minimatch@10.2.6`; wrapper flags themselves are implementation choices, not vendor evidence. A projection can remain `COMPLETE` only for glob behavior directly supported by the pinned official evidence/fixture set. Dotfile, case-folding, escape, extglob, or malformed-bracket behavior without such evidence is recorded as `UNSUPPORTED_GLOB_SEMANTIC` and makes the affected projection `PARTIAL` or `UNKNOWN`; it is never silently promoted to documented Claude parity. Never inherit host platform case-folding.
- Before brace expansion, run a bounded parser that counts the Cartesian alternatives without materializing more than 1,001 and rejects an expanded representation above 4 MiB. Exceeding either limit is `UNKNOWN`. Fixtures pin malformed/escaped brackets, dot paths, globstar, braces, and overflow.
- Scan imports with a small Markdown-state machine that distinguishes normal text, inline code, and fenced code; do not use a single global regex.
- Allow imports only when the resolved target is inside the snapshot and tracked.
- Expand imports to at most four edges.
- Detect cycles before reading again.
- Parse only the allowlisted `claudeMdExcludes` field from tracked project settings. Apply only patterns beginning `**/` with no absolute/drive prefix against a canonical `/__ruleblast_repo__/...` path. Record any other exclude, do not apply it, and mark potentially affected projections `PARTIAL`.
- Model documented ancestor order and import position as `ORDERED`. When multiple general/path rules apply, or when any applicable rule is combined with project memory and no pinned official source establishes their total order, preserve canonical display order but set `composition = UNSPECIFIED`; display order is never used as semantic order. One lone payload source can remain `ORDERED` because no relative order exists to invent.
- Instruction symlinks yield `UNKNOWN`; never decode link-target text as instructions.
- Cache parsed files, rules, imports, and target projections.

Deterministic fixtures prove RuleBlast reproducibility; they do not by themselves prove Claude parity. Each glob behavior rendered `COMPLETE` must cite a pinned vendor claim or implementation revision in `EvidenceRef`. Unsupported edge behavior remains visibly partial/unknown until such evidence exists.

### Step 4: Verify

```bash
npm test -- test/claude-profile.test.ts
npm run check
```

Expected: all 23 behaviors pass, including unknown/partial paths, relation-indeterminate composition, bounded globs, and relocation-invariant excludes.

### Step 5: Commit

```bash
git add src/profiles/claude.ts src/profiles/claude-imports.ts src/profiles/claude-rules.ts test/claude-profile.test.ts test/fixtures/claude
git commit -m "feat: resolve claude repository instructions"
```

## Task 8: Build profile-neutral projection and impact calculation

**Files:**

- Create: `src/project.ts`
- Create: `src/impact.ts`
- Create: `test/impact.test.ts`
- Create: `test/metamorphic.test.ts`

### Step 1: Write the failing impact matrix

Use fake profiles first, then run the same assertions against real profiles. Lock these transitions:

| Before | After | Expected |
|---|---|---|
| same/same | same/same | unchanged, aligned |
| same/same | changed/same | changed, newly split |
| changed/same | same/same | changed, converged |
| A/B | C/D | both changed, still split |
| partial/same | changed/same | partial, excluded from definitive split counts |
| unknown/same | changed/same | unknown, excluded from definitive split counts |
| ordered `[A,B]` / ordered `[A,B]` | same sequence | same |
| ordered `[A,B]` / ordered `[B,A]` | different sequence | different |
| unordered `{A,B}` / unordered `{B,A}` | equal multiset | same |
| ordered `[A,B]` / unordered `{A,B}` | equal multiset | indeterminate |
| ordered `[A,B]` / unspecified `{A,B}` | same sets | indeterminate, not split |
| ordered `[A,B]` / unspecified `{A,C}` | different multisets | definitively split |
| runtime-decided / any | any units | indeterminate |

Required count test:

```ts
expect(result.counts).toEqual({
  candidatePathCount: 5,
  changedStackPathCount: 3,
  newlySplitPathCount: 2,
  convergedPathCount: 0,
  currentSplitPathCount: 2,
  partialPathCount: 0,
  unknownPathCount: 1,
  indeterminatePathCount: 1,
  byProfile: [
    {
      profile: "anthropic/claude-code-cli@1",
      completePathCount: 5,
      partialPathCount: 0,
      unknownPathCount: 0,
      changedStackPathCount: 1,
    },
    {
      profile: "openai/codex-cli@1",
      completePathCount: 4,
      partialPathCount: 0,
      unknownPathCount: 1,
      changedStackPathCount: 3,
    },
  ],
});
```

### Step 2: Implement `analyzeCurrent` and `analyzeDiff`

```ts
export interface AnalysisInput {
  snapshot: RepositorySnapshot;
  profiles: readonly ProfileDefinition[];
}

export interface DiffAnalysisInput {
  before: RepositorySnapshot;
  after: RepositorySnapshot;
  profiles: readonly ProfileDefinition[];
}

export async function analyzeCurrent(
  input: AnalysisInput,
): Promise<CurrentRuleBlastResult>;

export async function analyzeDiff(
  input: DiffAnalysisInput,
): Promise<DiffRuleBlastResult>;
```

Rules:

- v1 analysis rejects missing, duplicate, or unknown profile ids and sorts the two bundled profiles by id before projection.
- Current analysis has one `snapshot`, current-only path records, and no artificial before state.
- Diff analysis prepares every profile against both snapshots, unions all before/after `sourceDependencyPaths`, builds exactly one `RepositoryTransition`, and uses its sorted, existing after-state blobs for `candidatePathCount`. This is how an edit to an imported `README.md` becomes an instruction-source change without classifying every README as an instruction globally.
- A newly added path is projected hypothetically in the before tree using its directory.
- Source changes and line stats come only from that `RepositoryTransition`; the downstream impact calculation does not reclassify files.
- Profile fingerprints determine before/after change. `changedStackPathCount` and each per-profile counterpart increment only when both projections are `COMPLETE` and their fingerprints differ; an incomplete before/after pair is reported through completeness/indeterminate fields, not promoted into the hero count.
- `normalizedPayloadUnits` are created only by one shared helper after profile-local transforms/import expansion. A contribution is one model-visible content contribution; imports split only at their documented insertion points. Empty content yields `[]`. For each non-empty contribution normalize CRLF to LF, preserve lone CR and other whitespace, split into logical lines, drop only the terminal empty line caused by a final LF, hash each line as `sha256("ruleblast-payload-line-v1\0" + UTF8(line))`, and preserve that ordered digest array as one item of `string[][]`. Preserve duplicate lines and duplicate contributions. `"" → []`; `"\n" → [[emptyLineDigest]]`. Adapters cannot emit arbitrary boundaries. Vendor wrappers, joining separators, source paths, and profile ids never enter this relation.
- Apply one relation table: any `PARTIAL`/`UNKNOWN` pair or any `RUNTIME_DECIDED` composition is `INDETERMINATE`; `ORDERED/ORDERED` compares the exact sequence of contribution sequences; `UNORDERED/UNORDERED` compares the multiset of ordered contribution sequences; `ORDERED/UNORDERED` with an equal contribution multiset is `INDETERMINATE`; either `UNSPECIFIED` with an equal contribution multiset is `INDETERMINATE`; in the last two cases unequal multisets prove `DIFFERENT`. Only the two documented equal cases produce `SAME`.
- Across N profiles, summarize as `SAME` only when every pair is proven equal, `DIFFERENT` when any pair is proven different, and `INDETERMINATE` when no difference is proven but any pair is undecidable. Map these to `isSplit = false`, `true`, and `null`. Track unresolved coverage separately: a path can be aggregate `DIFFERENT`/`isSplit = true` because A/B prove a split and still increment `indeterminatePathCount` because C is unknown.
- `newlySplitPathCount` is exactly aggregate `SAME → DIFFERENT`; `convergedPathCount` is exactly aggregate `DIFFERENT → SAME`; `currentSplitPathCount` is exactly current/after aggregate `DIFFERENT`. If either aggregate endpoint itself is `INDETERMINATE`, the transition enters neither newly-split nor converged; unresolved pair/profile coverage that coexists with an aggregate `DIFFERENT` is tracked separately and does not erase the proven split.
- `PARTIAL` increments `partialPathCount`; `UNKNOWN` increments `unknownPathCount`. Independently, a path increments `indeterminatePathCount` when at least one current/after profile or pair is unresolved/indeterminate. Partial/unknown paths therefore always enter it, and a complete `UNSPECIFIED` pair can enter it without entering either completeness count. This count may overlap `currentSplitPathCount`; only an aggregate relation of `INDETERMINATE` maps to `isSplit = null`.
- Sort profiles, paths, sources, causes, findings, and groups explicitly before canonicalization.
- Group by the nearest changed instruction-source directory; root is `.`.

### Step 3: Add metamorphic tests

Required invariants:

1. identical snapshots → zero impact;
2. reversed manifest enumeration → byte-identical JSON;
3. unrelated code edit → zero impact;
4. root instruction edit → every modeled path under that profile changes;
5. nested Codex edit → only descendant directory projections change;
6. Claude path-rule edit → only matching paths change;
7. non-empty override addition shadows same-directory `AGENTS.md`;
8. two runs → byte-identical canonical JSON;
9. changing process cwd and environment variables → identical result;
10. absolute temporary repository location → identical core result.
11. editing a nonstandard file imported by `CLAUDE.md` → Claude profile changes and `diffStats` includes that dependency;
12. editing the same non-imported filename → zero instruction impact.
13. adapter contribution boundaries are canonical and preserved: `"a\nb"`, contributions `"a"` + `"b"`, and `"ab"` are three distinct payload structures; `""` yields zero units; `"\n"` yields one empty-line unit; duplicate-line and duplicate-contribution multiplicity is preserved.
14. the full composition truth table covers `ORDERED`, `UNORDERED`, `UNSPECIFIED`, and `RUNTIME_DECIDED`, including `COMPLETE + UNSPECIFIED → indeterminatePathCount`.
15. A/B proven `DIFFERENT` plus C `UNKNOWN` yields `isSplit = true`, increments `currentSplitPathCount`, and also increments `unknownPathCount` plus `indeterminatePathCount`.

Invariant 10 must run both a relocatable `**/...` exclude and an absolute exclude. The first makes the same applicability decision at both locations; the second remains the same explicit `PARTIAL` finding at both locations.

### Step 4: Verify performance shape

Add a synthetic 10,000-path manifest test that asserts all snapshot instruction bytes are read at most once and total projection work remains bounded by prepared-profile caches. Do not place a strict wall-clock assertion in the unit test.

### Step 5: Verify and commit

```bash
npm test -- test/impact.test.ts test/metamorphic.test.ts
npm run check
git add src/project.ts src/impact.ts test/impact.test.ts test/metamorphic.test.ts
git commit -m "feat: calculate instruction blast radius"
```

## Task 9: Parse the four-action CLI

**Files:**

- Create: `src/args.ts`
- Create: `test/args.test.ts`
- Modify: `src/cli.ts`

### Step 1: Write a table-driven failing parser test

Accepted forms:

```text
ruleblast [path]
ruleblast diff [base] [--to <ref|WORKTREE>] [--json]
ruleblast explain <path> [--from <ref>] [--to <ref|WORKTREE>] [--json]
ruleblast demo [--explain <path>] [--json]
ruleblast --help
ruleblast --version
```

Defaults:

- scan path: `.`;
- diff base: `HEAD`;
- diff target: `WORKTREE`;
- explain target: `WORKTREE`;
- color: auto based on TTY and `NO_COLOR`.

Reject unknown flags, extra positionals, an empty path, base equal to target, and `--json` combined with forced ANSI. `demo --explain` resolves the named path inside the packaged fixture; it never treats `DEMO_BASE` as a Git ref.

### Step 2: Implement a dependency-free parser

Do not add Commander, Yargs, Chalk, or an argument-parser dependency. Return a discriminated union from `parseArgs` and a structured usage error; do not call `process.exit` inside the parser.

### Step 3: Wire the command runner

`src/cli.ts` must expose an injectable runner for tests:

```ts
export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
  cwd(): string;
  env: Readonly<Record<string, string | undefined>>;
}

export async function runCli(argv: readonly string[], io: CliIo): Promise<number>;
```

Exit codes:

- `0`: successful scan, including zero findings;
- `1`: usage or invalid repository/ref;
- `2`: analysis completed but no definitive result could be produced for any candidate path;
- `70`: unexpected internal error, rendered without stack unless `RULEBLAST_DEBUG=1`.

`--json` writes exactly one canonical JSON object to stdout. Human diagnostics go to stderr.

### Step 4: Verify and commit

```bash
npm test -- test/args.test.ts test/cli-version.test.ts
npm run check
git add src/args.ts src/cli.ts test/args.test.ts
git commit -m "feat: add compact ruleblast commands"
```

## Task 10: Render the curiosity ladder in text

**Files:**

- Create: `src/render-text.ts`
- Create: `test/render-text.test.ts`
- Create: `test/golden/*.txt`

### Step 1: Write failing golden tests

Lock five views:

- current repository with splits;
- current repository with aligned profiles;
- current repository with no tracked instruction source and a `ruleblast demo` CTA;
- diff with blast and newly split paths;
- explain before/after;
- no instruction changes;
- partial/unknown results.

The main diff golden must follow this order:

```text
RULEBLAST · HEAD → WORKTREE

9 instruction-line edits.

1,842
tracked paths changed stack.

1,229 paths now live in two AI realities.

The largest fracture starts at packages/api/internal/.

Pick one path. See every source:
  ruleblast explain packages/api/internal/refund.ts --from HEAD

Scope: 3,906 tracked paths · repository-only · resolver revision 1
```

### Step 2: Implement a semantic renderer

Requirements:

- Counts come only from `RuleBlastResult`.
- “two AI realities” maps only to `newlySplitPathCount`.
- Non-zero partial and unknown counts are shown after the main reveal and never folded into definitive split counts.
- No color is required to understand state.
- ANSI is disabled for redirected output and `NO_COLOR`.
- Singular/plural grammar is tested.
- Path samples are stable, never random.
- No fake progress delay or spinner.
- Error messages say how to recover in one line.

### Step 3: Verify and commit

```bash
npm test -- test/render-text.test.ts
npm run check
git add src/render-text.ts test/render-text.test.ts test/golden
git commit -m "feat: reveal blast results in the terminal"
```

## Task 11: Build the deterministic instant-win demo

**Files:**

- Create: `src/demo.ts`
- Create: `fixtures/demo/case.json`
- Create: `test/demo.test.ts`
- Create: `scripts/generate-demo.mjs`

### Step 1: Define the compact fixture recipe

`fixtures/demo/case.json` describes deterministic path groups and before/after instruction bytes. It must expand to:

- 3,906 tracked paths total;
- 613 paths where both profiles receive matching changed effective content;
- 1,229 paths where only Codex changes;
- 2,064 unaffected paths;
- 9 normalized instruction-line edits under `InstructionDiffStats`;
- 1,842 changed-stack paths;
- 1,229 newly split paths.

The recipe uses fixed sequential filenames and no randomness.

### Step 2: Write the failing end-to-end test

```ts
expect(result.counts.candidatePathCount).toBe(3906);
expect(result.counts.changedStackPathCount).toBe(1842);
expect(result.counts.newlySplitPathCount).toBe(1229);
expect(result.diffStats.editedLineCount).toBe(9);
expect(canonicalJson(first)).toBe(canonicalJson(second));
```

Also assert that the rendered output contains `DEMO FIXTURE` before the first number, `demo --explain packages/api/internal/refund.ts` exits `0` with the expected before/after chains, and no independent literal count exists in `render-text.ts`.

### Step 3: Implement demo expansion through `ManifestSnapshot`

The production `demo` command must call the same profile preparation, impact engine, canonicalizer, and renderer as a real repository. Only the snapshot source differs.

`scripts/generate-demo.mjs` regenerates and validates the recipe; it does not write terminal screenshots or result numbers into source code.

### Step 4: Verify the under-ten-second gate

Run from a production build:

```bash
npm run build
node dist/cli.js demo
```

Expected: exact golden result, exit `0`, first complete output in under 10 seconds on the documented baseline machine.

### Step 5: Commit

```bash
git add src/demo.ts fixtures/demo/case.json test/demo.test.ts scripts/generate-demo.mjs
git commit -m "feat: add reproducible ruleblast demo"
```

## Task 12: Make the repository self-explaining and forkable

**Files:**

- Create: `README.md`
- Create: `CONTRACT.md`
- Create: `ROADMAP.md`
- Create: `CONTRIBUTING.md`
- Create: `CHANGELOG.md`
- Create: `AGENTS.md`
- Create: `CLAUDE.md`
- Create: `LICENSE`
- Create: `.github/ISSUE_TEMPLATE/wrong-blast.yml`
- Create: `.github/ISSUE_TEMPLATE/missing-blast.yml`
- Create: `.github/ISSUE_TEMPLATE/weird-blast.yml`
- Create: `.github/ISSUE_TEMPLATE/profile-evidence.yml`
- Create: `test/docs.test.ts`

### Step 1: Write docs contract tests

Tests must assert:

- README first 160 words contain `RuleBlast`, `AGENTS.md`, `CLAUDE.md`, `Codex`, `Claude Code`, and `Git`;
- every synthetic number is preceded by `DEMO FIXTURE` before its first appearance;
- the first quick-start command is `npx ruleblast@latest`; `npx ruleblast@latest diff HEAD~1` is the second action;
- reproduction examples pin `ruleblast@1.0.0`;
- before the release tag, `ROADMAP.md` separates `IN BUILD`, `NEXT`, and `HORIZON`; the release task atomically changes `IN BUILD` to `SHIPPED`;
- no roadmap date or unchecked Markdown checkbox exists;
- `CONTRACT.md` defines projection context and every metric;
- `CLAUDE.md` contains `@AGENTS.md` so the repository self-dogfoods aligned root instructions;
- banned phrases do not appear as product claims: `actual prompt`, `agent will obey`, `guaranteed behavior`, `AI-ready score`, `100% accurate`.

### Step 2: Write README in the locked information order

```text
name
→ hero number
→ second diff sentence
→ labeled terminal recording
→ one npx command
→ explain CTA
→ collapsed real-case provenance/reproduction
→ compact scope details
→ how it works
→ examples
→ contribute a blast case
→ roadmap link
```

Do not place a table of contents, badge wall, sponsor wall, architecture diagram, or full support matrix above quick start.

### Step 3: Make one contribution unit obvious

`CONTRIBUTING.md` defines a blast case as:

```text
official source URL + retrieval date
before manifest
after manifest
expected canonical JSON
one sentence explaining the surprise
```

It rejects generic prompts, undocumented clients, feature dumps, and fixtures with only positive cases.

### Step 4: Write a restrained public roadmap with the multi-agent mechanism

`ROADMAP.md` must include:

- `IN BUILD — v1.0 The Second Diff`: Codex + Claude, scan/diff/explain/demo. Release task changes this label to `SHIPPED`.
- `NEXT — v1.1 Blast Receipts`: Markdown receipts from the same core JSON; no visual product.
- `HORIZON — v1.2 Third Reality`: one evidence-gated third agent surface.
- `HORIZON — v2.0 Reality Packs`: finite declarative profile IR plus explicitly installed packs.
- `HORIZON — v2.1 Many-Reality Diff`: N-way clustering such as “8 agent surfaces, 3 documented realities.”

The roadmap must state that Copilot CLI and Copilot VS Code are separate surfaces, as are any CLI/editor/cloud modes whose documented loading semantics differ.

End the README roadmap teaser with:

```text
Today: Codex + Claude Code.

The profile seam is already there for the rest.

Two agents share this repo.
How many rule realities are still hiding in it…?
```

### Step 5: Verify and commit

```bash
npm test -- test/docs.test.ts
npm run check
git add README.md CONTRACT.md ROADMAP.md CONTRIBUTING.md CHANGELOG.md AGENTS.md CLAUDE.md LICENSE .github test/docs.test.ts
git commit -m "docs: tell the ruleblast story"
```

## Task 13: Verify package behavior, side effects, and performance

**Files:**

- Create: `scripts/package-smoke.mjs`
- Create: `scripts/benchmark.mjs`
- Create: `scripts/release-check.mjs`
- Create: `test/package-smoke.test.ts`
- Create: `.github/workflows/verify.yml`

The single GitHub workflow verifies this repository; RuleBlast itself does not become a CI/CD product.

### Step 1: Write a failing packed-install smoke test

The script must:

1. run `npm pack --json`;
2. create a fresh temporary directory;
3. install the produced tarball with scripts disabled;
4. initialize a tiny Git fixture;
5. run `ruleblast demo`, `ruleblast .`, `ruleblast diff HEAD`, and `ruleblast explain src/index.ts`;
6. assert exit codes and JSON shape;
7. assert raw index bytes/mtime, tracked inventory, and target worktree bytes/kinds before/after are identical without invoking `git status` or fsmonitor;
8. remove only the exact temporary directory it created.

### Step 2: Implement the benchmark

`scripts/benchmark.mjs` creates an in-memory 10,000-path manifest with nested instructions, performs five warmups and 20 measured runs, and reports median/p95 plus Node/OS/CPU metadata outside the canonical result.

Release target: p95 under two seconds on the documented baseline. If it misses, profile preparation/caching is optimized before release; do not hide the number.

### Step 3: Implement the release checker

It fails unless:

- `npm run check` and `npm run build` pass;
- packed tarball is at most 1 MiB compressed;
- package contains only allowlisted files;
- package has no install lifecycle scripts;
- demo golden output matches;
- two JSON runs are byte-identical;
- no absolute workspace path appears in JSON;
- raw target index bytes/mtime and the read-only tracked inventory are unchanged, with the fsmonitor sentinel untouched;
- all runtime dependencies are at or below three;
- production TypeScript is at most 3,000 non-generated lines and no module exceeds 400 lines without a recorded extraction review.

### Step 4: Add the minimal verification workflow

The workflow runs install, check, build, and package smoke on Node 20, 22, and 24. No publish, deployment, comment bot, security scan, or release automation is included.

### Step 5: Verify and commit

```bash
npm run check
npm run build
node scripts/benchmark.mjs
node scripts/release-check.mjs
git add scripts test/package-smoke.test.ts .github/workflows/verify.yml
git commit -m "test: verify packed ruleblast release"
```

Expected: all gates pass, p95 is printed, tarball is ≤1 MiB, and target repositories remain unmodified.

## Task 14: Produce one real case and the launch packet

**Files:**

- Create: `cases/README.md`
- Create: `scripts/capture-case.mjs`
- Create: `docs/launch/1.0.0.md`
- Create: `docs/launch/codex-for-oss-readiness.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

The selected case path is data-derived, not handwritten: `cases/{owner}__{repo}/{baseSha12}..{headSha12}.json`. `scripts/capture-case.mjs` validates immutable full SHAs, computes this path, writes canonical JSON, and refuses to overwrite an existing case. No fake case file is created before the pilot.

### Step 1: Run the private pilot

Evaluate at least 25 real commits that change tracked repository instructions. Record locally:

- repository URL;
- base/head ids;
- RuleBlast version/commit;
- counts;
- whether the blast was non-obvious;
- any unknown/partial cause;
- permission/license suitability for publishing the derived case.

Promotion gate: at least five non-obvious useful results and no unresolved count-changing P0/P1 defect.

### Step 2: Select one reproducible public case

The chosen case JSON contains no copied source content beyond what its license permits. It contains repository URL, immutable refs, resolver revision, result core, core digest, and a generated reproduction command of this form:

```bash
npx ruleblast@1.0.0 diff <base> --to <head> --json
```

`<base>` and `<head>` above are CLI metavariables documented for the capture script; the emitted case and launch packet contain full concrete SHAs. Do not use a live branch name in the case.

### Step 3: Generate the terminal recording from the packed release

The recording must be 6–8 seconds, use the labeled demo or pinned public case, contain no typed fake output, and match the current CLI golden result. Store only the generated asset required by README.

### Step 4: Prepare, but do not send, launch copy

`docs/launch/1.0.0.md` contains:

- GitHub repo description and topics;
- Show HN title/body;
- short launch post;
- pinned reproduction command;
- `v1.0.0 — The Second Diff` release notes;
- next-layer closing line: “The blast can now be explained. Can it travel without losing the receipt?”

### Step 5: Prepare Codex for Open Source evidence

The readiness note references the [official program page](https://learn.chatgpt.com/community/codex-for-oss) and records public usage, maintainership, release activity, ecosystem role, and how Codex supports maintenance. It does not claim acceptance and is not linked from the README.

### Step 6: Verify and commit

Run the pinned reproduction command twice and byte-compare JSON. Run the full release checker.

```bash
node scripts/release-check.mjs
git add cases scripts/capture-case.mjs docs/launch README.md CHANGELOG.md
git commit -m "docs: prepare ruleblast 1.0 launch"
```

Expected: no placeholder token, mutable ref, invented metric, or unlabelled demo number remains.

## Task 15: Public release gate

This task contains external state changes. Execute it only after the user explicitly authorizes publication.

### Step 1: Reserve and verify identity

- Re-check exact GitHub, npm, common search, and trademark risk.
- Create the intended public GitHub repository.
- Reserve/publish the npm identity through the real release, not an empty package.
- Configure repository description and topics from the launch packet.

### Step 2: Final version commit

Set package and changelog version to `1.0.0`, change the `ROADMAP.md` v1.0 label from `IN BUILD` to `SHIPPED`, run `npm install --package-lock-only`, then:

```bash
npm ci
node scripts/release-check.mjs
git status --short
```

Expected: all gates pass and only intentional version/changelog changes remain.

Commit:

```bash
git add package.json package-lock.json CHANGELOG.md ROADMAP.md
git commit -m "chore: release ruleblast 1.0.0"
git tag -s v1.0.0 -m "RuleBlast 1.0.0 — The Second Diff"
```

### Step 3: Publish atomically

- Push the exact commit and signed tag.
- Publish the packed, already-tested tarball.
- Create the GitHub Release from the same tag.
- Verify `npx ruleblast@1.0.0 demo` in a fresh directory.
- Only then post launch copy.

If any post-publish verification differs from the tested artifact, stop promotion and issue a patch; do not silently edit evidence.

## Post-v1 release plan: multi-platform without core sprawl

These versions are architecture commitments, not work authorized in the v1 implementation branch.

### v1.1.0 — Blast Receipts

**One new dimension:** portable artifacts.

Add `--format markdown` to existing commands. The receipt consumes canonical `RuleBlastResult`; it cannot recalculate counts. Every artifact carries refs, resolver revisions, scope, and core digest. There is no SVG, image generator, or visual product.

Gate: a result generated on one machine verifies byte-for-byte on another after line-ending normalization defined by the format.

### v1.2.0 — Third Reality

**One new dimension:** one additional documented agent surface.

Use the existing N-profile `ProfileDefinition` seam and v1 composition field. Candidate selection is evidence-driven. `copilot-cli` and `copilot-vscode` are never treated as one profile. Preserve `UNSPECIFIED` or `RUNTIME_DECIDED`; do not manufacture precedence for a clean matrix.

Gate: the third profile passes the same positive, negative, ordering, ambiguity, mutation, and determinism fixtures as the first two without adding vendor branches to `impact.ts`, `project.ts`, or renderers.

### v2.0.0 — Reality Packs

**One new dimension:** explicitly installed multi-platform profile packs. The declarative Open Resolver is the internal mechanism of this release, not a separate marketing release.

Move profile behavior into a finite, data-only operator model:

```text
anchor repository root
walk ancestors
choose first existing candidate
decode/normalize bytes and drop selected trim-empty content
collect recursive pattern
parse allowlisted YAML frontmatter/settings fields
strip HTML comments outside code spans/fences
compile bounded path globs and exclusions
expand bounded import
apply on trigger/path glob
compose ordered/unordered/unspecified sources
apply byte budget
stop at symlink, external-path, malformed-data, and unsupported-node boundaries
preserve runtime-decided/unknown state
```

This list is a capability checklist, not a hand-waved final schema. V2 starts with a separate reviewed IR specification that closes each operator as a discriminated JSON union, defines transform order and budgets, and demonstrates that every Codex/Claude v1 golden—including empty selection, frontmatter, comments, excludes, invalid globs, imports, byte truncation, and symlink boundaries—can be encoded without executable escape hatches. No Reality Pack code ships until that migration is byte-for-byte and result-for-result equivalent.

A profile manifest contains:

```json
{
  "schemaVersion": 1,
  "id": "vendor/product-surface@revision",
  "surface": {
    "vendor": "Vendor",
    "product": "Product",
    "kind": "cli"
  },
  "evidence": [
    {
      "url": "https://vendor.example/docs/instructions",
      "retrievedAt": "2026-08-12",
      "claim": "ancestor instruction discovery"
    }
  ],
  "operators": [
    {
      "op": "walk-ancestors",
      "from": "repository-root",
      "to": "context-cwd"
    }
  ],
  "fixtures": ["fixtures/basic.json", "fixtures/unknown.json"]
}
```

The manifest above is illustrative, not the normative v2 schema. The reviewed schema has a closed union for every operator and rejects extra executable fields. No JavaScript hooks, shell commands, remote URLs at analysis time, or hosted registry. It reuses the validated v1 `vendor/product-surface@revision` ids and N-profile arrays. Codex, Claude, and the evidence-gated third profile move to manifests without changing any golden result.

A Reality Pack is an npm or local package containing only:

```text
profile manifest
official evidence index
positive fixture
negative fixture
ordering fixture
unknown/runtime-decided fixture
expected canonical results
```

RuleBlast loads only user-specified installed/local packs. It never auto-downloads during analysis. Separate surfaces get separate ids, for example:

```text
openai/codex-cli@1
anthropic/claude-code-cli@1
github/copilot-cli@1
github/copilot-vscode@1
cursor/editor@1
google/gemini-cli@1
windsurf/editor@1
```

Candidate names are roadmap examples, not support claims.

The user flow is fixed:

```bash
npm install --ignore-scripts --save-dev @ruleblast/profile-copilot-cli
npx ruleblast@latest \
  --profile-pack @ruleblast/profile-copilot-cli
npx ruleblast@latest explain src/api/refund.ts \
  --compare all \
  --profile-pack @ruleblast/profile-copilot-cli
```

Every pack exports `./ruleblast-pack.json`. RuleBlast creates a resolver with `createRequire(path.join(repoRoot, "package.json"))` when that file exists; otherwise it uses `createRequire(path.join(repoRoot, "__ruleblast_resolver__.cjs"))`. It resolves `<pack>/ruleblast-pack.json` from the target repository’s `node_modules`, never from the npm-exec cache, and reads JSON bytes only. It does not import the package entry point or execute pack code. A direct local pack argument must point to a `ruleblast-pack.json` file, not a directory or script.

Fixture entries are either embedded JSON values or forward-slash relative `.json` paths resolved from the real directory containing `ruleblast-pack.json`. Reject absolute paths, drive prefixes, `..` traversal, non-JSON suffixes, and symlinks whose resolved real path escapes that manifest directory. Expected canonical results follow the same rule. Loading a pack validates and reads these data files without importing JavaScript.

This release exposes basic N-profile behavior through the schema already present in v1. Existing scan/diff/explain actions project all selected profiles and emit the aggregate relation plus raw per-profile projections. Pairwise relations are derived internally to compute the aggregate but are not added to the public v1-shaped result. `--compare all` means bundled profiles plus packs explicitly supplied on this invocation; it does not auto-discover packs, expose pairwise records, or produce named reality clusters.

Gate: before a profile from a pack can be used, RuleBlast validates schema/evidence/revision, runs **every** bundled fixture through the IR interpreter, canonicalizes the produced result, and byte-compares it with the fixture's expected canonical JSON. Missing coverage, duplicate cases, interpreter errors, unexpected reads, or one byte of mismatch fails the entire pack closed for that invocation. Cache success only by the digest of the manifest plus all fixture/expected bytes and the core resolver revision. The core package bundles at most the three evidence-gated profiles proven before this release; additional support lives in packs. Installing a pack may use npm, but repository analysis itself remains offline.

### v2.1.0 — Many-Reality Diff

**One new dimension:** explicit pairwise output, named reality clustering, and the compact N-way summary. Basic N-profile projection plus its aggregate relation already ships with Reality Packs in v2.0.

Reuse existing scan/diff/explain commands with `--compare <profiles>`; do not add a dashboard or a new matrix command. Cluster by the v1 normalized-payload relation and keep `UNORDERED`, `UNSPECIFIED`, `RUNTIME_DECIDED`, partial, and unknown states separate.

The reveal format is:

```text
8 agent surfaces.
3 documented realities.

5 align · 2 diverge · 1 runtime-decided.

Pick one path. See which world each agent sees:
  ruleblast explain src/api/refund.ts --compare all
```

Gate: every cluster expands to exact surface ids, profile revisions, source chains, and evidence. “8 surfaces, 3 realities” is never printed from installed-pack count alone.

## Final self-review before execution handoff

Run these read-only checks against the plan and design:

```powershell
rg -n "TODO|TBD|placeholder|coming soon|100% accurate|agent will obey|actual prompt" docs
rg -n "dashboard|server|database|security scanner|CI/CD product|auto-fix" docs/superpowers
rg -n "v1\.0|v1\.1|v1\.2|v1\.3|v2\.0|v2\.1|v2\.2" docs/superpowers
```

Expected:

- no unresolved placeholder in an executable step;
- prohibited surfaces appear only as explicit non-goals;
- every planned version has exactly one new product dimension;
- v1 tasks cover all four commands, both profiles, both render modes, demo, package, docs, and launch gates;
- future multi-platform support has a concrete pack mechanism but creates no v1 implementation work.

After review, implementation can proceed in one of two ways:

1. **Subagent-Driven (recommended):** fresh implementation agent per task, then spec-compliance review and code-quality review before the next task.
2. **Inline execution:** implement sequentially in this task with the same RED → GREEN → refactor → verify → commit checkpoints.
