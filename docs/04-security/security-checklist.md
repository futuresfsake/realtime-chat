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

## Privacy
- [ ] Data inventory in privacy-and-sessions.md matches the code
- [ ] No raw IPs logged; logs contain no content (T-15)
- [ ] Privacy notice + rules page live; DB-IP attribution shown

## Safety
- [ ] 18+ gate + rules enforced on the server (S-01)
- [ ] Personal-info warning shown each session (S-08)
- [ ] Links not clickable (S-09)

## Supply chain & ops
- [ ] `npm audit --audit-level=high` clean in CI (T-21)
- [ ] Dependabot + CodeQL enabled (T-21)
- [ ] Branch protection on `main`; deploys only via CI (T-09)
- [ ] Uptime monitor alerting; rollback tested once

## Manual verification before launch
- [ ] `<img src=x onerror=alert(1)>` → shown as text
- [ ] 20 fast messages → `slow down`
- [ ] 10 KB payload from dev tools → rejected
- [ ] Socket from another origin → refused
- [ ] Dev tools → Network → WS frames: only ciphertext visible
- [ ] securityheaders.com grade ≥ A
