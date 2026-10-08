# Automation Opportunities

**Principle:** automate the repetitive and the error-prone; keep judgment calls (design, security trade-offs, product decisions) human.

## Prioritized list
| # | Automation | What it does | Cost | When |
|---|---|---|---|---|
| A-01 | **CI pipeline** | typecheck, tests, build, audit on every PR | Free | M2 |
| A-02 | **CD to Render** | deploy after CI passes | Free | M2 |
| A-03 | **Branch protection** | blocks merging red code | Free | M2 |
| A-04 | **Dependabot** | weekly PRs to update dependencies + security alerts | Free | M7 |
| A-05 | **CodeQL** | static security analysis of our code | Free (public repos) | M7 |
| A-06 | **Secret scanning + push protection** | blocks committing API keys | Free (public repos) | M2 |
| A-07 | **ESLint + Prettier** | consistent style; catches common bugs | Free | M7 |
| A-08 | **Pre-commit hooks** (husky + lint-staged) | runs lint/format on changed files before each commit | Free | M7 |
| A-09 | **Commit message lint** (commitlint) | enforces Conventional Commits | Free | M7 |
| A-10 | **Docs link checker + Markdown lint** | broken links fail CI | Free | M7 |
| A-11 | **Coverage report in PRs** | shows untested code | Free | M7 |
| A-12 | **Post-deploy smoke test** | confirms the live site works after each deploy | Free | M7 |
| A-13 | **Uptime monitor** (a free monitoring service) | emails us when `/health` fails | Free tier | M7 |
| A-14 | **Monthly geo DB refresh** | scheduled workflow downloads the new DB-IP file and opens a PR | Free | M7 |
| A-15 | **Release notes / CHANGELOG** (e.g. release-please) | generated from commit messages | Free | M8 |
| A-16 | **Dev container** (`.devcontainer/devcontainer.json`) | every Codespace has the same Node version and extensions | Free | M2 |
| A-17 | **Log/key leak guard** | CI grep fails if code logs `text`, `plain`, `key`, or `ip` | Free | M4 |
| A-18 | **Stale branch cleanup** | auto-delete merged branches (repo setting) | Free | now |

## Keep manual (on purpose)
- Merging PRs (a human looks at the diff)
- Crypto design changes (needs careful review)
- Launch decision (security checklist sign-off)
- Responding to abuse waves (judgment)

## Quick wins you can do today (2 minutes, no code)
1. Repo → **Settings → General → Pull Requests → ✅ Automatically delete head branches**
2. Repo → **Settings → Code security → enable Dependabot alerts + Secret scanning**
