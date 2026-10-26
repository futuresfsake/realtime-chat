# TDD-M3-US05: Leave Without Searching Again

**Milestone:** M3 1:1 Anonymous Sessions
**Story:** US-05 — As a chatter, I want to stop chatting completely
**Features:** F-16 (`/leave`)
**Gaps:** None

## Acceptance Criteria

- When I type `/leave`, the session ends and I return to READY
- No new search starts

## Technical Design

### `/leave` Flow

1. Client sends `session:leave {}`
2. Gateway validates → checks state is CHATTING, SEARCHING, or ENDED
3. If CHATTING: session ends, partner receives `session:ended { reason: "partner_left" }`
4. If SEARCHING: removed from matchmaker queue
5. Requester's state → READY (not SEARCHING — that's the difference from `/next`)

### `/leave` vs `/next`

| | `/next` | `/leave` |
|---|---|---|
| Ends session | Yes | Yes |
| Partner notified | Yes | Yes |
| After | SEARCHING (re-enqueue) | READY (idle) |
| Rate limited | Yes (start/next bucket) | No (idempotent, no abuse vector) |

## Test Plan (TDD)

### Unit Tests: `tests/unit/sessions/sessionManager.test.ts` (extend)

```
describe("/leave")
  ✅ CHATTING → /leave → state READY, session ended
  ✅ SEARCHING → /leave → state READY, removed from queue
  ✅ ENDED → /leave → state READY
  ❌ READY → /leave → INVALID_STATE (already idle)
  ✅ partner receives session:ended
  ✅ NOT re-enqueued in matchmaker
```

## Files to Modify

| File | Action |
|---|---|
| `src/sessions/sessionManager.ts` | Add leave() method |
| `src/gateway/registerHandlers.ts` | Register session:leave handler |
| `tests/unit/sessions/sessionManager.test.ts` | Extend |

## Dependencies

- US-02, US-04 (session manager with next already)
