# Decision log

> Every decision that shaped the project, in one place: what was decided, why, what it cost, and where the proof is. Architecture decisions that deserved a full write-up are [ADRs](../03-design/adr/README.md); the questions that were once open are in [open-decisions.md](open-decisions.md) and now point here. **When a decision changes, add a new entry that supersedes the old one; do not rewrite history.**

Decisions made by the builder for a portfolio project, **not** by a product owner, a lawyer or a regulator. Where a decision would need one of them before any launch, it says so.

**Status:** ✅ decided and built · ⚠️ decided with a known cost · 🔁 revisit before any launch · ⏸ not decided, and not needed unless launched

## Scope and approach
| ID | Decision | Why | Cost / trade-off | Evidence |
|---|---|---|---|---|
| DL-01 | ✅ **A portfolio project: build milestones M0 to M7, do not launch (M8 to M10).** | Launching an anonymous chat with strangers needs a lawyer, a legal entity, registration, named officers and moderators that this project does not have | No live link; the README uses a recording of the real app | [ADR-0012](../03-design/adr/0012-portfolio-scope-not-launched.md) |
| DL-02 | ✅ **Document every limit and gap honestly and keep the register in the repo.** | A reviewer trusts a project that says what it does not do | More writing, and a duty to update it | [limits-and-roadmap.md](limits-and-roadmap.md) |
| DL-03 | ✅ **Claims need proof:** the security overview names the test behind every claim, and a test fails the build if the protocol document or the page size or the licences drift. | Documentation that cannot be checked rots | Some tests exist only to guard documents | [security-overview.md](../04-security/security-overview.md), `tests/unit/checks/` |
| DL-04 | ✅ **One squashed commit per pull request, one push, squash merge.** Per-file commits and per-file pushes (the pipeline document's rule) were dropped. | Keeps the history readable and the contribution graph honest | The pipeline documents still describe the old rule ([L-37](limits-and-roadmap.md)) | `git log` on `main` |
| DL-05 | ✅ **No AI attribution anywhere in the history.** Checked across all refs before any publication. | The author owns the work | None | [final audit](../10-reviews/2026-11-14-final-audit.md) |

## Product
| ID | Decision | Why | Cost / trade-off | Evidence |
|---|---|---|---|---|
| DL-06 | ✅ **Anonymous, one-to-one, text only. No accounts, no profiles, no groups, no files.** | Smallest surface for abuse and for personal data | Cannot build trust or history between people | [ADR-0006](../03-design/adr/0006-anonymous-no-accounts-no-jwt.md), vision |
| DL-07 | ✅ **Interests are a fixed list of 29, at most 5** (D-02). | Free text invites slurs, phone numbers and handles, and typos defeat matching | Less expressive | `src/matchmaking/interests.ts`, schema tests |
| DL-08 | ✅ **Wait 10 s for a shared interest, then accept anyone** (D-04); configurable. | Short enough to feel alive, long enough to find a match | Quiet services will fall back often | `INTEREST_WAIT_MS`, matchmaker tests |
| DL-09 | ✅ **Show an "N online" count, a number only** (D-06). | Harmless, and shows that people are there | Updates every 5 s, so it can lag | [L-25](limits-and-roadmap.md) |
| DL-10 | ✅ **The typing indicator is sent in plain, with no text** (D-08). | It carries only timing; encrypting it adds cost for little gain | The server can see when someone types | [L-04](limits-and-roadmap.md) |
| DL-11 | ✅ **One standard chat interface; the four terminal themes were removed** (D-07). | A conventional layout reads as a product and is easier to make accessible | A feature (themes) was dropped | `public/`, FR-43 struck out in the specs |
| DL-12 | ✅ **Country comes from the IP, locally, optionally, and fails soft** (D-01). | The client cannot simply claim a country; no prompt; no outside call | VPNs and carriers fool it | [ADR-0013](../03-design/adr/0013-country-from-local-ip-database.md) |

## Privacy and encryption
| ID | Decision | Why | Cost / trade-off | Evidence |
|---|---|---|---|---|
| DL-13 | ✅ **The server is a blind relay with no database and no stored messages** (D-05, D-09). | Nothing to leak, nothing to hand over | Everything is lost on restart, and nothing can be recovered | [ADR-0005](../03-design/adr/0005-no-server-side-message-storage.md) |
| DL-14 | ✅ **WebCrypto only; ECDH P-256, HKDF, AES-GCM-256; a key per direction; padding; a safety code.** No hand-made primitives. | Standard, reviewed building blocks in every browser | Not forward-secret within a chat; P-256 rather than X25519; the web delivery caveat | [ADR-0007](../03-design/adr/0007-e2ee-webcrypto.md), [e2ee.md](../04-security/e2ee.md), [L-01 to L-06](limits-and-roadmap.md) |
| DL-15 | ✅ **People are identified only by a keyed hash of their IP that changes daily; the raw address is read in one file, and CI fails if it is read anywhere else.** | Abuse control needs a stable handle for a day, and nothing more | A VPN or a shared network defeats or over-reaches it | `clientIp.ts`, `ci.yml`, [security-overview.md](../04-security/security-overview.md) |
| DL-16 | ✅ **Logs never hold content, ciphertext, keys, addresses, countries or interests; only counts and 8 character hash prefixes.** A scrubber drops forbidden fields and tests search the logs for secrets. | RA 10173 data minimisation, and a log is the easiest place to leak | Less to debug with | `logger.ts`, the privacy tests |
| DL-17 | ✅ **Safety state (reports, blocks, no-rematch) is memory only; no safety ledger** (D-10, D-14). Persisting it on shutdown was considered and **rejected**. | Writing pseudonymous safety data to disk contradicts the privacy design | Reports expire after 1 hour and everything is lost on a restart | [L-14](limits-and-roadmap.md), [ADR-0005](../03-design/adr/0005-no-server-side-message-storage.md) |
| DL-18 | ✅ **Age is a self-declared 18+ tick box, enforced by the server on the handshake** (D-03, US-17). No age verification. | Verifying age means collecting sensitive data, which contradicts the product | Easily bypassed | [L-10](limits-and-roadmap.md) |
| DL-19 | ✅ **The gate text is versioned and a change re-asks everyone.** Current: `2026-11-preview-5`. | Consent must match what is shown | 🔁 Needs the owner's approval and counsel's review before any launch | `RULES_VERSION`, [compliance matrix](../09-compliance/compliance-matrix.md) |

## Abuse and safety
| ID | Decision | Why | Cost / trade-off | Evidence |
|---|---|---|---|---|
| DL-20 | ✅ **A report is a category and nothing else; the reported person is not told.** | The server has no messages to attach, and nobody reads chats | Evidence for the police is thin | [L-12](limits-and-roadmap.md), `report.test.ts` |
| DL-21 | ✅ **Three different reporting addresses within an hour block a connection for 24 hours.** One address counts once; reports about yourself do not count; reports are limited to 3 an hour. | Stops one person blocking another, and stops pile-ons by tabs | A block reaches everyone on a shared address | [L-13](limits-and-roadmap.md), `reports.test.ts` |
| DL-22 | ✅ **No rematch for 24 hours: people on different addresses are blocked by address; people sharing an address are blocked per connection only.** | The first version blocked by address alone and would have blocked a whole school or mobile network: found by a test | A new tab on a shared network is not blocked | `noRematch.test.ts` |
| DL-23 | ⚠️🔁 **A single `minor` report does NOT block at once** (L-36), although the child-safety procedure says it should. Three reporters block, like any category; a priority log line and the moderator guide escalate to a person the same day. | One report would let anyone block a stranger for a day with a false report | The procedure and the software disagree, and the document now says so. **Owner and counsel decide before any launch** | [L-36](limits-and-roadmap.md), [child-protection doc](../09-compliance/child-protection-and-online-safety.md) |
| DL-24 | ✅ **The content filter runs in the browser on both ends:** on send it blocks banned content and asks twice for personal information and spam; on arrival it hides banned content behind "Show anyway". The word list is narrow (no ordinary swearing). No server-side "policy acknowledgement". | The server cannot read content; the receiving side is the one a modified sender cannot skip | Bypassable by a determined person; list needs review (G-16) | `contentFilter.test.ts`, Playwright |
| DL-25 | ✅ **A proof-of-work puzzle (12 bits) before every connection token;** challenges are single use, address bound and limited to a burst of 5 then one per 10 s. | Costs scripts real work, costs a browser a fraction of a second | Slows bots, does not stop a determined one. The limit differs from the story's "one per 10 s" so a shared network is not locked out | `proofOfWork.test.ts` |
| DL-26 | ✅ **Moderation is a command-line summary of the logs, not a web tool, so there is no admin login or API key** (G-19). | Logs already hold only categories, counts and hash prefixes; a summary of them cannot show more | Needs a person and a way to export logs | `npm run moderation`, [moderator-guide.md](../09-compliance/moderator-guide.md) |

## Engineering
| ID | Decision | Why | Cost / trade-off | Evidence |
|---|---|---|---|---|
| DL-27 | ✅ **WebSocket only, no long-polling** (ADR-0011); strict Origin check. | The Origin header is always present on a WebSocket handshake | No fallback behind proxies that block WebSockets | [ADR-0011](../03-design/adr/0011-websocket-only-transport.md) |
| DL-28 | ✅ **Plain JavaScript and CSS in the browser, no framework and no build step** (ADR-0004); a strict CSP with no inline script; fonts self-hosted. | Small (84 KB), auditable, no supply chain in the page | More manual code for state and rendering | [ADR-0004](../03-design/adr/0004-plain-js-frontend.md), `bundle.test.ts` |
| DL-29 | ✅ **Observability is a metrics snapshot in the logs every 60 s, and alert rules that write a log line.** The event loop is reported as busy percent, not a delay histogram (which read 30 ms when idle). | Needs nothing outside the process | Alerts reach nobody until something watches the logs | [monitoring-observability.md](../06-operations/monitoring-observability.md), [L-23](limits-and-roadmap.md) |
| DL-30 | ✅ **Load test is a Node script, not k6** (G-20). | It must run the real handshake and the real end-to-end encryption | Not a general tool | `scripts/load-test.ts`, [scaling.md](../06-operations/scaling.md) |
| DL-31 | ✅ **Accessibility is checked with axe (WCAG 2.1 A and AA) plus keyboard, focus, reduced-motion and reflow tests, in CI.** Manual testing with real screen readers is deferred. | Automated checks found two real bugs | Axe finds only part of what matters | `e2e/a11y.spec.ts`, [L-28](limits-and-roadmap.md) |
| DL-32 | ✅ **Browser tests run in headless Chromium in CI and in Edge locally.** | No download needed locally; CI needs a browser | Small differences are possible | `ci.yml`, `playwright.config.ts` |
| DL-33 | ✅ **No ESLint or Prettier.** Strict TypeScript, `noUncheckedIndexedAccess`, several hundred tests and semgrep stand in for them. | Adds configuration and churn for a small codebase with one author | No enforced style beyond the compiler | `tsconfig.json` |
| DL-34 | ✅ **Dependency policy:** few runtime dependencies (five), Dependabot with a 7-day cooldown, Actions pinned to commit hashes, licences checked by a test, `npm audit` in CI. | Supply-chain risk is the cheapest risk to reduce | Updates need a human to merge | `dependabot.yml`, `licenses.test.ts` |
| DL-35 | ✅ **Licence: ISC, copyright holder the GitHub handle** (`futuresfsake`). | A public repository with no licence is "all rights reserved" and unclear to a reader | Change the name in `LICENSE` if wanted | `LICENSE` |
| DL-36 | ✅ **A browser-only demo with a simulated partner, not a hosted demo** (option A of four). The demo is generated from the real page and fails the build if the real page changes. The partner answers from a script and never reads what is written. | A chat needs two people, and a live link pairing strangers was ruled out (DL-01). A bot inside the server would break "the server cannot read your chat"; a bot as a separate client still means the operator runs the other end | It shows the interface and the real cryptography, not the server, matching, limits or reports ([L-38](limits-and-roadmap.md)). Both ends are in one browser | [ADR-0014](../03-design/adr/0014-browser-only-demo.md), `demo-build.test.ts`, `demo.spec.ts`, [demo guide](../08-guides/demo.md) |
| DL-37 | ✅ **Publishing the demo is a manual workflow,** not triggered by pushes. | Enabling GitHub Pages is an owner-only setting; an automatic workflow would fail on every push until it is done | One extra manual step | `.github/workflows/demo-pages.yml` |

## Decisions that are not needed unless the project is launched
Parked, not forgotten. Each would need the owner, a lawyer or an officer.

| ID | Question | Status |
|---|---|---|
| D-11 | Position on RA 10175 Sec 13 and RA 11930 Sec 9 (six-month traffic data) | ⏸ Not needed unless launched. The system holds almost nothing to preserve (see the data inventory) |
| D-12 | Who is the DPO and the child-safety officer, and who backs them up | ⏸ Needed before any launch |
| D-13 | Hosting region | ⏸ Singapore if ever hosted |
| D-16 | Which legal entity operates the service | ⏸ Needed before any launch |
| D-17 | Engage a Philippine lawyer | ⏸ Needed before any launch; every legal citation is unverified until then |
| D-18 | How the "Philippines beta" is enforced | ⏸ Moot while not launched |
| L-36 | Block on one `minor` report? | ⏸🔁 See DL-23 |

## Owner actions that were not taken for the owner
Things that change settings on the repository or merge other people's pull requests. They were **not done** because they were not asked for; each is one command.
| Action | Why it is worth doing | How |
|---|---|---|
| Merge the three open Dependabot pull requests for GitHub Actions (`checkout` 7, `setup-node` 7, `gitleaks-action` 3). Their checks are green. | Keeps CI current | `gh pr merge 5 6 7 --squash` (one at a time) |
| Turn on branch protection for `main`: require the four CI checks and a pull request, and forbid force pushes and deletion | CI becomes a gate, not advice ([L-30](limits-and-roadmap.md)) | Repository Settings → Branches, or `gh api -X PUT repos/futuresfsake/realtime-chat/branches/main/protection` |
| Approve (or change) the gate text `2026-11-preview-5` | Closes [L-32](limits-and-roadmap.md) | Edit `docs/09-compliance/compliance-matrix.md` row A-13 |
| **Publish the demo** so the README can link to something clickable | A live link with no server and no strangers | Settings → Pages → Source: GitHub Actions, then Actions → Publish demo → Run workflow ([guide](../08-guides/demo.md)) |
