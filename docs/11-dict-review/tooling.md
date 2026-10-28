# Security Tooling

Checked on the developer machine on 2026-10-28.

## 1. What is installed
| Tool | Purpose | Local status |
|---|---|---|
| Node 22.14 / npm 10.9 | Build, `npm audit` | Installed |
| git 2.50 | Hooks, history | Installed |
| Docker 29.2 | Container scans, local DB | Installed, **daemon not running** |
| Python 3.13 / pip | Installs semgrep | Installed |
| semgrep | Static analysis (SAST) | **Missing** (`pip install semgrep`) |
| gitleaks | Secret scanning | **Missing** (run via CI action, or download the binary) |
| trivy | Dependency and image scan | **Missing** (run via CI action or Docker) |
| gh CLI | PRs, branch protection | **Missing** (pushing works through git) |

## 2. First real result: `npm audit --package-lock-only`
3 vulnerabilities: **2 high, 1 moderate**.
| Package | Severity | Issue | Fix |
|---|---|---|---|
| `zod` < 4.6.6 | High | Memory exhaustion validating oversized collections (GHSA-mrhx-c7xc-m3w5). Zod is our input validator, so this matters | Upgrade to >= 4.6.6 |
| `qs` | Moderate | `stringify` DoS on odd array elements (GHSA-6pq8-jhm2-2vcw) | `npm audit fix` |
| (second high in the same report) | High | See `npm audit` output | `npm audit fix` |

Action: open `chore/update-dependencies`, run `npm audit fix`, re-run tests, merge before M2 deploy.

## 3. Pipeline tool plan
| Stage | Tool | Gate |
|---|---|---|
| Pre-commit (`.githooks`) | gitleaks, typecheck | Blocks the commit |
| PR CI | `npm ci`, typecheck, vitest, `npm audit --omit=dev --audit-level=high` | Blocks merge |
| PR CI | semgrep (`p/ci`, `p/nodejs`, `p/typescript`) or CodeQL | Blocks on high findings |
| PR CI | Dependency review action | Blocks risky new packages |
| Weekly | Dependabot | Opens update PRs |
| Pre-release | Header scan (securityheaders.com / Mozilla Observatory) | Grade A or better |
| M9 | Penetration test, OWASP ZAP baseline | Report filed |

## 4. Install commands
```powershell
pip install semgrep
semgrep --config p/ci --config p/nodejs src public
# gitleaks: download the Windows release, then
gitleaks detect --source . --redact
```
