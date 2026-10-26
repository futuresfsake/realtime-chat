# TDD-M5-US16: Fall Back to a Random Stranger

**Milestone:** M5 Matchmaking
**Story:** US-16 — No interest match within 10s → matched with any compatible stranger
**Features:** F-24 (10s fallback timer)
**Gaps:** G-07 (D-04 — assumed: 10s, configurable)

## Acceptance Criteria

- No interest match within 10s → matched with any compatible stranger
- Message: `no shared interests found - connected to a random stranger`

## Technical Design

### Fallback Timer

From `docs/03-design/matchmaking.md` §4:

```ts
// In Matchmaker.enqueue():
if (interests.length > 0 && !immediateMatch) {
  // Schedule fallback after 10s
  const timer = clock.setTimeout(() => {
    this.tryOpenMatch(entry);
  }, config.interestMatchTimeoutMs); // default 10000
  this.timers.set(socketId, timer);
}

// If interests are empty, go directly to open pool
if (interests.length === 0) {
  this.tryOpenMatch(entry);
}
```

### Open Pool

Users who:
1. Have no interests, OR
2. Waited 10s without an interest match

...enter the **open pool**, ordered by wait time (longest first for fairness):

```ts
tryOpenMatch(entry: WaitingEntry): void {
  for (const [id, candidate] of this.openPool) {
    if (compatible(entry, candidate, this.noRematch)) {
      this.pair(entry, candidate, []);  // no shared interests
      return;
    }
  }
  // No match → add to open pool
  this.openPool.set(entry.id, entry);
}
```

### Client-Side UI

When matched with no shared interests:
```
*** no shared interests found - connected to a random stranger
```

When matched with shared interests:
```
*** connected to quiet-otter-42 (shared: gaming, music)
```

### Configurable Timeout

Via `config.ts`:
```ts
interestMatchTimeoutMs: z.number().default(10_000),
```

Tests use a shorter timeout via fake clock.

## Test Plan (TDD)

### Unit Tests: `tests/unit/matchmaking/matchmaker.test.ts` (extend)

```
describe("fallback")
  ✅ fallback fires at exactly 10s (fake clock)
  ✅ after fallback, user enters open pool
  ✅ two users in open pool → matched (compatibility permitting)
  ✅ fallback match reports sharedInterests: []
  ✅ cancelled on /leave (timer doesn't fire)
  ✅ cancelled on interest match (timer cleared)
  ✅ 0 interests → immediate open pool entry (no 10s wait)
  ✅ only one person online → stays in open pool, UI shows "searching..."
```

## Files to Modify

| File | Action |
|---|---|
| `src/matchmaking/matchmaker.ts` | Add fallback timer and open pool logic |
| `src/config.ts` | Add interestMatchTimeoutMs |
| `tests/unit/matchmaking/matchmaker.test.ts` | Extend with fallback tests |

## Dependencies

- US-14 (interest matching)
- US-15 (compatibility for open pool)
- `lib/clock.ts` (fake clock for testing timers)
