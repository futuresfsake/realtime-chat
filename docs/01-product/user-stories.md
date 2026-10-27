# User Stories

Format: *As a **role**, I want **goal**, so that **benefit**.* Acceptance criteria (AC) use **Given / When / Then**.
Status: ✅ done · 🔜 planned

## Definition of Done: for every story
A story is **Done** only when **all** of these are true:
1. ✅ Every acceptance criterion passes, verified by a test or a written manual check
2. ✅ Automated tests added: unit tests for logic, integration test if it crosses client ↔ server
3. ✅ New input from clients has a zod schema; new abuse risk has a threat-model row
4. ✅ `npm run typecheck`, `npm test` and `npm run build` pass, and CI is green
5. ✅ No message plaintext ever reaches the server or the logs (from M4 onward)
6. ✅ Works on desktop **and** a 360 px-wide phone screen; keyboard usable
7. ✅ Docs updated: feature status, specs, LLD if structure changed
8. ✅ Merged to `main` through a PR, deployed, and smoke-tested on the live URL

*(Milestone and release DoD: see [milestones.md](milestones.md).)*

---

## Epic A: Chat sessions (M3)

### US-01 Get a random name 🔜
As a **chatter**, I want the system to give me a random name, so that I stay anonymous and nobody can impersonate a real person.
- Given I start a session, then I'm assigned a name like `quiet-otter-42` (adjective-animal-two digits) from curated word lists.
- Given I start a **new** session (`/next`), then I get a **new** name.
- There is **no way** to type or change my own name.
- **Features:** F-12

### US-02 Start a chat with a stranger 🔜
As a **chatter**, I want to be connected to one stranger, so that I can have a private conversation.
- Given I'm READY, when I type `/start`, then I see `searching...` and, once matched, `connected to <name>`.
- Given I'm matched, then only my partner receives my messages.
- **Features:** F-01, F-13

### US-03 Exactly two people per chat 🔜
As a **chatter**, I want my chat to be strictly between me and one stranger, so that nobody else can join or read it.
- A session always has exactly 2 sockets. A third client can never join, even by sending a fake session id.
- When one side leaves, the session is closed for good. It can't be re-joined.
- **Features:** F-13

### US-04 Skip to the next stranger 🔜
As a **chatter**, I want to end this chat and meet someone new instantly, so that I'm never stuck in a bad conversation.
- Given I'm CHATTING, when I type `/next`, then my partner sees `*** stranger left`, my screen clears, and I start SEARCHING.
- `/next` is limited to 10 per minute.
- **Features:** F-16

### US-05 Leave without searching again 🔜
As a **chatter**, I want to stop chatting completely, so that I can take a break.
- When I type `/leave`, the session ends and I return to READY. No new search starts.
- **Features:** F-16

### US-06 See my partner's status 🔜
As a **chatter**, I want to see whether my stranger is still there, so that I don't talk to an empty room.
- The sidebar shows `● connected`, `✎ typing…` or `○ left` within 1 s of a change.
- If my partner's connection drops briefly, I see `reconnecting…`; after 30 s without recovery, the session ends.
- **Features:** F-14

### US-07 See when the stranger is typing 🔜
- When my partner types, I see `<name> is typing…`; it disappears 3 s after they stop, or as soon as their message arrives.
- **Features:** F-18

### US-08 React to a message 🔜
As a **chatter**, I want to react with an emoji, so that I can respond quickly without typing.
- `/react 😂` adds the reaction to the stranger's latest message; both sides see it.
- Only `👍 ❤️ 😂 😮 😢 🙏` are accepted.
- **Features:** F-19

### US-09 History only while I'm in the session 🔜
As a **chatter**, I want messages to exist only during the chat, so that nothing can be read later by anyone.
- Messages are held **only in browser memory** (not localStorage, not cookies, not the server).
- When the session ends (`/next`, `/leave`, partner left, tab closed or refreshed), the history is wiped and **can't be recovered**.
- The server never stores messages (verified by code review + a test that the server has no storage for messages).
- **Features:** F-17

### US-10 See how many people are online 🔜
- The top bar shows `N online`, updated at most every 5 s. No names, no locations.
- **Features:** F-15

