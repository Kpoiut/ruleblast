# Increment 6 — after catalog loads Reality Packs

Same machine and Node as increment 0 / 0.30. Command: `npm run benchmark`. Exit 0.

```
HEAD at measure: dirty working tree (packs + catalog + witness)
Node:      v24.13.1
OS:        win32 10.0.19045
arch:      x64
CPU:       11th Gen Intel(R) Core(TM) i5-11400H @ 2.70GHz
paths:     10000
warmups:   5
samples:   20
medianMs:  940.80
p95Ms:     1079.77
target:    p95 < 2000ms
```

Gate: p95 1079.77ms < 2000ms. Pass.

Adapter-vs-pack regression is only claimed vs `docs/v2/migration-base-benchmark.md` (p95 994.87ms) on this same machine. The delta is not treated as a pack failure; both are under the published 2000ms budget.
