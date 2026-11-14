# TDD-M0-S03: Security Baseline

**Milestone:** M0 Foundations
**Status:** ⚠️ Partially done — .gitignore exists, env pattern missing
**Gaps:** G-03

## Story

As a **developer**, I want a security baseline in the project scaffold, so that secrets are never committed, environment variables have a documented pattern, and dependency auditing is established from day one.

## Current State

| Item | Status | Notes |
|---|---|---|
| `.gitignore` ignores `.env` | ✅ | Prevents accidental secret commits |
| `.gitignore` ignores `node_modules/`, `dist/` | ✅ | Standard exclusions |
| GitHub secret scanning | ✅ | Enabled by default on public repos |
| `.env.example` | ❌ Missing | No documented env var pattern |
| `npm audit` baseline | ❌ Not run | No audit in scripts; comes in M2 CI |
| Secrets management docs | ❌ Missing | No guidance for developers |

## Technical Design

### 1. `.env.example` (create)

```env
# Server
PORT=3000
NODE_ENV=development

# Security (M2+)
# ALLOWED_ORIGINS=http://localhost:3000
# TRUST_PROXY_HOPS=0

# Geo (M5+)
# GEO_DB_PATH=./data/dbip-country-lite.mmdb

# Feature flags
# PREVIEW_BANNER=true
```

Purpose: documents every env var the app uses, with safe defaults. Commented-out vars show what's coming in future milestones.

### 2. Security principles document (in existing docs)

Already covered by:
- `docs/04-security/` — threat model, checklist, E2EE, trust & safety
- `docs/00-overview/vision.md` — principles (never trust the client, blind relay, collect nothing)

No new document needed. The `.env.example` closes the gap.

### 3. Dependency audit baseline

`npm audit` is planned for M2 CI. For M0, run it once manually to establish a baseline:
```bash
npm audit --audit-level=high
```

If `better-sqlite3` shows vulnerabilities, it reinforces the case for removal (TDD-M0-S04).

## Test Plan (TDD)

1. `.env.example` exists and lists all env vars from `docs/06-operations/deployment.md`
2. `.env` is in `.gitignore` (already true)
3. `git log --all --diff-filter=A -- '*.env' '.env.*'` returns nothing (no env files ever committed)
4. `npm audit --audit-level=high` exit code documented

## Files to Create/Modify

| File | Action |
|---|---|
| `.env.example` | Create |
| `.gitignore` | Verify (already correct) |

## Dependencies

None. This is a standalone scaffold improvement.

## Acceptance Criteria

- [ ] `.env.example` exists with all documented env vars
- [ ] No `.env` file is tracked in git history
- [ ] `npm audit` baseline documented
