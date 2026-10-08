# Low-Level Design (LLD)

The **detail**: modules, contracts, state, algorithms. 🔜 = designed, not yet built. Once merged, **the code is the source of truth**; update this doc in the same PR.

## 1. Module layout (target, reviewed for the 1:1 E2EE design)

```
src/
├── index.ts                    ✅ bootstrap: load config, build server, listen, graceful shutdown
├── app.ts                      ✅ buildServer(deps): wires Express + Socket.IO (never listens → testable)
├── config.ts                   🔜 env → validated Config (zod); all limits live here
├── types/
│   └── events.ts               🔜 (replaces types.ts) event names, payloads, Ack, ErrorCode
├── http/
│   ├── health.ts               🔜 GET /health (200 / 503 while shutting down)
│   └── securityHeaders.ts      🔜 helmet + CSP (hash for the inline theme script)
├── gateway/                    ← the ONLY layer that knows about Socket.IO
│   ├── connectionGuards.ts     🔜 Origin allowlist · per-IP socket cap · ban check
│   ├── handler.ts              🔜 withHandler(schema, limiter, fn): validate → rate limit → try/catch → ack
│   └── registerHandlers.ts     🔜 maps events → services
├── validation/
│   └── schemas.ts              🔜 every zod schema (see validation-zod.md)
├── security/
│   ├── tokenBucket.ts          🔜 rate limiter (injectable clock)
│   ├── clientIp.ts             🔜 real client IP from X-Forwarded-For (Render proxy)
│   └── ipHash.ts               🔜 HMAC-SHA-256(dailySalt, ip), salt rotation
├── sessions/
│   ├── sessionManager.ts       🔜 client states, 2-person sessions, relay-to-partner
│   └── nameGenerator.ts        🔜 adjective-animal-NN from curated lists
├── matchmaking/
│   ├── matchmaker.ts           🔜 waiting pool + algorithm (see matchmaking.md)
│   ├── interests.ts            🔜 allowed interest list
│   └── compatibility.ts        🔜 country/scope rule (pure function)
├── safety/
│   ├── reports.ts              🔜 count distinct reporters per target
│   ├── banList.ts              🔜 24 h bans by IP hash
│   └── noRematch.ts            🔜 24 h pair exclusions
├── geo/
│   └── countryLookup.ts        🔜 interface + DB-IP MMDB implementation + fake for tests
├── observability/
│   ├── logger.ts               🔜 JSON logs (no content, no raw IPs)
│   └── metrics.ts              🔜 in-memory counters, logged every 60 s
└── lib/
    ├── clock.ts                🔜 Clock interface (real / fake) for timers in tests
    └── ttlMap.ts               🔜 Map with expiry (used by bans, no-rematch, reports)

public/
├── index.html · styles.css     ✅
└── js/                         🔜 split client.js into ES modules (<script type="module">, no build step)
    ├── main.js                 boot + wiring
    ├── state.js                client state machine
    ├── socket.js               Socket.IO wrapper, acks → errors
    ├── crypto.js               WebCrypto E2EE (keys, encrypt/decrypt, safety code)
    ├── commands.js             slash commands
    ├── render.js               DOM rendering (textContent only)
    └── themes.js               theme picker
```

### Review: what changed from the first design, and why
| Change | Reason |
|---|---|
| `db/` removed | No message storage (ADR-0005) |
| `presence/` → `sessions/` | Rooms are now strictly 1:1 sessions |
| Added `gateway/` | One place for transport concerns, so business logic stays pure and unit-testable |
| Added `matchmaking/`, `safety/`, `geo/` | New features M5–M6 |
| Added `lib/clock.ts` | Rate limits, timeouts and bans depend on time; tests need a fake clock |
| Client split into modules | `client.js` would exceed ~800 lines; crypto must be isolated and reviewable |

**Dependency rule:** `gateway → (sessions, matchmaking, safety, geo) → lib`. Lower layers never import `socket.io` or `express`.
**Scaling seam:** `SessionStore`, `WaitingPool` and `TtlStore` are interfaces with in-memory implementations; a Redis implementation can replace them later ([scaling.md](../06-operations/scaling.md)).

## 2. Event contracts

### Client → Server
| Event | Payload | Ack data | Allowed state |
|---|---|---|---|
| `session:start` | `{ consent:{adult:true, rulesVersion:string}, interests:string[], scope:"local"\|"world" }` | `{ status:"searching" }` | READY |
| `session:next` | `{}` | — | SEARCHING, CHATTING, ENDED |
| `session:leave` | `{}` | — | SEARCHING, CHATTING, ENDED |
| `session:report` | `{ reason: ReportReason }` | — | CHATTING |
| `e2e:key` | `{ publicKey: base64url(65 bytes) }` | — | CHATTING (once) |
| `e2e:envelope` | `{ seq:number, ct:string }` | — | CHATTING (after keys) |
| `typing` | `{ isTyping:boolean }` | — | CHATTING |

