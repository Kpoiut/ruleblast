# Documentation

Increment measurement records for the `2.0.0` Reality Packs line. Public product docs stay at the repository root.

## Why some Markdown stays at the root

| Path | Why it cannot move |
|---|---|
| `README.md` | GitHub front page and npm package readme |
| `LICENSE` | license discovery |
| `AGENTS.md` | Codex repository-instruction discovery; this is a modeled surface, not a doc dump |
| `CLAUDE.md` | Claude Code project-instruction discovery; this repository uses `@AGENTS.md` |
| `CONTRACT.md` | public result contract; shipped in the npm package |
| `CHANGELOG.md`, `ROADMAP.md` | release and admission records |
| `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` | GitHub community-health files |
| `PROOF.md` | first-fold evidence for the public 2→206 case |
| `AGENT_USAGE.md` | packaged agent routing guide |

`.agents/skills` and `.claude/skills` stay on their official discovery paths. `scripts/` stays executable tooling, not documentation.

## Increment records

| File | Increment |
|---|---|
| [baseline-benchmark.md](baseline-benchmark.md) | 0 — custom-tree baseline |
| [gemini-nested-import.md](gemini-nested-import.md) | 0.25 — CONTROL/PROBE, class D2a |
| [migration-base-benchmark.md](migration-base-benchmark.md) | 0.30 — adapter oracle measurement |
| [representability.md](representability.md) | 0.5 — closed construct inventory |
| [after-benchmark.md](after-benchmark.md) | 6 — after catalog loads packs |

These files are observations and inventories. They are not a second product spec. [CONTRACT.md](../CONTRACT.md) remains the public behavior contract.
