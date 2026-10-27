# Testing Requirements — IT Manager Review

**Date:** 2026-10-27

---

## 1. Current Testing Coverage

| Test Type | Status | Coverage |
|---|---|---|
| Unit tests | Planned (M2+) | 0% (no tests exist yet) |
| Integration tests | Planned (M3+) | 0% |
| Load tests | Planned (M7) | 0% |
| E2E browser tests | Not planned | 0% |
| Security/pen testing | Not planned | 0% |
| Accessibility testing | Not planned | 0% |
| Chaos/fault injection | Not planned | 0% |
| Mobile testing | Mentioned but not formalized | 0% |

**Assessment:** The testing *strategy* document is excellent. The test *pyramid* is well-designed. But zero tests exist in the codebase. This is the most significant gap between documentation and reality.

## 2. Additional Test Categories Required

### 2.1 Security Testing (M9)

#### Penetration Testing Plan

| Test | Target | Tool | Severity if Fails |
|---|---|---|---|
| WebSocket fuzzing | All event handlers | `ws-fuzzer`, custom scripts | CRITICAL |
| Origin bypass attempts | Connection gateway | curl, custom headers | CRITICAL |
| Session hijacking | Session membership check | Modified client | CRITICAL |
| Rate limit bypass | Token bucket implementation | Artillery/k6 burst | MAJOR |
| XSS injection via message | Client rendering | OWASP ZAP, manual | CRITICAL |
| CSP bypass attempts | Content Security Policy | CSP Evaluator, manual | MAJOR |
| Replay attack (pre-E2EE) | Envelope relay | Wireshark + replay script | CRITICAL |
| Key exchange MITM simulation | E2EE protocol | Custom proxy | CRITICAL |
| IP hash collision testing | Ban system | Known collision inputs | MAJOR |
| Ban evasion simulation | Trust & safety | VPN rotation script | MAJOR |
| Resource exhaustion | Memory/connections | Slowloris, flood tools | CRITICAL |
| Payload size boundary | zod schemas, maxHttpBufferSize | Oversized payloads | MAJOR |

#### OWASP Top 10 Mapping

| OWASP Category | Applicable? | Mitigation | Test |
|---|---|---|---|
| A01: Broken Access Control | Yes | Session membership, state machine | Integration test: forged session ID rejected |
| A02: Cryptographic Failures | Yes | E2EE with standard primitives | Unit tests: key exchange, encrypt/decrypt |
| A03: Injection | Yes (XSS) | textContent, CSP, zod | Manual: inject `<script>` in message |
| A04: Insecure Design | Partially | Threat model, ADRs | Architecture review (this document) |
| A05: Security Misconfiguration | Yes | helmet, CSP, env validation | Automated: securityheaders.com scan |
| A06: Vulnerable Components | Yes | npm audit, Dependabot | CI: `npm audit --audit-level=high` |
| A07: Auth Failures | Yes (connection auth) | Connection token, consent | Integration test: unauthorized connection |
| A08: Data Integrity Failures | Yes | E2EE AAD, seq numbers | Unit test: tampered envelope rejected |
| A09: Logging Failures | Yes | Structured logging, no PII | Code review: grep for raw IP in logs |
| A10: SSRF | No | No outbound requests from server | N/A |

### 2.2 Accessibility Testing (M7)

| Test | Standard | Tool | Pass Criteria |
|---|---|---|---|
| Color contrast | WCAG 2.1 AA | axe-core, Lighthouse | All text ≥ 4.5:1 contrast ratio |
| Keyboard navigation | WCAG 2.1 AA | Manual | All functions accessible via keyboard |
| Screen reader compatibility | WCAG 2.1 AA | NVDA, VoiceOver | Chat messages announced via `aria-live` |
| Focus management | WCAG 2.1 AA | Manual | Focus moves logically; visible focus ring |
| Reduced motion | WCAG 2.1 AA | `prefers-reduced-motion` | Animations respect user preference |
| Zoom to 200% | WCAG 2.1 AA | Browser zoom | No content clipping, no horizontal scroll |
| Touch targets | WCAG 2.1 AAA (optional) | Manual | Buttons ≥ 44x44 CSS pixels |
| Error identification | WCAG 2.1 AA | Manual | Errors announced, not color-only |

**Automated accessibility CI:**
```yaml
- name: Accessibility audit
  run: npx lighthouse-ci http://localhost:3000 --accessibility=0.9
```

### 2.3 Cross-Browser Compatibility (M7)

| Browser | Version | WebCrypto ECDH | Socket.IO | Priority |
|---|---|---|---|---|
| Chrome | Latest 2 | Yes | Yes | P0 |
| Edge | Latest 2 | Yes | Yes | P0 |
| Firefox | Latest 2 | Yes | Yes | P0 |
| Safari | Latest 2 | Yes (P-256 since 11) | Yes | P0 |
| Chrome Android | Latest | Yes | Yes | P0 |
| Safari iOS | Latest 2 | Yes (since 14.5) | Yes | P0 |
| Samsung Internet | Latest | Yes | Yes | P1 |
| Opera | Latest | Yes | Yes | P2 |

**Test matrix:** Each browser must pass:
1. Connect and exchange messages
2. E2EE key exchange completes (lock icon shown)
3. `/verify` safety codes match
4. `/next` and `/leave` work correctly
5. Theme switching works and persists
6. Responsive layout at 360px width

### 2.4 Chaos / Fault Injection Testing (M9)

