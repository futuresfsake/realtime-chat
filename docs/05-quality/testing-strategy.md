# Testing Strategy

## Goals
1. Catch bugs **before** they reach the live URL.
2. **Prove our privacy and security promises** (E2EE, no storage, limits) with tests, not just words.
3. Keep the suite fast (< 15 s) so it runs on every save and every PR.

## Test pyramid
```
              ▲ few, slow
             ╱ ╲    Manual: release smoke test (phone + laptop), security checks before launch
            ╱───╲
           ╱     ╲   Load: ~200 simulated clients (M7)
          ╱───────╲
         ╱         ╲  Integration: real server on port 0 + several socket.io-client clients
        ╱───────────╲
       ╱             ╲ Unit: schemas · token bucket · session manager · matchmaker · compatibility · crypto · bans
      ╱───────────────╲ many, fast
```

## What we test, per module
| Module | Key cases | Tools |
|---|---|---|
| `validation/schemas` | valid ✅; extra field ❌; 6 interests ❌; duplicate ❌; bad base64url ❌; `adult:false` ❌ | Vitest |
| `security/tokenBucket` | burst of 5 then reject; refill after 2 s; cap; `retryAfterMs` | Vitest + fake clock |
| `security/ipHash` | same IP + same day → same hash; after rotation → different | Vitest + fake clock |
| `sessions/sessionManager` | exactly two per session; forged sessionId rejected; `/next` ends for both; 30 s timeout | Vitest + fake clock |
| `sessions/nameGenerator` | format `adj-animal-NN`; only allowed words | Vitest |
| `matchmaking/*` | see [matchmaking.md §6](../03-design/matchmaking.md#6-tests-unit-with-a-fake-clock) | Vitest + fake clock |
| `public/js/crypto.js` | see [e2ee.md §9](../04-security/e2ee.md#9-test-plan) | Vitest (Node 20+ has WebCrypto) |
| `safety/*` | 3 distinct reporters → ban; same reporter ×3 → no ban; expiry after 24 h | Vitest + fake clock |
| `/health` | 200 normally; 503 during shutdown; `no-store` header | Vitest + fetch |

## Integration tests (`tests/integration/*.test.ts`)
Pattern: `buildServer(testConfig)` → `httpServer.listen(0)` (the OS picks a free port) → connect `socket.io-client` clients → assert → close everything in `afterAll`.
1. **Pairing:** A, B, C start → A+B paired, C searching; A's envelope reaches B only.
2. **Isolation:** C sends an envelope with A+B's sessionId → `NOT_IN_SESSION`.
3. **Blind relay:** a spy on the server's relay function sees only `{seq, ct}`; the plaintext marker string never appears.
4. **Origin:** a client with `Origin: https://evil.example` → refused.
5. **Rate limit:** 6 rapid envelopes → the 6th gets `RATE_LIMITED`.

## Load test (M7)
Use a free open-source tool (Artillery or k6) against a local or staging run: 200 clients paired, 1 message / 3 s each, for 5 min. Record p95 relay latency, memory and CPU in [scaling.md](../06-operations/scaling.md). **Never load-test the free production instance** (it burns quota and could get the account flagged).

## Conventions
- `tests/unit/...` mirrors `src/...`; files end in `*.test.ts`
- Arrange → Act → Assert; one behavior per test; names describe behavior (`"rejects a second key from the same side"`)
- No real time, network or randomness in unit tests: inject `Clock`, fakes and seeded values
- A bug fix starts with a failing test that reproduces it

## Coverage goals
≥ 80% lines on `security/`, `sessions/`, `matchmaking/`, `safety/`, `crypto.js`. We don't chase 100% on glue code.

## CI
`npm ci → lint → typecheck → test (with coverage) → build → npm audit` on every PR. Red CI blocks merging and deploying. See [07-process/ci-cd.md](../07-process/ci-cd.md).

## Release smoke test (manual, ~5 min, after each deploy)
1. Open the live URL on a laptop → confirm 18+ → `/start`
2. Phone on **mobile data** → `/start` → both connected, `🔒` shown
3. Exchange messages + a reaction; `/verify` codes match
4. Dev tools → Network → WS frames contain only ciphertext
5. `/next` on the phone → laptop sees "stranger left"
6. `/health` → ok
