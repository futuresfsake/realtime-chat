# TDD-M0-S05: Agentic SDLC Pipeline

**Milestone:** M0 Foundations
**Status:** ❌ Not implemented — critical foundation for agentic development
**Gaps:** None — this TDD defines the full pipeline

---

## Story

As a **developer (or agent)**, I want a full agentic software development lifecycle (SDLC) with multi-agent orchestration, skill-based capabilities, quality gates at every phase (pre-commit, commit, push, PR, merge, deploy), and evidence-based Definition of Ready / Definition of Done — so that each story flows through a repeatable, auditable pipeline from intake to production.

---

## 1. Agentic SDLC Overview

### 1.1 What This Is

An **agentic SDLC** automates the software development lifecycle using AI agents that follow structured pipelines. Each stage has a responsible agent role, defined inputs/outputs, and quality gates.

### 1.2 Core Layers

| Layer | Question | Meaning |
|---|---|---|
| Agentic SDLC | What is it for? | Automating plan → build → review → test → ship |
| Multi-agent orchestration | How is work distributed? | Orchestrator coordinates specialized agents |
| Agent skills | How is capability packaged? | Reusable, named units an agent can discover and invoke |

### 1.3 Multi-Agent Orchestration Pattern

```
                ┌────────────────────┐
                │    Orchestrator    │  (Claude Code session / workflow script)
                └─────────┬──────────┘
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
     ┌─────────┐     ┌──────────┐     ┌─────────┐
     │  build  │ ──▶ │  review  │ ──▶ │  audit  │   pipeline with hand-offs
     └─────────┘     └────┬─────┘     └─────────┘
          ▲               │ fail (capped retry loop, max 3)
          └───────────────┘
```

Two orchestration shapes used in this project:

1. **Orchestrator–worker**: The main session calls a subagent (e.g. code-reviewer) for a bounded job.
2. **Pipeline composition**: Chained stages with defined hand-offs — build → review → audit — with capped retry loops (review fails → back to build, max 3 attempts).

---

## 2. SDLC Stages & Agent Roles

| SDLC Stage | Agent Role | Reads From | Writes To |
|---|---|---|---|
| Intake | planner | `docs/backlogs/` | `docs/plans/` |
| Spec & design | architect | `docs/plans/` | `docs/specs/`, `docs/specs/adr/`, `docs/specs/hld/` |
| Investigation | researcher | `docs/specs/` | `docs/spikes/` |
| Build | builder | `docs/specs/`, TDDs | `src/`, `tests/` |
| Test | tester | `docs/tests/` | `tests/`, `testresults/`, `coverage/` |
| Review | code-reviewer | changed source | `docs/reviews/` |
| Audit / security | auditor | whole repo | `.gitleaks.toml`, `.semgrep.yml`, `docs/specs/evidence/` |
| Done | orchestrator | `testresults/dod/`, `docs/reviews/` | `docs/plans/` status, `agents-run.jsonl` |

### Stage Details

**Intake (planner):** Reads backlog items, verifies prerequisites, runs DoR checks, creates the work plan with acceptance criteria mapped to tests.

**Spec & design (architect):** Ensures TDD exists for the story, reviews design against HLD and ADRs, flags architectural concerns. Already done for all stories (our 36 TDD files).

**Investigation (researcher):** Time-boxed spikes when a TDD identifies unknowns. Writes findings to `docs/spikes/` with conclusions and recommendations.

**Build (builder):** Red-green-refactor TDD cycle. Each commit triggers pre-commit hooks. Implements until all acceptance criteria have passing tests.

**Test (tester):** Runs full test suite, measures coverage, verifies acceptance criteria. Generates test evidence for DoD.

**Review (code-reviewer):** Reviews changed source for correctness, security, simplification. Creates review record in `docs/reviews/`.

**Audit (auditor):** Runs gitleaks, semgrep, npm audit, license check. Generates evidence artifacts in `docs/specs/evidence/`.

**Done (orchestrator):** Verifies DoD checklist, merges PR, logs the run to `agents-run.jsonl`, updates plan status.

---

## 3. Repository Structure (Adapted for This Project)

