# Monitoring & Observability

> **Living document.** First written in the IT Manager production review (2026-10-27) and moved here on 2026-11-13. This folder now owns it: update it when the system changes. The original review record is in [10-reviews](../10-reviews/2026-10-27-it-manager/README.md).

**Date:** 2026-10-27

---

## 1. Current State (2026-11-14)

**Built and tested** (`src/observability/`, `tests/unit/observability/`, `tests/integration/metrics.test.ts`):
- Structured JSON logs with levels, correlation ids and a scrubber for forbidden fields
- A **metrics snapshot logged every 60 seconds** (`metrics_snapshot`): counters, timings and gauges, numbers only
- **Alert rules** evaluated on every snapshot, written as `alert` / `alert_cleared` log lines
- A deep `/health` (memory, connections, Socket.IO) and a coarse public answer

**Not built** (see [limits-and-roadmap.md](../00-overview/limits-and-roadmap.md)): an uptime monitor, a log platform or dashboard, e-mail delivery of alerts (the alerts are log lines; something has to watch the logs), per-address abuse scoring, and a moderator tool. Nothing here has run in production, because the service has never been deployed.

## 2. Structured Logging Standard

### 2.1 Log Format (JSON)

Every log line must be a single JSON object:

```json
{
  "ts": "2026-10-27T14:30:00.000Z",
  "level": "info",
  "event": "session:matched",
  "correlationId": "req_abc123",
  "sessionId": "sess_xyz",
  "data": {
    "sharedInterests": 2,
    "matchTimeMs": 1500,
    "scope": "world"
  }
}
```

### 2.2 Log Levels

| Level | When | Examples |
|---|---|---|
| `error` | Unrecoverable failure, needs human attention | Uncaught exception, OOM warning, health check failure |
| `warn` | Recoverable issue, potential problem | Rate limit hit, ban triggered, crypto failure, memory > 80% |
| `info` | Normal operational events | Session matched, session ended, deploy started |
| `debug` | Development only (disabled in production) | Event payload shape, state transitions |

### 2.3 Prohibited in Logs

- Raw IP addresses (use `ipHashPrefix` — first 8 chars of the hash)
- Message content (plaintext or ciphertext)
- Encryption keys (public or private)
- Full IP hashes (use prefix for correlation)
- User-generated text of any kind

### 2.4 Correlation IDs

Every WebSocket connection gets a `correlationId` (short UUID prefix). All log lines for that connection carry the same ID. When a session is created, both connections share a `sessionId` in logs.

## 3. Service Level Indicators (SLIs)

> **Status:** all except availability are **measured by the snapshot above**. Availability needs an outside checker that only makes sense once the service is hosted. The table says which snapshot field carries each indicator.

