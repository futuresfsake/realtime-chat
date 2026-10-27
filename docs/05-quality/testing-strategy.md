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

## Security testing (M9 — IT Manager review)

### Penetration testing
Use OWASP ZAP (free, open-source) for automated baseline scanning, plus manual tests:

| Test | Target | Tool | Severity if Fails |
|---|---|---|---|
| WebSocket fuzzing | All event handlers | Custom scripts + ws-fuzzer | CRITICAL |
| Origin bypass | Connection gateway | curl with custom headers | CRITICAL |
| Session hijacking | Session membership | Modified client | CRITICAL |
| Rate limit bypass | Token bucket | k6 burst mode | MAJOR |
| XSS injection | Client rendering | OWASP ZAP + manual | CRITICAL |
| CSP bypass | Content-Security-Policy | CSP Evaluator | MAJOR |
| Replay attack | E2EE envelope relay | Wireshark + replay | CRITICAL |
| Key exchange MITM | E2EE protocol | Custom proxy | CRITICAL |
| Resource exhaustion | Memory/connections | Slowloris, flood | CRITICAL |

### Chaos / fault injection testing
| Scenario | Expected Behavior |
|---|---|
| Server restart mid-session | Clients see "partner disconnected" within 30s |
| Network partition (client A) | Partner sees "reconnecting..."; 30s timeout ends session |
| Memory exhaustion | Health check returns 503; old version stays |
| Rapid connect/disconnect storm | Rate limiter blocks; no memory leak |
| Malformed WebSocket frames | Connection dropped cleanly; no crash |
| Half-open TCP connections | Timeout and cleanup within 60s |

## Accessibility testing (M7 — IT Manager review)
| Test | Standard | Tool |
|---|---|---|
| Color contrast | WCAG 2.1 AA | axe-core, Lighthouse |
| Keyboard navigation | WCAG 2.1 AA | Manual |
| Screen reader | WCAG 2.1 AA | NVDA, VoiceOver |
| Focus management | WCAG 2.1 AA | Manual |
| Reduced motion | WCAG 2.1 AA | `prefers-reduced-motion` |
| Zoom to 200% | WCAG 2.1 AA | Browser zoom |

## Cross-browser compatibility (M7/M9 — IT Manager review)
Test all browsers against: connect, E2EE key exchange, messaging, `/verify`, `/next`, `/leave`, themes, 360px layout.

| Browser | Priority |
|---|---|
| Chrome (latest 2) | P0 |
| Edge (latest 2) | P0 |
| Firefox (latest 2) | P0 |
| Safari (latest 2) | P0 |
| Chrome Android | P0 |
| Safari iOS (14.5+) | P0 |
| Samsung Internet | P1 |

## Mobile-specific testing (M3+ — IT Manager review)
| Test | Condition | Pass Criteria |
|---|---|---|
| Touch input | Normal | Messages send, commands work |
| Virtual keyboard | Keyboard open | Chat input visible, not obscured |
| Orientation change | Rotate during chat | Layout adjusts, no content loss |
| WiFi → mobile data | Network transition | Session survives (< 30s gap) |
| Background/foreground | Switch apps and back | Session reconnects within 30s |
| Low bandwidth | 3G simulation | Messages deliver |
| 360px viewport | Smallest supported | All UI elements visible and usable |

## Performance testing (M7/M9 — IT Manager review)
| Test | Configuration | Duration |
|---|---|---|
| Steady-state | 200 pairs, 1 msg/3s | 10 min |
| Ramp-up | 0 → 200 pairs in 2 min | 5 min |
| Spike | 50 → 500 connections in 10s | 1 min |
| Soak (memory leak detection) | 50 pairs cycling every 5 min | 8 hours |
| Endurance | 100 pairs | 2 hours |

Metrics: p50/p95/p99 relay latency, RSS, CPU%, connection count, error rate, GC pause time.

## Rollback testing (M9 — IT Manager review)
| Test | Pass Criteria |
|---|---|
| Render rollback | Service restored in < 5 minutes |
| Git revert | Clean revert, CI green, auto-deploy |
| Config rollback | Process exits on bad config; old version stays |
| Service rebuild | Operational in < 20 minutes from scratch |

## Release smoke test (manual, ~5 min, after each deploy)
1. Open the live URL on a laptop → confirm 18+ → `/start`
2. Phone on **mobile data** → `/start` → both connected, `🔒` shown
3. Exchange messages + a reaction; `/verify` codes match
4. Dev tools → Network → WS frames contain only ciphertext
5. `/next` on the phone → laptop sees "stranger left"
6. `/health` → returns system metrics (memory, connections, status)
7. **IT-REVIEW:** Connection without token → refused
8. **IT-REVIEW:** Outdated protocol version → "please refresh" message
9. **IT-REVIEW:** Check structured logs → no raw IPs present
