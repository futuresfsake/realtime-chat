# Definition of Ready (DoR) Audit Specification

The DoR audit runs **before a story begins implementation**. Its purpose is to verify there are no blockers — every prerequisite is in place and the story can proceed without interruption.

**Principle:** A story that fails DoR should never start. Starting a blocked story wastes effort and creates incomplete branches.

---

## DoR Audit Tool

```bash
npx tsx tools/check-dor.ts --story=US-21
```

The script runs all automated checks and produces a JSON report at `testresults/dod/US-NN-dor.json`.

---

## DoR Checks by Classification Level

### All Levels (CRITICAL, HIGH, MEDIUM, LOW)

| ID | Category | Check | Automated | Fail Action |
|---|---|---|---|---|
| DoR-01 | **Planning** | TDD exists: `docs/tdd/**/TDD-*-USNN*.md` | Yes | Story cannot start |
| DoR-02 | **Planning** | Acceptance criteria defined with Given/When/Then | Yes (parse) | Story cannot start |
| DoR-03 | **Planning** | Work plan exists: `docs/plans/US-NN.md` | Yes | Create plan first |
| DoR-04 | **Dependencies** | All prerequisite stories merged to main | Yes (git log) | Wait for prerequisites |
| DoR-05 | **Dependencies** | No CRITICAL gaps in GAPS.md for this story | Yes (parse) | Resolve gap first |
| DoR-06 | **Environment** | `npm ci` succeeds | Yes | Fix lockfile |
| DoR-07 | **Environment** | `npm run typecheck` passes | Yes | Fix type errors |
| DoR-08 | **Environment** | `npm test` passes | Yes | Fix failing tests |
| DoR-09 | **Security** | `npm audit --audit-level=high` clean | Yes | Update vulnerable deps |
| DoR-10 | **Security** | `gitleaks detect` clean | Yes | Remove secrets |

### Additional: CRITICAL and HIGH

| ID | Category | Check | Automated | Fail Action |
|---|---|---|---|---|
| DoR-11 | **Security** | Threat model rows exist for this story | Semi (grep) | Add threat model entries |
| DoR-12 | **Security** | Security checklist items mapped | Semi (grep) | Map checklist items |
| DoR-13 | **Compliance** | Compliance requirements identified | Manual | Map compliance requirements |
| DoR-14 | **Testing** | Test plan drafted (which tests, which tools) | Manual | Draft test plan |

### Additional: CRITICAL Only

| ID | Category | Check | Automated | Fail Action |
|---|---|---|---|---|
| DoR-15 | **Approval** | IT Manager reviewed and approved the approach | Manual | Get IT Manager sign-off |
| DoR-16 | **Risk** | Risk mitigation plan documented in work plan | Manual | Document risk mitigations |
| DoR-17 | **Review** | Two reviewers identified and available | Manual | Identify reviewers |

---

## DoR Report Schema

```json
{
  "$schema": "dor-report-v1",
  "story": "US-32",
  "milestone": "M2",
  "classification": "CRITICAL",
  "pipeline": "GATED",
  "timestamp": "2026-10-28T10:00:00Z",
  "checks": {
    "DoR-01": { "status": "pass", "detail": "docs/tdd/M2-hardening/TDD-M2-US32-connection-auth.md" },
    "DoR-02": { "status": "pass", "detail": "4 acceptance criteria found" },
    "DoR-03": { "status": "pass", "detail": "docs/plans/US-32.md" },
    "DoR-04": { "status": "pass", "detail": "US-21 merged (abc1234)" },
    "DoR-05": { "status": "pass", "detail": "G-25 status: resolved" },
    "DoR-06": { "status": "pass" },
    "DoR-07": { "status": "pass" },
    "DoR-08": { "status": "pass", "detail": "42 tests, 0 failures" },
    "DoR-09": { "status": "pass" },
    "DoR-10": { "status": "pass" },
    "DoR-11": { "status": "pass", "detail": "T-31, T-32 mapped" },
    "DoR-12": { "status": "pass" },
    "DoR-13": { "status": "pass" },
    "DoR-14": { "status": "pass" },
    "DoR-15": { "status": "pass", "signedBy": "IT-MGR", "date": "2026-10-28" },
    "DoR-16": { "status": "pass" },
    "DoR-17": { "status": "pass", "reviewers": ["reviewer-1", "reviewer-2"] }
  },
  "overall": "pass",
  "branchName": "feat/US-32-connection-auth"
}
```

---

## Blocker Resolution

When a DoR check fails, the story is **blocked**. Resolution paths:

| Blocker Type | Resolution | Who |
|---|---|---|
| Missing TDD | Write the TDD | Architect agent / developer |
| Prerequisite story not merged | Wait or resequence | Planner agent / IT Manager |
| Unresolved CRITICAL gap | Resolve the gap or get PO decision | Planner / PO |
| `npm ci` fails | Fix lockfile, update deps | Builder agent / developer |
| Tests failing | Fix the failing tests | Builder agent / developer |
| Vulnerable dependency | Update or replace the dependency | Builder agent / developer |
| Secrets detected | Remove secrets, rotate if exposed | Builder agent / developer + security |
| Missing threat model | Add threat entries | Auditor agent / developer |
| IT Manager not available | Escalate scheduling | Project manager |

---

## DoR for Hotfixes (H-Pipeline)

Hotfixes use a compressed DoR. See [hotfix-pipeline.md](hotfix-pipeline.md#phase-2-h-dor-minimal-gate).

| Check | Required for Hotfix |
|---|---|
| DoR-01 TDD exists | **No** (write post-incident) |
| DoR-02 Acceptance criteria | **No** (regression test is the AC) |
| DoR-03 Work plan | **No** |
| DoR-04 Prerequisites merged | **No** |
| DoR-05 No CRITICAL gaps | **No** |
| DoR-06 npm ci | **Yes** |
| DoR-07 typecheck | **Yes** |
| DoR-08 tests pass | **Yes** |
| DoR-09 audit | **No** (check in H-DoD) |
| DoR-10 gitleaks | **Yes** |
| DoR-11+ (all manual) | **No** |
