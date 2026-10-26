# TDD-M7-US25: Operator Knows When It's Down

**Milestone:** M7 Quality, Observability, Monitoring & Moderation
**Story:** US-25 — An uptime monitor checks `/health` every 5 minutes and alerts by email
**Features:** F-06 (health), F-29 (structured logs + metrics), F-30 (uptime monitor)
**Gaps:** G-20 (load test tool — assumed: k6), G-21 (uptime monitor — assumed: UptimeRobot)

## Acceptance Criteria

- Uptime monitor checks `/health` every 5 minutes and alerts by email
- Privacy-safe structured logs with no content and no raw IPs
- Counters for sessions, matches, rejections, reports

## Technical Design

### 1. Structured Logger (`src/observability/logger.ts`)

```ts
export function createLogger() {
  return {
    info(data: Record<string, unknown>) { console.log(JSON.stringify({ level: "info", ts: Date.now(), ...data })); },
    warn(data: Record<string, unknown>) { console.log(JSON.stringify({ level: "warn", ts: Date.now(), ...data })); },
    error(data: Record<string, unknown>) { console.error(JSON.stringify({ level: "error", ts: Date.now(), ...data })); },
  };
}
```

Rules:
- JSON format for machine parsing
- No message content, no ciphertext, no keys
- No raw IPs (only IP hash prefixes: first 8 chars)
- No user agents

### 2. Metrics (`src/observability/metrics.ts`)

In-memory counters, logged every 60 seconds:

```ts
export class Metrics {
  private counters = {
    connections: 0,
    disconnections: 0,
    sessionsCreated: 0,
    sessionsEnded: 0,
    matchesInterest: 0,
    matchesFallback: 0,
    reports: 0,
    bans: 0,
    rejectedOrigin: 0,
    rejectedValidation: 0,
    rejectedRateLimit: 0,
    rejectedBanned: 0,
  };

  increment(key: keyof typeof this.counters): void { this.counters[key]++; }
  snapshot(): typeof this.counters { return { ...this.counters }; }
  reset(): void { /* reset all to 0 */ }
}
```

60-second log cycle:
```ts
setInterval(() => {
  logger.info({ event: "metrics", ...metrics.snapshot() });
  metrics.reset();
}, 60_000);
```

### 3. Uptime Monitor

UptimeRobot free tier:
- 50 monitors
- 5-minute check interval
- Email + webhook alerts

Setup: `GET https://realtime-chat-XXXX.onrender.com/health` → expect 200.

### 4. Post-Deploy Smoke Test (CI)

Add a job to the CI workflow that runs after Render deploy:
```yaml
smoke:
  needs: build-and-test
  if: github.ref == 'refs/heads/main'
  steps:
    - run: curl -sf https://realtime-chat-XXXX.onrender.com/health
```

### 5. Load Test (k6)

200 simulated clients, 1 msg/3s, 5 minutes. Record p95 latency, memory, CPU.

```js
// k6 script outline
import ws from "k6/ws";
export default function() {
  const url = "ws://localhost:3000/socket.io/?EIO=4&transport=websocket";
  ws.connect(url, {}, (socket) => {
    socket.on("open", () => { /* emit session:start */ });
    socket.setInterval(() => { /* emit e2e:envelope */ }, 3000);
  });
}
```

Never run against production free instance.

## Test Plan (TDD)

### Unit Tests: `tests/unit/observability/metrics.test.ts`

```
describe("Metrics")
  ✅ increment increases counter by 1
  ✅ snapshot returns current values
  ✅ reset sets all counters to 0
  ✅ counters are independent
```

### Unit Tests: `tests/unit/observability/logger.test.ts`

```
describe("logger")
  ✅ info() outputs JSON with level "info"
  ✅ warn() outputs JSON with level "warn"
  ✅ output never contains "plaintext" marker string
  ✅ output never contains a raw IP pattern
```

### CI Verification

```
✅ Dependabot enabled (security updates for npm)
✅ CodeQL analysis enabled
✅ ESLint + Prettier checks in CI
✅ Link checker for docs
```

## Files to Create

| File | Action |
|---|---|
| `src/observability/logger.ts` | Create |
| `src/observability/metrics.ts` | Create |
| `tests/unit/observability/metrics.test.ts` | Create |
| `tests/unit/observability/logger.test.ts` | Create |
| `tests/load/load-test.js` | Create (k6 script) |
| `.github/workflows/ci.yml` | Extend with lint, CodeQL |
| `.github/dependabot.yml` | Create |

## Dependencies

- M2 (CI pipeline to extend)
- All safety modules (M6) for metrics integration