```
realtime-chat/
│
├── .claude/                          # agent tool configuration
│   ├── settings.json                 # shared tool settings (committed)
│   └── settings.local.json           # personal/machine-specific overrides (gitignored)
│
├── .githooks/                        # git hook scripts (committed, not husky)
│   ├── pre-commit                    # lint-staged + gitleaks protect
│   ├── commit-msg                    # conventional commit validation
│   ├── pre-push                      # full audit before push
│   └── reference-transaction         # ref update logging
│
├── coverage/                         # generated test coverage (gitignored)
│   └── lcov-report/
│
├── docs/
│   ├── 00-overview/                  # existing: vision, open decisions
│   ├── 01-product/                   # existing: milestones, user stories, features
│   ├── 02-requirements/              # existing: specs
│   ├── 03-design/                    # existing: HLD, LLD, matchmaking
│   ├── 04-security/                  # existing: e2ee, threat model, privacy
│   ├── 05-quality/                   # existing: testing strategy
│   ├── 06-operations/                # existing: deployment
│   ├── 07-process/                   # existing: CI/CD
│   ├── backlogs/                     # NEW: unscheduled work items awaiting prioritization
│   ├── plans/                        # NEW: per-milestone/phase work plans + status board
│   ├── reviews/                      # NEW: per-story code review records
│   ├── specs/                        # NEW: formal spec artifacts
│   │   ├── adr/                      #   architecture decision records (existing ADRs move here)
│   │   ├── evidence/                 #   sign-off artifacts for audit claims
│   │   └── hld/                      #   high-level design docs
│   ├── spikes/                       # NEW: time-boxed investigation logs
│   ├── tests/                        # NEW: per-story test design & result records
│   └── tdd/                          # existing: TDD files per milestone
│
├── src/                              # application source code
│
├── tests/                            # automated test suites
│   ├── unit/
│   ├── integration/
│   └── support/                      # shared test helpers
│
├── testresults/                      # NEW: generated test results (gitignored)
│   └── dod/                          # per-story merged test results (DoD evidence)
│
├── tools/                            # NEW: standalone CLI scripts for build/CI/dev workflow
│   ├── check-dor.ts                  # Definition of Ready audit
│   ├── check-dod.ts                  # Definition of Done audit
│   ├── push-ready.ts                 # full push pipeline orchestrator
│   ├── mod-report.ts                 # moderator CLI (M7)
│   └── generate-dod-evidence.ts      # generate DoD evidence artifacts
│
├── agents-run.jsonl                  # NEW: append-only log of agent runs
│
├── .gitattributes
├── .gitignore
├── .gitleaks.toml                    # secret scanning rules
├── .semgrep.yml                      # NEW: SAST rules
├── .semgrepignore                    # NEW: paths excluded from semgrep
├── .node-version                     # pinned Node.js version
├── eslint.config.ts                  # linting rules (flat config)
├── commitlint.config.js              # conventional commits config
├── package.json
├── package-lock.json
├── tsconfig.json
└── AGENTS.md                         # NEW: repo-wide agent instructions
```

### Key New Directories

| Directory | Purpose | Gitignored? |
|---|---|---|
| `.claude/` | Agent settings (shared + local) | `settings.local.json` only |
| `.githooks/` | Git hooks (replaces husky) | No |
| `docs/backlogs/` | Work items not yet scheduled | No |
| `docs/plans/` | Phase plans + status board | No |
| `docs/reviews/` | Code review records per story | No |
| `docs/specs/evidence/` | Audit sign-off artifacts | No |
| `docs/spikes/` | Investigation logs | No |
| `docs/tests/` | Test design records | No |
| `testresults/` | Generated test/DoD evidence | Yes |
| `tools/` | CLI scripts for pipeline | No |
| `agents-run.jsonl` | Agent run audit trail | No |

---

## 4. The Full Agentic Development Lifecycle

