# Threat Model

**Method:** STRIDE, a checklist of threat types: **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege.

## What we protect (assets)
1. **Availability** of the chat (the server staying up)
2. **Users' browsers** (no script injection)
3. **Integrity** of messages (who said what, when)
4. **Hosting quota** (free-tier hours and bandwidth)

## Who might attack
- Bored internet user / script kiddie (most likely): spam, XSS attempts, floods
- Automated bots scanning for vulnerable endpoints
- (Out of scope) a well-funded, targeted attacker

## Trust boundaries
```
[ Browser (untrusted) ] ──HTTPS/WSS──▶ [ Render proxy ] ──▶ [ Node server (trusted) ] ──▶ [ SQLite ]
         ▲ everything crossing this line is validated
```

## Threats and mitigations

| ID | STRIDE | Threat | Mitigation | Status |
|---|---|---|---|---|
| T-01 | Tampering | Malformed or oversized payloads crash the server or corrupt data | zod `.strict()` schemas; `maxHttpBufferSize: 1e3`; try/catch per handler | 🔜 M2 (basic type/length check ✅) |
| T-02 | DoS | Message flooding / spam | Token bucket per socket; disconnect after repeated violations | 🔜 M2 |
| T-03 | Spoofing | Someone uses another person's username | Unique per room while online; **no accounts in v1 → accepted risk**, documented to users | 🔜 M3 / accepted |
| T-04 | DoS | One IP opens hundreds of sockets | Max 5 sockets per IP | 🔜 M2 |
| T-05 | Spoofing | Other websites embed or connect to our socket server (Cross-Site WebSocket Hijacking) | Origin allowlist in `allowRequest` | 🔜 M2 |
| T-06 | Tampering / EoP | XSS: a message containing `<script>` runs in others' browsers | Render only with `textContent`; CSP header | ✅ textContent / 🔜 CSP |
| T-07 | Tampering | Fake timestamps or message ids from clients | Server assigns `id` and `sentAt` | ✅ |
| T-08 | Tampering | SQL injection via message text | Prepared statements only | 🔜 M4 |
| T-09 | Info disclosure | Stack traces / internals leaked to clients | Generic error codes in acks; details only in server logs | 🔜 M2 |
| T-10 | Info disclosure | Logs leak private message content or IPs | Log events + counts, not message text; hash IPs | 🔜 M5 |
| T-11 | Tampering | Vulnerable npm dependency | `npm audit` + Dependabot in CI; lockfile committed | 🔜 M5 |
| T-12 | Tampering | Clickjacking (our page framed by another site) | `X-Frame-Options: DENY` / CSP `frame-ancestors 'none'` (helmet) | 🔜 M2 |
| T-13 | DoS | Free-tier quota exhausted by bots | Rate limits; monitor bandwidth in the Render dashboard | 🔜 M2 / M6 |
| T-14 | Repudiation | No record of abuse | Structured logs of rejections (socket id, hashed IP, reason) | 🔜 M5 |
| T-15 | Info disclosure | Secrets committed to git | No secrets needed yet; `.env` in `.gitignore`; GitHub secret scanning | ✅ |

## Accepted risks (v1)
- **Name impersonation** while the real user is offline (no accounts).
- **History loss** on restart (ephemeral disk).
- **No content moderation** beyond limits. Don't use for sensitive conversations.

## Review
Re-run this threat model whenever we add a new event, endpoint or storage.
