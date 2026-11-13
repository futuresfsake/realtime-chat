# Story Classification

Every story is classified by **security level** which determines the pipeline gate style. Classification is assigned by the IT Manager based on the story's impact on security, privacy, compliance, and system integrity.

## Classification Levels

| Level | Pipeline | Manual Reviews | Merge Gate | Rationale |
|---|---|---|---|---|
| **CRITICAL** | Gated | 2 required | Explicit sign-off | Touches encryption, auth, compliance, or legal — a defect here is a breach |
| **HIGH** | Gated | 1 required | Explicit sign-off | Touches security headers, rate limiting, logging, or safety — a defect here degrades protection |
| **MEDIUM** | Continuous | Automated only | CI green = merge | Core feature logic — tested automatically, no manual gate |
| **LOW** | Continuous | Automated only | CI green = merge | UI polish, counters, non-security features — lowest risk |

## Classification Matrix

### CRITICAL — Gated, 2 Reviews

| Story | Milestone | Why Critical |
|---|---|---|
| US-12 | M4 | E2EE implementation — crypto bugs are silent and catastrophic |
| US-13 | M4 | Safety code verification — MITM detection depends on correctness |
| US-17 | M6 | 18+ age gate — RA 11930 compliance, child safety |
| US-20 | M6 | Temp bans — abuse prevention core logic, privacy-preserving IP hash |
| US-32 | M2 | Connection auth token — first line of defense against unauthorized access |
| US-37 | M4 | Key exchange timeout — incomplete crypto state is a security hole |
| US-38 | M6 | Privacy notice / ToS — legal documents, RA 10173 compliance |
| US-39 | M6 | Proof-of-work bot prevention — abuse prevention gate |
| US-44 | M7 | Incident response procedures — breach notification, child safety escalation |
| US-45 | M8 | Legal compliance sign-off — Philippine law compliance verification |
| US-46 | M8 | Launch readiness — final gate before public exposure |
| US-47 | M9 | Penetration testing — adversarial security validation |
| US-48 | M9 | DR drill — disaster recovery verification |

### HIGH — Gated, 1 Review

| Story | Milestone | Why High |
|---|---|---|
| US-18 | M6 | Report system — abuse reporting correctness, no transcript leakage |
| US-21 | M2 | Input validation (zod) — first defense against malformed input |
| US-22 | M2 | Rate limiting — DoS prevention, token bucket correctness |
| US-23 | M2 | Security headers / CSP — XSS prevention, clickjacking protection |
| US-28 | M6 | Content filters — harmful content detection before encryption |
| US-29 | M6 | Report categories — RA 11313 / RA 11930 alignment |
| US-33 | M2 | Structured logging — PII prevention in logs, privacy compliance |
| US-34 | M2 | Deep health check — exposes system internals, must be safe |
| US-35 | M2 | Protocol versioning — breaking change protection |
| US-36 | M3 | WebSocket edge cases — session integrity under race conditions |
| US-40 | M7 | SLIs/SLOs — service level measurement correctness |
| US-42 | M7 | Alerting — must not miss critical conditions |
| US-43 | M7 | Accessibility — WCAG AA compliance, legal obligation |

### MEDIUM — Continuous

| Story | Milestone | Why Medium |
|---|---|---|
| US-01 | M3 | Random names — anonymity depends on non-predictable generation |
| US-02 | M3 | Start chat — core feature, session creation |
| US-03 | M3 | Exactly two — session isolation, but tested by integration tests |
| US-04 | M3 | Skip — state transition, moderate complexity |
| US-05 | M3 | Leave — state transition |
| US-06 | M3 | Partner status — UI state, not security-critical |
| US-07 | M3 | Typing indicator — UI feature |
| US-09 | M3 | Session-only history — browser memory, no persistence |
| US-14 | M5 | Interest matching — algorithm correctness |
| US-15 | M5 | Country filter — geolocation logic |
| US-16 | M5 | Fallback match — timeout logic |
| US-19 | M6 | No rematch — uses existing IP hash |
| US-24 | M2 | CD pipeline — infrastructure, not code logic |
| US-41 | M7 | Metrics collection — observability, not security |

### LOW — Continuous

| Story | Milestone | Why Low |
|---|---|---|
| US-08 | M3 | Emoji reactions — UI polish |
| US-10 | M3 | Online counter — display only |
| US-11 | M3 | Survive network drops — Socket.IO built-in + timeout config |
| US-25 | M7 | Operator monitoring — /health + uptime monitor |
| US-26 | M1 | Themes — already delivered ✅ |
| US-27 | M1 | Slash commands — already delivered ✅ |
| US-30 | M7 | Automated monitoring — log analysis, no user-facing impact |
| US-31 | M7 | Moderator tools — internal tooling |
| US-49 | M9 | Performance baseline — measurement, not code change |
| US-50 | M10 | Operational maturity — process, not code |

## Classification by Milestone

### M2 — Hardening + CI/CD + First Deploy

