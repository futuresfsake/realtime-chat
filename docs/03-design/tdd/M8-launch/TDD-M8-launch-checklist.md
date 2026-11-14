# TDD-M8: Public Launch Checklist

**Milestone:** M8 Public Launch
**Status:** 🔜
**Gaps:** G-22 (legal review timing), G-23 (DPO), G-24 (beta rollout plan)

## Goal

Everything checked; share the link. Philippines beta first.

## Pre-Launch Checklist

### Security (from `docs/04-security/security-checklist.md`)

- [ ] Every client→server event validated by zod strict schema
- [ ] maxHttpBufferSize = 4 KB
- [ ] No innerHTML with user-influenced data
- [ ] helmet CSP without unsafe-inline
- [ ] Origin allowlist enforced
- [ ] Token buckets for all event types
- [ ] ≤ 5 sockets per IP hash
- [ ] No plaintext path (code review + spy test)
- [ ] Per-direction keys, counter IVs, seq + AAD tested
- [ ] 64-byte padding
- [ ] /verify safety codes match
- [ ] No keys or plaintext in logs (grep in CI)

### Privacy & Legal (RA 10173)

- [ ] Privacy notice published (what we collect, why, how long)
- [ ] Data inventory matches code
- [ ] No raw IPs logged
- [ ] Data Protection Officer designated (operator = interim DPO)
- [ ] Privacy Impact Assessment completed
- [ ] Terms of service published
- [ ] Acceptable use policy published

### Safety (RA 11313, RA 11930)

- [ ] 18+ gate enforced on server
- [ ] Rules page live with prohibited conduct
- [ ] Content filters active
- [ ] `minor` reports trigger immediate escalation
- [ ] Report categories cover all RA 11313 violation types
- [ ] Automated monitoring operational
- [ ] Human moderator review process active
- [ ] Moderator training completed
- [ ] Law enforcement cooperation guidelines documented (RA 10175)

### Operations

- [ ] CI green on main, all tests pass
- [ ] Uptime monitor active
- [ ] Incident response plan documented and tested
- [ ] Rollback tested once
- [ ] DB-IP attribution shown in footer

### Documentation

- [ ] README up to date
- [ ] All open decisions resolved
- [ ] CHANGELOG created
- [ ] `v1.0.0` git tag

### Legal Review (G-22)

- [ ] Privacy notice reviewed by Philippine lawyer
- [ ] Terms of service reviewed
- [ ] Compliance with RA 10173, RA 10175, RA 11313, RA 11930 confirmed

## Launch Process

### Phase 1: Philippines Beta (1-2 weeks)

1. Share link via personal networks in the Philippines
2. Monitor abuse metrics daily
3. Review moderator reports daily
4. Adjust content filters based on observed patterns
5. Fix any issues found

### Phase 2: Wider Release

1. All Phase 1 issues resolved
2. Abuse metrics within acceptable ranges
3. Share link more broadly
4. Monitor for scaling issues (free tier limits)

## Demo Script (final smoke test)

1. Laptop: open live URL → consent gate → accept → `/start`
2. Phone (mobile data): same flow → both connected, `🔒` shown
3. Exchange messages + a reaction; `/verify` codes match
4. Dev tools → Network → WS frames: only ciphertext
5. `/next` on phone → laptop sees "stranger left"
6. `/health` → ok
7. securityheaders.com grade ≥ A
8. Report flow: submit report → verify it processes correctly

## Post-Launch Monitoring

- Daily: check abuse metrics, review priority reports
- Weekly: moderator review of trends, adjust thresholds
- Monthly: update DB-IP database, review dependencies (Dependabot)
- Ongoing: respond to user reports, law enforcement requests
