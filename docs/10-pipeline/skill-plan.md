# Skill Plan

Agent skills are reusable, named units of capability that agents invoke during the pipeline. Each skill has defined inputs, outputs, and quality criteria.

---

## Skill Inventory

### Pipeline Skills

| Skill | Agent | Phase | Purpose |
|---|---|---|---|
| `dor-audit` | Planner | DoR | Run all DoR checks and produce report |
| `dod-audit` | Auditor | DoD | Run all DoD checks and produce report |
| `dependency-check` | Planner | DoR | Verify prerequisite stories are merged |
| `gap-analysis` | Planner | DoR | Check GAPS.md for unresolved blockers |
| `milestone-plan` | Planner | M-Plan | Sequence stories, identify dependencies |

### Build Skills

| Skill | Agent | Phase | Purpose |
|---|---|---|---|
| `tdd-cycle` | Builder | Build | Red-green-refactor for one acceptance criterion |
| `commit-push` | Builder | Build | Stage one file, commit, push (per-file rule) |
| `code-generation` | Builder | Build | Generate implementation code from TDD spec |
| `test-generation` | Builder | Build | Generate test code from acceptance criteria |

### Quality Skills

| Skill | Agent | Phase | Purpose |
|---|---|---|---|
| `test-runner` | Tester | Build/DoD | Execute full test suite with coverage |
| `coverage-analysis` | Tester | DoD | Parse coverage report, check thresholds |
| `ac-mapping` | Tester | DoD | Map tests to acceptance criteria |
| `code-review` | Reviewer | DoD | Review changed files for correctness |
| `security-review` | Reviewer | DoD | Review for OWASP top 10 and project rules |
| `simplification` | Reviewer | DoD | Identify code that can be simplified |

### Security Skills

| Skill | Agent | Phase | Purpose |
|---|---|---|---|
| `security-scan` | Auditor | DoD | Run gitleaks, semgrep, npm audit |
| `compliance-check` | Auditor | DoD | Verify compliance requirements per story |
| `evidence-generation` | Auditor | DoD | Generate audit evidence JSON artifacts |
| `threat-model-verify` | Auditor | DoD | Verify threat model rows for the story |

### Management Skills

| Skill | Agent | Phase | Purpose |
|---|---|---|---|
| `classification` | IT Manager | Planning | Classify story by security level |
| `sign-off` | IT Manager | DoR/DoD | Approve CRITICAL story approach/completion |
| `escalation-handling` | IT Manager | Any | Investigate retry exhaustion |
| `reclassification` | IT Manager | Any | Change story security level |

### Deployment Skills

| Skill | Agent | Phase | Purpose |
|---|---|---|---|
| `merge-deploy` | Deployer | Merge | Squash merge PR and monitor deployment |
| `health-check` | Deployer | Merge | Verify /health returns expected response |
| `smoke-test` | Deployer | Merge | Run post-deploy smoke test |
| `rollback` | Deployer | Hotfix | Rollback to previous version |

---

## Skill Specifications

### `dor-audit`

```yaml
name: dor-audit
agent: Planner
inputs:
  - story: string (e.g. "US-32")
  - classification: CRITICAL | HIGH | MEDIUM | LOW
outputs:
  - report: testresults/dod/{story}-dor.json
  - overall: pass | fail
steps:
  1. Check TDD exists
  2. Check acceptance criteria defined
  3. Check work plan exists
  4. Check dependencies merged (git log)
  5. Check GAPS.md for blockers
  6. Run npm ci
  7. Run npm run typecheck
  8. Run npm test
  9. Run npm audit --audit-level=high
  10. Run gitleaks detect
  11. (HIGH+) Check threat model
  12. (HIGH+) Check security checklist
  13. (CRITICAL) Get IT Manager sign-off
  14. Generate report JSON
quality: All checks must pass for overall=pass
```

### `tdd-cycle`

```yaml
name: tdd-cycle
agent: Builder
inputs:
  - story: string
  - acceptanceCriterion: string (the Given/When/Then)
  - tddSpec: string (path to TDD file)
outputs:
  - testFile: string (path to new/modified test)
  - sourceFile: string (path to new/modified source)
  - commits: number
steps:
  1. Read the acceptance criterion
  2. Write a failing test (RED)
  3. Commit test file: "test(scope): add failing test for AC-N"
  4. Push
  5. Write minimum code to pass (GREEN)
  6. Commit source file: "feat(scope): implement AC-N"
  7. Push
  8. Run tests to verify green
  9. Refactor if needed (separate commit + push)
quality: Test must fail before implementation, pass after
```