### Server → Client
| Event | Payload |
|---|---|
| `session:matched` | `{ sessionId, myName, partnerName, sharedInterests:string[], role:"initiator"\|"responder" }` |
| `session:ended` | `{ reason:"partner_left"\|"partner_timeout"\|"reported"\|"protocol_error" }` |
| `partner:status` | `{ state:"connected"\|"reconnecting"\|"typing"\|"idle" }` |
| `e2e:key` / `e2e:envelope` | relayed unchanged from the partner |
| `stats:online` | `{ count:number }` |

### Inside the encrypted envelope (only clients can read this)
```ts
type Plain =
  | { t: "msg"; text: string }                        // 1–500 chars
  | { t: "react"; ref: number; emoji: Reaction };     // ref = seq of the reacted message
```

### Acks and errors
```ts
type Ack<T = void> = { ok: true; data?: T } | { ok: false; error: { code: ErrorCode; retryAfterMs?: number } };
type ErrorCode = "VALIDATION" | "RATE_LIMITED" | "INVALID_STATE" | "NOT_IN_SESSION"
               | "CONSENT_REQUIRED" | "BANNED" | "INTERNAL";
```
Clients never receive stack traces or internal messages, only codes.

## 3. Server state (all in memory)

```ts
interface ClientState {
  socketId: string;
  state: "READY" | "SEARCHING" | "CHATTING" | "ENDED";
  ipHash: string;              // daily-salted HMAC, never the raw IP
  country: string;             // "PH", "JP" … or "XX"
  sessionId?: string;
  name?: string;               // assigned per session
}
interface Session { id: string; a: string; b: string; createdAt: number; keysSeen: Set<string>; }

clients:  Map<socketId, ClientState>     // O(1) lookup
sessions: Map<sessionId, Session>        // O(1) lookup
```
**Relay check (every envelope, O(1)):** `clients.get(sender).sessionId === payload's session` → partner = `session.a === sender ? session.b : session.a` → `io.to(partner).emit(...)`. A forged session id fails this check.

**Concurrency:** Node runs JavaScript on one thread, so `createSession` / `endSession` are synchronous functions that can't interleave. That's why two people pressing `/next` at the same moment can't corrupt state. With multiple instances this guarantee disappears; see scaling.md.

## 4. Gateway handler pipeline
```
event → zod safeParse → state check → token bucket → service call (try/catch) → ack
          │ fail → VALIDATION     │ fail → INVALID_STATE  │ fail → RATE_LIMITED   │ throw → INTERNAL + log
```
Implemented once in `withHandler()` so every event gets the same protection.

## 5. Rate limiting: token bucket
```
tokens = min(capacity, tokens + elapsedSec × refillPerSec)
if tokens ≥ 1: tokens -= 1 → ALLOW  else → REJECT (retryAfterMs = (1 − tokens) / refill × 1000)
```
| Bucket | Capacity | Refill | Scope |
|---|---|---|---|
| envelopes | 5 | 0.5/s | per socket |
| typing | 10 | 2/s | per socket |
| start/next | 10 | 10/min | per IP hash |
| reports | 3 | 3/h | per IP hash |
O(1) time and memory per key; buckets are deleted on disconnect (or by TTL for IP-hash buckets).

## 6. Client state machine (public/js/state.js)
Same states as the server (HLD §3). The UI enables commands per state; the server enforces them anyway (never trust the client).

## 7. Client crypto module API (public/js/crypto.js)
```js
generateKeyPair()                                   → { privateKey (non-extractable), publicKeyRaw }
deriveSessionKeys(privateKey, peerPublicRaw, { sessionId, role, myPublicRaw })
                                                    → { sendKey, recvKey, safetyCode }
encrypt(sendKey, seq, plainObject, aadContext)      → ct (base64url)
decrypt(recvKey, seq, ct, aadContext)               → plainObject   // throws on tamper
```
Algorithm details: [04-security/e2ee.md](../04-security/e2ee.md).

## 8. Error handling rules
- One bad event must never crash the process: every handler is wrapped.
- `unhandledRejection` / `uncaughtException` → log + exit(1). Render restarts the process (fail fast).
- Shutdown: `/health` returns 503 → stop accepting sockets → notify sessions → close within 10 s.
- Client: any decryption failure → show `!!! secure channel error` → end session. No retries with weaker settings.
