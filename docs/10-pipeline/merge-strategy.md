# Merge Strategy

Defines how code reaches `main` and production. Every merge is gated — the gate strictness depends on the story's [classification](story-classification.md).

---

## Branch Naming Convention

| Type | Pattern | Example |
|---|---|---|
| **Story** | `feat/US-NN-short-description` | `feat/US-32-connection-auth` |
| **Bug fix** | `fix/US-NN-short-description` or `fix/description` | `fix/US-22-rate-limit-edge-case` |
| **Hotfix** | `hotfix/SEV-N-description` | `hotfix/SEV-1-websocket-crash` |
| **Docs** | `docs/description` | `docs/it-manager-production-review` |
| **Test** | `test/US-NN-description` | `test/US-21-schema-validation` |
| **Refactor** | `refactor/description` | `refactor/extract-session-state` |
| **Chore** | `chore/description` | `chore/update-dependencies` |
| **CI** | `ci/description` | `ci/add-codeql-workflow` |

---

## Merge Gates by Classification

### CRITICAL Stories

```
 feat/US-32-connection-auth
     │
     ├── All S-Pipeline phases passed
     ├── DoR report: pass
     ├── DoD report: pass (42 checks)
     ├── 2 code review approvals on PR
     ├── IT Manager explicit sign-off
     ├── CI green (all jobs)
     ├── Threat model verified
     ├── Security checklist verified
     │
     ▼
 gh pr merge --squash --delete-branch
     │
     ▼
 main → CI → Render auto-deploy → /health → live
```

**Merge method:** Squash merge (clean history)
**Branch deletion:** Automatic after merge
**Auto-merge:** **Disabled** — must be manually triggered after sign-off

### HIGH Stories

```
 feat/US-21-input-validation
     │
     ├── All S-Pipeline phases passed
     ├── DoR report: pass
     ├── DoD report: pass (33 checks)
     ├── 1 code review approval on PR
     ├── CI green
     │
     ▼
 gh pr merge --squash --delete-branch
```

**Auto-merge:** **Disabled** — requires 1 approval

### MEDIUM Stories

```
 feat/US-01-random-names
     │
     ├── All S-Pipeline phases passed
     ├── DoD report: pass (19 checks)
     ├── CI green
     │
     ▼
 Auto-merge (if enabled) or manual merge
```

**Auto-merge:** **Eligible** — CI green = merge

### LOW Stories

```
 feat/US-08-reactions
     │
     ├── DoD report: pass (16 checks)
     ├── CI green
     │
     ▼
 Auto-merge (if enabled) or manual merge
```

**Auto-merge:** **Eligible** — CI green = merge

---

## Branch Protection Rules (GitHub)

| Rule | Value |
|---|---|
| Require PR before merging | **Yes** |
| Required approving reviews | **1** (CRITICAL/HIGH enforced by process, not GitHub — GitHub max is repo-wide) |
| Dismiss stale reviews on new push | **Yes** |
| Require status checks to pass | **Yes** |
| Required status checks | `build-and-test` |
| Require branches to be up to date | **Yes** |
| Include administrators | **Yes** — nobody bypasses the gates |
| No force push | **Yes** |
| No deletion | **Yes** |
| Allow squash merge only | **Yes** |

---

## Commit Rules

### Per-File Commits

Every source file change is its own commit. This provides:
1. Granular contribution history
2. Easy `git bisect` for finding regressions
3. Clear blame for every line
4. Atomic revertability

```bash
# Good: one file per commit
git add src/security/tokenBucket.ts
git commit -m "feat(security): implement token bucket rate limiter"
git push

git add tests/unit/security/tokenBucket.test.ts
git commit -m "test(security): add token bucket unit tests"
git push
```

```bash
# Bad: multiple files in one commit
git add src/security/tokenBucket.ts tests/unit/security/tokenBucket.test.ts
git commit -m "feat(security): implement and test token bucket"
```

### Per-File Pushes

Every commit is pushed immediately after creation. This provides:
1. Remote backup of every incremental change
2. Individual contribution entries in GitHub history
3. CI feedback on every push (if PR exists)
4. No risk of losing local-only work

```bash
# Pattern: commit then push, repeat
git add <file>
git commit -m "type(scope): description"
git push

git add <next-file>
git commit -m "type(scope): description"
git push
```

### Conventional Commits

Enforced by `.githooks/commit-msg` + commitlint:

```
type(scope): description

Types: feat | fix | docs | test | refactor | chore | ci
Scope: module or feature area
Description: imperative, lowercase, no period
```

| Example | When |
|---|---|
| `feat(validation): add zod schemas for chat events` | New feature |
| `fix(sessions): prevent double-next race condition` | Bug fix |
| `docs(pipeline): add merge strategy specification` | Documentation |
| `test(security): add rate limiter edge case tests` | Test only |
| `refactor(sessions): extract state machine module` | Restructure |
| `chore(deps): update socket.io to 4.8.1` | Dependency update |
| `ci(workflow): add semgrep SAST scan step` | CI/CD change |

---

## Squash Merge Format

When the PR is merged, the squash commit message follows this format:

```
type(scope): US-NN short description (#PR)

Stories: US-NN
Pipeline: GATED|CONTINUOUS
Classification: CRITICAL|HIGH|MEDIUM|LOW
DoD: testresults/dod/US-NN-dod.json
```

---

## Post-Merge Verification

After every merge to main:

| Step | How | Fail Action |
|---|---|---|
| CI runs on main | GitHub Actions | **Revert merge immediately** |
| Render auto-deploys | "After CI Checks Pass" | CI red → no deploy |
| Health check | `GET /health` → 200 | Render keeps old version |
| Smoke test (M7+) | Automated CI job | Alert operator |
| Log to agents-run.jsonl | Orchestrator/developer | Manual entry |

### Revert Protocol

If CI fails on main after merge:

```bash
# 1. Revert the merge commit
git revert <merge-sha> --mainline 1
git push

# 2. Verify CI is green again on main
# 3. Investigate the failure
# 4. Fix via normal S-Pipeline (or H-Pipeline if urgent)
```

**Rule:** A broken main is a SEV-2 incident. Revert first, investigate second.

---

## Merge Conflict Resolution

| Scenario | Resolution |
|---|---|
| Feature branch behind main | Rebase onto main: `git rebase main` |
| Conflicting changes in same file | Manual resolution, re-run all tests |
| Two stories modify same module | Merge the dependency story first, rebase the other |
| Docs conflict (milestones.md, features.md) | Merge both additions, verify IDs are unique |

**Rule:** Never resolve merge conflicts by deleting the other person's code without understanding it. When in doubt, ask.
