# TDD-M0-S05: Development Pipeline (Pre-Commit, Lint, Audit, DoR/DoD)

**Milestone:** M0 Foundations
**Status:** ❌ Not implemented — critical foundation for agentic development
**Gaps:** None — this TDD defines the full pipeline

## Story

As a **developer (or agent)**, I want an automated development pipeline that enforces quality gates at every step (pre-commit, commit, push), so that no story is started without its dependencies verified (Definition of Ready) and no story is marked done without passing all audits (Definition of Done).

## The Agentic Development Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. DEFINITION OF READY (DoR) — before starting a story                    │
│    ✅ All dependency TDDs are implemented and merged                       │
│    ✅ npm ci succeeds (dependencies healthy)                               │
│    ✅ npm run typecheck passes                                             │
│    ✅ npm test passes (no regressions)                                     │
│    ✅ npm audit --audit-level=high clean                                   │
│    ✅ TDD for this story exists and is reviewed                            │
│    ✅ Gaps in GAPS.md for this story are resolved or accepted              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. IMPLEMENT (TDD cycle)                                                  │
│    Write failing test → implement → green → refactor                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. PRE-COMMIT HOOKS (run automatically on every commit)                   │
│    ✅ ESLint — code quality + security rules                              │
│    ✅ Prettier — formatting                                                │
│    ✅ gitleaks — no secrets in staged files                                │
│    ✅ TypeScript check (tsc --noEmit)                                      │
│    ❌ Any failure → commit blocked                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. COMMIT MESSAGE HOOK                                                    │
│    ✅ Conventional commits format: type(scope): message                    │
│    ✅ Types: feat, fix, docs, test, refactor, chore, ci                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. PRE-PUSH AUDIT (run before pushing)                                    │
│    ✅ Full test suite passes                                               │
│    ✅ Build succeeds (npm run build)                                       │
│    ✅ npm audit --audit-level=high clean                                   │
│    ✅ gitleaks scan on full diff                                           │
│    ❌ Any failure → push blocked                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. CI PIPELINE (GitHub Actions, on PR and push to main)                   │
│    ✅ npm ci → lint → typecheck → test → build → audit                    │
│    ✅ gitleaks scan                                                        │
│    ✅ CodeQL security analysis (M7)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 7. DEFINITION OF DONE (DoD) — before merging to main                     │
│    ✅ All acceptance criteria pass (verified by tests or manual check)     │
│    ✅ Automated tests added (unit + integration where needed)              │
│    ✅ npm run typecheck, npm test, npm run build all pass                  │
│    ✅ ESLint clean, Prettier formatted                                     │
│    ✅ gitleaks clean (no secrets)                                          │
│    ✅ npm audit clean                                                      │
│    ✅ CI green on the PR                                                   │
│    ✅ Threat model updated if new event/endpoint/dependency added          │
│    ✅ Docs updated (feature status, specs, LLD if structure changed)       │
│    ✅ Works on desktop AND 360px phone (for UI changes)                    │
│    ✅ Merged to main through PR                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technical Design

### 1. ESLint Configuration (`.eslintrc.cjs`)

```js
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "prettier",
  ],
  parserOptions: {
    project: "./tsconfig.json",
  },
  rules: {
    "no-eval": "error",
    "no-implied-eval": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/strict-boolean-expressions": "warn",
    "no-console": ["warn", { allow: ["error", "warn"] }],
  },
};
```

### 2. Prettier Configuration (`.prettierrc`)

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

### 3. Git Hooks (via `husky` + `lint-staged`)

```bash
npm install -D husky lint-staged @commitlint/cli @commitlint/config-conventional gitleaks
npx husky init
```

#### Pre-commit hook (`.husky/pre-commit`)

```bash
#!/bin/sh
npx lint-staged
```

#### `lint-staged` config in `package.json`

```json
{
  "lint-staged": {
    "*.{ts,js}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"],
    "*": ["gitleaks protect --staged --no-banner"]
  }
}
```

#### Commit message hook (`.husky/commit-msg`)

```bash
#!/bin/sh
npx commitlint --edit $1
```

#### `commitlint.config.js`

```js
export default { extends: ["@commitlint/config-conventional"] };
```

#### Pre-push hook (`.husky/pre-push`)

```bash
#!/bin/sh
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
gitleaks detect --no-banner
```

### 4. Gitleaks Configuration (`.gitleaks.toml`)

```toml
[allowlist]
paths = [
  "package-lock.json",
  "docs/**",
]
```

### 5. DoR Audit Script (`scripts/check-dor.ts`)

```ts
// Runs before starting a story implementation
// Checks: npm ci, typecheck, test, audit, dependency TDDs exist
```

### 6. DoD Audit Script (`scripts/check-dod.ts`)

```ts
// Runs before marking a story as done
// Checks: all tests pass, lint clean, gitleaks clean, audit clean, build succeeds
```

### 7. Package.json Scripts (additions)

```json
{
  "scripts": {
    "lint": "eslint src/ tests/",
    "lint:fix": "eslint src/ tests/ --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "audit:security": "npm audit --audit-level=high",
    "check:secrets": "gitleaks detect --no-banner",
    "check:dor": "tsx scripts/check-dor.ts",
    "check:dod": "tsx scripts/check-dod.ts",
    "prepare": "husky"
  }
}
```

## Test Plan (TDD)

### Structural Verification

```
✅ .eslintrc.cjs exists and is valid
✅ .prettierrc exists and is valid
✅ .husky/pre-commit exists and runs lint-staged
✅ .husky/commit-msg exists and runs commitlint
✅ .husky/pre-push exists and runs full audit
✅ .gitleaks.toml exists
✅ commitlint.config.js exists
✅ npm run lint exits 0 on clean code
✅ npm run format:check exits 0 on formatted code
✅ gitleaks detect finds no secrets in the repo
```

### Hook Behavior Tests (manual)

```
✅ Commit with lint error → blocked by pre-commit
✅ Commit message "bad message" → blocked by commit-msg
✅ Commit message "feat(sessions): add name generator" → accepted
✅ Push with failing tests → blocked by pre-push
✅ File with API key pattern → blocked by gitleaks
```

## Files to Create

| File | Action |
|---|---|
| `.eslintrc.cjs` | Create |
| `.prettierrc` | Create |
| `.husky/pre-commit` | Create |
| `.husky/commit-msg` | Create |
| `.husky/pre-push` | Create |
| `.gitleaks.toml` | Create |
| `commitlint.config.js` | Create |
| `scripts/check-dor.ts` | Create |
| `scripts/check-dod.ts` | Create |
| `package.json` | Add lint/format/audit scripts, lint-staged config, prepare hook |

## Dev Dependencies to Install

```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-config-prettier prettier husky lint-staged \
  @commitlint/cli @commitlint/config-conventional
```

`gitleaks` is installed as a system binary (not npm): https://github.com/gitleaks/gitleaks

## Dependencies

- None (this is foundational — everything else depends on this)

## Why This Is M0, Not M2

This pipeline must exist **before** any story implementation begins. It ensures:
1. Every commit is lint-clean and secret-free
2. Every push passes full tests and audit
3. The Definition of Ready verifies dependencies before work starts
4. The Definition of Done verifies completeness before merge
5. Agents implementing stories can run `check-dor` and `check-dod` automatically
