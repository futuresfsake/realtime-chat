# TDD-M6-US20: Abusers Are Temporarily Blocked

**Milestone:** M6 Trust & Safety
**Story:** US-20 — 3 different users report the same client within 1h → blocked for 24h
**Features:** F-28 (temporary bans)
**Gaps:** None

## Acceptance Criteria

- 3 different users report same client within 1 hour → blocked from matching for 24h
- Block uses salted IP hash that rotates daily
- Raw IPs never stored

## Technical Design

### Ban Module (`src/safety/banList.ts`)

```ts
export class BanList {
  private bans = new TtlMap<string, BanRecord>();

  ban(ipHash: string, reason: string, clock: Clock): void {
    this.bans.set(ipHash, { reason, bannedAt: clock.now() }, 24 * 60 * 60 * 1000);
  }

  isBanned(ipHash: string): boolean {
    return this.bans.has(ipHash);
  }
}
```

### Ban Check Points

1. **Connection**: in `connectionGuards.ts`, before accepting a socket
2. **session:start**: in the handler, before enqueuing
3. **Matchmaker**: redundant check in `compatible()`

### Banned User Experience

The page still loads (they can read the rules). But:
- Socket connection is accepted (so they see the ban message)
- `session:start` returns `{ ok: false, error: { code: "BANNED" } }`
- Client shows: `You are temporarily blocked from matching. This expires in <time>.`
- No indication of who reported them or how many reports

### Automatic Ban Trigger

In `session:report` handler:
```ts
reportTracker.addReport(targetIpHash, reporterIpHash, reason, clock);
if (reportTracker.shouldBan(targetIpHash)) {
  banList.ban(targetIpHash, "auto:3_reports_1h", clock);
}
```

### Collateral Risk (CGNAT)

Mobile carriers share IPs. A ban could hit innocent users. Mitigations:
- Short duration (24h)
- Affects matching only (page still loads)
- Clear explanation shown to the user
- Salt rotation means the ban doesn't persist across days

## Test Plan (TDD)

### Unit Tests: `tests/unit/safety/banList.test.ts`

```
describe("BanList")
  ✅ ban(hash) → isBanned(hash) returns true
  ❌ isBanned(unbannedHash) returns false
  ✅ after 24h (fake clock) → isBanned returns false (expired)
  ✅ multiple bans tracked independently

describe("auto-ban trigger")
  ✅ 3 distinct reporters → ban triggered
  ❌ 2 distinct reporters → no ban
  ❌ same reporter 3 times → no ban
  ✅ reporters from outside 1h window don't count (expired)
```

### Integration Test: `tests/integration/ban.test.ts`

```
describe("temporary bans")
  ✅ 3 users report target → target gets BANNED on next session:start
  ✅ banned user can still load the page
  ✅ ban expires after 24h → can match again
```

## Files to Create

| File | Action |
|---|---|
| `src/safety/banList.ts` | Create |
| `src/gateway/connectionGuards.ts` | Add ban check |
| `src/gateway/registerHandlers.ts` | Add ban check in session:start |
| `tests/unit/safety/banList.test.ts` | Create |
| `tests/integration/ban.test.ts` | Create |

## Dependencies

- US-18 (report tracker triggers bans)
- M2 US-22 (IP hashing)
- `lib/ttlMap.ts`