```
 STORY LIFECYCLE (one story, start to finish)
 ═══════════════════════════════════════════════════════════════════════════════

 ┌──────────────────────────────────────────────────────────────────────────┐
 │ PHASE 1: INTAKE — planner agent                                        │
 │                                                                         │
 │  Input:  Story from docs/01-product/user-stories.md                    │
 │  Output: Work plan in docs/plans/US-NN.md                              │
 │                                                                         │
 │  Actions:                                                               │
 │   ✅ Verify TDD exists for this story                                   │
 │   ✅ Map acceptance criteria → test cases                               │
 │   ✅ Identify dependencies (other stories, packages)                    │
 │   ✅ Check GAPS.md for unresolved blockers                              │
 │   ✅ Create work plan with ordered tasks                                │
 ├──────────────────────────────────────────────────────────────────────────┤
 │ PHASE 2: DEFINITION OF READY (DoR) — gate: can we start?              │
 │                                                                         │
 │  $ npx tsx tools/check-dor.ts --story=US-21                            │
 │                                                                         │
 │  Automated checks:                                                      │
 │   ✅ TDD exists: docs/tdd/**/TDD-*-US21-*.md                           │
 │   ✅ Work plan exists: docs/plans/US-21.md                              │
 │   ✅ All dependency stories merged to main                              │
 │   ✅ Gaps in GAPS.md for this story resolved or accepted                │
 │   ✅ npm ci succeeds (lockfile healthy)                                  │
 │   ✅ npm run typecheck passes (no type errors)                           │
 │   ✅ npm test passes (no regressions from prior stories)                │
 │   ✅ npm audit --audit-level=high clean                                  │
 │   ✅ gitleaks detect clean (no secrets in repo)                          │
 │                                                                         │
 │  Output: DoR report in testresults/dod/US-21-dor.json                  │
 │                                                                         │
 │  ❌ Any failure → DO NOT START. Fix the blocker first.                   │
 │  ✅ All pass → create feature branch, begin Phase 3.                    │
 ├──────────────────────────────────────────────────────────────────────────┤
 │ PHASE 3: BUILD — builder agent (TDD red-green-refactor)                │
 │                                                                         │
 │  $ git checkout -b feat/US-21-input-validation                         │
 │                                                                         │
 │  Loop (per acceptance criterion):                                       │
 │   1. Write a failing test (RED)                                        │
 │   2. Write the minimum code to pass (GREEN)                            │
 │   3. Refactor without changing behavior                                │
 │   4. Commit → triggers Phase 4 hooks automatically                    │
 │  Repeat until all acceptance criteria have tests.                      │
 ├──────────────────────────────────────────────────────────────────────────┤
 │ PHASE 4: COMMIT GATES — automated via .githooks/                       │
 │                                                                         │
 │  .githooks/pre-commit (on every `git commit`):                         │
 │   ✅ lint-staged: ESLint --fix on staged .ts/.js                        │
 │   ✅ lint-staged: Prettier --write on staged files                      │
 │   ✅ gitleaks protect --staged (no secrets in staged diff)              │
 │                                                                         │
 │  .githooks/commit-msg (validates commit message):                      │
 │   ✅ Conventional commits: type(scope): description                     │
 │      types: feat | fix | docs | test | refactor | chore | ci          │
 │      example: feat(validation): add zod schemas for all events         │
 │                                                                         │
 │  ❌ Any failure → commit rejected. Fix and retry.                       │
 ├──────────────────────────────────────────────────────────────────────────┤
 │ PHASE 5: REVIEW — code-reviewer agent                                  │
 │                                                                         │
 │  After build is complete (all commits on feature branch):              │
 │   ✅ Review all changed files for correctness                           │
 │   ✅ Check for security issues (OWASP top 10)                           │
 │   ✅ Verify no plaintext leaks (from M4 onward)                        │
 │   ✅ Check for simplification opportunities                             │
 │   ✅ Write review record: docs/reviews/US-21-review.md                 │
 │                                                                         │
 │  Result:                                                                │
 │   ❌ Issues found → back to Phase 3 (build), max 3 retries             │
 │   ✅ Approved → proceed to Phase 6                                      │
 ├──────────────────────────────────────────────────────────────────────────┤
 │ PHASE 6: PRE-PUSH AUDIT — gate: can this leave the machine?           │
 │  (runs automatically via .githooks/pre-push)                           │
 │                                                                         │
 │  Full-project checks (not just staged files):                          │
 │   ✅ npm run typecheck (tsc --noEmit, full project)                    │
 │   ✅ npm test (full suite with coverage)                                │
 │   ✅ npm run build (production build compiles to dist/)                 │
 │   ✅ npm run lint (ESLint, full project)                                │
 │   ✅ npm audit --audit-level=high (dependency vulnerabilities)          │
 │   ✅ gitleaks detect --no-banner (full repo secret scan)               │
 │   ✅ semgrep --config=.semgrep.yml src/ (SAST scan)                    │
 │                                                                         │
 │  ❌ Any failure → push rejected. Fix, commit, retry.                    │
 │  ✅ All pass → code pushed to origin.                                   │
 ├──────────────────────────────────────────────────────────────────────────┤
 │ PHASE 7: PUSH PIPELINE — orchestrator creates PR + triggers CI        │
 │                                                                         │
 │  $ npx tsx tools/push-ready.ts --story=US-21                           │
 │                                                                         │
 │  Step 1 — Verify local state:                                          │
 │   ✅ On feature branch (not main)                                       │
 │   ✅ No uncommitted changes                                             │
 │   ✅ Branch is ahead of main                                            │
 │   ✅ Pre-push audit already passed (or re-run)                          │
 │                                                                         │
 │  Step 2 — Push to origin:                                              │
 │   git push -u origin feat/US-21-input-validation                      │
 │                                                                         │
 │  Step 3 — Create Pull Request:                                         │
 │   gh pr create \                                                       │
 │     --title "feat(validation): US-21 input validation" \               │
 │     --body "## Story\nUS-21\n## Changes\n- ...\n## Test Evidence\n..."  │
 │                                                                         │
 │  Step 4 — Wait for CI:                                                 │
 │   gh pr checks --watch                                                 │
 │   (CI pipeline runs — see Phase 8)                                     │
 │                                                                         │
 │  Step 5 — CI result:                                                   │
 │   ❌ CI red → diagnose, fix locally, push again (back to Phase 4)       │
 │   ✅ CI green → proceed to Phase 9 (DoD)                                │
 ├──────────────────────────────────────────────────────────────────────────┤
 │ PHASE 8: CI PIPELINE (GitHub Actions — on every push & PR to main)    │
 │                                                                         │
 │  .github/workflows/ci.yml:                                             │
 │                                                                         │
 │  Job: build-and-test (ubuntu-latest, Node from .node-version)          │
 │   ✅ npm ci (exact lockfile install)                                    │
 │   ✅ npm run lint (ESLint full project)                                  │
 │   ✅ npm run typecheck (tsc --noEmit)                                    │
 │   ✅ npm test -- --coverage (vitest with coverage report)                │
 │   ✅ npm run build (tsc → dist/)                                        │
 │   ✅ npm audit --audit-level=high                                        │
 │   ✅ gitleaks detect (secret scanning)                                   │
 │   ✅ semgrep --config=.semgrep.yml src/ (SAST)                          │
 │   ✅ Coverage ≥ 80% on security/, sessions/, matchmaking/, safety/      │
 │   ✅ Upload coverage report as artifact                                  │
 │   ✅ Upload test results to testresults/                                 │
 │                                                                         │
 │  Job: security (M7+):                                                  │
 │   ✅ CodeQL analysis                                                     │
 │                                                                         │
 │  ❌ Any failure → PR blocked from merging (branch protection).           │
 │  ✅ All pass → PR is mergeable.                                         │
 ├──────────────────────────────────────────────────────────────────────────┤
 │ PHASE 9: DEFINITION OF DONE (DoD) — gate: can we merge?               │
 │                                                                         │
 │  $ npx tsx tools/check-dod.ts --story=US-21                            │
 │                                                                         │
 │  Automated checks:                                                      │
 │   ✅ CI is green on the PR (gh pr checks)                                │
 │   ✅ npm run typecheck passes                                            │
 │   ✅ npm test passes (all acceptance criteria covered)                   │
 │   ✅ npm run lint clean                                                   │
 │   ✅ npm run build succeeds                                               │
 │   ✅ npm audit --audit-level=high clean                                   │
 │   ✅ gitleaks detect clean                                                │
 │   ✅ semgrep clean                                                        │
 │   ✅ Coverage on changed modules ≥ 80%                                    │
 │   ✅ Review record exists: docs/reviews/US-21-review.md                  │
 │                                                                         │
 │  Manual checks (verified and logged in DoD report):                    │
 │   ✅ All acceptance criteria from TDD verified by tests                 │
 │   ✅ New input → zod schema added                                       │
 │   ✅ New abuse risk → threat model row added                            │
 │   ✅ Docs updated (features.md, specs.md, LLD if structure changed)    │
 │   ✅ Works on desktop AND 360px phone (if UI change)                   │
 │   ✅ No plaintext on server (from M4 onward)                           │
 │                                                                         │
 │  Output:                                                                │
 │   testresults/dod/US-21-dod.json (evidence artifact)                   │
 │   docs/specs/evidence/US-21-audit.json (audit sign-off)                │
 │                                                                         │
 │  ❌ Any failure → fix, push, re-run DoD.                                │
 │  ✅ All pass → merge PR.                                                │
 ├──────────────────────────────────────────────────────────────────────────┤
 │ PHASE 10: MERGE + DEPLOY                                               │
 │                                                                         │
 │  $ gh pr merge --squash --delete-branch                                │
 │                                                                         │
 │  After merge to main:                                                  │
 │   ✅ CI runs again on main (same pipeline)                              │
 │   ✅ Render auto-deploys after CI passes (from M2 onward)              │
 │   ✅ Render health check: GET /health → 200                            │
 │       YES → new version live                                           │
 │       NO  → Render keeps old version, alert triggered                  │
 │   ✅ Post-deploy smoke test (manual or CI job in M7)                   │
 │                                                                         │
 │  Finalization:                                                          │
 │   ✅ Log run to agents-run.jsonl                                        │
 │   ✅ Update docs/plans/ status board                                    │
 │   ✅ Story is DONE.                                                     │
 └──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Guardrails

Quality is enforced regardless of whether a human or agent writes the code:

```
 .githooks/     ──▶  pre-commit, commit-msg, pre-push, reference-transaction
 .gitleaks.toml ──▶  secret scanning (local + CI)
 .semgrep.yml   ──▶  SAST rules (local + CI)
 eslint.config  ──▶  code quality + security rules (local + CI)
 vitest         ──▶  unit + integration tests (local + CI)
 npm audit      ──▶  dependency vulnerability scanning
 CI pipeline    ──▶  all of the above, enforced on every PR
 branch protect ──▶  no direct push to main, CI must pass
