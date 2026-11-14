# Known limits, gaps and future work

> The honest register. Every limit, gap and unfinished piece we know about is here, with **why** it exists, **what protects people meanwhile**, and **what is planned**. If you find a new one, add a row in the same pull request. Nothing here is hidden elsewhere: the [security overview](../04-security/security-overview.md) says what *is* protected; this says what is *not*.

**Current position (2026-11-14):** a **portfolio project**. M0 to M6 are code complete (policy drafts await counsel) and M7 is partly done (metrics, alerts, accessibility checks, browser tests in CI). It runs locally, has never been deployed, and is **not ready for public use**.

Status key: ⚠️ accepted limit (by design or by cost) · 🔜 planned (milestone) · ⏸ needs a decision · ❌ not planned.

## 1. Security and encryption
| ID | Limit | Why / impact | Today | Plan |
|---|---|---|---|---|
| L-01 | **The server delivers the encrypting code.** A compromised or dishonest operator could ship code that leaks keys (T-09) | A property of browser-based E2EE, not of this code | Strict CSP, self-hosted scripts, open source, reviewed deploys | ⚠️ Accepted. Post-v1: published file hashes, reproducible builds |
| L-02 | **No outside review of the cryptography or the code** | Crypto mistakes are silent | Standard WebCrypto only; extensive tests; documented design | 🔜 M9 penetration test; an independent crypto review is advisable before any public launch |
| L-03 | **Men-in-the-middle are only caught if people compare the safety code** outside the chat | Most people will not | The code is one click away and explained | ⚠️ Accepted |
| L-04 | **Metadata is visible to the server**: that two connections paired, when, roughly how much (padded to 64-byte blocks), and the plaintext "is typing" signal | Needed to relay; typing left plain by decision D-08 | No content, no raw IPs in logs | ⚠️ Accepted. Revisit typing (D-08) |
| L-05 | **No forward secrecy inside a chat** and no re-keying; one key pair per chat | Keeps the protocol small | Fresh keys for every chat; keys never leave memory | 🔜 Post-v1: periodic re-keying |
| L-06 | **P-256, not X25519** | X25519 is not in every browser yet | P-256 is standard and everywhere | 🔜 Post-v1: migrate when universal |
| L-07 | **The server keeps ciphertext in memory for about 100 s** so a dropped connection can catch up | Needed for reconnecting | Still encrypted; never on disk; stated in the gate text | ⚠️ Accepted |
| L-08 | **The other person can save or share anything** (screenshots) | Nothing technical can stop it | Told at the gate | ⚠️ Accepted |
| L-09 | **Browser needs WebCrypto and HTTPS (or `localhost`)** | `crypto.subtle` is hidden elsewhere | Chat is switched off with a clear message; **no plaintext fallback** | ⚠️ By design |

## 2. Safety and abuse
| ID | Limit | Why / impact | Today | Plan |
|---|---|---|---|---|
| L-10 | **Age is self-declared** (18+ tick box) | No way to verify age without an identity system | Server enforces the acknowledgement; `minor` reports are flagged | ⚠️ Accepted risk (see the PIA). Ask counsel |
| L-11 | **The content filter can be bypassed** by a determined person, and the word list is narrow, English-heavy and unreviewed (G-16) | A filter in the browser is advisory; the server cannot read content | Receiver-side hiding protects the reader even if the sender skips the check | ⏸ Owner review of the list, including Filipino terms. ⚠️ Bypass accepted |
| L-12 | **Reports carry no transcript** | The server never has messages; nobody reads chats | A category and counts only | ⚠️ By design. Evidence for the police is limited ([law-enforcement-requests.md](../09-compliance/law-enforcement-requests.md), D-11) |
| L-13 | **Blocks and no-rematch are tied to a network address** | A VPN or new network evades them; one block reaches **everyone on a shared address** (school, mobile data) | Needs three different reporting addresses; lasts 24 h; same-address pairs are kept apart per connection only | ⚠️ Accepted. Post-v1: stronger signals (privacy cost to weigh) |
| L-14 | **Reports, blocks and no-rematch are lost on restart** and expire quickly (reports after 1 h) | Memory only, on purpose | No data to leak | 🔜 D-10: a minimal expiring safety ledger |
| L-15 | **No human moderation.** `minor` and `threats` reports only write a warning log line | No moderator tool or people yet | Automatic blocks; roles are defined ([roles-and-access.md](../09-compliance/roles-and-access.md)) | 🔜 M7 moderator tooling (US-31); ⏸ D-12 name the people |
| L-16 | **Automated abuse detection is limited to spikes.** Alerts fire on report, connection and error spikes; there is no per-address abuse score or pattern analysis | Needs real traffic to tune | Rate limits, reports, alert rules | 🔜 Post-launch tuning |
| L-17 | **Bot prevention only slows bots down.** A proof-of-work puzzle (default 12 bits, a fraction of a second in a browser) is solved before every connection token | A script with real CPU and many addresses can still pay the price; a shared network gets a puzzle burst of 5, then one per 10 s | Puzzle, per-address limits, connection token | ⚠️ Accepted. Post-v1: tune difficulty with real traffic; Cloudflare Turnstile |
| L-18 | **Country detection is approximate** | VPNs, mobile carriers and a monthly database. Unknown on `localhost` | "My country only" is refused with a clear message when unknown | ⚠️ Accepted. 🔜 M7 automate the monthly refresh |
| L-19 | **Matching scans the waiting list** (fine for hundreds, not millions) | Simplicity | Bounded by the 500 connection cap | 🔜 Post-v1: country-bucketed pools |

