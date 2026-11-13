# TDD-M3-US03: Exactly Two People Per Chat

**Milestone:** M3 1:1 Anonymous Sessions
**Story:** US-03 — As a chatter, my chat is strictly between me and one stranger
**Features:** F-13 (session manager)
**Gaps:** None

## Acceptance Criteria

- A session always has exactly 2 sockets
- A third client can never join, even by sending a fake session id
- When one side leaves, the session is closed for good (can't be re-joined)

## Technical Design

### Session Integrity Checks

Every event handler that operates on a session checks:

```ts
function validateSessionMembership(socketId: string, sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  return session.a === socketId || session.b === socketId;
}
```

From LLD §3: relay check is O(1):
```
clients.get(sender).sessionId === payload's session
→ partner = session.a === sender ? session.b : session.a
→ io.to(partner).emit(...)
```

### Session Closure

When either side leaves (disconnect, `/next`, `/leave`, `/report`):
1. Session is removed from the `sessions` map immediately
2. Both clients' state moves to ENDED
3. The remaining partner receives `session:ended { reason }`
4. The session ID is invalidated — any further events with that ID return `NOT_IN_SESSION`

No rejoin mechanism exists. A new `/start` creates a new session with new keys and new names.

### Forged Session ID Protection

The session ID is a `crypto.randomUUID()` (128-bit random). Even if an attacker guesses a valid session ID, the `validateSessionMembership` check rejects them because their socket ID isn't `session.a` or `session.b`.

## Test Plan (TDD)

### Unit Tests: `tests/unit/sessions/sessionManager.test.ts` (extend)

```
describe("session integrity")
  ❌ third socket sending to a session it's not in → NOT_IN_SESSION
  ❌ forged session ID (random UUID) → NOT_IN_SESSION
  ✅ session has exactly 2 participants (a and b)
  ❌ after session ends, any event with that sessionId → NOT_IN_SESSION
  ❌ can't re-join an ended session
```

### Integration Test: `tests/integration/isolation.test.ts`

```
describe("session isolation")
  ✅ A and B paired; C sends envelope with A+B's sessionId → NOT_IN_SESSION
  ✅ A's message reaches B only, never C
  ✅ after A leaves, B receives session:ended
  ❌ B sends message after session ended → NOT_IN_SESSION
```

## Files to Modify

| File | Action |
|---|---|
| `src/sessions/sessionManager.ts` | Extend with validation checks |
| `tests/unit/sessions/sessionManager.test.ts` | Add integrity tests |
| `tests/integration/isolation.test.ts` | Create |

## Dependencies

- US-02 (session manager must exist)

## Threat Mitigations

- T-13 (forged session ID): membership check on every event