```

---

## 6. Branch Strategy

```
main (protected — no direct push, no force push)
  ├── feat/US-21-input-validation
  ├── feat/US-22-rate-limiting
  ├── fix/csp-inline-script-hash
  └── docs/tdd-m3-sessions
```

| Rule | Value |
|---|---|
| Branch naming | `type/US-NN-short-description` or `type/short-description` |
| Types | `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci` |
| Base branch | Always `main` |
| Merge method | Squash merge (clean history, one commit per story) |
| Delete after merge | Yes (auto) |
| Direct push to main | Blocked (branch protection) |
| Force push to main | Blocked |
| Required status checks | `build-and-test` job must pass |

---

## 7. Agent Run Log (`agents-run.jsonl`)

Every agentic run (one story, start to finish) is logged as a JSON line:

```json
{
  "story": "US-21",
  "startedAt": "2026-10-26T10:00:00Z",
  "completedAt": "2026-10-26T11:30:00Z",
  "phases": {
    "dor": { "status": "pass", "attempts": 1 },
    "build": { "status": "pass", "commits": 5 },
    "review": { "status": "pass", "attempts": 1, "findings": 0 },
    "audit": { "status": "pass" },
    "push": { "status": "pass", "pr": "#12" },
    "ci": { "status": "pass" },
    "dod": { "status": "pass", "attempts": 1 },
    "merge": { "status": "pass", "sha": "abc1234" }
  },
  "retryLoops": 0,
  "evidence": "testresults/dod/US-21-dod.json"
}
```

This provides a complete audit trail of every agent-driven development cycle.

---

## 8. AGENTS.md (Repo-Wide Agent Instructions)

Create `AGENTS.md` at the repo root — standing context that any agent reads when working in this repo:

```markdown
# Agent Instructions for realtime-chat

