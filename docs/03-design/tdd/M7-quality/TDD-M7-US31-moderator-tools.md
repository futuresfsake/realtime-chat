# TDD-M7-US31: Human Moderators Can Review Abuse Trends

**Milestone:** M7 Quality, Observability, Monitoring & Moderation
**Story:** US-31 — Human moderators review aggregated report data
**Features:** F-35 (moderator tools)
**Gaps:** G-19 (moderator tooling format — assumed: structured logs + CLI)

## Acceptance Criteria

- Moderators see aggregated report patterns, abuse scores, and escalated cases
- Moderators never see message content, raw IPs, or full IP hashes
- Escalation workflow: `minor` and `threats` get priority human review
- Moderators trained on Philippine law (RA 11313, RA 11930, RA 10173)

## Technical Design

### v1 Approach: Structured Logs + CLI Script

For v1 (single maintainer, free tier), a full web dashboard is overkill. Instead:
1. Structured JSON logs contain all the data a moderator needs
2. A CLI script queries and summarizes the logs
3. Priority reports trigger email alerts via the uptime monitor webhook

### Moderator CLI (`scripts/mod-report.ts`)

```bash
npx tsx scripts/mod-report.ts --period 24h --type priority
npx tsx scripts/mod-report.ts --period 7d --type summary
```

Output:
```
=== Moderation Report (last 24h) ===

Priority Reports: 2
  - [2026-10-26 14:32] reason=minor, target=a1b2c3d4 (score: 45)
  - [2026-10-26 18:01] reason=threats, target=e5f6g7h8 (score: 32)

Active Bans: 3
Top Abuse Scores:
  1. a1b2c3d4 — score 45 (3 reports, 5 churn events)
  2. e5f6g7h8 — score 32 (2 reports, 1 connection spike)

Report Breakdown:
  harassment: 12
  sexual: 4
  spam: 8
  hate: 2
  minor: 2
  threats: 1
  other: 3
```

### Moderator Access Controls

What moderators can see:
- Report reason codes
- IP hash prefixes (first 8 chars)
- Timestamps
- Session metadata (duration, state transitions)
- Abuse scores

What moderators NEVER see:
- Message content (E2EE, server never had it)
- Encryption keys
- Raw IP addresses
- Full IP hashes
- User agents

### Escalation Workflow

```
Report received
  → priority reason? (minor/threats)
    → YES: log priority_report + email alert to operator
      → Human reviews within 24h
      → If confirmed: document, extend ban, law enforcement if required
    → NO: normal report processing (auto-ban at threshold)
```

### Moderator Training Documentation

Create `docs/04-security/moderator-guide.md`:
1. What data is available and what is not (E2EE means no message content)
2. How to run the CLI report
3. RA 11313 obligations (gender-based harassment)
4. RA 11930 obligations (child safety, reporting CSAEM)
5. RA 10173 obligations (data privacy, no unnecessary data collection)
6. Escalation to law enforcement (when required by law)
7. False positive handling

### Incident Response Plan

Create `docs/06-operations/incident-response.md`:
1. Detection (automated monitoring, user reports, uptime alerts)
2. Triage (severity: P1 child safety, P2 threats, P3 abuse patterns, P4 spam)
3. Response (ban, escalate, law enforcement, platform adjustment)
4. Documentation (incident log, no message content)
5. Review (weekly moderator review of trends)

## Test Plan (TDD)

### Unit Tests: `tests/unit/scripts/modReport.test.ts`

```
describe("mod-report")
  ✅ parses structured log entries
  ✅ filters by time period
  ✅ counts reports by category
  ✅ lists priority reports
  ✅ shows only IP hash prefix (8 chars), never full hash
  ✅ output contains no message content
```

## Files to Create

| File | Action |
|---|---|
| `scripts/mod-report.ts` | Create |
| `docs/04-security/moderator-guide.md` | Create |
| `docs/06-operations/incident-response.md` | Create |
| `tests/unit/scripts/modReport.test.ts` | Create |

## Dependencies

- M7 US-25 (structured logger)
- M7 US-30 (abuse scorer)
- M6 (report categories, ban system)
