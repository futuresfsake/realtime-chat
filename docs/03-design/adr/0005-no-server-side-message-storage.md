# ADR-0005: No server-side message storage

- **Status:** Accepted · **Date:** 2026-10-08 · **Supersedes:** ADR-0002

## Context
New product requirement: *"Message history should only be viewable while the user is inside the session; otherwise it is not saved."* The messages are also end-to-end encrypted, so the server can't read them anyway.

## Options
| Option | Pros | Cons |
|---|---|---|
| **Keep messages only in browser memory** | Strongest privacy; nothing to leak, subpoena or breach; simplest server | Refresh/close = history gone (that's the requirement) |
| Store ciphertext on the server | Survives refresh | The server holds data it can't use; retention, breach and legal risk |
| `sessionStorage` / `localStorage` | Survives refresh | Readable later on a shared device; contradicts "not saved" |

## Decision
Messages live **only in JavaScript memory** in the two participants' browsers, for the duration of the session. The server relays envelopes and keeps **zero** copies. `better-sqlite3` is removed from dependencies (open decision D-05).

## Consequences
- ✅ No database to secure, back up or migrate; Render's ephemeral disk no longer matters
- ✅ "Anonymous even to us" becomes enforceable by design
- ⚠️ Page refresh ends the session (keys and history are gone). Network blips are covered by Socket.IO connection state recovery (30 s)
- ⚠️ Reports can't include server-side evidence (see trust-and-safety.md)
