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

## Accepted risks (stated publicly in the privacy notice)
T-08 (if users don't verify), T-09, T-12 (partial), T-17 (self-declared age), T-19, T-20.

## Review triggers
Re-review this file when adding an event, endpoint, dependency, third party or storage, and before every milestone ends.