## Project
Anonymous, end-to-end encrypted, one-to-one realtime chat. TypeScript + Socket.IO.

## Rules
- TypeScript strict mode, ES modules only
- All client→server events validated by zod schemas
- No plaintext on server (E2EE from M4 onward)
- No raw IPs in logs (IP hash only)
- Conventional commits: type(scope): description
- Tests required for every acceptance criterion (TDD)
- Coverage ≥ 80% on security, sessions, matchmaking, safety modules

## Pipeline
Run `npx tsx tools/check-dor.ts --story=US-NN` before starting.
Run `npx tsx tools/check-dod.ts --story=US-NN` before merging.

## Key Files
- docs/tdd/ — Technical Design Documents per story
- docs/01-product/user-stories.md — Acceptance criteria
- docs/04-security/threat-model.md — Security threats
- GAPS.md — Open decisions needing PO confirmation
```

---

## 9. Technical Design

### 9.1 Git Hooks (`.githooks/` — no husky dependency)

Configure git to use `.githooks/` instead of the default `.git/hooks/`:

```bash
git config core.hooksPath .githooks
```

This is set automatically in `package.json` `prepare` script.

#### `.githooks/pre-commit`

```bash
#!/bin/sh
npx lint-staged
```

#### `.githooks/commit-msg`

```bash
#!/bin/sh
npx commitlint --edit "$1"
```

#### `.githooks/pre-push`

```bash
#!/bin/sh
set -e

echo "=== PRE-PUSH AUDIT ==="

echo "[1/7] TypeScript type check..."
npm run typecheck

echo "[2/7] Full test suite..."
npm test

echo "[3/7] Production build..."
npm run build

echo "[4/7] ESLint..."
npm run lint

echo "[5/7] Dependency audit..."
npm audit --audit-level=high

echo "[6/7] Secret scan (gitleaks)..."
gitleaks detect --no-banner

echo "[7/7] SAST scan (semgrep)..."
semgrep --config=.semgrep.yml src/ --quiet

