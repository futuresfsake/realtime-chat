# ADR-0002: Use SQLite (better-sqlite3) for message history

- **Status:** ❌ **Superseded by [ADR-0005](0005-no-server-side-message-storage.md)** · **Date:** 2026-10-08

## Context
We need to store recent messages per room. Single server instance, small data, $0 budget.

## Options
| Option | Pros | Cons |
|---|---|---|
| **SQLite (better-sqlite3)** | No server to run, very fast, synchronous API, real SQL | Single-writer; file on local disk |
| Postgres (managed) | Durable, scalable | Another service to configure; free tiers are limited |
| In-memory array | Simplest | Lost on every restart; no querying |
| Hosted SQLite (e.g. Turso) | SQLite API + durable | External dependency, network latency |

## Decision
SQLite via better-sqlite3, behind a `messageRepository` interface.

## Consequences
- ✅ Zero setup, great for learning SQL, indexes and prepared statements
- ⚠️ **Render free tier has an ephemeral filesystem: the DB file is wiped on every restart/redeploy/spin-down.** History is best-effort in production.
- ✅ The repository interface means we can swap to a durable store later without touching handlers.

## Open follow-up (decide in M4)
Accept best-effort history, **or** move to a free durable store. Record the choice as ADR-0005.
