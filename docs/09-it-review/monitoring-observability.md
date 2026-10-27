# Monitoring & Observability Requirements — IT Manager Review

**Date:** 2026-10-27

---

## 1. Current State

- `console.log` for connection/disconnection events — no structure, no levels
- `/health` endpoint returns static `{"status":"ok"}`
- No metrics collection
- No log aggregation
- No alerting
- No dashboards

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

| SLI | What It Measures | Collection Method |
|---|---|---|
| **Availability** | % of time `/health` returns 200 | UptimeRobot external checks |
| **Connection success rate** | % of WS handshakes that complete | Counter: `ws_connect_total` / `ws_connect_attempt_total` |
| **Match latency** | Time from `session:start` to `session:matched` | Timer in matchmaker |
| **Relay latency** | Time from `e2e:envelope` received to forwarded | Timer in sessionManager |
| **Error rate** | % of events that return non-ok acks | Counter per error code |
| **Session duration** | How long sessions last | Timer: matched → ended |
| **Memory usage** | RSS and heap used | `process.memoryUsage()` sampled every 60s |
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

### 5.1 In-Process Counters (logged every 60s)

```json
{
  "ts": "...",
  "level": "info",
  "event": "metrics:snapshot",
  "data": {
    "connections": { "current": 45, "peak": 120, "total": 5400 },
    "sessions": { "active": 20, "total": 2700, "avgDurationMs": 180000 },
    "matchmaking": { "poolSize": 3, "matchesTotal": 2700, "avgMatchTimeMs": 2500, "fallbacks": 400 },
    "safety": { "reportsTotal": 15, "bansActive": 2, "bansTotal": 5, "escalations": 1 },
    "rateLimit": { "limited": 50, "blocked": 10 },
    "memory": { "rss": 180000000, "heapUsed": 120000000, "heapTotal": 150000000 },
    "uptime": 86400
  }
}
```

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

### 6.1 Alert Channels

| Channel | For | Tool |
|---|---|---|
| Email | All alerts | UptimeRobot (availability) + custom (metrics) |
| Webhook (future) | Critical alerts | Render notification or custom |

### 6.2 Alert Rules

| Alert | Condition | Severity | Action |
|---|---|---|---|
| Service down | `/health` fails 2 consecutive checks | CRITICAL | Check Render dashboard, review logs |
| High memory | RSS > 400MB for 5 minutes | WARNING | Check for leaks, consider restart |
| Connection spike | > 200 connections in 1 minute | WARNING | Check for bot attack, review rate limits |
| Report spike | > 20 reports in 10 minutes | WARNING | Notify moderator, review patterns |
| Error rate spike | > 5% error rate for 5 minutes | WARNING | Check logs for new error pattern |
| Ban surge | > 10 bans in 1 hour | INFO | Review abuse patterns |
| `minor` report | Any `minor` category report | CRITICAL | Immediate moderator notification |
| Crypto failures | > 3 crypto errors across sessions in 5 min | WARNING | Check for protocol mismatch |

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
