# Definition of Done (DoD) Audit Specification

The DoD audit runs **after implementation and before merge**. It audits the story from **every angle** — code quality, security, documentation, UX, compliance, and evidence — to verify the story is truly complete.

**Principle:** A story that passes DoD has been examined from every perspective that matters. Nothing is assumed; everything is verified.

---

## DoD Audit Tool

```bash
npx tsx tools/check-dod.ts --story=US-21
```

The script runs automated checks, prompts for manual verification, and produces:
- `testresults/dod/US-NN-dod.json` — evidence artifact
- `docs/specs/evidence/US-NN-audit.json` — audit sign-off record

---

## The Seven Angles of DoD

Every story is audited from seven angles:

```
                         ┌─────────────┐
                         │   US-NN     │
                         │   STORY     │
                         └──────┬──────┘
          ┌──────────┬─────────┼─────────┬──────────┐
          │          │         │         │          │
     ┌────▼───┐ ┌───▼────┐ ┌──▼───┐ ┌──▼───┐ ┌───▼────┐
     │1. CODE │ │2.SECUR.│ │3.TEST│ │4.DOCS│ │5. UX   │
     └────────┘ └────────┘ └──────┘ └──────┘ └────────┘
                    │          │
               ┌────▼───┐ ┌───▼────┐
               │6.COMPL.│ │7.EVID. │
               └────────┘ └────────┘
```

### Angle 1: Code Quality

| ID | Check | How | Level |
|---|---|---|---|
| DoD-01 | `npm run typecheck` passes | Automated | All |
| DoD-02 | `npm run lint` clean | Automated | All |
| DoD-03 | `npm run build` succeeds | Automated | All |
| DoD-04 | CI is green on the PR | `gh pr checks` | All |
| DoD-05 | Conventional commit format on all commits | Automated | All |
| DoD-06 | Per-file commits maintained | `git log --stat` | All |
| DoD-07 | No TODO/FIXME/HACK comments left | Grep | All |

### Angle 2: Security

| ID | Check | How | Level |
|---|---|---|---|
| DoD-08 | `npm audit --audit-level=high` clean | Automated | All |
| DoD-09 | `gitleaks detect` clean | Automated | All |
| DoD-10 | `semgrep --config=.semgrep.yml` clean | Automated | All |
| DoD-11 | No raw IPs in any log statement | CI semgrep rule | HIGH+ |
| DoD-12 | No plaintext on server (from M4) | Integration test | HIGH+ |
| DoD-13 | Threat model rows verified | Manual review | HIGH+ |
| DoD-14 | Security checklist items verified | Manual review | HIGH+ |
| DoD-15 | No `eval()`, `innerHTML`, `document.write` | Semgrep | All |
| DoD-16 | New zod schema for any new client input | Manual review | HIGH+ |

### Angle 3: Testing

| ID | Check | How | Level |
|---|---|---|---|
| DoD-17 | `npm test` passes | Automated | All |
| DoD-18 | Every acceptance criterion has a test | Manual verify | All |
| DoD-19 | Coverage ≥ 80% on changed modules | Coverage report | All |
| DoD-20 | Integration test exists (if client↔server change) | File check | MEDIUM+ |
| DoD-21 | Edge cases tested (boundary values, error paths) | Manual review | HIGH+ |
| DoD-22 | Regression test for any bug fix | Manual review | All |

### Angle 4: Documentation

| ID | Check | How | Level |
|---|---|---|---|
| DoD-23 | `features.md` status updated | Manual check | All |
| DoD-24 | `specs.md` updated if requirements changed | Manual check | HIGH+ |
| DoD-25 | LLD updated if module structure changed | Manual check | HIGH+ |
| DoD-26 | README updated if user-visible behavior changed | Manual check | HIGH+ |
| DoD-27 | Inline code comments only for non-obvious WHY | Review | All |

### Angle 5: User Experience

| ID | Check | How | Level |
|---|---|---|---|
| DoD-28 | Works on desktop browser | Manual test | All (if UI change) |
| DoD-29 | Works on 360px mobile viewport | Manual test | All (if UI change) |
| DoD-30 | Keyboard navigable | Manual test | HIGH+ (if UI change) |
| DoD-31 | Screen reader compatible | Manual test | CRITICAL (if UI change) |
| DoD-32 | Color contrast meets WCAG AA | Lighthouse | HIGH+ (if UI change) |

### Angle 6: Compliance

| ID | Check | How | Level |
|---|---|---|---|
| DoD-33 | RA 10173 requirements met (if PII-related) | Manual review | CRITICAL |
| DoD-34 | RA 11313 requirements met (if safety-related) | Manual review | CRITICAL |
| DoD-35 | RA 11930 requirements met (if minor-safety) | Manual review | CRITICAL |
| DoD-36 | RA 10175 requirements met (if law-enforcement) | Manual review | CRITICAL |
| DoD-37 | No new PII collected without privacy notice update | Manual review | HIGH+ |

