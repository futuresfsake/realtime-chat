# Production Pipeline

**IT Manager — Production-Grade Development Pipeline**

This section defines the complete story-to-production pipeline for the realtime-chat project. Every story, hotfix, and milestone flows through audited gates with evidence artifacts.

## Pipeline Types

| Code | Pipeline | When | Gate Style |
|---|---|---|---|
| **M** | Milestone Pipeline | Milestone-level planning, sequencing, and release | Always gated |
| **S** | Story Pipeline | Per-story lifecycle: DoR → Build → DoD → Merge | Gated or Continuous (by classification) |
| **H** | Hotfix Pipeline | Emergency production fixes (SEV-1/SEV-2) | Fast-track gated |

## Pipeline Flow

```
M-PIPELINE (per milestone)
════════════════════════════════════════════════════════════
 M-DoR ──▶ [S-Pipeline × N stories] ──▶ M-DoD ──▶ Release
════════════════════════════════════════════════════════════

S-PIPELINE (per story)
════════════════════════════════════════════════════════════
 S-DoR ──▶ Build ──▶ S-DoD ──▶ Merge
   │         │         │         │
   │ audit   │ impl    │ audit   │ gate
   │ blocker │ code    │ angles  │ merge
   ▼ check   ▼ test    ▼ review  ▼ deploy
════════════════════════════════════════════════════════════

H-PIPELINE (hotfix)
════════════════════════════════════════════════════════════
 Triage ──▶ H-DoR ──▶ Fix+Test ──▶ H-DoD ──▶ Merge+Deploy
════════════════════════════════════════════════════════════
```

## Story Classification

Every story is classified by **security level**, which determines whether the pipeline is **gated** (requires manual approval) or **continuous** (automated gates only):

| Security Level | Pipeline | Manual Reviews | Approval |
|---|---|---|---|
| CRITICAL | **Gated** | 2 reviews required | Explicit sign-off |
| HIGH | **Gated** | 1 review required | Explicit sign-off |
| MEDIUM | Continuous | Automated only | CI pass = merge |
| LOW | Continuous | Automated only | CI pass = merge |

Full classification: [story-classification.md](story-classification.md)

## Documents

| Document | Purpose |
|---|---|
| [story-lifecycle.md](story-lifecycle.md) | S-Pipeline: complete story lifecycle (DoR → Build → DoD → Merge) |
| [milestone-pipeline.md](milestone-pipeline.md) | M-Pipeline: milestone planning, sequencing, and release |
| [hotfix-pipeline.md](hotfix-pipeline.md) | H-Pipeline: emergency fix fast-track |
| [story-classification.md](story-classification.md) | Every story classified: security level, gate style, required reviews |
| [definition-of-ready.md](definition-of-ready.md) | DoR audit specification per classification level |
| [definition-of-done.md](definition-of-done.md) | DoD audit specification per classification level |
| [merge-strategy.md](merge-strategy.md) | Merge gates, branch rules, and deploy strategy |
| [agent-definitions.md](agent-definitions.md) | Agent roles, responsibilities, and handoff contracts |
| [skill-plan.md](skill-plan.md) | Agent skill inventory and capability matrix |
| [workflow.md](workflow.md) | GitHub Actions workflow definitions |
| [commit-audit.md](commit-audit.md) | Audit report of the 19 IT review commits |

## Relationship to Existing Docs

| This pipeline document | Extends / replaces |
|---|---|
| story-lifecycle.md | Extends [TDD-M0-S05](../tdd/M0-foundations/TDD-M0-S05-development-pipeline.md) §4 with IT Manager gates |
| milestone-pipeline.md | New — milestone-level orchestration |
| hotfix-pipeline.md | New — emergency procedures |
| story-classification.md | New — security-driven gating |
| definition-of-ready.md | Formalizes TDD-M0-S05 §4 Phase 2 |
| definition-of-done.md | Formalizes TDD-M0-S05 §4 Phase 9 + [user-stories.md](../01-product/user-stories.md) DoD |
| merge-strategy.md | Extends [ci-cd.md](../07-process/ci-cd.md) with gating rules |
| agent-definitions.md | Extends TDD-M0-S05 §2 with IT Manager agent roles |
| skill-plan.md | New — agent capability planning |
| workflow.md | Extends [ci-cd.md](../07-process/ci-cd.md) with full workflow definitions |

## Principles

1. **Evidence over trust** — every gate produces a JSON artifact proving it passed
2. **Classification drives strictness** — security-critical stories get manual gates; others flow automatically
3. **Per-file commits, per-file pushes** — every file is its own commit and push for full traceability
4. **No story starts without DoR** — blockers are caught before work begins
5. **No story merges without DoD** — every angle is audited before code reaches main
6. **Hotfixes have a fast track** — but still produce evidence
7. **Agents follow the same pipeline** — human or AI, the gates are identical