### US-11 Survive short network drops 🔜 (basic ✅)
As a **chatter** on a mobile network, I want brief disconnects not to end my chat.
- Given my connection drops for < 30 s, when it comes back, then my session continues and missed messages are delivered.
- Given it drops for > 30 s, then the session ends for both sides.
- **Features:** F-05

## Epic B: Privacy (M4)

### US-12 Messages are end-to-end encrypted 🔜
As a **chatter**, I want only my stranger to be able to read my messages, so that not even the operators can see them.
- Every message and reaction is encrypted in my browser before sending.
- The server only receives and forwards ciphertext. Server logs contain no message content.
- The UI shows `🔒 end-to-end encrypted` once keys are exchanged. **No message can be sent before that.**
- If key exchange fails or the browser lacks WebCrypto, the chat ends with a clear error. It **never falls back to unencrypted**.
- **Features:** F-20

### US-13 Verify nobody is in the middle 🔜
As a **privacy-conscious chatter**, I want to compare a safety code with my stranger, so that I can confirm nobody swapped our keys.
- `/verify` shows a code like `48213 99307 17742 03621`, identical on both sides when keys weren't tampered with.
- The help text explains the code is only meaningful if compared over a **different** channel.
- **Features:** F-21

## Epic C: Matching (M5)

### US-14 Choose my interests 🔜
- I can pick up to 5 interests from a predefined list (e.g. `music, gaming, coding, anime, travel…`).
- Given I and a waiting stranger share ≥ 1 interest, then we are matched and see `shared: <interest>`.
- **Features:** F-22

### US-15 My country or worldwide 🔜
- `/country local` → I'm only matched with people the server detects in the same country as me.
- `/country world` → I can be matched with anyone whose own setting allows me.
- A local-only user is never matched with someone outside their country.
- **Features:** F-23

### US-16 Fall back to a random stranger 🔜
- Given no interest match within 10 s, then I'm matched with any compatible stranger and see `no shared interests found - connected to a random stranger`.
- **Features:** F-24

## Epic D: Safety (M6)

### US-17 Confirm age and rules before chatting 🔜
- Before the first search I must confirm **I am 18 or older** and accept the rules (no harassment, no sharing personal info, no sexual content involving minors, etc.).
- The confirmation is remembered only for the browser session (`sessionStorage`).
- **Features:** F-25

### US-18 Report a stranger 🔜
- `/report harassment` ends the chat, prevents rematching, and sends the report (reason code only).
- **No transcript is sent.** The server never had the messages, and with no human moderators nobody would read them. Bans are based on *how many different people* report someone (US-20).
- **Features:** F-26

### US-19 Never meet the same person again 🔜
- Strangers I skipped or reported aren't matched with me again for 24 h (best effort, using the same daily-salted IP hash as bans, so no extra identifier is created).
- **Features:** F-27

### US-20 Abusers are temporarily blocked 🔜
As the **operator**, I want repeat abusers blocked automatically, so that others stay safe without us reading chats.
- If **3 different** users report the same client within 1 hour, that client is blocked from matching for 24 h.
- The block uses a salted hash of the IP that rotates daily. Raw IPs are never stored.
- **Features:** F-28

### US-28 Content is filtered for harmful patterns 🔜
As a **chatter**, I want obvious harmful content (slurs, spam, solicitation) to be caught before it reaches my screen, so that the platform feels safer.
- Client-side filters check messages before encryption for banned words, spam patterns, and known harmful content.
- Users are warned when messages appear to contain personal information (phone numbers, email addresses, social handles).
- URLs are displayed as plain text and never rendered as clickable links.
- **Features:** F-32

### US-29 Reports cover all types of violations 🔜
As a **chatter**, I want to report specific types of abuse, so that the platform can respond appropriately to different violations.
- Report categories: `harassment`, `sexual`, `spam`, `hate`, `minor`, `threats`, `other`.
- Reports tagged `minor` or `threats` are flagged for immediate human moderator review.
- Report categories align with Safe Spaces Act (RA 11313) and Anti-OSAEC Law (RA 11930) requirements.
- **Features:** F-33

### US-30 Abuse patterns are detected automatically 🔜
As the **operator**, I want automated monitoring to detect abuse patterns without reading messages, so that I can respond to threats at scale.
- The system tracks report velocity, session churn patterns, and connection anomalies per IP hash.
- Safety metrics are logged every 60 seconds for trend analysis.
- Pattern detection flags potential coordinated harassment or repeat offenders for human review.
- **Features:** F-34