echo "=== PRE-PUSH AUDIT PASSED ==="
```

#### `.githooks/reference-transaction`

```bash
#!/bin/sh
# Log ref updates for audit trail
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ref-update: $1 $2 $3" >> .git/ref-log.txt
```

### 9.2 lint-staged Config (in `package.json`)

```json
{
  "lint-staged": {
    "*.{ts,js}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"],
    "*": ["gitleaks protect --staged --no-banner"]
  }
}
```

### 9.3 ESLint Configuration (`eslint.config.ts` — flat config)

```ts
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: { project: "./tsconfig.json" },
    },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/strict-boolean-expressions": "warn",
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
);
```

### 9.4 Prettier Configuration (`.prettierrc`)

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

### 9.5 Commitlint (`commitlint.config.js`)

```js
export default { extends: ["@commitlint/config-conventional"] };
```

### 9.6 Gitleaks (`.gitleaks.toml`)

```toml
[allowlist]
paths = [
  "package-lock.json",
  "docs/**",
]
```

### 9.7 Semgrep (`.semgrep.yml`)

```yaml
rules:
  - id: no-innerhtml
    pattern: $X.innerHTML = $Y
    message: "Do not use innerHTML with dynamic content (XSS risk)"
    languages: [typescript, javascript]
    severity: ERROR

  - id: no-eval
    pattern: eval(...)
    message: "eval() is forbidden"
    languages: [typescript, javascript]
    severity: ERROR

  - id: no-raw-ip-log
    pattern: console.$METHOD(..., $IP, ...)
    message: "Do not log raw IP addresses — use ipHash"
    languages: [typescript, javascript]
    severity: WARNING
```

### 9.8 Semgrep Ignore (`.semgrepignore`)

```
node_modules/
dist/
coverage/
testresults/
*.test.ts
```

### 9.9 DoR Audit Script (`tools/check-dor.ts`)

```ts
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

interface DorResult {
  story: string;
  timestamp: string;
  checks: Record<string, { status: "pass" | "fail"; detail?: string }>;
  overall: "pass" | "fail";
}

function checkDor(story: string): DorResult {
  const checks: DorResult["checks"] = {};

  // TDD exists
  const tddPattern = `docs/tdd/**/TDD-*-${story}*.md`;
  checks.tddExists = { status: existsSync(tddPattern) ? "pass" : "fail" };

  // npm ci
  try {
    execSync("npm ci --ignore-scripts", { stdio: "pipe" });
    checks.npmCi = { status: "pass" };
  } catch {
    checks.npmCi = { status: "fail", detail: "npm ci failed" };
  }

  // typecheck
  try {
    execSync("npm run typecheck", { stdio: "pipe" });
    checks.typecheck = { status: "pass" };
  } catch {
    checks.typecheck = { status: "fail", detail: "type errors found" };
  }

  // tests
  try {
    execSync("npm test", { stdio: "pipe" });
    checks.tests = { status: "pass" };
  } catch {
    checks.tests = { status: "fail", detail: "tests failing" };
  }

  // npm audit
  try {
    execSync("npm audit --audit-level=high", { stdio: "pipe" });
    checks.audit = { status: "pass" };
  } catch {
    checks.audit = { status: "fail", detail: "high vulnerabilities found" };
  }

  // gitleaks
  try {
    execSync("gitleaks detect --no-banner", { stdio: "pipe" });
    checks.gitleaks = { status: "pass" };
  } catch {
    checks.gitleaks = { status: "fail", detail: "secrets detected" };
  }

  const overall = Object.values(checks).every((c) => c.status === "pass") ? "pass" : "fail";

  return { story, timestamp: new Date().toISOString(), checks, overall };
}
```

### 9.10 DoD Audit Script (`tools/check-dod.ts`)

```ts
interface DodResult {
  story: string;
  timestamp: string;
  checks: Record<string, { status: "pass" | "fail"; detail?: string }>;
  manualChecks: Record<string, boolean>;
  overall: "pass" | "fail";
}

function checkDod(story: string): DodResult {
  const checks: DodResult["checks"] = {};

  // All automated checks from DoR, plus:

  // CI green (check via gh cli)
  try {
    execSync("gh pr checks", { stdio: "pipe" });
    checks.ciGreen = { status: "pass" };
  } catch {
    checks.ciGreen = { status: "fail", detail: "CI not passing" };
  }

  // Review record exists
  const reviewPath = `docs/reviews/${story}-review.md`;
  checks.reviewExists = {
    status: existsSync(reviewPath) ? "pass" : "fail",
    detail: reviewPath,
  };

  // Coverage threshold
  // (parse coverage report from testresults/)

  // semgrep clean
  try {
    execSync("semgrep --config=.semgrep.yml src/ --quiet", { stdio: "pipe" });
    checks.semgrep = { status: "pass" };
  } catch {
    checks.semgrep = { status: "fail", detail: "SAST findings" };
  }

  // Generate DoD evidence artifact
  const evidence = { story, timestamp: new Date().toISOString(), checks };
  writeFileSync(`testresults/dod/${story}-dod.json`, JSON.stringify(evidence, null, 2));

  const overall = Object.values(checks).every((c) => c.status === "pass") ? "pass" : "fail";
  return { story, timestamp: new Date().toISOString(), checks, manualChecks: {}, overall };
}
```

### 9.11 Push Pipeline Script (`tools/push-ready.ts`)

```ts
// Orchestrates the full push-to-merge pipeline for a story.
//
// Usage: npx tsx tools/push-ready.ts --story=US-21
//
// Steps:
//  1. Verify we're on a feature branch, not main
//  2. Verify no uncommitted changes
//  3. Verify branch is ahead of main
//  4. Run pre-push audit (typecheck, test, build, lint, audit, gitleaks, semgrep)
//  5. Push to origin
//  6. Create PR with story reference and test evidence
//  7. Wait for CI to pass
//  8. Report result (ready for DoD, or CI failures to fix)

