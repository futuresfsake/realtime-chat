# S-Pipeline: Story Lifecycle

The S-Pipeline is the per-story development lifecycle. Every story — whether implemented by a human or an agent — flows through four phases with audited gates.

```
 S-PIPELINE
 ═══════════════════════════════════════════════════════════════════════
  PHASE 1          PHASE 2          PHASE 3          PHASE 4
  DoR Audit   ──▶  Build       ──▶  DoD Audit   ──▶  Merge
  ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
  │ blockers │      │ impl    │      │ all      │      │ gate    │
  │ deps     │      │ code    │      │ angles   │      │ merge   │
  │ gaps     │      │ test    │      │ review   │      │ deploy  │
  │ env      │      │ commit  │      │ evidence │      │ verify  │
  └────┬─────┘      └────┬────┘      └────┬─────┘      └────┬────┘
       │                  │                │                  │
   ❌ STOP            ❌ retry          ❌ fix+retry       ❌ rollback
   fix blocker        max 3             back to build      revert merge
 ═══════════════════════════════════════════════════════════════════════
```

---

## Phase 1: Definition of Ready (DoR) Audit

**Purpose:** Verify the story can be started without blockers.

**Trigger:** Story is next in the milestone sequence.

**Agent:** Planner (or human developer).

### DoR Checklist — All Levels

| # | Check | How | Blocks |
|---|---|---|---|
| 1 | TDD exists for this story | `docs/tdd/**/TDD-*-USNN*.md` exists | Yes |
| 2 | Acceptance criteria defined | Story in `user-stories.md` has Given/When/Then | Yes |
| 3 | No unresolved CRITICAL gaps | `GAPS.md` entries for this story are ✅ or 🔄 | Yes |
| 4 | Dependencies merged | All prerequisite stories are on `main` | Yes |
| 5 | `npm ci` succeeds | Lockfile is healthy | Yes |
| 6 | `npm run typecheck` passes | No type errors from prior work | Yes |
| 7 | `npm test` passes | No regressions from prior stories | Yes |
| 8 | `npm audit --audit-level=high` clean | No known high/critical vulns | Yes |
| 9 | `gitleaks detect` clean | No secrets in repo | Yes |

### Additional DoR — CRITICAL / HIGH Only

| # | Check | How | Blocks |
|---|---|---|---|
| 10 | Threat model rows exist | Story's threats in `threat-model.md` | Yes |
| 11 | Security checklist items mapped | Items in `security-checklist.md` | Yes |
| 12 | Compliance requirements identified | Relevant laws mapped in `compliance-matrix.md` | Yes |

### Additional DoR — CRITICAL Only

| # | Check | How | Blocks |
|---|---|---|---|
| 13 | IT Manager sign-off on approach | Written approval in DoR report | Yes |
| 14 | Risk mitigation plan documented | In the work plan | Yes |

### DoR Output

```json
{
  "story": "US-32",
  "classification": "CRITICAL",
  "pipeline": "GATED",
  "timestamp": "2026-10-27T10:00:00Z",
  "checks": {
    "tddExists": { "status": "pass" },
    "acceptanceCriteria": { "status": "pass" },
    "noBlockingGaps": { "status": "pass" },
    "dependenciesMerged": { "status": "pass" },
    "npmCi": { "status": "pass" },
    "typecheck": { "status": "pass" },
    "tests": { "status": "pass" },
    "audit": { "status": "pass" },
    "gitleaks": { "status": "pass" },
    "threatModel": { "status": "pass" },
    "securityChecklist": { "status": "pass" },
    "complianceMapping": { "status": "pass" },
    "itManagerSignoff": { "status": "pass", "signedBy": "IT-MGR" },
    "riskMitigation": { "status": "pass" }
  },
  "overall": "pass"
}
```

**Result:**
- ❌ Any check fails → **STOP**. Fix the blocker. Do not start the story.
- ✅ All pass → Create feature branch, begin Phase 2.

```bash
git checkout -b feat/US-32-connection-auth
```

---

## Phase 2: Build (Implementation)

**Purpose:** Implement the story using TDD (red-green-refactor).

**Agent:** Builder (or human developer).

### Build Loop

```
 For each acceptance criterion:
 ┌─────────────────────────────────────┐
 │  1. Write failing test (RED)        │
 │  2. Write minimum code (GREEN)      │
 │  3. Refactor (no behavior change)   │
 │  4. Commit → triggers commit gates  │
 └─────────────────────────────────────┘
 Repeat until all criteria have passing tests.
```