### `commit-push`

```yaml
name: commit-push
agent: Builder
inputs:
  - file: string (path to stage)
  - type: feat | fix | docs | test | refactor | chore | ci
  - scope: string
  - description: string
outputs:
  - sha: string (commit hash)
  - pushed: boolean
steps:
  1. git add {file}
  2. git commit -m "{type}({scope}): {description}"
     - pre-commit hook runs (lint-staged + gitleaks)
     - commit-msg hook runs (conventional commit validation)
  3. git push
     - pre-push hook runs (typecheck + tests + build + audit + semgrep)
  4. Return sha
quality: One file per commit, one commit per push. Hooks must not be skipped.
```

### `code-review`

```yaml
name: code-review
agent: Reviewer
inputs:
  - branch: string (feature branch name)
  - story: string
  - classification: CRITICAL | HIGH
outputs:
  - record: docs/reviews/{story}-review.md
  - verdict: APPROVED | CHANGES_REQUESTED
  - findings: array of {file, line, severity, description}
steps:
  1. List changed files: git diff main...{branch} --name-only
  2. For each file:
     a. Read the file
     b. Check for correctness against AC
     c. Check for security issues
     d. Check for simplification
     e. Record findings
  3. Write review record
  4. Return verdict
quality: Every finding has a severity and actionable description
```

### `dod-audit`

```yaml
name: dod-audit
agent: Auditor
inputs:
  - story: string
  - classification: CRITICAL | HIGH | MEDIUM | LOW
outputs:
  - report: testresults/dod/{story}-dod.json
  - evidence: docs/specs/evidence/{story}-audit.json
  - overall: pass | fail
steps:
  1. Run all 7 angles of DoD checks (see definition-of-done.md)
  2. Collect automated results
  3. Verify manual checks (prompt or read existing records)
  4. Generate DoD report JSON
  5. Generate audit evidence JSON
quality: All checks for the classification level must pass
```

---

## Skill Dependencies

```
dor-audit
  ├── dependency-check
  ├── gap-analysis
  └── security-scan (partial: gitleaks + audit only)

tdd-cycle
  ├── test-generation
  ├── code-generation
  └── commit-push

dod-audit
  ├── test-runner
  ├── coverage-analysis
  ├── ac-mapping
  ├── security-scan
  ├── compliance-check
  ├── threat-model-verify
  └── evidence-generation

code-review
  ├── security-review
  └── simplification

merge-deploy
  ├── health-check
  └── smoke-test
```

---

## Skill Plan by Milestone

| Milestone | Skills to Implement | Priority |
|---|---|---|
| **M2** | `dor-audit`, `dod-audit`, `commit-push`, `tdd-cycle`, `security-scan`, `merge-deploy`, `health-check` | P0 — pipeline must work before first story |
| **M3** | `code-review`, `security-review`, `test-runner`, `coverage-analysis` | P0 — review skills needed for gated stories |
| **M4** | `compliance-check`, `threat-model-verify` | P0 — E2EE stories are all CRITICAL |
| **M6** | `escalation-handling`, `sign-off` | P1 — compliance stories need IT Manager skills |
| **M7** | `smoke-test`, `evidence-generation`, `ac-mapping` | P1 — observability and evidence maturity |
| **M9** | `rollback` | P2 — DR drill needs rollback skill |

---

## Capability Matrix

| Skill | Automated | Requires Human | Produces Evidence |
|---|---|---|---|
| `dor-audit` | Mostly | CRITICAL: IT Manager sign-off | JSON report |
| `dod-audit` | Mostly | HIGH+: manual checks | JSON report + evidence |
| `tdd-cycle` | Fully | — | Commits + test results |
| `commit-push` | Fully | — | Git commits |
| `code-review` | Agent or human | HIGH+: at least 1 human | Review record |
| `security-scan` | Fully | — | Scan results |
| `compliance-check` | Semi | Lawyer for legal docs | Compliance mapping |
| `merge-deploy` | Mostly | CRITICAL: manual trigger | Deploy verification |
| `health-check` | Fully | — | Health response |
| `smoke-test` | Semi | UI verification | Test results |
| `rollback` | Fully | Trigger decision is human | Rollback verification |
