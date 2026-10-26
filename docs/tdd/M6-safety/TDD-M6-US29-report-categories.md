# TDD-M6-US29: Reports Cover All Types of Violations

**Milestone:** M6 Trust & Safety
**Story:** US-29 — Report specific types of abuse for appropriate response
**Features:** F-33 (expanded report categories)
**Gaps:** None

## Acceptance Criteria

- Report categories: `harassment`, `sexual`, `spam`, `hate`, `minor`, `threats`, `other`
- `minor` and `threats` flagged for immediate human moderator review
- Categories align with RA 11313 (Safe Spaces) and RA 11930 (Anti-OSAEC)

## Technical Design

### Report Categories

```ts
export const REPORT_REASONS = [
  "harassment",  // RA 11313 — gender-based harassment
  "sexual",      // RA 11313 — sexual harassment
  "spam",        // Unsolicited advertising, bots
  "hate",        // Hate speech, discrimination
  "minor",       // Suspected minor or child exploitation (RA 11930)
  "threats",     // Credible threats of violence
  "other",       // Catch-all
] as const;

export type ReportReason = typeof REPORT_REASONS[number];
```

### Priority Escalation

Reports tagged `minor` or `threats` are flagged for immediate human moderator review:

```ts
const PRIORITY_REASONS: ReportReason[] = ["minor", "threats"];

function handleReport(targetIpHash: string, reporterIpHash: string, reason: ReportReason): void {
  reportTracker.addReport(targetIpHash, reporterIpHash, reason, clock);

  if (PRIORITY_REASONS.includes(reason)) {
    logger.warn({
      event: "priority_report",
      reason,
      targetIpHashPrefix: targetIpHash.slice(0, 8),
      timestamp: clock.now(),
    });
    // In M7: trigger escalation workflow
  }
}
```

### Client-Side `/report` Command

```
/report                     → shows available categories
/report harassment          → submits report with reason "harassment"
/report minor               → submits priority report
```

### Legal Alignment

| Category | Philippine Law | Obligation |
|---|---|---|
| `harassment` | RA 11313 §12 | Mechanism against gender-based harassment |
| `sexual` | RA 11313 §12 | Sexual harassment reporting |
| `minor` | RA 11930 | Report to authorities if confirmed CSAEM |
| `threats` | RA 10175 | Cooperate with law enforcement on valid orders |

## Test Plan (TDD)

### Unit Tests: `tests/unit/validation/schemas.test.ts` (extend)

```
describe("SessionReportSchema")
  ✅ accepts each valid reason ("harassment", "sexual", "spam", "hate", "minor", "threats", "other")
  ❌ rejects unknown reason "dating"
  ❌ rejects empty reason
```

### Unit Tests: `tests/unit/safety/reports.test.ts` (extend)

```
describe("priority escalation")
  ✅ reason "minor" → priority log entry created
  ✅ reason "threats" → priority log entry created
  ✅ reason "spam" → normal report, no priority log
```

## Files to Modify

| File | Action |
|---|---|
| `src/validation/schemas.ts` | Update SessionReportSchema with all 7 reasons |
| `src/safety/reports.ts` | Add priority escalation logic |
| `src/observability/logger.ts` | Add priority report logging |
| `public/js/commands.js` | Update /report to show categories |
| `tests/unit/safety/reports.test.ts` | Extend with escalation tests |

## Dependencies

- US-18 (report system)
- M7 US-31 (moderator tools handle escalated reports)