import { execSync } from "node:child_process";

function pushReady(story: string): void {
  // Step 1: Verify branch
  const branch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
  if (branch === "main") throw new Error("Cannot push from main. Use a feature branch.");

  // Step 2: Clean working tree
  const status = execSync("git status --porcelain", { encoding: "utf8" }).trim();
  if (status) throw new Error("Uncommitted changes. Commit or stash first.");

  // Step 3: Ahead of main
  const behind = execSync("git rev-list --count HEAD..main", { encoding: "utf8" }).trim();
  if (behind !== "0") console.warn(`Warning: ${behind} commits behind main. Consider rebasing.`);

  // Step 4: Pre-push audit (same as .githooks/pre-push)
  console.log("Running pre-push audit...");
  execSync("npm run typecheck", { stdio: "inherit" });
  execSync("npm test", { stdio: "inherit" });
  execSync("npm run build", { stdio: "inherit" });
  execSync("npm run lint", { stdio: "inherit" });
  execSync("npm audit --audit-level=high", { stdio: "inherit" });
  execSync("gitleaks detect --no-banner", { stdio: "inherit" });
  execSync("semgrep --config=.semgrep.yml src/ --quiet", { stdio: "inherit" });

  // Step 5: Push
  console.log("Pushing to origin...");
  execSync(`git push -u origin ${branch}`, { stdio: "inherit" });

  // Step 6: Create PR
  console.log("Creating pull request...");
  const prTitle = `${branch.split("/")[0]}(${story.toLowerCase()}): ${branch.split("/").slice(1).join("/")}`;
  execSync(
    `gh pr create --title "${prTitle}" --body "## Story\n${story}\n\n## Pipeline\nDoR: passed\nBuild: complete\nReview: pending\n\n## Evidence\ntestresults/dod/${story}-dor.json"`,
    { stdio: "inherit" },
  );

  // Step 7: Wait for CI
  console.log("Waiting for CI...");
  try {
    execSync("gh pr checks --watch", { stdio: "inherit" });
    console.log(`CI passed. Run: npx tsx tools/check-dod.ts --story=${story}`);
  } catch {
    console.error("CI failed. Fix the issues and push again.");
    process.exit(1);
  }
}
```

### 9.12 DoD Evidence Generator (`tools/generate-dod-evidence.ts`)

```ts
// Generates the final DoD evidence artifact for a story.
// Collects: test results, coverage, audit results, review record.
// Output: testresults/dod/US-NN-dod.json + docs/specs/evidence/US-NN-audit.json

import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";

interface DodEvidence {
  story: string;
  timestamp: string;
  ci: "pass" | "fail";
  typecheck: "pass" | "fail";
  tests: "pass" | "fail";
  lint: "pass" | "fail";
  build: "pass" | "fail";
  audit: "pass" | "fail";
  gitleaks: "pass" | "fail";
  semgrep: "pass" | "fail";
  reviewRecord: string | null;
  coveragePercent: number | null;
}

