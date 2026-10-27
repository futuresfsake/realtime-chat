# Infrastructure Requirements — IT Manager Review

**Date:** 2026-10-27

---

## 1. Current Infrastructure

| Component | Provider | Tier | Limitations |
|---|---|---|---|
| Hosting | Render | Free web service | 750h/mo, 512MB RAM, spins down after 15min idle, Singapore only |
| TLS | Render (managed) | Included | Auto-renewed, modern ciphers |
| DNS | Render subdomain | Included | `*.onrender.com` — no custom domain on free tier |
| CI/CD | GitHub Actions | Free (public repo) | 2000 min/mo, ubuntu-latest runners |
| Monitoring | UptimeRobot (planned) | Free | 50 monitors, 5-min interval |
| Log aggregation | Render logs | Included | ~7 days retention, no search |
| CDN | None | N/A | Static assets served from origin |
| Database | None (by design) | N/A | All state in-memory |

## 2. Availability Requirements

### 2.1 Service Level Objectives (Proposed)

| SLO | Target | Measurement |
|---|---|---|
| Uptime (excluding cold starts) | 99.5% monthly | UptimeRobot `/health` checks |
| Cold start latency | < 60 seconds | Manual + monitoring |
| WebSocket connection success rate | > 99% (from allowed origins) | Server-side counter |
| Message relay p95 latency | < 50ms server-side | Instrumented in `sessionManager.relay()` |
| End-to-end p95 latency (same region) | < 300ms | Client-side measurement |
| Time to first match (with online users) | < 15 seconds (including 10s fallback) | Server-side timer |

### 2.2 Availability Gaps

**IR-01 (MAJOR):** No SLIs/SLOs are defined. Without measurable targets, there is no way to know if the service is meeting expectations or degrading.

**IR-02 (MAJOR):** Render free tier spins down after 15 minutes of inactivity. First-visitor experience is a 30-60 second wait. No loading state or UX for this.

**Recommendation:**
- Add a client-side loading screen that shows "Waking up the server..." with a progress indicator
- UptimeRobot 5-minute pings keep the instance warm (costs instance hours)
- Document the trade-off: warm instance uses ~720h/mo of the 750h quota

## 3. Capacity Planning

### 3.1 Memory Budget

On a 512MB Render free instance:

| Component | Estimated Memory | Notes |
|---|---|---|
| Node.js baseline | ~50 MB | V8 heap + runtime |
| Express + Socket.IO | ~30 MB | Framework overhead |
| Per-connection overhead | ~5-10 KB | Socket.IO connection state |
| Session data per pair | ~2 KB | Two ClientState + Session object |
| Ban records (24h window) | ~100 bytes each | IP hash + expiry |
| Rate limit buckets | ~100 bytes each | Per-socket + per-IP |
| Matchmaking pool | ~200 bytes per waiting user | Interests + metadata |
| **Headroom for GC + spikes** | ~100 MB | V8 needs space for garbage collection |

**Estimated capacity:** ~200-500 concurrent connections comfortably. ~1000 theoretical max before memory pressure.

### 3.2 Memory Gaps

**IR-03 (CRITICAL):** No memory bounds on in-memory data structures. If the ban list or rate-limit maps grow unexpectedly (e.g., during a bot attack), the process will OOM and crash.

**Recommendation:**
- Add `maxSize` to every `TtlMap` instance
- Add a memory usage check in the health endpoint (report `process.memoryUsage()`)
- Set `--max-old-space-size=400` in the Node.js start command (leaves room for the OS)
- Add an alert if RSS exceeds 400MB

**IR-04 (MAJOR):** No graceful handling of memory pressure. When memory is tight, the server should:
1. Stop accepting new connections
2. Return 503 from `/health` (triggers Render to keep old version)
3. Log the memory state
4. Allow existing sessions to finish

## 4. Network Requirements

### 4.1 Bandwidth Budget

| Traffic Type | Size per Event | Rate | Monthly Estimate (200 concurrent) |
|---|---|---|---|
| Page load (HTML + CSS + JS) | ~80 KB | Once per session | ~50 GB (assumes 20K sessions/mo) |
| Socket.IO handshake | ~2 KB | Once per connection | ~40 MB |
| Encrypted envelope | ~200-500 bytes | ~1/3s per pair | ~2 GB |
| Typing indicator | ~50 bytes | ~1/s when typing | ~500 MB |
| Stats (online count) | ~30 bytes | Every 5s broadcast | ~100 MB |
| **Total estimate** | | | ~3 GB/mo |

Render free tier: 100 GB/mo outbound. **Comfortable margin** at current scale.

### 4.2 Network Gaps

**IR-05 (MINOR):** No CDN for static assets. Every page load fetches HTML/CSS/JS from the Singapore origin server. Users in Americas/Europe get ~300ms+ TTFB.

**Recommendation:** Post-v1, consider Cloudflare (free tier) as a CDN/proxy in front of Render. This also adds DDoS protection.

**IR-06 (MINOR):** No compression configured. Express is not serving gzipped static files.

**Recommendation:** Add `compression` middleware or pre-compress static assets (`gzip -k public/*`).

## 5. DNS & Domain

**IR-07 (MINOR):** Using `*.onrender.com` subdomain. No custom domain configured.

**Recommendation for production:**
- Register a custom domain before M8
- Configure DNS with Render's CNAME
- Enables HSTS preload, looks more trustworthy, avoids Render vendor lock-in for URLs

## 6. Backup & State Recovery

**IR-08 (MAJOR):** All operational state (bans, reports, rate limits, sessions) is in-memory and lost on every restart.

**Impact:**
- A deploy wipes all active bans (abusers get a fresh start)
- All active sessions are terminated
- The matchmaking pool is emptied
- Rate-limit buckets reset

**Recommendation:**
- Accept for v1 (single instance, short ban durations)
- For v1: on graceful shutdown, dump ban list + report counts to a temp file; on startup, reload if fresh (< 5 min old)
- For post-v1 (multi-instance): Redis is the natural solution (already in the scaling plan)

## 7. Health Check Enhancement

**IR-09 (CRITICAL):** Current `/health` returns `{"status":"ok"}` unconditionally. It should be a **deep health check:**

```json
{
  "status": "ok | degraded | unhealthy",
  "checks": {
    "socketio": "ok",
    "memory": { "rss": 180000000, "heapUsed": 120000000, "status": "ok" },
    "connections": { "current": 45, "max": 500, "status": "ok" },
    "uptime": 3600
  },
  "version": "1.0.0"
}
```

- `degraded`: memory > 80% or connections > 80% of max
- `unhealthy`: shutting down, or critical subsystem failure
- Render uses HTTP status: 200 = healthy, 503 = unhealthy

## 8. Findings Summary

| ID | Severity | Finding | Milestone |
|---|---|---|---|
| IR-01 | MAJOR | No SLIs/SLOs defined | M7 |
| IR-02 | MAJOR | No UX for cold start delay | M2 |
| IR-03 | CRITICAL | No memory bounds on in-memory data structures | M2 |
| IR-04 | MAJOR | No graceful memory pressure handling | M2 |
| IR-05 | MINOR | No CDN for static assets | Post-v1 |
| IR-06 | MINOR | No response compression | M2 |
| IR-07 | MINOR | No custom domain | M8 |
| IR-08 | MAJOR | In-memory state lost on restart | M7 |
| IR-09 | CRITICAL | Health check doesn't report actual system health | M2 |
