# H-Pipeline: Hotfix Fast-Track

The H-Pipeline is for **emergency production fixes** when the live system has a critical defect. It uses a compressed version of the S-Pipeline with fewer gates but full evidence.

```
 H-PIPELINE
 ═══════════════════════════════════════════════════════════════════════
  TRIAGE         H-DoR         FIX+TEST       H-DoD         MERGE+DEPLOY
  ┌──────┐       ┌──────┐     ┌──────┐       ┌──────┐      ┌──────┐
  │sev   │  ──▶  │minimal│ ──▶│fix   │  ──▶  │security│ ──▶│merge │
  │impact│       │gate  │     │test  │       │focused │     │deploy│
  │scope │       │fast  │     │commit│       │fast   │     │verify│
  └──────┘       └──────┘     └──────┘       └──────┘      └──────┘
                                                            │
                                                     post-incident
                                                       review
 ═══════════════════════════════════════════════════════════════════════
```

---

## When to Use the H-Pipeline

| Use H-Pipeline | Use S-Pipeline |
|---|---|
| Production is down or degraded (SEV-1/SEV-2) | Feature work, even urgent |
| Security vulnerability actively exploited | Security improvement (not exploited) |
| Data privacy breach in progress | Compliance improvement |
| Legal compliance violation discovered in production | Pre-launch compliance work |
| CI/CD pipeline broken, blocking all deploys | CI/CD improvements |

**Rule:** If users aren't currently affected and the fix can wait for the next story cycle, use the S-Pipeline. The H-Pipeline skips gates that exist for a reason — use it only when the cost of waiting exceeds the cost of less review.

---

## Severity Classification

| Severity | Impact | Response Time | H-Pipeline |
|---|---|---|---|
| **SEV-1** | Service down, security breach, data leak, child safety | **Immediate** (< 15 min to start) | Yes — maximum fast-track |
| **SEV-2** | Major degradation, feature broken for all users, significant security issue | **< 1 hour** to start | Yes — fast-track |
| **SEV-3** | Minor issue, workaround exists | **< 4 hours** to start | No — use S-Pipeline |
| **SEV-4** | Cosmetic, low impact | Next story cycle | No — use S-Pipeline |

---

## Phase 1: Triage

**Purpose:** Classify severity, assess impact, determine scope of fix.

**Time budget:** 5–10 minutes.

| Step | Action |
|---|---|
| 1 | Classify severity (SEV-1 or SEV-2) |
| 2 | Identify the defect: what's broken, who's affected |
| 3 | Assess blast radius: one user, some users, all users |
| 4 | Determine if rollback is faster than a fix |
| 5 | If rollback is faster → rollback first, then fix via S-Pipeline |
| 6 | If fix is faster → proceed to H-DoR |

### Rollback Decision Tree

```
 Is it a bad deploy?
   YES → Rollback on Render (< 2 min)
         Then fix via normal S-Pipeline
   NO  → Is the fix < 10 lines of code?
           YES → Hotfix (H-Pipeline)
           NO  → Rollback + S-Pipeline
```

---

## Phase 2: H-DoR (Minimal Gate)

**Purpose:** Verify the fix won't make things worse.

**Time budget:** 5 minutes.

| # | Check | How | Blocks |
|---|---|---|---|
| 1 | `npm ci` succeeds | Automated | Yes |
| 2 | `npm run typecheck` passes | Automated | Yes |
| 3 | `npm test` passes | Automated | Yes |
| 4 | `gitleaks detect` clean | Automated | Yes |

**Skipped (vs S-Pipeline DoR):**
- TDD existence check (no time for new TDD)
- Dependency resolution check
- Threat model mapping
- IT Manager sign-off

**Branch naming:** `hotfix/SEV-N-short-description`

```bash
git checkout -b hotfix/SEV-1-websocket-crash
```

---

## Phase 3: Fix + Test

**Purpose:** Fix the defect with minimum change and add a regression test.

### Rules

1. **Minimum viable fix** — change only what's necessary to fix the defect
2. **Regression test required** — write a test that reproduces the bug, then fix it
3. **Per-file commits** — maintain traceability even under pressure
4. **Per-file pushes** — each commit pushed individually
5. **No unrelated changes** — don't sneak in refactoring or features

### Commit Convention

