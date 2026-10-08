# Features

Features are **extracted from user stories**. Status: ✅ done · 🚧 in progress · 🔜 planned · ⏸ needs decision · ❌ won't do

## Already built (M0–M1 prototype)

| ID | Feature | Status | From stories | Notes |
|---|---|---|---|---|
| F-01 | Real-time message relay | ✅ prototype | US-02 | Currently broadcasts to **everyone**. Becomes strictly 1:1 in M3 (F-13) |
| F-02 | Terminal UI with 4 themes (phosphor, amber, ice, paper), saved per browser | ✅ ⏸ | US-26 | **Will be modified.** Waiting for new requirements (open decision D-07) |
| F-03 | Slash commands | 🚧 | US-27 + many | `/help /clear /whoami /theme` ✅. Full set in [slash-commands.md](slash-commands.md) |
| F-04 | Input history (↑ / ↓, last 50, memory only) | ✅ | US-27 | Kept as is |
| F-05 | Connection status indicator + auto-reconnect | ✅ | US-11 | Extended in M3 with connection state recovery |
| F-06 | Health endpoint `GET /health` | ✅ basic | US-25 | Explained in detail in [06-operations/health-checks.md](../06-operations/health-checks.md) |

### What is F-06 (health endpoint)?
A tiny URL (`/health`) that answers `{"status":"ok"}` when the server is alive. **Machines** call it, not people: Render calls it to decide whether a new deploy may go live and whether to restart a stuck server; an uptime monitor calls it to alert us when the site is down. It reveals nothing about users. See the [full explanation](../06-operations/health-checks.md).

## Planned

| ID | Feature | Milestone | From stories |
|---|---|---|---|
| F-07 | Validation of every incoming event (zod schemas) | M2 | US-21 |
| F-08 | Rate limiting (token bucket per socket) + max connections per IP | M2 | US-22 |
| F-09 | Security headers (helmet, CSP), Origin allowlist, 4 KB payload limit | M2 | US-23 |
| F-10 | CI pipeline (typecheck, test, build, audit) on every PR | M2 | — (enabler) |
| F-11 | Continuous deployment to Render, only after CI passes | M2 | US-24 |
| F-12 | System-generated random names (`adjective-animal-NN`), new for every session | M3 | US-01 |
| F-13 | 1:1 sessions: exactly two people per chat, random pairing | M3 | US-02, US-03 |
| F-14 | **Partner status**: connected · typing · left | M3 | US-06 |
| F-15 | Global "N online" counter | M3 | US-10 |
| F-16 | `/next` (skip to a new stranger) and `/leave` (end and stop) | M3 | US-04, US-05 |
| F-17 | Session-only history (kept in browser memory, wiped when the session ends) | M3 | US-09 |
| F-18 | Typing indicator | M3 | US-07 |
| F-19 | Emoji reactions to messages (fixed set of 6) | M3 | US-08 |
| F-20 | End-to-end encryption (ECDH P-256 → HKDF → AES-GCM-256) | M4 | US-12 |
| F-21 | Safety code + `/verify` | M4 | US-13 |
| F-22 | Interest matching (predefined list, max 5) | M5 | US-14 |
| F-23 | Country filter: "my country" or "worldwide" | M5 | US-15 |
| F-24 | Fallback to a random stranger after a 10 s wait | M5 | US-16 |
| F-25 | 18+ confirmation + community rules gate | M6 | US-17 |
| F-26 | `/report` a stranger | M6 | US-18 |
| F-27 | No-rematch list (skipped/reported strangers) | M6 | US-19 |
| F-28 | Temporary bans (24 h, privacy-preserving IP hash) | M6 | US-20 |
| F-29 | Privacy-safe structured logs + metrics | M7 | US-25 |
| F-30 | Uptime monitor + post-deploy smoke test | M7 | US-25 |
| F-31 | Repo automation: Dependabot, CodeQL, linting, link checks | M7 | — (enabler) |

### What happened to "online list per room" (old F-14)?
It used to mean "the list of usernames inside a group room". Rooms are now **strictly two people**, so a list makes no sense. It's replaced by:
- **F-14 Partner status:** you see whether *your* stranger is connected, typing, or has left.
- **F-15 Global online counter:** "1,204 online". It's an anonymous number with no names.

## Won't do (v1)

| ID | Feature | Why not |
|---|---|---|
| F-90 | Accounts / login / passwords / OAuth | Fully anonymous by design, **even to the operators** |
| F-91 | File / image / voice / video uploads | Biggest abuse and legal risk; bandwidth cost |
| F-92 | Group chats (> 2 people) | Strictly 1:1 |
| F-93 | User-chosen display names | Names are system-generated |
| F-94 | Server-side message history | Messages exist only in the two browsers during the session |
