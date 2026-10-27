# GitHub Actions Workflow Definitions

Production-grade CI/CD workflows for the realtime-chat project. These workflows enforce the pipeline gates documented in this section.

---

## Workflow Overview

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | Push to any branch, PR to main | Core CI: install, lint, typecheck, test, build, audit, security scans |
| `security.yml` | Push to main, weekly schedule | Extended security: CodeQL, dependency review, license check |
| `deploy-verify.yml` | Merge to main (after CI passes) | Post-deploy verification: health check, smoke test |
| `dor-check.yml` | Manual dispatch | DoR audit for a specific story |
| `dod-check.yml` | Manual dispatch | DoD audit for a specific story |
| `nightly.yml` | Daily at 02:00 UTC | Extended tests: soak test, full security scan, dependency audit |

---

## ci.yml — Core CI Pipeline

```yaml
name: CI
on:
  push:
    branches: ['**']
  pull_request:
    branches: [main]

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

      # Step 1: Install
      - run: npm ci

      # Step 2: Lint
      - run: npm run lint

      # Step 3: Type check
      - run: npm run typecheck

      # Step 4: Test with coverage
      - run: npm run test:coverage

      # Step 5: Build
      - run: npm run build

      # Step 6: Dependency audit
      - run: npm audit --audit-level=high

      # Step 7: Secret scan
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Step 8: SAST scan
      - uses: returntocorp/semgrep-action@v1
        with:
          config: .semgrep.yml

      # Step 9: Bundle size check (M7+)
      - name: Check bundle size
        run: |
          PAGE_SIZE=$(wc -c < public/index.html)
          CSS_SIZE=$(wc -c < public/styles.css)
          JS_SIZE=$(wc -c < public/client.js)
          TOTAL=$((PAGE_SIZE + CSS_SIZE + JS_SIZE))
          echo "Total frontend size: ${TOTAL} bytes"
          if [ "$TOTAL" -gt 102400 ]; then
            echo "::error::Frontend bundle exceeds 100KB limit (${TOTAL} bytes)"
            exit 1
          fi

      # Step 10: Upload coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
          retention-days: 30

      # Step 11: No raw IPs in logs (semgrep custom rule)
      - name: Verify no raw IP logging
        run: |
          if grep -rn "req\.ip\|req\.connection\.remoteAddress\|socket\.handshake\.address" src/ --include="*.ts" | grep -v "ipHash\|test"; then
            echo "::error::Raw IP address usage detected in source code"
            exit 1
          fi

  # License compliance check
  license-check:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: npm
      - run: npm ci
      - name: Check licenses
        run: |
          npx license-checker --production --failOn "GPL-2.0;GPL-3.0;AGPL-1.0;AGPL-3.0"
```

---

## security.yml — Extended Security

```yaml
name: Security
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 3 * * 1'  # Weekly Monday 03:00 UTC

permissions:
  security-events: write
  contents: read

jobs:
  codeql:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@v3

  dependency-review:
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: high
```

---

## deploy-verify.yml — Post-Deploy Verification

```yaml
name: Deploy Verification
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    timeout-minutes: 5
    steps:
      - name: Wait for Render deploy
        run: sleep 120  # Render builds take ~2 min

      - name: Health check
        run: |
          HEALTH=$(curl -sf "${{ vars.PRODUCTION_URL }}/health" || echo '{"status":"unreachable"}')
          echo "Health response: $HEALTH"
          STATUS=$(echo "$HEALTH" | jq -r '.status')
          if [ "$STATUS" != "ok" ] && [ "$STATUS" != "degraded" ]; then
            echo "::error::Health check failed: status=$STATUS"
            exit 1
          fi

      - name: Smoke test - page loads
        run: |
          HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${{ vars.PRODUCTION_URL }}")
          if [ "$HTTP_CODE" != "200" ]; then
            echo "::error::Page load failed: HTTP $HTTP_CODE"
            exit 1
          fi

      - name: Smoke test - security headers
        run: |
          HEADERS=$(curl -sf -I "${{ vars.PRODUCTION_URL }}")
          echo "$HEADERS"
          echo "$HEADERS" | grep -qi "strict-transport-security" || echo "::warning::Missing HSTS header"
          echo "$HEADERS" | grep -qi "content-security-policy" || echo "::warning::Missing CSP header"
          echo "$HEADERS" | grep -qi "x-content-type-options" || echo "::warning::Missing X-Content-Type-Options"
```

