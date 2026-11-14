# Final audit (2026-11-14)

> **A self-audit by the author.** It is a careful, evidence-based check of the repository, and it is **not independent**: nobody outside the project has reviewed it, and it says so wherever that matters. Like the other files in this folder it is a **dated record and is not edited afterwards**. Findings that lead to change are fixed in the living documents; open ones are in the [limits register](../00-overview/limits-and-roadmap.md) and the [decision log](../00-overview/decision-log.md).

| | |
|---|---|
| **Subject** | The repository at `main` (`d78e605`, 375 commits on `main`) plus the changes in the pull request that adds this file, and the production build run from `dist/` |
| **Goal** | Is the repository in a consistent, verified state to be shown as a portfolio project, and are its claims true? |
| **Not in scope** | Hosting, legal review, the wording of the policy drafts, penetration testing, review by a cryptographer, testing with real screen readers |
| **Conclusion** | **Yes, as a portfolio project. No, as a public service.** Nothing found blocks the first; the second needs the things listed in the limits register. 12 findings: 5 fixed, 3 documented, 3 left for the owner, 1 accepted limit |

## 1. What was checked, and the result
| Area | Check | Result | Evidence |
|---|---|---|---|
| **History** | Attribution, trailers and identities across all refs | **Pass.** 0 mentions of an AI tool or co-author in any of 382 commits (all refs) | `git log --all` scan |
| **History** | Secrets in the whole history | **Pass** | gitleaks, full history |
| **Files** | Sensitive or oversized tracked files | **Pass.** No `.env`, key or certificate; the largest tracked file is the 332 KB demo GIF; the 8 MB country database is not tracked | `git ls-files` |
| **Dependencies** | Known vulnerabilities | **Pass.** 0 in all dependencies and 0 in production dependencies | `npm audit`, `npm audit --omit=dev` |
| **Dependencies** | Licences | **Pass.** 94 production packages: 88 MIT, 4 ISC, 2 BSD-3-Clause. No copyleft | `licenses.test.ts` |
| **Dependencies** | Freshness | **Fixed.** 3 packages were behind (express, vitest, @types/node); updated. 3 Dependabot pull requests for GitHub Actions are open and green (see F-05) | `npm outdated` |
| **Code** | Strict type check, production build | **Pass** | `npm run typecheck`, `npm run build` |
| **Code** | Raw IP address read outside the one allowed file; console logging in the server | **Pass.** 0 offenders | CI greps, re-run |
| **Code** | `innerHTML` and similar in the page | **Pass.** One match, in a comment saying not to use it | `grep` |
| **Tests** | Unit and integration | **Pass.** 726 tests in 46 files, repeated runs clean after F-01 was fixed | `npm test` |
| **Tests** | Browser, two real browsers through a real server | **Pass.** 40 tests (26 flows, 14 accessibility) | `npm run test:e2e` |
| **Tests** | Accessibility | **Pass.** axe finds 0 WCAG 2.1 A or AA violations on every screen and dialog; keyboard-only, focus, reduced motion and reflow tests pass. Not tested with real screen readers | `e2e/a11y.spec.ts` |
| **Tests** | Load | **Pass.** 200 and 400 simulated people: all connected, paired and encrypted; 0 decryption failures; message p95 2 ms; server peak 117 MB. One fast machine over `localhost`, 75 seconds | `npm run load:test`, [scaling.md](../06-operations/scaling.md) |
| **Running build** | The production artifact, probed from outside | **Pass.** HSTS (2 years), a CSP with no inline script and no external origin, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, no `X-Powered-By`, `/health` coarse in public and detailed only with the key, 403 for a token without the puzzle answer, 404 for unknown paths, and the server **refuses to start** with an `http://` origin in production | `curl` against `node dist/index.js` |
| **Page** | Size and external requests | **Pass.** 84 KB on the wire against a 100 KB budget; no request leaves our origin | `bundle.test.ts` |
| **Protocol** | The AsyncAPI document matches the code | **Pass** (every event, error code, category, interest and limit) | `asyncapi.test.ts` |
| **Docs** | Relative links and heading links in 142 Markdown files | **Pass after a fix.** The checker found links to this file before it existed; it was proven able to fail with a deliberate bad link | `docs-links.test.ts` |
| **Docs** | Claims against reality | **Pass with exceptions.** See F-08 and F-09 | this section |