| Story | Level | Pipeline |
|---|---|---|
| US-21 | HIGH | Gated |
| US-22 | HIGH | Gated |
| US-23 | HIGH | Gated |
| US-24 | MEDIUM | Continuous |
| US-32 | CRITICAL | Gated |
| US-33 | HIGH | Gated |
| US-34 | HIGH | Gated |
| US-35 | HIGH | Gated |

**M2 profile:** 1 CRITICAL, 6 HIGH, 1 MEDIUM — **heavily gated milestone**. This is the security foundation.

### M3 — 1:1 Anonymous Sessions

| Story | Level | Pipeline |
|---|---|---|
| US-01 | MEDIUM | Continuous |
| US-02 | MEDIUM | Continuous |
| US-03 | MEDIUM | Continuous |
| US-04 | MEDIUM | Continuous |
| US-05 | MEDIUM | Continuous |
| US-06 | MEDIUM | Continuous |
| US-07 | MEDIUM | Continuous |
| US-08 | LOW | Continuous |
| US-09 | MEDIUM | Continuous |
| US-10 | LOW | Continuous |
| US-11 | LOW | Continuous |
| US-36 | HIGH | Gated |

**M3 profile:** 1 HIGH, 8 MEDIUM, 3 LOW — **mostly continuous**. US-36 (edge cases) is gated due to session integrity.

### M4 — End-to-End Encryption

| Story | Level | Pipeline |
|---|---|---|
| US-12 | CRITICAL | Gated |
| US-13 | CRITICAL | Gated |
| US-37 | CRITICAL | Gated |

**M4 profile:** 3 CRITICAL — **fully gated milestone**. Crypto is the highest risk.

### M5 — Matchmaking

| Story | Level | Pipeline |
|---|---|---|
| US-14 | MEDIUM | Continuous |
| US-15 | MEDIUM | Continuous |
| US-16 | MEDIUM | Continuous |

**M5 profile:** 3 MEDIUM — **fully continuous**. Matching is algorithmic, well-tested by unit tests.

### M6 — Trust & Safety

| Story | Level | Pipeline |
|---|---|---|
| US-17 | CRITICAL | Gated |
| US-18 | HIGH | Gated |
| US-19 | MEDIUM | Continuous |
| US-20 | CRITICAL | Gated |
| US-28 | HIGH | Gated |
| US-29 | HIGH | Gated |
| US-38 | CRITICAL | Gated |
| US-39 | CRITICAL | Gated |

**M6 profile:** 4 CRITICAL, 3 HIGH, 1 MEDIUM — **heavily gated**. Trust & safety is legally mandated.

### M7 — Quality, Observability, Monitoring & Moderation

| Story | Level | Pipeline |
|---|---|---|
| US-25 | LOW | Continuous |
| US-30 | LOW | Continuous |
| US-31 | LOW | Continuous |
| US-40 | HIGH | Gated |
| US-41 | MEDIUM | Continuous |
| US-42 | HIGH | Gated |
| US-43 | HIGH | Gated |
| US-44 | CRITICAL | Gated |

**M7 profile:** 1 CRITICAL, 3 HIGH, 1 MEDIUM, 3 LOW — **mixed**. IRP and alerting are gated; monitoring tools flow continuously.

### M8 — Public Launch

| Story | Level | Pipeline |
|---|---|---|
| US-45 | CRITICAL | Gated |
| US-46 | CRITICAL | Gated |

**M8 profile:** 2 CRITICAL — **fully gated**. Launch is the final gate.

### M9 — Production Hardening

| Story | Level | Pipeline |
|---|---|---|
| US-47 | CRITICAL | Gated |
| US-48 | CRITICAL | Gated |
| US-49 | LOW | Continuous |

**M9 profile:** 2 CRITICAL, 1 LOW — pen test and DR drill are gated; perf baseline is measurement only.

### M10 — Post-Launch Operations

| Story | Level | Pipeline |
|---|---|---|
| US-50 | LOW | Continuous |

**M10 profile:** 1 LOW — **fully continuous**. Operational maturity is process, not code risk.

## Summary

| Level | Count | % |
|---|---|---|
| CRITICAL | 13 | 27% |
| HIGH | 13 | 27% |
| MEDIUM | 14 | 29% |
| LOW | 10 | 20% |
| **Total** | **50** | |

| Pipeline | Count | % |
|---|---|---|
| **Gated** | 26 | 52% |
| **Continuous** | 24 | 48% |

Over half of all stories require manual review gates. This is appropriate for an anonymous chat platform handling sensitive user interactions under Philippine law.

## Reclassification Rules

A story's classification can be changed by the IT Manager when:
1. A dependency on a CRITICAL story is discovered → upgrade to at least HIGH
2. A story touches E2EE code paths (from M4 onward) → upgrade to CRITICAL
3. A compliance finding is linked to the story → upgrade to at least HIGH
4. A penetration test reveals the story's code is a vulnerability → upgrade to CRITICAL
5. A story is split into sub-stories → each sub-story inherits the parent's classification or higher
