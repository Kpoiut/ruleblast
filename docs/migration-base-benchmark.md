# Increment 0.30 — measurement at `MIGRATION_BASE_SHA`

Adapter correction for D2a exists. This file is the **migration-base** measurement. It is not the increment 0 custom-tree file.

```
MIGRATION_BASE_SHA:     38cb0f50bd03bc39a0046426b6fa3004103d4f4a
BASELINE_SHA:           2cdd0ef7b202f1d35d1dbca4fcfef5c5906c2f12
PROBE_TREE_SHA:         f9e6833aeadcb3e3f23753ebf0f761df68749f0a
final profile id:       google/gemini-cli@1
resolverRevision:       1
fingerprint contract:   historical (attribution-only; projectionDigest recipe unchanged)
worktree at measure:    dirty only ?? artifacts/ (untracked)
```

`npm run check` on this tree expands to `tsc -p tsconfig.json && vitest run` (581 tests passed before this measurement file).

Command: `npm run benchmark` at `MIGRATION_BASE_SHA`. Exit 0.

```
paths:     10000
warmups:   5
samples:   20
medianMs:  854.45
p95Ms:     994.87
target:    p95 < 2000ms
Node:      v24.13.1
OS:        win32 10.0.19045
arch:      x64
CPU:       11th Gen Intel(R) Core(TM) i5-11400H @ 2.70GHz
```

Gate: p95 994.87ms < 2000ms. Pass.

Do not treat the difference from increment 0 (p95 757.66ms) as a pack regression. That comparison is increment 0 vs this correction tree, not packs vs adapters.