## 3. Scale, operations and hosting
| ID | Limit | Why / impact | Today | Plan |
|---|---|---|---|---|
| L-20 | **Never deployed.** No live URL, no TLS, no custom domain, no HSTS preload | A portfolio project | Runs locally; Render blueprint exists | ⏸ Deploy only if wanted; then the M8 checklist applies |
| L-21 | **One server instance, all state in memory.** A restart or deploy ends every chat; no horizontal scaling | In-memory design (ADR-0005) | Clients are told and can start again | 🔜 Post-v1: Redis-backed state ([scaling.md](../06-operations/scaling.md)) |
| L-22 | **Free-tier cold start** (up to about a minute) if hosted on Render free | Free hosting sleeps | The page says it is waking up | ⚠️ Accepted |
| L-23 | **Alerts are log lines, not messages to a person**, and there is no uptime monitor, log platform or dashboard. Availability is not measured | The metrics snapshot and alert rules exist (every 60 s), but nothing watches them without hosting | `metrics_snapshot` and `alert` log lines; a deep `/health` | 🔜 With hosting: UptimeRobot and a log platform alert on `event = alert` |
| L-24 | **No load, soak or chaos testing**; capacity is a design target, not a measurement | Not yet done | 500 connection cap, memory ceiling | 🔜 M7 small load test; M9 full |
| L-25 | **"N online" can lag by about 5 seconds** | It is broadcast on a timer, and doubles as the reconnect keepalive | Documented | ⚠️ Accepted |
| L-26 | ~~Browser tests are not in CI~~ **Closed (M7):** a CI job runs them in headless Chromium | The Edge-based local run and the CI Chromium run can differ in small ways | Both run the same tests | ✅ |
| L-27 | **Only Edge/Chromium is tested.** No automated Firefox or Safari run | Cost | Standard WebCrypto only | 🔜 M9 cross-browser |
| L-28 | **Accessibility is checked by tools, not by people.** Axe (WCAG 2.1 A and AA) and keyboard-only tests pass on every screen and dialog; nobody has used it with a real screen reader, and axe finds only part of what matters | Cost | Semantic HTML, labelled controls, live regions, visible focus, reduced motion, reflow at 320 px | 🔜 Manual test with NVDA, VoiceOver and TalkBack |
| L-29 | **English only**; no mobile app or installable page | Scope | Works at 360 px wide | 🔜 Post-v1: i18n, PWA |
| L-30 | **Branch protection on `main` is not enabled**; CI is advisory | A solo project | PRs, green CI and review by habit | ⏸ Enable if hosted |

## 4. Legal and governance
| ID | Gap | Today | Plan |
|---|---|---|---|
| L-31 | **No lawyer has reviewed anything.** Every legal citation in `09-compliance` is unverified | Marked unverified | ⏸ D-17 |
| L-32 | **The gate text** (`2026-11-preview-5`) is **not approved by the owner** (preview-3 was) and **not reviewed by counsel** | Plain-language draft | ⏸ Owner approval; D-17 |
| L-33 | **Privacy notice, terms and community rules exist only as drafts** ([policies/](../09-compliance/policies/README.md)): not reviewed by counsel, not published, with placeholders for the operator, DPO, contact and beta scope | Drafts match the code | ⏸ D-12, D-16, D-17, D-18; publish in M8 |
| L-34 | **No legal entity, NPC registration, DPO, child-safety officer or processor agreement** | Defined on paper | ⏸ D-12, D-16, D-17, D-18 before any public launch |
| L-35 | **No ban/report retention schedule or purge job** (D-10, D-14) | Nothing is kept beyond memory | 🔜 With the ledger |

## 5. Documentation and process
- The **TDD files** for stories that are built (`docs/03-design/tdd/`) still describe the original plan in places (for example module names). The living documents and the code win; each TDD is a design record.
- The **security checklist** is a launch gate (M8): boxes are ticked only where a test or document proves them; many stay open on purpose.
- The **demo screenshots and GIF** are recorded by `npm run e2e:capture` from the real app; they need re-recording after any interface change.

## Future implementations (roadmap)
In the order they are planned. Scope and exit criteria live in [milestones.md](../01-product/milestones.md); this is the summary.

| When | What | Closes |
|---|---|---|
| **Rest of M6** | Age confirmation wording (US-17) and counsel review of the policy drafts (US-38) | L-32, L-33 |
| **M7** | Done: metrics, service levels, alert rules, accessibility checks, browser tests in CI. **Open:** moderator tooling, uptime monitor and log alerting (needs hosting), small load test, monthly country database refresh | L-15, L-18, L-23, L-24 |
| **M8** | Legal sign-off, entity, NPC registration, DPO, launch checklist, **only if the project is ever launched** | L-20, L-30 to L-35 |
| **M9** | Penetration test, ZAP baseline, WebSocket fuzzing, disaster recovery drill, load and soak, cross-browser | L-02, L-24, L-27 |
| **M10** | Incident drill, on-call, retrospective | operational maturity |
| **After v1** | Redis state and multiple instances; X25519; periodic re-keying; Turnstile; country-bucketed matching; i18n; installable app; custom domain; published file hashes | L-05, L-06, L-17, L-19, L-21, L-29 |

## How to keep this honest
- A pull request that **adds a shortcut, a workaround or a "later"** adds a row here.
- A pull request that **closes** a row updates its status and the roadmap table.
- When a limit is accepted rather than fixed, say **why**, in the row.
