# TDD-M6-US18: Report a Stranger

**Milestone:** M6 Trust & Safety
**Story:** US-18 — `/report harassment` ends the chat and prevents rematching
**Features:** F-26 (report)
**Gaps:** G-18 (report data retention — assumed: 30 days in logs, 24h in memory)

## Acceptance Criteria

- `/report harassment` ends the chat, prevents rematching, sends report (reason code only)
- No transcript is sent (server never had messages)

## Technical Design

### Report Flow

1. Client sends `session:report { reason: "harassment" }`
2. Gateway validates reason against allowed categories
3. Session manager ends the session
4. Both sides added to each other's no-rematch list (24h)
5. Report recorded: `{ targetIpHash, reporterIpHash, reason, timestamp }`
6. Partner receives `session:ended { reason: "reported" }`
7. If this triggers ban threshold (3 distinct reporters / 1h) → target banned

### Reports Module (`src/safety/reports.ts`)

```ts
export class ReportTracker {
  private reports = new TtlMap<string, Set<string>>();  // targetIpHash → Set<reporterIpHash>

  addReport(targetIpHash: string, reporterIpHash: string, reason: string, clock: Clock): void {
    const reporters = this.reports.get(targetIpHash) ?? new Set();
    reporters.add(reporterIpHash);
    this.reports.set(targetIpHash, reporters, 3600_000); // 1h window
  }

  shouldBan(targetIpHash: string): boolean {
    const reporters = this.reports.get(targetIpHash);
    return reporters !== undefined && reporters.size >= 3;
  }
}
```

### What Is NOT Reported

- No message content (server never had it — E2EE)
- No transcript
- No user identifiers beyond IP hash
- Only: reason code, IP hash of target, IP hash of reporter, timestamp

### Logging

```json
{
  "event": "report",
  "reason": "harassment",
  "targetIpHashPrefix": "a1b2c3d4",
  "timestamp": 1760000000000
}
```

IP hash prefix (first 8 chars) for abuse investigation. No full hash, no raw IP.

## Test Plan (TDD)

### Unit Tests: `tests/unit/safety/reports.test.ts`

```
describe("ReportTracker")
  ✅ addReport records the report
  ✅ 1 report → shouldBan returns false
  ✅ 2 distinct reporters → shouldBan returns false
  ✅ 3 distinct reporters within 1h → shouldBan returns true
  ❌ same reporter 3 times → shouldBan returns false (not distinct)
  ✅ reports expire after 1h (fake clock)
  ✅ reports from different IPs counted correctly
```

### Integration Test: `tests/integration/report.test.ts`

```
describe("/report")
  ✅ A reports B → session ends, both get no-rematch
  ✅ 3 different users report B → B is banned from matching
  ✅ B tries to /start after ban → BANNED
  ❌ report with invalid reason → VALIDATION error
  ✅ report payload contains no message content
```

## Files to Create

| File | Action |
|---|---|
| `src/safety/reports.ts` | Create |
| `src/gateway/registerHandlers.ts` | Add session:report handler |
| `public/js/commands.js` | Add /report command with reason argument |
| `tests/unit/safety/reports.test.ts` | Create |
| `tests/integration/report.test.ts` | Create |

## Dependencies

- M3 US-02 (session manager)
- M2 US-22 (rate limiting — reports bucket: 3/h)
- `lib/ttlMap.ts` (for expiring reports)
