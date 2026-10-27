# Threat Model

**Method:** STRIDE (see [README](README.md) for how to read this table). Status: ✅ done · 🔜 planned (milestone) · ⚠️ accepted risk.

## Assets
1. **Message confidentiality** (E2EE keys and content)
2. **User anonymity** (IP, country, linkability across sessions)
3. **User safety** (from harassment and harmful content)
4. **Availability** of the service and free-tier quotas

## Attackers
| Attacker | Goal |
|---|---|
| Abusive user | Harass, spam, scam, evade bans |
| Bot operator | Flood, farm matches, advertise |
| Curious/malicious operator or compromised host | Read messages, identify users |
| Network attacker | Eavesdrop, tamper |
| Other website | Use visitors' browsers against our server (CSWSH) |

## Trust boundaries
```
[Browser A] ─TLS─▶ [Render edge] ─▶ [Node server: blind relay] ─▶ [Render edge] ─TLS─▶ [Browser B]
     ▲ E2EE keys live only here                                               ▲ and here
```

## Threats

| ID | STRIDE | Threat | Mitigation | Status |
|---|---|---|---|---|
| T-01 | Tampering | Malformed or oversized events crash or confuse the server | zod `strictObject` schemas; 4 KB payload limit; wrapped handlers | 🔜 M2 |
| T-02 | DoS | Message/command flooding | Token buckets (messages, start/next, typing, reports) | 🔜 M2 |
| T-03 | DoS | One IP opens many sockets | ≤ 5 sockets per IP hash | 🔜 M2 |
| T-04 | Spoofing | Cross-Site WebSocket Hijacking | Origin allowlist | 🔜 M2 |
| T-05 | Tampering / EoP | XSS via message text, which also steals E2EE keys | `textContent` only; strict CSP (no `unsafe-inline`) | ✅ textContent / 🔜 CSP M2 |
| T-06 | Tampering | Clickjacking | CSP `frame-ancestors 'none'` | 🔜 M2 |
| T-07 | Info disclosure | Server, logs or host read message content | E2EE; no storage; no content logging | 🔜 M4 |
| T-08 | Spoofing | Active MITM swaps public keys during exchange | Safety code via `/verify` (compare out-of-band) | 🔜 M4 / ⚠️ residual |
| T-09 | Tampering | Malicious or compromised JavaScript delivered by the server | CSP, no third-party scripts, open source, PR-only deploys, published hashes | ⚠️ accepted residual |
| T-10 | Tampering | Replay, reorder or cross-session splicing of envelopes | Strictly increasing `seq`; AAD binds sessionId + direction + seq | 🔜 M4 |
| T-11 | Info disclosure | AES-GCM IV reuse | Per-direction keys; counter-based IVs | 🔜 M4 |
| T-12 | Info disclosure | Message length reveals content | Pad to 64-byte buckets | 🔜 M4 / ⚠️ partial |
| T-13 | Spoofing | Joining someone else's session with a forged sessionId | Server checks session membership on every event | 🔜 M3 |
| T-14 | Info disclosure | Partner learns your IP | Server relay, no WebRTC | ✅ by design |
| T-15 | Info disclosure | Our logs de-anonymize users | No raw IPs; daily-salted HMAC; no content | 🔜 M2/M7 |
| T-16 | Repudiation / safety | Harassment by strangers | Report, no-rematch, temp bans, instant `/next` | 🔜 M3/M6 |
| T-17 | Safety | Minors on the platform | 18+ gate (self-declared), rules, reporting reason `minor` | 🔜 M6 / ⚠️ residual |
| T-18 | DoS | Bots farming matches | `/start` + `/next` rate limit per IP hash | 🔜 M2 |
| T-19 | Spoofing | Ban evasion with a VPN | Short bans; rate limits | ⚠️ accepted |
| T-20 | Spoofing | Faking country via VPN | — | ⚠️ accepted |
| T-21 | Tampering | Vulnerable dependencies | `npm audit` in CI, Dependabot, CodeQL | 🔜 M2/M7 |
| T-22 | Info disclosure | Secrets committed to the repo | No secrets needed; `.env` ignored; GitHub secret scanning | ✅ |
| T-23 | Info disclosure | Error messages leak internals | Clients get error codes only | 🔜 M2 |
| T-24 | DoS | Free-tier quota exhaustion (hours/bandwidth) | Rate limits; monitor usage; alerts | 🔜 M7 |
| T-25 | Downgrade | Forcing an unencrypted session | No plaintext path exists; envelope-only protocol | 🔜 M4 |
| T-26 | Safety | Gender-based online sexual harassment (RA 11313) | Dedicated report categories (`harassment`, `sexual`), content filters for slurs and explicit solicitation, automated ban on threshold, human moderator escalation | 🔜 M6/M7 |
| T-27 | Safety | Platform used for child exploitation or grooming (RA 11930) | 18+ gate, text-only (no media), `minor` report with immediate escalation, no persistent contact, no user-chosen names, law enforcement reporting procedures | 🔜 M6/M7 |
| T-28 | Compliance | Failure to comply with Data Privacy Act (RA 10173) | Data minimization, privacy notice, data inventory, retention policy, NPC breach notification procedure | 🔜 M7/M8 |
| T-29 | Compliance | Law enforcement data preservation request (RA 10175) | Documented cooperation procedures; minimal data available (no message content, no raw IPs); legal counsel contact established | 🔜 M8 |
| T-30 | Safety | Coordinated harassment campaigns | Automated detection of report clustering by IP hash patterns, rate limiting across sessions, human moderator pattern analysis | 🔜 M7 |

