# Performance Requirements — IT Manager Review

**Date:** 2026-10-27

---

## 1. Performance Budget

### 1.1 Page Load

| Metric | Target | Measurement |
|---|---|---|
| First Contentful Paint (FCP) | < 1.5s (excluding cold start) | Lighthouse |
| Time to Interactive (TTI) | < 2.0s (excluding cold start) | Lighthouse |
| Total page weight | < 100 KB (excluding Socket.IO client) | Build check |
| Socket.IO client | ~50 KB (minified + gzipped) | Vendor bundle |
| WebSocket connection time | < 500ms (same region) | Client-side timer |
| HTML | < 10 KB | File size check |
| CSS | < 15 KB | File size check |
| JS (client code, excluding Socket.IO) | < 30 KB | File size check |

### 1.2 Runtime Performance

| Metric | Target | Context |
|---|---|---|
| Server relay latency (p95) | < 50ms | Time from envelope received to forwarded |
| Server relay latency (p99) | < 100ms | Under load (200 concurrent) |
| Key exchange completion | < 2s | Both sides generate keys and derive session keys |
| Encrypt/decrypt per message | < 5ms | WebCrypto is hardware-accelerated on most devices |
| Match latency (with pool) | < 500ms | When a compatible user is already waiting |
| Match latency (fallback) | ~10s | Configurable timeout |
| Typing indicator propagation | < 200ms | Real-time feel |
| Online count broadcast | Every 5s | Not per-event |

### 1.3 Memory Budget (Server)

| Component | Budget | Measurement |
|---|---|---|
| Node.js baseline | 50 MB | `process.memoryUsage().rss` at idle |
| Per connection | ≤ 10 KB | (rss at N connections - baseline) / N |
| Total RSS ceiling | 400 MB | Leave 112 MB for OS + GC on 512 MB instance |
| Heap used ceiling | 300 MB | Trigger warning at 80% (240 MB) |
| GC pause (p95) | < 50ms | `--trace-gc` during load test |

### 1.4 Network Budget

| Direction | Per Message | Per Second (at capacity) | Monthly (200 concurrent) |
|---|---|---|---|
| Client → Server (envelope) | ~300 bytes | ~33 (100 pairs * 1/3s) | ~2 GB |
| Server → Client (envelope) | ~300 bytes | ~33 | ~2 GB |
| Typing indicator | ~50 bytes | ~100 (variable) | ~500 MB |
| Stats broadcast | ~30 bytes | 0.2 (every 5s) | ~20 MB |
| **Total outbound** | | | **~3-5 GB/mo** |

Render free tier: 100 GB/mo. **Comfortable headroom.**

## 2. Client-Side Performance

### 2.1 JavaScript Execution

| Concern | Mitigation |
|---|---|
| Long tasks blocking input | Crypto operations use async WebCrypto (non-blocking) |
| DOM manipulation cost | `textContent` only (no reflow from innerHTML parsing) |
| Memory leaks | Clear session history on end; no global event listener accumulation |
| Theme switching | CSS custom properties (instant, no repaint of content) |

### 2.2 Mobile Performance

| Device Class | Target | Constraints |
|---|---|---|
| Mid-range Android (2 GB RAM) | Smooth chat at 60fps scroll | Minimize DOM nodes, no heavy animations |
| Low-end Android (1 GB RAM) | Functional, may lag on fast scroll | Limit visible message count to 200 |
| iPhone SE (2nd gen, 3 GB RAM) | Smooth | Safari WebCrypto is reliable since iOS 14.5 |

### 2.3 Recommended Client Performance Checks

```js
// Add to client.js for development only
if (location.hostname === 'localhost') {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 50) {
        console.warn(`Long task: ${entry.duration}ms`, entry);
      }
    }
  });
  observer.observe({ type: 'longtask', buffered: true });
}
```

## 3. Server-Side Performance

### 3.1 Hot Paths

| Path | Frequency | Target | Optimization |
|---|---|---|---|
| `e2e:envelope` relay | Every message | O(1) lookup + O(1) emit | Map-based session lookup |
| `typing` relay | ~1/s per active chat | O(1) | Same relay path |
| Session membership check | Every event | O(1) | Single Map lookup |
| Rate limit check | Every event | O(1) | Token bucket, no external calls |
| Matchmaking | On `/start` | O(n) worst case, O(1) best | Indexed by interest |

### 3.2 Performance Anti-Patterns to Avoid

| Anti-Pattern | Why It Hurts | Alternative |
|---|---|---|
| `JSON.stringify` in hot path | CPU-intensive for large objects | Pre-serialize where possible |
| `Array.filter` on all sessions | O(n) on every event | Use Map for O(1) lookups |
| Synchronous crypto on server | Blocks event loop | Server doesn't do crypto (only clients) |
| Logging every event in production | I/O cost per message | Log metrics aggregates (every 60s), not individual events |
| Global `io.emit` for stats | O(n) per broadcast | Acceptable for 200 users; batch for scale |

### 3.3 Node.js Tuning

```bash
# Production start command
node --max-old-space-size=400 --expose-gc dist/index.js
```

| Flag | Purpose |
|---|---|
| `--max-old-space-size=400` | Cap V8 heap to leave room for OS on 512 MB instance |
| `--expose-gc` | Allow manual GC trigger in health check (diagnostic only) |

## 4. Performance Testing Plan

### 4.1 Baseline (M7)

| Test | Configuration | Duration | Metrics |
|---|---|---|---|
| Idle baseline | 0 connections | 5 min | RSS, CPU, GC |
| Light load | 20 pairs | 10 min | Relay p95, RSS, CPU |
| Target load | 100 pairs, 1 msg/3s | 10 min | Relay p50/p95/p99, RSS, CPU, GC pauses |
| Full capacity | 200 pairs, 1 msg/3s | 10 min | All metrics + error rate |
| Spike | 50 → 500 connections in 10s | 1 min | Connection success rate, error rate |

### 4.2 Endurance (M9)

| Test | Configuration | Duration | Looking For |
|---|---|---|---|
| Soak test | 50 pairs, cycling every 5 min | 8 hours | Memory leaks, handle leaks |
| Marathon | 100 pairs | 2 hours | Memory growth rate, GC efficiency |

### 4.3 Regression (CI)

Add a lightweight performance check to CI (M7):
```yaml
- name: Performance smoke test
  run: |
    npm start &
    sleep 5
    # Check page weight
    curl -s http://localhost:3000 | wc -c  # Should be < 10240
    # Check response time
    curl -o /dev/null -s -w "%{time_total}" http://localhost:3000/health  # Should be < 0.1s
    kill %1
```

## 5. Findings Summary

| ID | Severity | Finding | Milestone |
|---|---|---|---|
| PR-01 | MAJOR | No performance budget defined | M7 |
| PR-02 | MAJOR | No memory ceiling configured (--max-old-space-size) | M2 |
| PR-03 | MAJOR | No client-side performance monitoring | M7 |
| PR-04 | MINOR | No response compression (gzip) | M2 |
| PR-05 | MINOR | No Lighthouse CI check | M7 |
| PR-06 | MINOR | No bundle size check in CI | M7 |