## 2. Findings
| ID | Severity | Finding | Status |
|---|---|---|---|
| F-01 | Medium | **Intermittent failures in the metrics integration tests** (2 failures in 5 full runs). Each test waited for one counter, then asserted another that happened later and might not be in a snapshot yet; one read a snapshot that was older than the connection. A flaky test erodes trust in every green run | ✅ **Fixed.** Each test now waits for everything it asserts. Verified: 8 of 8 isolated runs and 4 of 4 full runs clean |
| F-02 | Low | The README described the project as it was at M1 to M3 ("what it will be", an old structure listing, a dependency table without the current packages) | ✅ **Fixed.** Rewritten from the current state |
| F-03 | Low | No `LICENSE` file, and `package.json` had a wrong `main`, no description and no author | ✅ **Fixed.** ISC licence, metadata corrected, `private: true` so it cannot be published by accident |
| F-04 | Low | Three npm packages were behind | ✅ **Fixed.** `express` 5.3.0, `vitest` 5.1.0, `@types/node` 26.6.6; tests re-run |
| F-05 | Low | **Three Dependabot pull requests for GitHub Actions are open** (`checkout` 7, `setup-node` 7, `gitleaks-action` 3), green, with pinned commit hashes | ⏸ **Left for the owner.** Merging other pull requests was not asked for ([decision log](../00-overview/decision-log.md)) |
| F-06 | Low | **Branch protection on `main` is off** (limits L-30), so CI is advice, not a gate | ⏸ **Left for the owner.** One setting; the command is in the decision log |
| F-07 | Info | **The git history shows the author's personal email address**, under four author identities (name variants). Anyone who reads the commits can see it | ⏸ **Left for the owner.** Changing published history was out of scope. Going forward, GitHub's "keep my email private" setting uses a `noreply` address |
| F-08 | Medium | **A document and the software disagree.** The child-safety procedure says a `minor` report blocks the reported connection at once; the software needs three reporters, like any category | 📝 **Documented, not changed.** A one-report block lets anyone block a stranger with a false report. The procedure, the moderator guide, the limits register (L-36) and the decision log (DL-23) all say so. Owner and counsel decide before any launch |
| F-09 | Low | **The story pipeline documents describe a process that was never built** (audit tools, `.githooks`, evidence reports, per-file commits) | 📝 **Documented.** A note at the top of the folder and limits L-37 say what the repository really does |
| F-10 | Info | **Defects the tests caught while building,** all fixed with a test: a no-rematch rule that would have blocked a whole shared network; an empty chat log hidden from screen readers (so the first message might not be announced); chat lines that were orphan list items; an event-loop gauge that read 30 ms when idle; and a puzzle limit that would have locked out a shared network | ✅ Fixed during the build; listed so the process is visible |
| F-11 | Low | **Numbers in the docs (test counts, page size, load results) are typed by hand** and will go stale | 📝 Accepted. Tests guard the page size, licences, links and protocol; the counts are dated |
| F-12 | Info | **Nothing here was checked by anyone else:** no outside code review, no cryptographer, no penetration test, no real screen reader, no lawyer. The encryption is standard WebCrypto, but how it is assembled is the author's design | ⚠️ **Accepted limit** (L-02, L-28, L-31) |

## 3. What this audit does not show
- That the software is **secure against a determined attacker.** It shows the author's own tests and CI pass and the controls described exist.
- That the load results hold on **real hosting.** They were measured on one fast machine over `localhost`.
- That the **policy drafts or the gate text are legally sound.** Nobody qualified has read them.
- That an **assistive-technology user** can use the app comfortably. Tools say it meets the rules; people have not tried it.

## 4. How to repeat this audit
```
git log --all --format=%B%an%ae | grep -ciE "claude|anthropic|co-authored"   # 0
gitleaks detect                              # no leaks (whole history)
npm audit && npm audit --omit=dev            # 0 vulnerabilities
npm run typecheck && npm run build
npm test                                     # 726 unit and integration tests
npm run test:e2e                             # 40 browser tests (Edge; E2E_BROWSER=chromium for Chromium)
npm run load:test -- --users 200 --seconds 75
```
Then build, run `NODE_ENV=production ALLOWED_ORIGINS=https://… node dist/index.js` and check the headers with `curl -I`.
