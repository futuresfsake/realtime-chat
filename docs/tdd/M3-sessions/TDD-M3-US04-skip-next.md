# TDD-M3-US04: Skip to the Next Stranger

**Milestone:** M3 1:1 Anonymous Sessions
**Story:** US-04 — As a chatter, I want to end this chat and meet someone new
**Features:** F-16 (`/next`)
**Gaps:** None

## Acceptance Criteria

- Given I'm CHATTING, when I type `/next`, my partner sees `*** stranger left`, my screen clears, and I start SEARCHING
- `/next` is limited to 10 per minute

## Technical Design

### `/next` Flow

1. Client sends `session:next {}`
2. Gateway validates → checks state is CHATTING or SEARCHING or ENDED
3. Session manager ends the current session:
   - Partner receives `session:ended { reason: "partner_left" }`
   - Both clients' history is wiped (client-side)
   - Session removed from the map
4. Requester's state → SEARCHING
5. Requester is re-enqueued in the matchmaker

### Rate Limiting

`/next` shares the `start/next` rate limit bucket (per IP hash):
- Capacity: 10
- Refill: 10/min (0.167/s)

This prevents rapid scanning (repeatedly skipping to find a specific person or type of person — T-18).

### State Transitions

```
CHATTING → /next → end session → SEARCHING → matched → CHATTING
SEARCHING → /next → cancel search → SEARCHING (re-enqueue)
ENDED → /next → SEARCHING
```

## Test Plan (TDD)

### Unit Tests: `tests/unit/sessions/sessionManager.test.ts` (extend)

```
describe("/next")
  ✅ CHATTING client sends /next → session ended, state → SEARCHING
  ✅ partner receives session:ended with reason "partner_left"
  ✅ SEARCHING client sends /next → removed from queue, re-enqueued
  ✅ ENDED client sends /next → state → SEARCHING
  ❌ READY client sends /next → INVALID_STATE
  ✅ rate limit: 11th /next in a minute → RATE_LIMITED
```

### Integration Test: `tests/integration/skip.test.ts`

```
describe("/next flow")
  ✅ A and B chatting → A sends /next → B receives session:ended
  ✅ A is immediately searching again
  ✅ C is waiting → A and C get paired
```

## Files to Modify

| File | Action |
|---|---|
| `src/sessions/sessionManager.ts` | Add next() method |
| `src/gateway/registerHandlers.ts` | Register session:next handler |
| `tests/unit/sessions/sessionManager.test.ts` | Extend |
| `tests/integration/skip.test.ts` | Create |

## Dependencies

- US-02, US-03 (session manager)
- M2 US-22 (rate limiting)