### Commit Gates (automatic via .githooks/)

Every `git commit` triggers:

| Hook | What | Blocks Commit |
|---|---|---|
| `.githooks/pre-commit` | lint-staged (ESLint + Prettier) + gitleaks staged scan | Yes |
| `.githooks/commit-msg` | Conventional commit format validation | Yes |

Every `git push` triggers:

| Hook | What | Blocks Push |
|---|---|---|
| `.githooks/pre-push` | typecheck + full test suite + build + lint + audit + gitleaks + semgrep | Yes |

### Build Rules

1. **Per-file commits** — each source file change is its own commit
2. **Per-file pushes** — each commit is pushed individually for contribution traceability
3. **Conventional commits** — `type(scope): description` format enforced by commitlint
4. **No skipping hooks** — `--no-verify` is forbidden in this project
5. **Test-first** — every behavior change starts with a failing test

### Build Evidence

The build phase produces:
- Commit history on the feature branch
- Test results for each acceptance criterion
- Coverage report showing the changed modules

---

## Phase 3: Definition of Done (DoD) Audit

**Purpose:** Verify the story is complete from every angle before it can merge.

**Trigger:** Builder declares all acceptance criteria implemented.

**Agent:** Auditor + Code Reviewer (or human reviewer).

### DoD Checklist — All Levels

| # | Angle | Check | How |
|---|---|---|---|
| 1 | **Code** | CI is green on the PR | `gh pr checks` |
| 2 | **Code** | `npm run typecheck` passes | Automated |
| 3 | **Code** | `npm test` passes with all AC covered | Automated + verify |
| 4 | **Code** | `npm run lint` clean | Automated |
| 5 | **Code** | `npm run build` succeeds | Automated |
| 6 | **Code** | Coverage ≥ 80% on changed modules | Coverage report |
| 7 | **Security** | `npm audit --audit-level=high` clean | Automated |
| 8 | **Security** | `gitleaks detect` clean | Automated |
| 9 | **Security** | `semgrep` clean | Automated |
| 10 | **Docs** | Features.md updated | Manual check |
| 11 | **Docs** | Specs.md updated if requirements changed | Manual check |
| 12 | **Docs** | LLD updated if module structure changed | Manual check |

### Additional DoD — CRITICAL / HIGH

| # | Angle | Check | How |
|---|---|---|---|
| 13 | **Security** | Threat model rows verified | Review `threat-model.md` |
| 14 | **Security** | Security checklist items verified | Review `security-checklist.md` |
| 15 | **Security** | No raw IPs in any log (from M2) | CI semgrep rule |
| 16 | **Security** | No plaintext on server (from M4) | Integration test |
| 17 | **Review** | Code review record exists | `docs/reviews/US-NN-review.md` |
| 18 | **Review** | All review findings resolved | Review record updated |
| 19 | **Compliance** | Compliance requirements verified | `compliance-matrix.md` check |

### Additional DoD — CRITICAL Only

| # | Angle | Check | How |
|---|---|---|---|
| 20 | **Review** | Second review completed | Two review records |
| 21 | **Security** | Penetration test (if applicable) | Manual or OWASP ZAP |
| 22 | **Legal** | Legal review (if applicable) | Lawyer sign-off |
| 23 | **IT Manager** | IT Manager sign-off | Written approval |

### DoD Angles Explained

The DoD audits **every angle** of the story:

```
                    ┌──────────────┐
                    │   STORY      │
                    │   US-NN      │
                    └──────┬───────┘
          ┌────────────────┼────────────────┐
          │                │                │
     ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
     │  CODE   │     │SECURITY │     │  DOCS   │
     │         │     │         │     │         │
     │ types   │     │ threats │     │ features│
     │ tests   │     │ audit   │     │ specs   │
     │ lint    │     │ secrets │     │ LLD     │
     │ build   │     │ SAST    │     │ readme  │
     │ coverage│     │ review  │     │         │
     └─────────┘     └─────────┘     └─────────┘
          │                │                │
     ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
     │   UX    │     │COMPLIAN.│     │EVIDENCE │
     │         │     │         │     │         │
     │ desktop │     │ RA 10173│     │ DoD JSON│
     │ mobile  │     │ RA 11313│     │ audit   │
     │ a11y    │     │ RA 11930│     │ sign-off│
     │ keyboard│     │ RA 10175│     │         │
     └─────────┘     └─────────┘     └─────────┘
```