### US-31 Human moderators can review abuse trends 🔜
As the **operator**, I want human moderators to review aggregated report data, so that we can adjust safety controls and handle escalations that automated systems can't resolve.
- Moderators see aggregated report patterns, abuse scores, and escalated cases.
- Moderators never see message content, raw IP addresses, or full IP hashes.
- Escalation workflow ensures `minor` and `threats` reports get priority human review.
- Moderators are trained on Philippine law requirements (RA 11313, RA 11930, RA 10173).
- **Features:** F-35

## Epic E: Platform (M2, M7)

### US-21 Bad input is rejected safely (M2) 🔜
- Payloads of the wrong type, with unknown fields, or too large → rejected with `{ ok:false, error:{ code:"VALIDATION" } }`; the server keeps running.
- **Features:** F-07

### US-22 Spam is limited (M2) 🔜
- More than 5 messages in a burst → `slow down`. More than 5 sockets from one IP → refused.
- **Features:** F-08

### US-23 Only our website can connect (M2) 🔜
- A socket opened from another website's origin is refused. Security headers grade A on securityheaders.com.
- **Features:** F-09

### US-24 Use it from anywhere (M2) 🔜
- The app is reachable over HTTPS at a public URL; a phone on mobile data can chat with a laptop.
- **Features:** F-11

### US-25 Operator knows when it's down (M7) 🔜
- An uptime monitor checks `/health` every 5 minutes and alerts by email.
- **Features:** F-06, F-29, F-30

## Epic G: IT Manager — Security Hardening (M2, M6)

### US-32 Connection authentication token (M2) 🔜
As the **operator**, I want every WebSocket connection to present a short-lived, server-signed token, so that automated scripts and bots cannot connect without passing through our HTTPS endpoint first.
- Given a client requests `GET /connect-token`, the server returns a signed nonce with a 30-second TTL bound to the client's IP hash.
- Given a WebSocket handshake includes a valid, unexpired token, the connection is accepted.
- Given a WebSocket handshake has no token, an expired token, or a token bound to a different IP hash, the connection is refused with `AUTH_REQUIRED`.
- Tokens are HMAC-SHA-256 signed with a server secret that rotates daily.
- **Features:** F-36

### US-33 Structured logging (M2) 🔜
As the **operator**, I want all server logs to be structured JSON with log levels, correlation IDs, and zero PII, so that I can debug production issues without violating user privacy.
- Every log line is a single JSON object with `ts`, `level`, `event`, `correlationId`, and `data`.
- Log levels: `error`, `warn`, `info`, `debug`. Production runs at `info` level.
- No raw IP addresses appear in any log statement (verified by CI grep/semgrep rule).
- No message content (plaintext or ciphertext) appears in any log.
- Each WebSocket connection gets a unique correlation ID carried through all related log lines.
- **Features:** F-37

### US-34 Deep health check (M2) 🔜
As the **operator**, I want `/health` to report actual system health (memory, connections, Socket.IO status), so that I can detect degradation before users are affected.
- `/health` returns `{"status": "ok|degraded|unhealthy", "checks": {...}, "version": "..."}`.
- `degraded` when memory > 80% of ceiling or connections > 80% of max.
- `unhealthy` when shutting down or critical subsystem failure.
- HTTP 200 for ok/degraded, 503 for unhealthy.
- **Features:** F-38

### US-35 Protocol versioning (M2) 🔜
As the **operator**, I want the WebSocket protocol to carry a version identifier, so that breaking changes don't silently crash old clients.
- Clients send `protocolVersion: "rc/v1"` in the Socket.IO `auth` option during handshake.
- The server validates the version and rejects mismatches with `PROTOCOL_MISMATCH`.
- When a client has an outdated version, the server emits `system:refresh` with a reason and a 5-minute deadline before force-disconnecting.
- **Features:** F-39

