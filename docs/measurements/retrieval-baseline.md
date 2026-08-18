# Retrieval baseline — 2026-08-16

Independent web-search snapshot. Not a claim that Search Console or every crawler agrees. Scores:

| Score | Meaning |
|---:|---|
| 0 | Official GitHub or npm URL absent |
| 1 | Mention only, or far below the first page |
| 2 | Top 20 |
| 3 | Top 10 |
| 4 | Top 5 |
| 5 | Top 3 |

| Query | Score | Observed |
|---|---:|---|
| `ruleblast github` | 0 | Unrelated GitHub “rules” / BLAST hits |
| `"Kpoiut/ruleblast"` | 1 | Yousou GitHub-trend crawl, not github.com |
| `"RuleBlast" AGENTS.md` | 0 | No official URL |
| `AGENTS.md blast radius` | 0 | Other blast-radius pages |
| `which files inherit AGENTS.md` | 0 | Unrelated inheritance posts |
| `ruleblast npm` | 0 | Other `agents` npm packages |
| `"Git diff for invisible repository instructions"` | 0 | Signature phrase not served |

GitHub internal search already returns `Kpoiut/ruleblast`. Direct URL fetch works. External web index and problem-query association do not yet.

Re-run the same queries after the canonical landing `https://kpoiut.github.io/ruleblast/` is live and after any independent technical mention. A first win is the official GitHub or npm URL appearing for `ruleblast github` or `"Kpoiut/ruleblast"`.

`2.4.2` standardizes the public signature to `RuleBlast — Git diff for AI agent repository instructions`. That is a presentation change, not a claim that ranking already moved.
