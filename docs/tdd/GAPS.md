# Gaps Requiring Product Owner Confirmation

Identified during TDD creation for all milestones (M0–M8). Each gap blocks or affects one or more TDDs.

Status: ⏸ waiting · ✅ decided · 🔄 assumed (proceeding with recommendation)

## M0 Foundations

| ID | Gap | Affects | Recommendation | Status |
|---|---|---|---|---|
| G-01 | **Docker**: no Docker setup exists. Render deploys from source. Do we need Docker for local dev consistency? | TDD-M0-S02 | Skip Docker for v1. Render doesn't need it, and `npm run dev` is already simple. Add Docker in post-v1 when multi-instance scaling needs Redis. | 🔄 |
| G-02 | **better-sqlite3 still in package.json** despite ADR-0005 (no message storage). D-05 and D-09 are ⏸. | TDD-M0-S04, package.json | Remove `better-sqlite3` and `@types/better-sqlite3`. Bans/reports live in memory. | 🔄 |
| G-03 | **No `.env.example`** or env var documentation in the scaffold. Config validation (`config.ts`) is planned for M2 but a basic pattern should exist in M0. | TDD-M0-S03 | Create `.env.example` with `PORT`, `NODE_ENV` in M0. Full zod config in M2. | 🔄 |

## Open Decisions (D-01 through D-09)

| ID | Open Decision | Recommendation Used | Status |
|---|---|---|---|
| G-04 | D-01: Country detection method | (a) Server-side IP lookup with DB-IP Lite | 🔄 |
| G-05 | D-02: Interests — free text or fixed list | (a) Predefined list (~30 tags, max 5) | 🔄 |
| G-06 | D-03: Minimum age | 18+ (self-declared) | 🔄 |
| G-07 | D-04: Interest match wait timeout | 10 s, configurable via config.ts | 🔄 |
| G-08 | D-05: Keep SQLite? | Remove (no message storage, ADR-0005) | 🔄 |
| G-09 | D-06: Global "N online" counter? | Yes | 🔄 |
| G-10 | D-07: Rename F-02 (themes)? | Keep current themes as-is for v1; PO to specify changes if needed | ⏸ |
| G-11 | D-08: Encrypted typing indicator? | Plaintext start/stop signal (carries no content) | 🔄 |
| G-12 | D-09: SQLite message history → session-only? | Replace with session-only browser memory | 🔄 |

## M2 Hardening

| ID | Gap | Affects | Recommendation | Status |
|---|---|---|---|---|
| G-13 | **Render service URL unknown** — `ALLOWED_ORIGINS` can't be set until the Render service is created | TDD-M2-US24 | Create the Render service during M2 implementation; update ALLOWED_ORIGINS then | 🔄 |
| G-14 | **CSP hash for inline theme script** — the current `styles.css`/`index.html` has an inline script for theme loading. Need to compute its SHA-256 hash for CSP. | TDD-M2-US23 | Compute hash during implementation; document in CSP config | 🔄 |

## M5 Matchmaking

| ID | Gap | Affects | Recommendation | Status |
|---|---|---|---|---|
| G-15 | **DB-IP Lite licensing** — need to verify free tier terms allow bundling the MMDB file | TDD-M5-US15 | DB-IP Lite is CC-BY-4.0; requires attribution link in footer | 🔄 |

## M6 Trust & Safety

| ID | Gap | Affects | Recommendation | Status |
|---|---|---|---|---|
| G-16 | **Banned word list source** — who curates the initial content filter list? What languages? | TDD-M6-US28 | Start with an English-only curated list of slurs/explicit terms; add Filipino (Tagalog) terms. PO to review the list before merge. | ⏸ |
| G-17 | **Rules page legal wording** — the draft rules in trust-and-safety.md need legal review | TDD-M6-US17 | Use the draft as a starting point; flag for lawyer review before M8 | 🔄 |
| G-18 | **Report data retention** — privacy-and-sessions.md says 30 days for abuse reports. Is this confirmed? | TDD-M6-US18 | 30 days for report logs, in-memory data expires with daily salt rotation (24h) | 🔄 |

## M7 Quality & Monitoring

| ID | Gap | Affects | Recommendation | Status |
|---|---|---|---|---|
| G-19 | **Moderator tooling format** — is the moderator dashboard a web UI, CLI, or structured log queries? | TDD-M7-US31 | Start with structured JSON logs + a CLI script that queries them. A web dashboard is post-v1. | ⏸ |
| G-20 | **Load testing tool** — Artillery or k6? | TDD-M7-US25 | k6 (lighter, scriptable in JS, free and open-source) | 🔄 |
| G-21 | **Uptime monitor service** — which external service monitors `/health`? | TDD-M7-US25 | UptimeRobot free tier (50 monitors, 5-min interval) | 🔄 |

## M8 Launch