### US-36 WebSocket edge case resilience (M3) 🔜
As a **chatter**, I want the system to handle edge cases gracefully (double `/next`, disconnect during key exchange, concurrent state transitions), so that no chat session gets stuck or corrupted.
- Given both partners press `/next` simultaneously, no orphaned session is created.
- Given a client disconnects during key exchange, the other client receives a timeout within 10 seconds.
- Given a client reconnects to an expired session (> 30s), they receive a clean error, not a stale session.
- Given maximum-length (500 char) and boundary-violating (501 char) messages, the correct one is accepted and the other rejected.
- **Features:** part of F-13

### US-37 Key exchange timeout (M4) 🔜
As a **chatter**, I want the key exchange to have a timeout, so that I don't wait indefinitely if my partner's browser can't complete the handshake.
- If both public keys are not exchanged within 10 seconds of session match, the session ends with `CRYPTO_TIMEOUT`.
- Both clients see a clear error message explaining the failure.
- **Features:** part of F-20

## Epic H: IT Manager — Compliance & Legal (M6, M8)

### US-38 Privacy notice and terms of service (M6) 🔜
As the **operator**, I want draft legal documents (privacy notice, terms of service, acceptable use policy), so that they can be reviewed by a Philippine lawyer before launch.
- Privacy notice covers: what data is processed, lawful basis, data subject rights, retention periods, DPO contact.
- Privacy notice references RA 10173 obligations explicitly.
- Terms of service covers: acceptable use, prohibited conduct, reporting, bans, disclaimers.
- Acceptable use policy aligns prohibited conduct with RA 11313 (Safe Spaces Act) categories.
- All documents are in plain language, accessible to non-legal readers.
- **Features:** F-40

### US-39 Bot prevention with proof-of-work (M6) 🔜
As the **operator**, I want clients to solve a computational challenge before their first session, so that bot operators face meaningful friction.
- Before issuing a connection token or allowing `session:start`, the server sends a proof-of-work challenge.
- The challenge is: find a nonce where `SHA-256(prefix + nonce)` has N leading zero bits.
- Difficulty is configurable (default: ~50ms on a modern browser, expensive for bot farms).
- Legitimate browsers solve it transparently; headless bot scripts must burn CPU per connection.
- Challenge is rate-limited: one challenge per IP per 10 seconds.
- **Features:** F-41

## Epic I: IT Manager — Monitoring & Quality (M7)

### US-40 Service level indicators and objectives (M7) 🔜
As the **operator**, I want defined SLIs and SLOs, so that I can measure whether the service is meeting expectations.
- SLIs: availability (health check), connection success rate, match latency, relay latency, error rate, memory usage.
- SLOs: 99.5% uptime, <50ms p95 relay, <15s match (with pool), <1% error rate, <400MB RSS.
- SLO dashboard or log-based tracking implemented.
- **Features:** F-42

### US-41 Metrics collection (M7) 🔜
As the **operator**, I want in-process metrics collected and logged every 60 seconds, so that I can track system health trends.
- Metrics snapshot includes: connections (current, peak, total), sessions (active, total, avg duration), matchmaking (pool size, matches, fallbacks), safety (reports, bans, escalations), rate limits (limited, blocked), memory (rss, heap).
- Metrics are logged as structured JSON at `info` level.
- No PII in metrics (IP hashes are counts, not individual values).
- **Features:** F-43

### US-42 Alerting system (M7) 🔜
As the **operator**, I want alerts for critical conditions, so that I can respond before users are severely affected.
- UptimeRobot monitors `/health` every 5 minutes with email alerts.
- `minor` report category triggers immediate email to operator.
- Memory > 400MB sustained for 5 minutes triggers warning.
- Error rate > 5% for 5 minutes triggers warning.
- Report spike (> 20 reports in 10 minutes) triggers moderator notification.
- **Features:** F-44

### US-43 Accessibility compliance (M7) 🔜
As a **chatter** using assistive technology, I want the chat interface to be fully keyboard-navigable and screen-reader compatible, so that I can use the service without a mouse.
- All interactive elements are reachable and operable by keyboard alone.
- Chat messages are announced to screen readers via `aria-live` region.
- Focus management is logical: new messages don't steal focus from the input.
- Color contrast meets WCAG 2.1 AA (≥ 4.5:1 for normal text, ≥ 3:1 for large text).
- UI respects `prefers-reduced-motion` (no animations when set).
- Lighthouse accessibility score ≥ 90.
- **Features:** F-45