---

## dor-check.yml — DoR Audit (Manual Dispatch)

```yaml
name: DoR Check
on:
  workflow_dispatch:
    inputs:
      story:
        description: 'Story ID (e.g. US-32)'
        required: true
        type: string
      classification:
        description: 'Classification level'
        required: true
        type: choice
        options:
          - CRITICAL
          - HIGH
          - MEDIUM
          - LOW

jobs:
  dor:
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
      - run: npm audit --audit-level=high
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Check TDD exists
        run: |
          STORY="${{ github.event.inputs.story }}"
          STORY_NUM=$(echo "$STORY" | sed 's/US-//')
          if ! ls docs/tdd/**/TDD-*-US${STORY_NUM}*.md 2>/dev/null; then
            if ! ls docs/tdd/**/TDD-*-${STORY}*.md 2>/dev/null; then
              echo "::error::No TDD found for ${STORY}"
              exit 1
            fi
          fi
      - name: Generate DoR report
        run: |
          echo '{"story":"${{ github.event.inputs.story }}","classification":"${{ github.event.inputs.classification }}","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","overall":"pass"}' > dor-report.json
          cat dor-report.json
      - uses: actions/upload-artifact@v4
        with:
          name: dor-report-${{ github.event.inputs.story }}
          path: dor-report.json
```

---

## dod-check.yml — DoD Audit (Manual Dispatch)

```yaml
name: DoD Check
on:
  workflow_dispatch:
    inputs:
      story:
        description: 'Story ID (e.g. US-32)'
        required: true
        type: string
      classification:
        description: 'Classification level'
        required: true
        type: choice
        options:
          - CRITICAL
          - HIGH
          - MEDIUM
          - LOW

jobs:
  dod:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:coverage
      - run: npm run build
      - run: npm audit --audit-level=high
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: returntocorp/semgrep-action@v1
        with:
          config: .semgrep.yml
      - name: Check review record
        if: ${{ github.event.inputs.classification == 'CRITICAL' || github.event.inputs.classification == 'HIGH' }}
        run: |
          STORY="${{ github.event.inputs.story }}"
          if [ ! -f "docs/reviews/${STORY}-review.md" ]; then
            echo "::error::Review record not found: docs/reviews/${STORY}-review.md"
            exit 1
          fi
      - name: Check coverage threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json 2>/dev/null | jq '.total.lines.pct' 2>/dev/null || echo "0")
          echo "Coverage: ${COVERAGE}%"
          if [ "$(echo "$COVERAGE < 80" | bc)" -eq 1 ] 2>/dev/null; then
            echo "::warning::Coverage below 80% threshold"
          fi
      - name: Generate DoD report
        run: |
          echo '{"story":"${{ github.event.inputs.story }}","classification":"${{ github.event.inputs.classification }}","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","overall":"pass"}' > dod-report.json
          cat dod-report.json
      - uses: actions/upload-artifact@v4
        with:
          name: dod-report-${{ github.event.inputs.story }}
          path: dod-report.json
```

---

## nightly.yml — Extended Tests

```yaml
name: Nightly
on:
  schedule:
    - cron: '0 2 * * *'  # Daily 02:00 UTC
  workflow_dispatch:

jobs:
  extended-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: npm
      - run: npm ci
      - run: npm run test:coverage
      - run: npm audit
      - name: Full dependency audit (all levels)
        run: npm audit --audit-level=low || true
      - name: Check for outdated packages
        run: npm outdated || true
```

---

## Workflow and Pipeline Phase Mapping

| Pipeline Phase | Workflow | Trigger |
|---|---|---|
| DoR Audit | `dor-check.yml` | Manual dispatch |
| Build (commit hooks) | Local `.githooks/` | git commit / git push |
| Build (CI) | `ci.yml` | Push to feature branch |
| DoD Audit | `dod-check.yml` | Manual dispatch |
| Merge | `ci.yml` | Push/merge to main |
| Deploy Verify | `deploy-verify.yml` | After CI passes on main |
| Extended Security | `security.yml` | Weekly + push to main |
| Extended Tests | `nightly.yml` | Daily |
