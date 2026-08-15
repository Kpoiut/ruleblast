# Increment 0 — measured production tree

This is **not** a `v1.6.2` baseline label. `HEAD` is not the `v1.6.2` tag commit, and the worktree has untracked `artifacts/`.

Command output is authority for these observations. CONTRACT is not adjudicated here.

```
BASELINE_SHA:           2cdd0ef7b202f1d35d1dbca4fcfef5c5906c2f12
expected v1.6.2 tag:    4883efb6d5a82e0bcfe4ebd8375a0f024ff7943b (tag object)
v1.6.2 commit:          ef2206a40b44a1debb211bd131f23afb519ac32f
HEAD == v1.6.2 commit:  no
worktree:               dirty
porcelain:              ?? artifacts/
label:                  custom-tree baseline
CONTRACT_BLOB_SHA:      3f0e37459b94f61b5f95e4de2301201139f68063
  (git rev-parse HEAD:CONTRACT.md; same as v1.6.2^{}:CONTRACT.md)
```

## Scripts on this SHA

From `package.json` at `BASELINE_SHA` (re-read, not assumed from memory):

```
check:      tsc -p tsconfig.json && vitest run
build:      tsc -p tsconfig.build.json
test:       vitest run
benchmark:  npm run build && node scripts/benchmark.mjs
```

`npm run check` includes the full Vitest suite.

## Command results

| Command | Exit |
|---|---|
| `npm run check` | 0 |
| `npm run build` | 0 |
| `npm run benchmark` | 0 |
| `git diff --check` | 0 |

`npm run check` Vitest: 38 files, 578 tests passed. Duration 187.56s. Node v24.13.1.

## Benchmark (this machine)

Command: `npm run benchmark`

```
paths:     10000
warmups:   5
samples:   20
medianMs:  729.39
p95Ms:     757.66
target:    p95 < 2000ms
Node:      v24.13.1
OS:        win32 10.0.19045
arch:      x64
CPU:       11th Gen Intel(R) Core(TM) i5-11400H @ 2.70GHz
```

RSS at measurement point: not recorded.

Gate: p95 757.66ms < 2000ms. Pass.

## Increment 0 gate

Green. `src/` unchanged. Next: increment 0.24 harness-only commit, then 0.25 on `PROBE_TREE_SHA`.
