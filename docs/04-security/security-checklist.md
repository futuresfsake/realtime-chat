# Security Checklist: launch gate (M8)

All boxes must be checked before the link is shared publicly. Each line references a threat (T-##) or safety control (S-##).

## Input, output & transport
- [ ] Every client→server event validated by a zod `strictObject` schema (T-01)
- [ ] `maxHttpBufferSize` = 4 KB (T-01)
- [ ] No `innerHTML` with any user-influenced data anywhere (T-05)
- [ ] helmet enabled; CSP without `unsafe-inline` (theme script allowed by hash) (T-05, T-06)
- [ ] Origin allowlist enforced in production (T-04)
- [ ] HTTPS/WSS only (Render TLS)

## Abuse
- [ ] Token buckets: envelopes, typing, start/next, reports (T-02, T-18)
- [ ] ≤ 5 sockets per IP hash (T-03)
- [ ] Bans + no-rematch working with daily salt rotation (T-16, S-06)

## Encryption
- [ ] No plaintext path from client to server (code review + integration spy test) (T-07, T-25)
- [ ] Per-direction keys, counter IVs, seq + AAD checks unit-tested (T-10, T-11)
- [ ] Padding to 64 bytes (T-12)
- [ ] `/verify` safety codes match; MITM simulation differs (T-08)
- [ ] No keys or plaintext in any log statement (grep in CI)

## Privacy (RA 10173 - Data Privacy Act)
- [ ] Data inventory in privacy-and-sessions.md matches the code
- [ ] No raw IPs logged; logs contain no content (T-15)
- [ ] Privacy notice published, compliant with RA 10173 requirements
- [ ] Rules page live with clear prohibited conduct list
- [ ] DB-IP attribution shown in footer
- [ ] Data retention policy documented and enforced
- [ ] Privacy Impact Assessment completed before launch
- [ ] Data Protection Officer designated

## Safety (RA 11930 - Anti-OSAEC, RA 11313 - Safe Spaces Act)
- [ ] 18+ gate + rules enforced on the server (S-01)
- [ ] Personal-info warning shown each session (S-08)
- [ ] Links not clickable (S-09)
- [ ] Content filters active for known harmful patterns (S-15)
- [ ] `minor` report category triggers immediate escalation (S-16)
- [ ] `harassment` and `sexual` report categories implemented per RA 11313
- [ ] Report categories cover all Safe Spaces Act violation types

## Monitoring & moderation
- [ ] Automated behavioral monitoring operational (S-13)
- [ ] Abuse scoring metrics tracked per IP hash
- [ ] Report velocity and pattern detection working
- [ ] Human moderator review process documented (S-14)
- [ ] Escalation workflow documented and tested (S-16)
- [ ] Moderator access controls verified (no message content, no raw IPs)
- [ ] Moderator training documentation completed (PH law requirements)
- [ ] Incident response plan documented

## Supply chain & ops
- [ ] `npm audit --audit-level=high` clean in CI (T-21)
- [ ] Dependabot + CodeQL enabled (T-21)
- [ ] Branch protection on `main`; deploys only via CI (T-09)
- [ ] Uptime monitor alerting; rollback tested once
- [ ] HTTPS everywhere, secure WebSockets only

## Legal compliance
- [ ] Terms of service published
- [ ] Privacy policy published (RA 10173)
- [ ] Acceptable use policy published
- [ ] Age policy documented
- [ ] Law enforcement cooperation guidelines documented (RA 10175)
- [ ] Incident response plan covers RA 11930 reporting obligations
- [ ] Legal review completed by qualified Philippine lawyer

## Connection & protocol security (IT Manager review)
- [ ] Connection token required for WebSocket handshake (US-32)
- [ ] Connection token is HMAC-signed with 30s TTL, bound to IP hash
- [ ] Protocol version `rc/v1` validated on every connection (US-35)
- [ ] Outdated clients receive `system:refresh` notification before disconnect
- [ ] Connection-rate limiting: max 5 new connections per IP per 10 seconds
- [ ] Proof-of-work challenge required before first session (US-39)
- [ ] Key exchange timeout: 10s, then session ends with CRYPTO_TIMEOUT (US-37)

## Monitoring & observability (IT Manager review)
- [ ] Structured JSON logging with correlation IDs, no PII (US-33)
- [ ] CI grep/semgrep rule fails on raw IP in any log statement
- [ ] Deep health check reports memory, connections, status (US-34)
- [ ] Memory ceiling configured (`--max-old-space-size=400`)
- [ ] In-memory data structures have `maxSize` bounds
- [ ] SLIs and SLOs defined and tracked (US-40)
- [ ] Alerting configured for critical conditions (US-42)

## Infrastructure (IT Manager review)
- [ ] `.node-version` file pins Node 22
- [ ] `better-sqlite3` removed from dependencies
- [ ] `.env.example` exists with all required variables
- [ ] Response compression enabled (gzip)
- [ ] CODEOWNERS file protects security-critical paths
- [ ] `SECURITY.md` published with vulnerability disclosure policy

## Compliance & legal (IT Manager review)
- [ ] Privacy Impact Assessment completed
- [ ] NPC registration completed or filed
- [ ] Data Protection Officer designated
- [ ] RA 11930 designated officer appointed
- [ ] Breach notification procedure documented and tested
- [ ] Law enforcement cooperation procedure documented
- [ ] Data processing agreement with Render reviewed
- [ ] Terms of service published
- [ ] Acceptable use policy published

## Testing (IT Manager review)
- [ ] Penetration test report with no unresolved critical/major findings
- [ ] OWASP ZAP baseline scan clean
- [ ] WebSocket fuzzing: no crashes
- [ ] Rollback drill completed in < 5 minutes
- [ ] Service rebuild drill completed in < 20 minutes
- [ ] WCAG AA accessibility audit score ≥ 90 (Lighthouse)
- [ ] Cross-browser E2EE verified (Chrome, Edge, Firefox, Safari)
- [ ] Load test: 200 pairs, p95 relay < 50ms
- [ ] Soak test: 8 hours, RSS growth < 10%

## Manual verification before launch
- [ ] `<img src=x onerror=alert(1)>` → shown as text
- [ ] 20 fast messages → `slow down`
- [ ] 10 KB payload from dev tools → rejected
- [ ] Socket from another origin → refused
- [ ] Socket without connection token → refused
- [ ] Dev tools → Network → WS frames: only ciphertext visible
- [ ] securityheaders.com grade ≥ A
- [ ] Report flow: submit report → confirm ban triggers after threshold
- [ ] Content filter: send known banned word → filter activates
- [ ] Bot script without PoW → connection refused or session denied
- [ ] Outdated protocol version → client sees "please refresh"
- [ ] `/health` shows memory and connection count
- [ ] Structured logs contain no raw IPs (grep verification)