| Scenario | What Breaks | Expected Behavior | Test Method |
|---|---|---|---|
| Server restart mid-session | All sessions | Both clients see "partner disconnected" within 30s | Kill process during active chat |
| Network partition (client A) | One connection | Partner sees "reconnecting..."; 30s timeout ends session | `tc` or network throttle |
| Memory exhaustion | Server process | Health check returns 503; Render keeps old version | Allocate until OOM |
| CPU spike (100%) | Event processing | Messages delayed but not lost; rate limits still enforce | `stress` tool |
| Rapid connect/disconnect | Connection pool | Rate limiter blocks; no memory leak | Custom script |
| Clock skew | Token bucket timing | Rate limits still work (use monotonic clock) | Fake clock in tests |
| Malformed WebSocket frames | Socket.IO parser | Connection dropped cleanly; no crash | `ws` library raw frames |
| Half-open TCP connections | Connection count | Timeout and cleanup; don't count toward IP cap forever | Slowloris tool |
| DNS resolution failure | External services | Only affects geo lookup (M5); degrade to "XX" country | Block DNS |
| Render cold start during session | Active sessions | Sessions lost (accepted); new connections get loading screen | Wait for idle spin-down |

### 2.5 Mobile-Specific Testing (M3+)

| Test | Device | Condition | Pass Criteria |
|---|---|---|---|
| Touch input | Phone | Normal | Messages send, commands work |
| Virtual keyboard | Phone | Keyboard open | Chat input visible, not obscured by keyboard |
| Orientation change | Phone | Rotate during chat | Layout adjusts, no content loss |
| Network transition | Phone | WiFi → mobile data | Session survives (< 30s gap) |
| Background/foreground | Phone | Switch apps and back | Session reconnects within 30s |
| Low bandwidth | Phone | 3G simulation | Messages deliver (may be slow) |
| Battery saver mode | Phone | OS throttling | WebSocket stays alive |
| 360px viewport | Phone | Smallest supported | All UI elements visible and usable |

### 2.6 WebSocket Edge Case Testing (M3)

| Test | Scenario | Expected |
|---|---|---|
| Concurrent connection storm | 100 connections from same IP in 1 second | 5 accepted, 95 refused with rate limit |
| Message during state transition | Send during SEARCHING → CHATTING race | Message queued or cleanly rejected |
| Double `/next` | Both partners press `/next` simultaneously | No orphaned sessions, no error |
| Disconnect during key exchange | One client drops mid-ECDH | Other client gets timeout, session ends |
| Reconnect to expired session | Reconnect after 30s timeout | Clean error, not paired with new stranger |
| Maximum message length boundary | Exactly 500 chars, 501 chars | 500 accepted, 501 rejected |
| Empty envelope | `{seq: 1, ct: ""}` | Validation rejects |
| Negative sequence number | `{seq: -1, ct: "..."}` | Validation rejects |
| Duplicate sequence number | Same seq sent twice | Second rejected (replay protection) |
| Out-of-order sequence | seq 3 before seq 2 | Rejected (strict ordering) |

### 2.7 Performance Testing (M7/M9)

| Test | Target | Tool | Duration |
|---|---|---|---|
| Steady-state load | 200 concurrent pairs, 1 msg/3s | k6 | 10 minutes |
| Ramp-up | 0 → 200 pairs in 2 minutes | k6 | 5 minutes |
| Spike | 50 → 500 connections in 10 seconds | k6 | 1 minute |
| Soak | 100 pairs for 2 hours | k6 | 2 hours |
| Endurance (memory leak detection) | 50 pairs, cycling every 5 minutes | k6 | 8 hours |

**Metrics to capture:** p50/p95/p99 relay latency, memory RSS, CPU%, connection count, error rate, GC pause time.

### 2.8 Rollback Testing (M9)

| Test | Procedure | Pass Criteria |
|---|---|---|
| Render rollback | Deploy bad version → rollback via dashboard | Old version serves within 2 minutes |
| Git revert | Merge bad commit → revert PR → merge | Clean revert, CI green, auto-deploy |
| Config rollback | Set bad ALLOWED_ORIGINS → fix | Process exits on bad config; old version stays |
| Database migration rollback | N/A (no database) | Confirmed N/A |

## 3. Test Automation in CI

### 3.1 Current CI Plan (M2)
```
npm ci → typecheck → test → build → audit
```

### 3.2 Recommended CI Enhancement (M7+)
```
npm ci → lint → typecheck → test (with coverage) → build → audit
  → accessibility audit → security scan (semgrep + CodeQL)
  → coverage threshold check (≥ 80% on core modules)
  → license check (no GPL in production deps)
  → bundle size check (page < 100KB)
```

### 3.3 Recommended Nightly/Weekly CI (M9)
```
Weekly:
  → Full pen test suite (OWASP ZAP baseline)
  → Cross-browser test (Playwright, 4 browsers)
  → Load test (200 pairs, 10 min)
  → Dependency update check (Dependabot)

Monthly:
  → Soak test (100 pairs, 2 hours)
  → Memory leak analysis (heap snapshots)
  → Security headers re-scan
```

## 4. Findings Summary

| ID | Severity | Finding | Milestone |
|---|---|---|---|
| TR-01 | CRITICAL | Zero tests exist in the codebase | M2 |
| TR-02 | MAJOR | No penetration testing plan | M9 |
| TR-03 | MAJOR | No accessibility testing | M7 |
| TR-04 | MAJOR | No cross-browser compatibility matrix tested | M7 |
| TR-05 | MAJOR | No chaos/fault injection testing | M9 |
| TR-06 | MAJOR | No mobile-specific test plan | M3 |
| TR-07 | MAJOR | No WebSocket edge case test suite | M3 |
| TR-08 | MAJOR | No soak/endurance test for memory leaks | M9 |
| TR-09 | MINOR | No nightly/weekly CI for extended tests | M9 |
| TR-10 | MINOR | No rollback testing plan | M9 |
| TR-11 | MINOR | No bundle size check in CI | M7 |
| TR-12 | MINOR | No license compliance check in CI | M7 |
