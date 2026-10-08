# Features

Status: ✅ done · 🚧 in progress · 🔜 planned · ❌ won't do (v1)

| ID | Feature | Status | Milestone | Stories |
|---|---|---|---|---|
| F-01 | Real-time messaging between all connected clients | ✅ | M1 | US-01 |
| F-02 | Terminal-style UI with 4 themes (phosphor, amber, ice, paper), saved per browser | ✅ | M1 | US-10 |
| F-03 | Slash commands: `/help`, `/clear`, `/whoami`, `/theme` | ✅ | M1 | US-11 |
| F-04 | Input history (↑ / ↓) | ✅ | M1 | US-11 |
| F-05 | Connection status indicator + auto-reconnect | ✅ | M1 | US-09 |
| F-06 | `/health` endpoint | ✅ | M1 | — |
| F-07 | Public deployment on Render | 🚧 | M1 | US-12 |
| F-08 | Schema validation of every incoming event (zod) | 🔜 | M2 | US-07 |
| F-09 | Rate limiting (messages per socket, connections per IP) | 🔜 | M2 | US-08 |
| F-10 | Security headers + Origin check + payload size limit | 🔜 | M2 | US-08 |
| F-11 | CI: typecheck, test, build on every PR | 🔜 | M2 | — |
| F-12 | Usernames (validated, unique per room) | 🔜 | M3 | US-02 |
| F-13 | Rooms (join / switch) | 🔜 | M3 | US-03 |
| F-14 | Online list per room | 🔜 | M3 | US-04 |
| F-15 | Typing indicator | 🔜 | M3 | US-05 |
| F-16 | Message history (last 50 per room, SQLite) | 🔜 | M4 | US-06 |
| F-17 | Structured logging (JSON) | 🔜 | M5 | — |
| F-18 | Uptime monitoring | 🔜 | M6 | — |
| F-19 | Accounts / login | ❌ | — | — |
| F-20 | File / image uploads | ❌ | — | — |

## Feature details (short)

**F-09 Rate limiting:** each socket gets a "token bucket": a burst of 5 messages, refilling at 1 message every 2 seconds. Over the limit, the message is rejected and the user sees `!!! slow down`. Repeat offenders are disconnected.

**F-12 Usernames:** 2–20 characters, letters/digits/`_`/`-`. They are not accounts: anyone can pick any free name. This is an accepted risk (see threat model T-03).

**F-16 History:** stored in SQLite. On Render free tier the disk is wiped on restart, so history is **best-effort** until we decide on persistent storage (see ADR-0002).