function generateEvidence(story: string): DodEvidence {
  // ... run all checks, collect results, write to testresults/dod/ and docs/specs/evidence/
}
```

---

## 10. Package.json Script Additions

```json
{
  "scripts": {
    "lint": "eslint src/ tests/",
    "lint:fix": "eslint src/ tests/ --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "audit:security": "npm audit --audit-level=high",
    "check:secrets": "gitleaks detect --no-banner",
    "check:sast": "semgrep --config=.semgrep.yml src/ --quiet",
    "check:dor": "tsx tools/check-dor.ts",
    "check:dod": "tsx tools/check-dod.ts",
    "pipeline:push": "tsx tools/push-ready.ts",
    "evidence:dod": "tsx tools/generate-dod-evidence.ts",
    "prepare": "git config core.hooksPath .githooks"
  }
}
```

---

## 11. Test Plan

### Structural Verification

```
✅ .githooks/pre-commit exists and is executable
✅ .githooks/commit-msg exists and is executable
✅ .githooks/pre-push exists and is executable
✅ .githooks/reference-transaction exists and is executable
✅ eslint.config.ts exists and is valid
✅ .prettierrc exists and is valid
✅ .gitleaks.toml exists
✅ .semgrep.yml exists with at least 3 rules
✅ .semgrepignore exists
✅ commitlint.config.js exists
✅ AGENTS.md exists at repo root
✅ tools/check-dor.ts exists
✅ tools/check-dod.ts exists
✅ tools/push-ready.ts exists
✅ tools/generate-dod-evidence.ts exists
✅ agents-run.jsonl exists (empty initial)
✅ docs/backlogs/ directory exists
✅ docs/plans/ directory exists
✅ docs/reviews/ directory exists
✅ docs/specs/evidence/ directory exists
✅ docs/spikes/ directory exists
✅ docs/tests/ directory exists
✅ testresults/dod/ directory exists
✅ npm run lint exits 0 on clean code
✅ npm run format:check exits 0 on formatted code
✅ gitleaks detect finds no secrets in the repo
✅ semgrep finds no issues in clean code
```

### Hook Behavior Tests (manual)

```
✅ Commit with lint error → blocked by pre-commit
✅ Commit message "bad message" → blocked by commit-msg
✅ Commit message "feat(sessions): add name generator" → accepted
✅ Push with failing tests → blocked by pre-push
✅ File with API key pattern → blocked by gitleaks
✅ innerHTML usage → flagged by semgrep
```

### Pipeline Script Tests

```
✅ check-dor.ts exits 0 when all checks pass
✅ check-dor.ts exits 1 when typecheck fails
✅ check-dor.ts exits 1 when tests fail
✅ check-dor.ts generates DoR report JSON
✅ check-dod.ts exits 0 when all checks pass
✅ check-dod.ts exits 1 when review record missing
✅ check-dod.ts generates DoD evidence JSON
✅ push-ready.ts refuses to run on main branch
✅ push-ready.ts refuses to run with uncommitted changes
```

---

## 12. Files to Create

| File | Action |
|---|---|
| `.githooks/pre-commit` | Create |
| `.githooks/commit-msg` | Create |
| `.githooks/pre-push` | Create |
| `.githooks/reference-transaction` | Create |
| `eslint.config.ts` | Create (flat config, replacing .eslintrc.cjs plan) |
| `.prettierrc` | Create |
| `.gitleaks.toml` | Create |
| `.semgrep.yml` | Create |
| `.semgrepignore` | Create |
| `commitlint.config.js` | Create |
| `AGENTS.md` | Create |
| `tools/check-dor.ts` | Create |
| `tools/check-dod.ts` | Create |
| `tools/push-ready.ts` | Create |
| `tools/generate-dod-evidence.ts` | Create |
| `agents-run.jsonl` | Create (empty) |
| `docs/backlogs/.gitkeep` | Create |
| `docs/plans/.gitkeep` | Create |
| `docs/reviews/.gitkeep` | Create |
| `docs/specs/evidence/.gitkeep` | Create |
| `docs/spikes/.gitkeep` | Create |
| `docs/tests/.gitkeep` | Create |
| `testresults/dod/.gitkeep` | Create |
| `package.json` | Update scripts, lint-staged, prepare hook |
| `.gitignore` | Update: add coverage/, testresults/, dist/ |

---

## 13. Dev Dependencies to Install

```bash
npm install -D eslint @eslint/js typescript-eslint \
  eslint-config-prettier prettier lint-staged \
  @commitlint/cli @commitlint/config-conventional
```

System binaries (not npm):
- **gitleaks**: https://github.com/gitleaks/gitleaks
- **semgrep**: https://semgrep.dev/docs/getting-started/

---

## 14. Dependencies

- None — this is foundational. Everything else depends on this.

---

## 15. Why This Is M0, Not M2

This pipeline must exist **before** any story implementation begins. It ensures:
1. Every commit is lint-clean and secret-free
2. Every push passes full tests, audit, and SAST
3. The Definition of Ready verifies dependencies before work starts
4. The Definition of Done verifies completeness with evidence artifacts before merge
5. Agents implementing stories follow a structured, auditable pipeline
6. Every agentic run is logged to `agents-run.jsonl` for traceability
7. Code reviews are recorded as artifacts, not lost in conversation
8. The orchestrator–worker pattern enables specialized subagent delegation