### DoD Output

```json
{
  "story": "US-32",
  "classification": "CRITICAL",
  "pipeline": "GATED",
  "timestamp": "2026-10-27T14:00:00Z",
  "automated": {
    "ci": "pass",
    "typecheck": "pass",
    "tests": "pass",
    "lint": "pass",
    "build": "pass",
    "coverage": { "status": "pass", "percent": 92 },
    "audit": "pass",
    "gitleaks": "pass",
    "semgrep": "pass"
  },
  "manual": {
    "featuresUpdated": true,
    "specsUpdated": true,
    "threatModelVerified": true,
    "securityChecklistVerified": true,
    "noRawIPs": true,
    "reviewRecord": "docs/reviews/US-32-review.md",
    "secondReview": "docs/reviews/US-32-review-2.md",
    "itManagerSignoff": true
  },
  "overall": "pass"
}
```

**Result:**
- ❌ Any check fails → Fix, push, re-run DoD. Back to Phase 2 if code changes needed (max 3 retry loops).
- ✅ All pass → Proceed to Phase 4 (Merge).

---

## Phase 4: Merge

**Purpose:** Merge the story to main with appropriate gates, deploy, and verify.

**Agent:** Orchestrator (or human developer).

### Merge Gates by Classification

| Classification | Gate |
|---|---|
| CRITICAL | DoD pass + IT Manager explicit sign-off + 2 review approvals on PR |
| HIGH | DoD pass + 1 review approval on PR |
| MEDIUM | DoD pass + CI green (auto-merge eligible) |
| LOW | DoD pass + CI green (auto-merge eligible) |

### Merge Process

```
 1. Verify DoD report exists and overall = "pass"
 2. Verify PR has required approvals (per classification)
 3. Squash merge to main:
    gh pr merge --squash --delete-branch
 4. CI runs on main (same pipeline)
 5. Render auto-deploys after CI passes
 6. Health check verifies deployment:
    GET /health → 200 → new version live
    GET /health → non-200 → old version stays, alert triggered
 7. Post-deploy smoke test (from M7)
 8. Log to agents-run.jsonl
 9. Update docs/plans/ status
10. Story is DONE
```

### Post-Merge Evidence

```json
{
  "story": "US-32",
  "branch": "feat/US-32-connection-auth",
  "mergedAt": "2026-10-27T15:00:00Z",
  "mergeCommit": "abc1234",
  "pr": "#12",
  "classification": "CRITICAL",
  "dorReport": "testresults/dod/US-32-dor.json",
  "dodReport": "testresults/dod/US-32-dod.json",
  "reviewRecords": ["docs/reviews/US-32-review.md", "docs/reviews/US-32-review-2.md"],
  "deployStatus": "healthy",
  "smokeTest": "pass"
}
```

---

## Retry and Escalation

| Situation | Action | Max Retries |
|---|---|---|
| DoR fails | Fix blocker, re-run DoR | No limit |
| Build commit rejected (pre-commit hook) | Fix lint/secrets, retry commit | No limit |
| Build push rejected (pre-push hook) | Fix tests/build/audit, retry push | No limit |
| Code review finds issues | Fix in build phase, re-submit for review | 3 |
| DoD fails | Fix, push, re-run DoD | 3 |
| CI fails on PR | Fix locally, push, re-run CI | 3 |
| CI fails on main (post-merge) | **Revert merge immediately** — this is a SEV-2 | 0 |
| Health check fails after deploy | Render keeps old version; investigate | 0 |

After 3 retry loops on review or DoD, the story is **escalated to IT Manager** for investigation.

---

## Timing Expectations

| Phase | CRITICAL | HIGH | MEDIUM | LOW |
|---|---|---|---|---|
| DoR Audit | 15–30 min | 10–15 min | 5 min (automated) | 5 min (automated) |
| Build | 2–8 hours | 1–4 hours | 1–4 hours | 30 min–2 hours |
| DoD Audit | 30–60 min | 15–30 min | 5 min (automated) | 5 min (automated) |
| Merge + Deploy | 15–30 min | 10–15 min | 5 min | 5 min |
| **Total** | **3–10 hours** | **2–5 hours** | **1–5 hours** | **45 min–2.5 hours** |

These are per-story estimates for one developer working focused.
