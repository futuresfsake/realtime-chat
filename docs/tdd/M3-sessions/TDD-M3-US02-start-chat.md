# TDD-M3-US02: Start a Chat With a Stranger

**Milestone:** M3 1:1 Anonymous Sessions
**Story:** US-02 — As a chatter, I want to be connected to one stranger
**Features:** F-01 (relay, now 1:1), F-13 (session manager)
**Gaps:** None

## Acceptance Criteria

- Given I'm READY, when I type `/start`, I see `searching...` and, once matched, `connected to <name>`
- Only my partner receives my messages

## Technical Design

### Session Manager (`src/sessions/sessionManager.ts`)

Core state machine per client: `READY → SEARCHING → CHATTING → ENDED`

```ts
export class SessionManager {
  private clients = new Map<string, ClientState>();
  private sessions = new Map<string, Session>();

  registerClient(socketId: string, ipHash: string, country: string): void;
  startSearching(socketId: string): void;
  createSession(socketIdA: string, socketIdB: string, sharedInterests: string[]): Session;
  getPartner(socketId: string): string | null;
  endSession(sessionId: string, reason: EndReason): void;
  getClientState(socketId: string): ClientState | undefined;
  removeClient(socketId: string): void;
}
```

### Event Flow

1. Client sends `session:start` with consent
2. Gateway validates (zod) → checks state is READY
3. Session manager sets client to SEARCHING
4. Matchmaker enqueues the client (see M5; in M3, basic random pairing)
5. When two SEARCHING clients exist → `createSession(A, B)`
6. Both receive `session:matched { sessionId, myName, partnerName, sharedInterests, role }`

### M3 Basic Pairing (before M5 matchmaking)

In M3, the matchmaker is simplified: first two SEARCHING clients get paired. No interests, no country filter. This is replaced in M5.

```ts
export class SimpleMatchmaker {
  private waiting: string | null = null;

  enqueue(socketId: string, sessionManager: SessionManager): void {
    if (this.waiting && this.waiting !== socketId) {
      sessionManager.createSession(this.waiting, socketId, []);
      this.waiting = null;
    } else {
      this.waiting = socketId;
    }
  }

  remove(socketId: string): void {
    if (this.waiting === socketId) this.waiting = null;
  }
}
```

### Message Relay (1:1 only)

Replace the current `io.emit()` broadcast with targeted relay:

```ts
socket.on("chat:send", withHandler(ChatSendSchema, messageLimiter, (data) => {
  const partner = sessionManager.getPartner(socket.id);
  if (!partner) return ack({ ok: false, error: { code: "NOT_IN_SESSION" } });
  io.to(partner).emit("chat:message", { /* ... */ });
}));
```

## Test Plan (TDD)

### Unit Tests: `tests/unit/sessions/sessionManager.test.ts`

```
describe("SessionManager")
  describe("registerClient")
    ✅ new client starts in READY state
    ✅ registers ipHash and country

  describe("createSession")
    ✅ both clients move to CHATTING state
    ✅ session has exactly 2 participants
    ✅ both get assigned random names
    ✅ sessionId is a valid UUID

  describe("getPartner")
    ✅ returns the other participant's socketId
    ❌ returns null if not in a session

  describe("endSession")
    ✅ both clients move to ENDED state
    ✅ session is removed from the map
```

### Integration Test: `tests/integration/pairing.test.ts`

```
describe("1:1 pairing")
  ✅ A and B both /start → both receive session:matched
  ✅ A sends message → only B receives it (not C)
  ✅ C starts → C is searching (not paired with A or B)
  ❌ A sends message to C's session → NOT_IN_SESSION
```

## Files to Create/Modify

| File | Action |
|---|---|
| `src/sessions/sessionManager.ts` | Create |
| `src/matchmaking/simpleMatchmaker.ts` | Create (replaced by full matchmaker in M5) |
| `src/app.ts` | Modify — replace broadcast with 1:1 relay |
| `src/gateway/registerHandlers.ts` | Create |
| `tests/unit/sessions/sessionManager.test.ts` | Create |
| `tests/integration/pairing.test.ts` | Create |

## Dependencies

- Depends on M2 (validation, handler wrapper)
- US-01 (nameGenerator)