### US-44 Incident response and escalation procedures (M7) 🔜
As the **operator**, I want documented incident response, breach notification, and child safety escalation procedures, so that I can respond correctly under time pressure.
- Incident response plan covers: severity classification, response flow, containment, investigation, resolution, post-incident review.
- Breach notification procedure covers RA 10173 NPC 72-hour requirement with templates.
- Child safety escalation covers RA 11930 reporting to PNP-ACG/NBI-CCD.
- Law enforcement cooperation procedure covers RA 10175 data preservation requests.
- All procedures tested via tabletop exercise before M8.
- **Features:** F-46

## Epic J: IT Manager — Launch & Production (M8, M9, M10)

### US-45 Legal compliance sign-off (M8) 🔜
As the **operator**, I want all legal requirements verified and signed off, so that the platform launches in compliance with Philippine law.
- Philippine lawyer has reviewed and approved: privacy notice, terms of service, rules page.
- NPC registration completed (or filed, if processing time extends past launch).
- Data Protection Officer formally designated.
- RA 11930 designated officer appointed.
- Privacy Impact Assessment completed.
- Data processing agreement with Render reviewed.
- **Features:** F-47

### US-46 Launch readiness verification (M8) 🔜
As the **operator**, I want a final launch readiness checklist verified, so that nothing is missed before sharing the link.
- Security checklist 100% passed.
- All IT Manager review CRITICAL findings resolved.
- All IT Manager review MAJOR findings resolved or accepted with documented rationale.
- Production configuration verified (env vars, ALLOWED_ORIGINS, Node flags).
- Release smoke test passed on live URL (phone + laptop).
- Rollback tested once successfully.
- README and docs up to date.
- `v1.0.0` git tag created.
- **Features:** F-48

### US-47 Penetration testing (M9) 🔜
As the **operator**, I want the system tested by adversarial methods, so that hidden vulnerabilities are found before attackers find them.
- OWASP ZAP baseline scan clean (no high/medium alerts).
- WebSocket fuzzing: no crashes from malformed frames or payloads.
- Origin bypass testing: verified the Origin check cannot be circumvented.
- Session hijacking testing: verified forged session IDs are always rejected.
- XSS injection testing: verified all user input is safely rendered.
- CSP bypass testing: verified CSP blocks injected scripts.
- Rate limit bypass testing: verified burst and sustained abuse is contained.
- Results documented in a penetration test report.
- **Features:** pen test report artifact

### US-48 Disaster recovery drill (M9) 🔜
As the **operator**, I want to verify I can recover from disasters, so that I'm not learning the process during an actual incident.
- Rollback drill: deploy intentionally broken version → rollback → service restored in < 5 minutes.
- Service rebuild drill: delete Render service → recreate from scratch → operational in < 20 minutes.
- State recovery verification: restart with state file → verify bans persist across restart.
- Emergency hotfix drill: simulate SEV-1 → hotfix deployed via documented exception process.
- All drill results documented.

### US-49 Performance baseline (M9) 🔜
As the **operator**, I want measured performance baselines, so that I can detect regressions and plan capacity.
- Load test: 200 concurrent pairs sustained for 10 minutes, p95 relay < 50ms.
- Soak test: 50 pairs cycling for 8 hours, RSS growth < 10%.
- Cross-browser E2EE test: key exchange + messaging verified on Chrome, Edge, Firefox, Safari.
- Results documented with specific numbers, not "it seems fine."

### US-50 Operational maturity (M10) 🔜
As the **operator**, I want operational processes established after launch, so that the platform can sustain itself.
- Incident response drill completed (simulated SEV-2 scenario).
- On-call rotation documented (even if single-person).
- First week production metrics reviewed and documented.
- Post-launch retrospective completed.
- Bug triage process established.
- Moderator review cycle confirmed (at minimum weekly).
- Cost monitoring active (Render hours and bandwidth).
- v1.1 roadmap drafted based on launch learnings.

## Epic F: Already delivered (M1)

### US-26 Personalize the look ✅
- `/theme amber` or clicking a theme switches instantly and is remembered. *(F-02 will be revised, see D-07)*

### US-27 Power-user keyboard control ✅
- Slash commands and ↑/↓ input history.