### Angle 7: Evidence

| ID | Check | How | Level |
|---|---|---|---|
| DoD-38 | DoD report generated | Automated | All |
| DoD-39 | Code review record exists | File check | HIGH+ |
| DoD-40 | Second review record exists | File check | CRITICAL |
| DoD-41 | IT Manager sign-off recorded | Manual | CRITICAL |
| DoD-42 | Test evidence archived | File check | All |

---

## DoD by Classification — Summary

| Check Category | LOW | MEDIUM | HIGH | CRITICAL |
|---|---|---|---|---|
| Code quality (DoD-01–07) | ✅ All | ✅ All | ✅ All | ✅ All |
| Security automated (DoD-08–10, 15) | ✅ All | ✅ All | ✅ All | ✅ All |
| Security manual (DoD-11–14, 16) | — | — | ✅ | ✅ |
| Testing automated (DoD-17–19) | ✅ All | ✅ All | ✅ All | ✅ All |
| Testing manual (DoD-20–22) | — | ✅ 20 | ✅ 20–22 | ✅ 20–22 |
| Documentation (DoD-23–27) | ✅ 23, 27 | ✅ 23, 27 | ✅ All | ✅ All |
| UX (DoD-28–32) | ✅ 28–29 | ✅ 28–29 | ✅ 28–32 | ✅ 28–32 |
| Compliance (DoD-33–37) | — | — | ✅ 37 | ✅ 33–37 |
| Evidence (DoD-38–42) | ✅ 38, 42 | ✅ 38, 42 | ✅ 38–39, 42 | ✅ All |

**Total checks:** LOW = 16, MEDIUM = 19, HIGH = 33, CRITICAL = 42.

---

## DoD Report Schema

```json
{
  "$schema": "dod-report-v1",
  "story": "US-32",
  "milestone": "M2",
  "classification": "CRITICAL",
  "pipeline": "GATED",
  "timestamp": "2026-10-28T16:00:00Z",
  "angles": {
    "code": {
      "typecheck": "pass",
      "lint": "pass",
      "build": "pass",
      "ci": "pass",
      "conventionalCommits": "pass",
      "perFileCommits": "pass",
      "noTodos": "pass"
    },
    "security": {
      "audit": "pass",
      "gitleaks": "pass",
      "semgrep": "pass",
      "noRawIPs": "pass",
      "threatModelVerified": true,
      "securityChecklistVerified": true,
      "newZodSchema": true
    },
    "testing": {
      "allTests": "pass",
      "allACCovered": true,
      "coverage": { "percent": 92, "threshold": 80, "status": "pass" },
      "integrationTest": true,
      "edgeCases": true
    },
    "docs": {
      "featuresUpdated": true,
      "specsUpdated": true,
      "lldUpdated": true,
      "readmeUpdated": false
    },
    "ux": {
      "desktop": "pass",
      "mobile360": "pass",
      "keyboard": "pass",
      "screenReader": "pass",
      "contrast": "pass"
    },
    "compliance": {
      "ra10173": "pass",
      "ra11313": "not_applicable",
      "ra11930": "not_applicable",
      "ra10175": "not_applicable",
      "noPIIWithoutNotice": "pass"
    },
    "evidence": {
      "dodReport": "testresults/dod/US-32-dod.json",
      "reviewRecord": "docs/reviews/US-32-review.md",
      "secondReview": "docs/reviews/US-32-review-2.md",
      "itManagerSignoff": true,
      "testEvidence": "testresults/dod/US-32-tests.json"
    }
  },
  "overall": "pass"
}
```

---

## DoD Failure Handling

| Failure | Action | Max Retries |
|---|---|---|
| Automated check fails | Fix, push, re-run automated checks | 3 |
| Security finding | Fix in code, re-run security checks | 3 |
| Review finding | Fix in code, resubmit for review | 3 |
| Coverage below threshold | Write more tests | 3 |
| IT Manager rejects | Address feedback, resubmit | 3 |
| 3 retries exhausted | **Escalate to IT Manager for investigation** | — |

---

## DoD for Hotfixes (H-Pipeline)

Hotfixes use a compressed DoD. See [hotfix-pipeline.md](hotfix-pipeline.md#phase-4-h-dod-security-focused).

| Angle | Required for Hotfix |
|---|---|
| Code quality | ✅ Automated only |
| Security | ✅ Automated + manual surface check |
| Testing | ✅ Regression test required |
| Documentation | ❌ Done post-incident |
| UX | ❌ Unless UI change |
| Compliance | ❌ Unless compliance-related |
| Evidence | ✅ H-DoD report generated |
