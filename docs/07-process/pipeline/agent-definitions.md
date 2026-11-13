# Agent Definitions

Agent roles, responsibilities, handoff contracts, and orchestration patterns for the agentic SDLC pipeline.

---

## Agent Roster

| Agent | Role | Pipeline Phase | Reads | Writes |
|---|---|---|---|---|
| **Orchestrator** | Coordinates the full pipeline | All phases | Everything | `agents-run.jsonl`, status updates |
| **Planner** | Intake, sequencing, DoR | Phase 1 (DoR) | Stories, TDDs, GAPS | Work plans, DoR reports |
| **Builder** | Implementation (TDD cycle) | Phase 2 (Build) | TDDs, specs, work plans | `src/`, `tests/`, commits |
| **Tester** | Test execution, coverage | Phase 2–3 | Test plans, source | Test results, coverage reports |
| **Reviewer** | Code review | Phase 3 (DoD) | Changed source, TDDs | Review records |
| **Auditor** | Security + compliance audit | Phase 3 (DoD) | Whole repo | Evidence artifacts, audit reports |
| **IT Manager** | Classification, sign-off, escalation | DoR/DoD gates | Everything | Sign-offs, reclassifications |
| **Deployer** | Merge + deploy + verify | Phase 4 (Merge) | DoD reports, CI status | Merge commits, deploy verification |

---

## Agent Details

### Orchestrator

**Purpose:** Runs the pipeline end-to-end for a story or milestone. Coordinates hand-offs between agents. Logs the run.

**When active:** Every story, from DoR through merge.

**Responsibilities:**
1. Accept a story from the milestone sequence
2. Run DoR audit (delegate to Planner)
3. If DoR passes, hand off to Builder
4. After build, hand off to Reviewer and Auditor
5. Run DoD audit
6. If DoD passes, hand off to Deployer
7. If any phase fails, manage retry loop (max 3)
8. After merge, log the run to `agents-run.jsonl`
9. Update `docs/plans/` status board

**Handoff contract:**

```
Planner → Orchestrator:  DoR report JSON (pass/fail)
Orchestrator → Builder:  Story ID + feature branch name
Builder → Orchestrator:  "build complete" + commit count
Orchestrator → Reviewer: Branch name + changed files list
Reviewer → Orchestrator: Review record (approved/findings)
Orchestrator → Auditor:  Branch name
Auditor → Orchestrator:  Audit report JSON (pass/fail)
Orchestrator → Deployer: DoD report + PR number
Deployer → Orchestrator: Merge SHA + deploy status
```

### Planner

**Purpose:** Prepares stories for implementation. Runs DoR checks. Sequences work.

**When active:** Before each story starts; during milestone planning.

**Responsibilities:**
1. Verify TDD exists and acceptance criteria are defined
2. Check dependencies (prerequisite stories merged)
3. Check GAPS.md for unresolved blockers
4. Run automated DoR checks (npm ci, typecheck, test, audit, gitleaks)
5. For CRITICAL/HIGH: verify threat model, security checklist, compliance mapping
6. For CRITICAL: get IT Manager sign-off
7. Generate DoR report JSON
8. Create work plan: `docs/plans/US-NN.md`

**Skills used:** `dor-audit`, `dependency-check`, `gap-analysis`

### Builder

**Purpose:** Implements stories using TDD. Writes code and tests.

**When active:** Phase 2 (Build) for every story.

**Responsibilities:**
1. Create feature branch from main
2. For each acceptance criterion: RED → GREEN → REFACTOR
3. Commit per file, push per file
4. Follow conventional commit format
5. Respect commit hooks (lint-staged, gitleaks, commitlint)
6. Respect push hooks (typecheck, full tests, build, audit, semgrep)

**Skills used:** `tdd-cycle`, `commit-push`, `code-generation`

**Rules:**
- Never skip hooks (`--no-verify` is forbidden)
- Never commit multiple files together
- Always write the test before the implementation
- Stop when all acceptance criteria have passing tests

### Tester

**Purpose:** Runs tests, measures coverage, verifies acceptance criteria.

**When active:** During build (continuous) and during DoD audit.

**Responsibilities:**
1. Run the full test suite: `npm test`
2. Generate coverage report: `npm run test:coverage`
3. Verify coverage meets threshold (≥ 80% on security/, sessions/, etc.)
4. Map test files to acceptance criteria
5. Identify untested acceptance criteria
6. Generate test evidence for DoD

**Skills used:** `test-runner`, `coverage-analysis`, `ac-mapping`

### Reviewer

**Purpose:** Reviews code changes for correctness, security, and quality.

**When active:** Phase 3 (DoD) for HIGH and CRITICAL stories.

