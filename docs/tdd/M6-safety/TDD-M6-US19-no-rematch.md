# TDD-M6-US19: Never Meet the Same Person Again

**Milestone:** M6 Trust & Safety
**Story:** US-19 — Strangers I skipped or reported aren't matched with me again for 24h
**Features:** F-27 (no-rematch list)
**Gaps:** None

## Acceptance Criteria

- Skipped or reported strangers not matched again for 24h
- Uses the same daily-salted IP hash as bans (no extra identifier created)

## Technical Design

### No-Rematch Module (`src/safety/noRematch.ts`)

```ts
export class NoRematchList {
  private pairs = new TtlMap<string, true>();  // "hashA:hashB" → true, 24h TTL

  add(ipHashA: string, ipHashB: string): void {
    const key = [ipHashA, ipHashB].sort().join(":");
    this.pairs.set(key, true, 24 * 60 * 60 * 1000);
  }

  has(ipHashA: string, ipHashB: string): boolean {
    const key = [ipHashA, ipHashB].sort().join(":");
    return this.pairs.has(key);
  }
}
```

The key is sorted so `(A,B)` and `(B,A)` produce the same entry.

### When Pairs Are Added

1. `/next` (skip) → add both IP hashes to no-rematch
2. `/report` → add both IP hashes to no-rematch
3. Session timeout → add both (the dropped user might reconnect)

### Integration with Matchmaker

The `compatible()` function in `matchmaking/compatibility.ts` checks:
```ts
!noRematch.has(a.ipHash, b.ipHash)
```

### Privacy

- Uses the same daily-salted IP hash already computed for rate limiting
- No new identifier created
- Pairs expire after 24h and become unlinkable after salt rotation
- Collateral: users behind the same IP (CGNAT) share the no-rematch list

## Test Plan (TDD)

### Unit Tests: `tests/unit/safety/noRematch.test.ts`

```
describe("NoRematchList")
  ✅ add(A, B) → has(A, B) returns true
  ✅ add(A, B) → has(B, A) returns true (symmetric)
  ❌ has(A, C) returns false (not added)
  ✅ after 24h (fake clock) → has(A, B) returns false (expired)
  ✅ different pairs tracked independently
```

### Integration Test: (extend `tests/integration/pairing.test.ts`)

```
describe("no-rematch")
  ✅ A skips B → A starts searching → not re-matched with B
  ✅ A reports B → neither matched with the other
```

## Files to Create

| File | Action |
|---|---|
| `src/safety/noRematch.ts` | Create |
| `src/matchmaking/compatibility.ts` | Extend with no-rematch check |
| `src/sessions/sessionManager.ts` | Add no-rematch on skip/report/timeout |
| `tests/unit/safety/noRematch.test.ts` | Create |

## Dependencies

- M2 US-22 (`ipHash.ts`)
- M5 US-14 (matchmaker compatibility)
- `lib/ttlMap.ts`