### IT Manager Review — Additional Threats

| ID | STRIDE | Threat | Mitigation | Status |
|---|---|---|---|---|
| T-31 | Spoofing | Automated bots bypass Origin check by spoofing headers outside browser | Connection token (HMAC-signed, IP-bound, 30s TTL) + proof-of-work challenge | 🔜 M2/M6 |
| T-32 | DoS | WebSocket handshake flood (before rate limiter kicks in) | Connection-rate limiting at gateway: 5 new connections/IP/10s | 🔜 M2 |
| T-33 | Tampering | Outdated client code (stale tab) sends incompatible events after deploy | Protocol versioning (`rc/v1` in handshake); mismatch → refused + refresh notice | 🔜 M2 |
| T-34 | Info disclosure | Structured logs accidentally contain raw IP addresses | CI semgrep rule fails build on `console.*` with raw IP patterns; log audit | 🔜 M2 |
| T-35 | DoS | Unbounded in-memory maps (bans, sessions, pools) exhaust 512MB instance | `maxSize` on all TtlMap instances; memory ceiling `--max-old-space-size=400` | 🔜 M2 |
| T-36 | Tampering | Client-side content filters bypassed by modified client | Accepted risk (E2EE limitation); behavioral monitoring detects abuse patterns | ⚠️ accepted |
| T-37 | DoS | Key exchange hangs indefinitely if one client never sends public key | 10s key exchange timeout; session ends with CRYPTO_TIMEOUT | 🔜 M4 |
| T-38 | Compliance | Breach notification not sent within 72 hours (RA 10173) | Documented procedure with NPC template; tested via tabletop exercise | 🔜 M7/M8 |
| T-39 | Safety | `minor` report not escalated promptly (RA 11930) | Immediate email alert on `minor` report; documented PNP-ACG/NBI-CCD procedure | 🔜 M7 |
| T-40 | DoS | Render free tier quota exhaustion suspends service | Monitor usage; alert at 80% quota; documented cost triggers in scaling.md | 🔜 M7 |
| T-41 | Info disclosure | Health check exposes internal system details to unauthenticated users | Return detailed metrics only for operator; public `/health` returns status only | 🔜 M2 |
| T-42 | Spoofing | Ban evasion via VPN + new browser (no fingerprinting) | Accepted for v1; browser fingerprinting tracked as post-v1 improvement | ⚠️ accepted |

## Accepted risks (stated publicly in the privacy notice)
T-08 (if users don't verify), T-09, T-12 (partial), T-17 (self-declared age), T-19, T-20, T-36, T-42.

## Review triggers
Re-review this file when adding an event, endpoint, dependency, third party or storage, and before every milestone ends.
