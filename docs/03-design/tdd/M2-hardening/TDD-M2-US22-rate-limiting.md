# TDD-M2-US22: Spam Limited (Rate Limiting)

**Milestone:** M2 Hardening + CI/CD + First Deploy
**Story:** US-22 — As a chatter, spam is limited
**Features:** F-08 (token bucket per socket, per-IP cap)
**Gaps:** None

## Acceptance Criteria

- More than 5 messages in a burst → `slow down` (ack with `RATE_LIMITED`)
- More than 5 sockets from one IP → connection refused
- Rate limited responses include `retryAfterMs`

## Technical Design

### 1. Token Bucket Algorithm (`src/security/tokenBucket.ts`)

From LLD §5:
```
tokens = min(capacity, tokens + elapsedSec × refillPerSec)
if tokens ≥ 1: tokens -= 1 → ALLOW
else → REJECT (retryAfterMs = (1 − tokens) / refill × 1000)
```

```ts
import type { Clock } from "../lib/clock.js";

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillPerSec: number,
    private clock: Clock,
  ) {
    this.tokens = capacity;
    this.lastRefill = clock.now();
  }

  consume(): boolean {
    this.refill();
    if (this.tokens >= 1) { this.tokens -= 1; return true; }
    return false;
  }

  retryAfterMs(): number {
    return Math.ceil((1 - this.tokens) / this.refillPerSec * 1000);
  }

  private refill(): void {
    const now = this.clock.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
    this.lastRefill = now;
  }
}
```

### 2. Rate Limit Configuration (from LLD)

| Bucket | Capacity | Refill | Scope |
|---|---|---|---|
| envelopes (messages) | 5 | 0.5/s | per socket |
| typing | 10 | 2/s | per socket |
| start/next | 10 | 10/min (0.167/s) | per IP hash |
| reports | 3 | 3/h (0.00083/s) | per IP hash |

### 3. Per-IP Socket Cap (`src/gateway/connectionGuards.ts`)

```ts
const socketsPerIp = new Map<string, Set<string>>();

export function checkIpCap(ipHash: string, socketId: string, max: number): boolean {
  const sockets = socketsPerIp.get(ipHash) ?? new Set();
  if (sockets.size >= max) return false;
  sockets.add(socketId);
  socketsPerIp.set(ipHash, sockets);
  return true;
}

export function removeSocket(ipHash: string, socketId: string): void {
  const sockets = socketsPerIp.get(ipHash);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) socketsPerIp.delete(ipHash);
  }
}
```

### 4. Client IP Extraction (`src/security/clientIp.ts`)

Behind Render's proxy, the real IP is in `X-Forwarded-For`:
```ts
export function clientIp(socket: Socket, trustProxyHops: number): string {
  const xff = socket.handshake.headers["x-forwarded-for"];
  if (trustProxyHops > 0 && typeof xff === "string") {
    const parts = xff.split(",").map(s => s.trim());
    // Trust the Nth-from-right hop
    return parts[Math.max(0, parts.length - trustProxyHops)] ?? socket.handshake.address;
  }
  return socket.handshake.address;
}
```

### 5. IP Hashing (`src/security/ipHash.ts`)

```ts
import { createHmac, randomBytes } from "node:crypto";

let salt = randomBytes(32);
let saltCreatedAt = Date.now();
const ROTATION_MS = 24 * 60 * 60 * 1000;

export function hashIp(ip: string, clock: Clock): string {
  if (clock.now() - saltCreatedAt > ROTATION_MS) {
    salt = randomBytes(32);
    saltCreatedAt = clock.now();
  }
  return createHmac("sha256", salt).update(ip).digest("hex");
}
```

### 6. Injectable Clock (`src/lib/clock.ts`)

```ts
export interface Clock {
  now(): number;
}

export const realClock: Clock = { now: () => Date.now() };

export class FakeClock implements Clock {
  constructor(private time: number = 0) {}
  now() { return this.time; }
  advance(ms: number) { this.time += ms; }
  set(ms: number) { this.time = ms; }
}
```

## Test Plan (TDD — write tests FIRST)

### Unit Tests: `tests/unit/security/tokenBucket.test.ts`

```
describe("TokenBucket")
  ✅ allows burst of 5 messages (capacity=5)
  ❌ rejects the 6th message in a burst
  ✅ after 2s (refill 0.5/s) → 1 more token available
  ✅ tokens never exceed capacity
  ✅ retryAfterMs() returns correct wait time
  ✅ retryAfterMs() returns 0 when tokens available
  ✅ works with fake clock (no real time)
```

### Unit Tests: `tests/unit/security/ipHash.test.ts`

```
describe("hashIp")
  ✅ same IP + same day → same hash
  ✅ different IPs → different hashes
  ✅ after salt rotation (advance 24h) → different hash for same IP
  ✅ hash is a 64-char hex string
  ✅ uses fake clock for rotation testing
```

### Unit Tests: `tests/unit/security/clientIp.test.ts`

```
describe("clientIp")
  ✅ no proxy (trustProxyHops=0) → returns socket.handshake.address
  ✅ with proxy (trustProxyHops=1) → returns rightmost XFF entry
  ✅ multiple proxies → respects hop count
  ✅ no XFF header → falls back to socket address
```

### Unit Tests: `tests/unit/gateway/connectionGuards.test.ts`

```
describe("checkIpCap")
  ✅ allows 5 sockets from same IP
  ❌ rejects 6th socket from same IP
  ✅ after removeSocket → allows a new one
  ✅ different IPs tracked independently
```

## Files to Create

| File | Action |
|---|---|
| `src/security/tokenBucket.ts` | Create |
| `src/security/clientIp.ts` | Create |
| `src/security/ipHash.ts` | Create |
| `src/gateway/connectionGuards.ts` | Create |
| `src/lib/clock.ts` | Create |
| `tests/unit/security/tokenBucket.test.ts` | Create |
| `tests/unit/security/ipHash.test.ts` | Create |
| `tests/unit/security/clientIp.test.ts` | Create |
| `tests/unit/gateway/connectionGuards.test.ts` | Create |

## Dependencies

- `node:crypto` (built-in) for HMAC-SHA-256
- No new packages

## Threat Mitigations

- T-02 (message flooding): token buckets
- T-03 (socket flooding): per-IP cap
- T-15 (IP in logs): hashed, never raw
- T-18 (bot farming): start/next rate limit per IP hash
