# TDD-M2-US24: Use It From Anywhere (CI/CD + Deployment)

**Milestone:** M2 Hardening + CI/CD + First Deploy
**Story:** US-24 — As a chatter, I can use it from anywhere
**Features:** F-10 (CI pipeline), F-11 (Render CD)
**Gaps:** G-13 (Render URL unknown until service created)

## Acceptance Criteria

- The app is reachable over HTTPS at a public URL
- A phone on mobile data can chat with a laptop
- CI runs on every PR: typecheck → test → build → audit
- Branch protection: `main` requires PR + green CI
- Render Auto-Deploy: only after CI checks pass

## Technical Design

### 1. CI Pipeline (`.github/workflows/ci.yml`)

From `docs/07-process/ci-cd.md`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: npm audit --audit-level=high
```

### 2. Node Version Pinning

Create `.node-version`:
```
22
```

This is used by:
- GitHub Actions `setup-node` (reads `node-version-file`)
- Render (reads `.node-version`)
- Local dev guidance

### 3. Render Service Configuration

| Setting | Value | Notes |
|---|---|---|
| Region | Singapore | Closest to Philippines |
| Branch | `main` | Production branch |
| Build command | `npm ci && npm run build` | Exact lockfile, compile TS |
| Start command | `npm start` | `node dist/index.js` |
| Instance type | Free | $0 |
| Health check path | `/health` | Deploy gating + auto-restart |
| Auto-Deploy | After CI Checks Pass | Red CI never reaches users |

### 4. Environment Variables on Render

| Name | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | |
| `ALLOWED_ORIGINS` | `https://realtime-chat-XXXX.onrender.com` | Set after service creation |
| `TRUST_PROXY_HOPS` | `1` | Render's proxy |
| `PREVIEW_BANNER` | `true` | Until M8 launch |

### 5. Branch Protection Rules

Configure on GitHub:
- Require PR before merging to `main`
- Require status checks: `build-and-test`
- No force-push to `main`
- No deletion of `main`

### 6. Preview Banner

Until M8 (public launch), show a banner on the page:
```html
<div id="preview-banner">⚠️ Preview — not launched yet</div>
```

The server sets a `X-Preview: true` header when `PREVIEW_BANNER=true`, and the client checks it.

## Test Plan (TDD — write tests FIRST)

### CI Validation (not unit tests, but structural)

```
✅ ci.yml exists at .github/workflows/ci.yml
✅ ci.yml includes: npm ci, typecheck, test, build, audit
✅ .node-version exists and contains "22"
✅ npm run build produces dist/index.js
✅ npm run typecheck exits 0
✅ npm test exits 0
✅ npm audit --audit-level=high exits 0
```

### Integration Test: `tests/integration/health.test.ts`

```
describe("/health endpoint")
  ✅ GET /health → 200 { status: "ok" }
  ✅ Cache-Control: no-store header present
  ✅ response time < 100ms
```

### Smoke Test (manual, post-deploy)

From `docs/05-quality/testing-strategy.md`:
1. Open live URL on laptop → page loads over HTTPS
2. Open on phone (mobile data) → page loads
3. Both connect via Socket.IO → can exchange messages
4. `/health` returns `{ status: "ok" }`
5. Security headers check: securityheaders.com grade ≥ A
6. Preview banner visible

## Files to Create/Modify

| File | Action |
|---|---|
| `.github/workflows/ci.yml` | Create |
| `.node-version` | Create |
| `src/app.ts` | Modify — add preview banner header |
| `public/index.html` | Modify — add preview banner element |
| `public/styles.css` | Modify — style preview banner |

## Dependencies

- GitHub Actions (free for public repos)
- Render free tier account
- No new npm packages

## Threat Mitigations

- T-09 (compromised deploys): branch protection + CI gate
- T-21 (vulnerable deps): `npm audit` in CI