**Responsibilities:**
1. Review all changed files on the feature branch
2. Check for correctness (does it do what the AC says?)
3. Check for security issues (OWASP top 10, project-specific rules)
4. Check for simplification opportunities
5. Verify no plaintext leaks (from M4 onward)
6. Write review record: `docs/reviews/US-NN-review.md`

**Skills used:** `code-review`, `security-review`, `simplification`

**Review record format:**

```markdown
# Review: US-NN

**Reviewer:** [name/agent]
**Date:** YYYY-MM-DD
**Classification:** CRITICAL|HIGH
**Verdict:** APPROVED | CHANGES_REQUESTED

## Files Reviewed
- src/security/tokenBucket.ts — [findings or OK]
- tests/unit/security/tokenBucket.test.ts — [findings or OK]

## Security Checks
- [ ] No eval/innerHTML/document.write
- [ ] No raw IPs in logs
- [ ] No plaintext on server (M4+)
- [ ] Zod schema for new input
- [ ] Threat model rows covered

## Findings
[list findings with severity]

## Conclusion
[approved or what needs to change]
```

### Auditor

**Purpose:** Runs security and compliance audits. Produces evidence artifacts.

**When active:** Phase 3 (DoD) for all stories; extended audit for HIGH/CRITICAL.

**Responsibilities:**
1. Run automated security scans (gitleaks, semgrep, npm audit)
2. Verify no secrets in the repo
3. Verify SAST rules pass
4. For HIGH/CRITICAL: verify threat model and security checklist
5. For CRITICAL: verify compliance requirements
6. Generate audit evidence: `docs/specs/evidence/US-NN-audit.json`

**Skills used:** `security-scan`, `compliance-check`, `evidence-generation`

### IT Manager

**Purpose:** Classifies stories, provides sign-offs, handles escalations.

**When active:** DoR gate (CRITICAL stories), DoD gate (CRITICAL stories), escalation from any phase.

**Responsibilities:**
1. Classify new stories (security level, gated/continuous)
2. Review and approve approach for CRITICAL stories (DoR)
3. Sign off on CRITICAL story completion (DoD)
4. Investigate escalations (3 retries exhausted)
5. Reclassify stories when risk profile changes
6. Approve hotfix post-incident reviews

**Skills used:** `classification`, `sign-off`, `escalation-handling`

### Deployer

**Purpose:** Merges PRs, verifies deployments, runs post-deploy checks.

**When active:** Phase 4 (Merge) for every story.

**Responsibilities:**
1. Verify DoD report exists and passes
2. Verify PR has required approvals
3. Execute squash merge
4. Monitor CI on main
5. Verify Render deployment succeeds
6. Run post-deploy smoke test (M7+)
7. Log to agents-run.jsonl

**Skills used:** `merge-deploy`, `health-check`, `smoke-test`

---

## Orchestration Patterns

### Pattern 1: Sequential Story Pipeline

```
Orchestrator
    │
    ├──▶ Planner (DoR)
    │       └── pass ──▶
    ├──▶ Builder (Build)
    │       └── complete ──▶
    ├──▶ Reviewer + Auditor (DoD) [parallel]
    │       └── both pass ──▶
    ├──▶ Deployer (Merge)
    │       └── deployed ──▶
    └──▶ Log run, update status
```

### Pattern 2: Retry Loop

```
Orchestrator
    │
    ├──▶ Reviewer (finds issues)
    │       └── CHANGES_REQUESTED ──▶
    ├──▶ Builder (fix issues) ←── retry 1/3
    │       └── complete ──▶
    ├──▶ Reviewer (re-review)
    │       └── APPROVED ──▶
    └──▶ continue pipeline
```

### Pattern 3: Parallel Stories (within milestone)

```
Orchestrator (milestone)
    │
    ├──▶ S-Pipeline(US-22) ──────────▶ merged
    │                                       │
    ├──▶ S-Pipeline(US-23) ──────────▶ merged  (parallel, no dependency)
    │                                       │
    └──▶ S-Pipeline(US-33) ──── wait ──────▶ S-Pipeline(US-34) ──▶ merged
                                              (sequential, US-34 depends on US-33)
```

---

## Agent Communication Protocol

Agents communicate through **file-based handoffs** and **structured JSON messages**:

| From | To | Channel | Format |
|---|---|---|---|
| Planner | Orchestrator | `testresults/dod/US-NN-dor.json` | DoR report |
| Builder | Orchestrator | Git commits on feature branch | Conventional commits |
| Reviewer | Orchestrator | `docs/reviews/US-NN-review.md` | Review record |
| Auditor | Orchestrator | `docs/specs/evidence/US-NN-audit.json` | Audit evidence |
| Deployer | Orchestrator | `agents-run.jsonl` append | Run log entry |
| IT Manager | Orchestrator | Sign-off in DoR/DoD report | `signedBy` field |