| SLI | What It Measures | Collection Method |
|---|---|---|
| **Availability** | % of time `/health` returns 200 | UptimeRobot external checks |
| **Connection success rate** | % of WS handshakes that complete | `ws_connected` against `ws_connected` + all `ws_refused.*` |
| **Match latency** | Time the longer-waiting person waited | `timings.match_wait_ms`. In a quiet service this is dominated by waiting for another person, not by the server |
| **Relay latency** | Time the server spends relaying one envelope | `timings.relay_ms` (the server's own handling time, not network time) |
| **Error rate** | % of events that return non-ok acks | `events_rejected` / `events_total`, and `rejected.<code>`. It includes expected refusals (rate limits, validation), so a spike means "look", not "broken" |
| **Session duration** | How long sessions last | `timings.session_duration_ms` |
| **Memory usage** | RSS and heap used | `gauges.rssMb`, `gauges.heapUsedMb`; also `gauges.eventLoopP99Ms` for how busy the event loop is |
| **Connection count** | Active WebSocket connections | `io.engine.clientsCount` |

## 4. Service Level Objectives (SLOs)

| SLO | Target | Consequence of Breach |
|---|---|---|
| Availability | ≥ 99.5% (monthly, excluding cold starts) | Investigate within 1 hour |
| Connection success rate | ≥ 99% | Check rate limits, Origin config |
| Match latency (p95) | ≤ 15s | Check pool size, fallback timer |
| Relay latency (p95) | ≤ 50ms | Check CPU, memory, GC pressure |
| Error rate | ≤ 1% of events | Check logs for new error patterns |
| Memory RSS | ≤ 400MB | Check for leaks, tune GC |

## 5. Metrics Collection

### 5.1 In-process counters (logged every 60s) (IMPLEMENTED)

Every value is a number and every name comes from a small fixed set (an event, an error code, a report category), never from anything a client typed. At most 200 names are accepted, as a safety net. The snapshot holds what happened **since the previous one** (`counters`), the running `totals`, timings in milliseconds (`n`, `p50`, `p95`, `max`), and `gauges` for right now:

```json
{
  "ts": "...", "level": "info", "event": "metrics_snapshot",
  "data": {
    "intervalSec": 60,
    "counters": { "ws_connected": 14, "sessions_started": 6, "matches.interest": 4, "matches.random": 2,
                  "envelopes_relayed": 212, "keys_relayed": 12, "events_total": 480, "events_rejected": 7,
                  "rejected.RATE_LIMITED": 5, "reports.harassment": 1, "blocks": 0, "pow_issued": 14,
                  "sessions_ended.left": 3, "sessions_ended.partner_left": 3 },
    "totals":   { "ws_connected": 5400 },
    "timings":  { "relay_ms": { "n": 212, "p50": 0.02, "p95": 0.05, "max": 0.4 },
                  "match_wait_ms": { "n": 6, "p50": 1800, "p95": 9400, "max": 9900 },
                  "session_duration_ms": { "n": 6, "p50": 150000, "p95": 600000, "max": 780000 } },
    "gauges":   { "connections": 45, "activeSessions": 20, "waiting": 3, "bansActive": 2, "noRematchPairs": 11,
                  "rssMb": 90, "heapUsedMb": 40, "eventLoopP99Ms": 3.1, "uptimeSec": 86400 }
  }
}
```

Counter names in use: `ws_connected`, `ws_refused.<reason>`, `events_total`, `events_rejected`, `rejected.<code>`, `sessions_started`, `sessions_ended.<reason>`, `matches.interest`, `matches.random`, `search_widened`, `keys_relayed`, `envelopes_relayed`, `reports.<category>`, `reports_priority`, `blocks`, `pow_issued`, `pow_refused.<reason>`, `rate_limited.<bucket>`.

What is deliberately **not** in a snapshot: addresses, hashes, countries, interests, session ids, text, ciphertext. A test feeds all of these through a real chat and searches the snapshot lines for them.

### 5.2 Event-Level Metrics (per occurrence)

| Event | Logged Data |
|---|---|
| Connection | `ws_connect { correlationId, ipHashPrefix, country, connectionCount }` |
| Disconnection | `ws_disconnect { correlationId, reason, sessionDuration }` |
| Session matched | `session_matched { sessionId, matchTimeMs, sharedInterests, scope }` |
| Session ended | `session_ended { sessionId, reason, duration, messageCount }` |
| Rate limited | `rate_limited { ipHashPrefix, bucket, retryAfterMs }` |
| Banned | `banned { ipHashPrefix, reportCount, duration }` |
| Report | `report { sessionId, reason, escalated }` |
| Crypto failure | `crypto_error { sessionId, type, seq }` |
| Health check | `health { status, memory, connections }` |

## 6. Alerting

### 6.1 How alerts work today (IMPLEMENTED)
On every snapshot the server checks the rules below (`src/observability/alerts.ts`). When a rule **becomes true** it writes **one** warning-level log line, `alert`, with `{ rule, severity, value, limit }`, and one `alert_cleared` line when it stops. It never repeats while the condition lasts. An alert carries only the rule name, a severity and two numbers.

To be told, something must watch the logs: a log platform's alert rule on `event = "alert"`, or an operator running `jq`. That wiring does not exist yet (it needs hosting), so **today an alert is a line in a log, not a message to a person.** The one exception is the priority report line `report_priority` (a `minor` or `threats` report), written at the moment of the report.

### 6.2 Alert rules
| Alert (`rule`) | Condition | Severity | Status | Action |
|---|---|---|---|---|
| `high_memory` | RSS above the ceiling (400 MB) in 5 snapshots in a row | warning | ✅ | Check for leaks, consider a restart |
| `connection_spike` | More than 200 new connections in one snapshot | warning | ✅ | Check for a bot attack, review limits and the puzzle difficulty |
| `report_spike` | More than 20 reports in 10 minutes, all categories | warning | ✅ | Review patterns; notify the moderator (when there is one) |
| `error_rate` | More than 5% of events rejected over 5 minutes, with at least 20 events | warning | ✅ | Look for a new error pattern |
| `crypto_failures` | More than 3 chats that could not be secured in 5 minutes | warning | ✅ | Check for a protocol or browser mismatch |
| `ban_surge` | More than 10 blocks in an hour | info | ✅ | Review abuse patterns |
| `report_priority` (an event, not a rule) | Any `minor` or `threats` report | critical | ✅ as a log line, not delivered to a person | Immediate human review (no moderator tool yet) |
| Service down | `/health` fails twice | critical | 🔜 needs an outside uptime monitor and hosting | Check the host's dashboard |

## 7. Log Aggregation Strategy

### 7.1 Short-Term (v1, $0)

- Render provides real-time log tailing and ~7 days of retention
- Structured JSON logs make `grep` / `jq` filtering effective
- Periodic export: Render API → download logs → local analysis

### 7.2 Medium-Term (post-v1)

- **Better Stack (Logtail)** — free tier: 1GB/month, 3 days retention
- **Grafana Cloud** — free tier: 50GB logs, 14 days retention
- Either receives logs via Render log drain (syslog)

### 7.3 Dashboard (post-v1)

Key panels for an operational dashboard:

1. Active connections (real-time gauge)
2. Sessions per minute (time series)
3. Match latency p50/p95 (time series)
4. Memory RSS (time series with threshold line)
5. Report volume by category (stacked bar)
6. Error rate (time series with threshold)
7. Ban count (counter)
8. Country distribution (pie chart)

## 8. Findings Summary

| ID | Severity | Finding | Milestone |
|---|---|---|---|
| MO-01 | CRITICAL | No structured logging — only console.log | M2 |
| MO-02 | CRITICAL | Health check doesn't report real system health | M2 |
| MO-03 | MAJOR | No SLIs/SLOs defined | M7 |
| MO-04 | MAJOR | No metrics collection | M7 |
| MO-05 | MAJOR | No alerting system | M7 |
| MO-06 | MAJOR | No correlation IDs for request tracing | M2 |
| MO-07 | MINOR | No log aggregation strategy implemented | Post-v1 |
| MO-08 | MINOR | No operational dashboard | Post-v1 |
