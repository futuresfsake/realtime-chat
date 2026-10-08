# Testing Strategy

## Goals
1. Catch bugs **before** they reach the public URL.
2. Make refactoring safe.
3. Keep the suite **fast** (< 10 s) so it runs on every save and every PR.

## Test pyramid

```
            ▲  few, slow
           ╱ ╲   Manual / exploratory: two tabs + phone, security checks before release
          ╱───╲
         ╱     ╲  Integration: real server on a random port + 2 socket.io clients
        ╱───────╲
       ╱         ╲ Unit: schemas, rate limiter, presence store, repository (in-memory DB)
      ╱───────────╲  many, fast
```

## What we test, and how

| Layer | Target | Tool | Example cases |
|---|---|---|---|
| Unit | `validation/schemas.ts` | Vitest | valid name ✅; 1-char name ❌; `<script>` name ❌; extra field ❌; 501-char text ❌ |
| Unit | `security/rateLimiter.ts` | Vitest + injected clock | 5 allowed then 6th rejected; refills after 2 s; never above capacity |
| Unit | `presence/presenceStore.ts` | Vitest | join/leave; name taken case-insensitive; leave unknown socket is safe |
| Unit | `db/messageRepository.ts` | Vitest + SQLite `:memory:` | insert + recent returns oldest→newest; limit 50; per-room isolation |
| Unit | typing timeout | Vitest fake timers | expires after 3 s; reset on new keystroke |
| Integration | full server | Vitest + `socket.io-client` | A and B join `#general`; A sends; B receives the exact payload; C in `#random` does not |
| Integration | `/health` | `fetch` | 200 + `{status:"ok"}` |
| Manual | UI + themes | Browser checklist | see "Release smoke test" below |

**Integration test pattern:** `buildServer()` + `httpServer.listen(0)` (port 0 means the OS picks a free port), connect clients to that port, close everything in `afterAll`. That's why `app.ts` doesn't call `listen()` itself.

## Conventions
- Tests live in `tests/`, named `*.test.ts`, mirroring `src/` paths.
- **Arrange → Act → Assert** structure; one behavior per test; descriptive names (`"rejects usernames with spaces"`).
- No real network, timers or disk in unit tests: inject them.
- A bug fix starts with a failing test that reproduces it.

## Coverage
- Target ≥ 80% lines for `validation/`, `security/`, `presence/`, `db/` (the risky logic).
- We don't chase 100% overall; untested glue code is fine if behavior is covered by the integration test.

## CI (GitHub Actions)
On every push and PR: `npm ci` → `npm run typecheck` → `npm test` → `npm run build` (later: `npm audit`, coverage).
**A red CI blocks merging.**

## Release smoke test (manual, ~3 min, after every deploy)
1. Open the public URL → status turns ONLINE
2. Second device on mobile data → messages flow both ways
3. `/theme paper` → reload → still paper
4. `<b>hi</b>` shows as literal text
5. `/health` returns ok
