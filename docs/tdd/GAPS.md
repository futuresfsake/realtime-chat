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