```
fix(scope): description of the fix

Hotfix SEV-N: brief explanation of the production issue.
```

---

## Phase 4: H-DoD (Security-Focused)

**Purpose:** Verify the fix doesn't introduce new issues, focused on security.

**Time budget:** 10–15 minutes.

| # | Check | How | Blocks |
|---|---|---|---|
| 1 | CI green | GitHub Actions | Yes |
| 2 | `npm run typecheck` passes | Automated | Yes |
| 3 | `npm test` passes (including new regression test) | Automated | Yes |
| 4 | `npm run build` succeeds | Automated | Yes |
| 5 | `npm audit --audit-level=high` clean | Automated | Yes |
| 6 | `gitleaks detect` clean | Automated | Yes |
| 7 | `semgrep` clean | Automated | Yes |
| 8 | No raw IPs in changed files | Manual/automated | Yes |
| 9 | Fix doesn't widen attack surface | Manual review | Yes |

**Skipped (vs S-Pipeline DoD):**
- Full coverage check (regression test is sufficient)
- Docs update (done post-incident)
- Second review for CRITICAL (one review is enough for a hotfix)
- IT Manager sign-off (post-incident review serves this purpose)

---

## Phase 5: Merge + Deploy

**Purpose:** Get the fix to production as fast as possible.

| Step | Action |
|---|---|
| 1 | Create PR: `gh pr create --title "hotfix(SEV-N): description"` |
| 2 | One review required (even for hotfixes) |
| 3 | Merge: `gh pr merge --squash --delete-branch` |
| 4 | CI on main → Render auto-deploy |
| 5 | Verify `/health` returns 200 |
| 6 | Verify the defect is resolved on the live URL |
| 7 | Log to `agents-run.jsonl` with `type: "hotfix"` |

---

## Phase 6: Post-Incident Review

**Required within 48 hours of the hotfix merge.**

### Post-Incident Review Template

```markdown
# Post-Incident Review: SEV-N — [title]

## Timeline
- **Detected:** [when and how]
- **Triage started:** [when]
- **Fix merged:** [when]
- **Deployed:** [when]
- **Verified:** [when]
- **Total time to resolution:** [duration]

## Root Cause
[What caused the defect]

## Impact
- Users affected: [count or estimate]
- Duration of impact: [duration]
- Data impact: [none / describe]

## Fix
- PR: [link]
- What changed: [brief description]
- Regression test: [test file and name]

## What Went Well
- [bullet points]

## What To Improve
- [bullet points]

## Follow-Up Actions
- [ ] Update threat model if security-related
- [ ] Update security checklist if applicable
- [ ] Create story for proper fix if hotfix was a bandaid
- [ ] Update runbook with this failure mode
- [ ] Update DoD checklist if this class of bug should be caught
```

### Mandatory Follow-Ups

| If the hotfix was... | Then also... |
|---|---|
| Security-related | Update threat model, security checklist, run semgrep rules review |
| Compliance-related | Update compliance matrix, notify DPO if RA 10173 relevant |
| Child safety (RA 11930) | Follow mandatory reporting procedure |
| Data breach | Follow breach notification procedure (72h NPC requirement) |
| A bandaid fix | Create a proper story in the next milestone's backlog |

---

## H-Pipeline Evidence

Even under time pressure, the H-Pipeline produces evidence:

| Artifact | Location |
|---|---|
| Triage record | `docs/incidents/SEV-N-YYYY-MM-DD.md` |
| H-DoR report | `testresults/dod/HOTFIX-description-dor.json` |
| H-DoD report | `testresults/dod/HOTFIX-description-dod.json` |
| Agent run log | `agents-run.jsonl` with `type: "hotfix"` |
| Post-incident review | `docs/incidents/SEV-N-YYYY-MM-DD-review.md` |

---

## Hotfix vs Rollback Decision Matrix

| Scenario | Rollback | Hotfix | Both |
|---|---|---|---|
| Bad deploy (recent merge broke it) | ✅ | | |
| Bug existed before this deploy | | ✅ | |
| Security vulnerability (new) | ✅ first | ✅ then | ✅ |
| Security vulnerability (old, just discovered) | | ✅ | |
| Config error | ✅ (fix config, redeploy) | | |
| Dependency vulnerability | | ✅ (update dep) | |
| Data corruption | ✅ first | ✅ then | ✅ |