| ID | Gap | Affects | Recommendation | Status |
|---|---|---|---|---|
| G-22 | **Philippine lawyer review** — when should this start? | TDD-M8 | Start during M6 (when rules page and privacy notice are drafted). Budget 2–4 weeks for review. | ⏸ |
| G-23 | **Data Protection Officer** — RA 10173 requires a DPO. Who? | TDD-M8 | The operator (project owner) acts as interim DPO | 🔄 |
| G-24 | **Beta rollout plan** — "Philippines beta first" but no details on how/where to share the link | TDD-M8 | Share via personal networks + Philippine tech communities; monitor for 1 week before wider release | ⏸ |

## IT Manager Review — New Gaps (2026-10-27)

### Security & Authentication

| ID | Gap | Affects | Recommendation | Status |
|---|---|---|---|---|
| G-25 | **No WebSocket connection authentication** — Origin check alone is insufficient against automated scripts | US-32, M2 | Implement server-signed connection token (HMAC, 30s TTL, IP-bound) | 🔄 |
| G-26 | **No bot prevention** — zero friction for headless browsers or bot farms | US-39, M6 | Proof-of-work challenge (SHA-256, ~50ms for browsers); Cloudflare Turnstile as backup | 🔄 |
| G-27 | **No connection-rate limiting on WS handshake** — only established connections are rate-limited | US-32, M2 | Max 5 new connections per IP per 10 seconds at gateway level | 🔄 |
| G-28 | **No key exchange timeout** — half-keyed sessions hang indefinitely | US-37, M4 | 10-second timeout; session ends with CRYPTO_TIMEOUT | 🔄 |

### Infrastructure & Operations

| ID | Gap | Affects | Recommendation | Status |
|---|---|---|---|---|
| G-29 | **No structured logging** — only `console.log` with no levels, no correlation, no JSON | US-33, M2 | JSON structured logging with levels, correlation IDs, and PII prevention | 🔄 |
| G-30 | **Health check is shallow** — returns static 200 without checking system state | US-34, M2 | Deep health check: memory, connections, Socket.IO status | 🔄 |
| G-31 | **No memory bounds** — in-memory maps can grow unbounded on 512MB instance | M2 | `maxSize` on all TtlMap instances; `--max-old-space-size=400` | 🔄 |
| G-32 | **No SLIs/SLOs** — no measurable service level targets | US-40, M7 | Define availability, relay latency, error rate, memory targets | 🔄 |
| G-33 | **In-memory state lost on restart** — bans, reports, rate limits all reset | M7 | State persistence to temp file on graceful shutdown; reload on startup | 🔄 |

### Compliance & Legal

| ID | Gap | Affects | Recommendation | Status |
|---|---|---|---|---|
| G-34 | **No breach notification procedure** — RA 10173 requires NPC notification within 72 hours | US-44, M7/M8 | Document procedure with templates; test via tabletop exercise | ⏸ |
| G-35 | **No Privacy Impact Assessment** — required for high-risk processing under RA 10173 | US-45, M8 | Complete PIA before launch | ⏸ |
| G-36 | **No NPC registration** — required as personal information controller | US-45, M8 | Register before launch | ⏸ |
| G-37 | **No DPO designated** — RA 10173 requires Data Protection Officer | US-45, M8 | Operator acts as interim DPO; formalize | 🔄 |
| G-38 | **No RA 11930 designated officer** — Anti-OSAEC Law requires a designated responsible officer | US-45, M8 | Appoint before launch | ⏸ |
| G-39 | **Legal review not scheduled** — requires 2-4 weeks lead time | US-45, M6/M8 | Engage Philippine lawyer during M6; budget PHP 15K-50K | ⏸ |

### Testing & Quality

| ID | Gap | Affects | Recommendation | Status |
|---|---|---|---|---|
| G-40 | **Zero tests exist** — comprehensive strategy documented but no test files in repo | M2 | First test must ship with M2 | 🔄 |
| G-41 | **No penetration testing plan** — adversarial testing not scheduled | US-47, M9 | OWASP ZAP baseline + manual WebSocket fuzzing | 🔄 |
| G-42 | **No accessibility testing** — WCAG AA claimed but not verified | US-43, M7 | Lighthouse + axe-core + manual keyboard/screen reader test | 🔄 |

### Pipeline & Process

| ID | Gap | Affects | Recommendation | Status |
|---|---|---|---|---|
| G-43 | **`build` script missing from package.json** — `tsc` compilation not configured | M2 | Add `"build": "tsc"` to scripts | 🔄 |
| G-44 | **No `.node-version` file** — referenced in docs but not created | M2 | Create `.node-version` with `22` | 🔄 |
| G-45 | **No `.env.example`** — developers have no reference for required env vars | M2 | Create with PORT, NODE_ENV, ALLOWED_ORIGINS | 🔄 |
| G-46 | **No `SECURITY.md`** — no vulnerability disclosure policy | M2 | Create GitHub security policy with responsible disclosure instructions | 🔄 |
| G-47 | **No protocol versioning** — breaking changes crash stale clients | US-35, M2 | `rc/v1` in handshake auth; mismatch → refused | 🔄 |
