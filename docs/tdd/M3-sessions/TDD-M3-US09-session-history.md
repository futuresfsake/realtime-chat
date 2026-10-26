# TDD-M3-US09: History Only While in the Session

**Milestone:** M3 1:1 Anonymous Sessions
**Story:** US-09 — As a chatter, messages exist only during the chat
**Features:** F-17 (session-only history)
**Gaps:** None

## Acceptance Criteria

- Messages held only in browser memory (not localStorage, not cookies, not the server)
- When session ends (`/next`, `/leave`, partner left, tab close/refresh), history is wiped and can't be recovered
- The server never stores messages

## Technical Design

### Client-Side History

```js
// In-memory array, max 500 entries
let history = [];
const MAX_HISTORY = 500;

function addToHistory(entry) {
  history.push(entry);
  if (history.length > MAX_HISTORY) history.shift();
}

function clearHistory() {
  history = [];
  // Also clear the DOM
  chatLog.innerHTML = "";
}
```

History is cleared on:
- `session:ended` event received
- `/next` command sent
- `/leave` command sent
- Page refresh/close (memory is inherently lost)

### Server-Side Guarantee

The server relay function processes envelopes in a fire-and-forget pattern:
```ts
// relay to partner, then forget
io.to(partnerId).emit("e2e:envelope", envelope);
// envelope is NOT stored anywhere
```

No `Map`, no `Array`, no log ever holds a message or envelope beyond the relay call.

### What IS NOT Used

- `localStorage` — never for messages (only for theme preference)
- `sessionStorage` — only for age/rules consent flag
- Cookies — not used at all
- IndexedDB — not used
- Server disk/database — does not exist

## Test Plan (TDD)

### Unit Tests: `tests/unit/client/history.test.ts`

```
describe("session history")
  ✅ addToHistory stores messages in memory
  ✅ clearHistory empties the array
  ✅ max 500 entries (oldest dropped)
  ✅ after clearHistory, history.length === 0
```

### Integration Test (server-side)

```
describe("no server storage")
  ✅ server relay function has no reference to message content after relay
  ✅ grep: no Array/Map/Set stores messages or envelopes on the server
  ✅ grep: no localStorage.setItem with message content in client code
```

### Manual Verification

- Open session, send messages, refresh page → history gone
- Open session, `/next` → previous chat history cleared

## Files to Create/Modify

| File | Action |
|---|---|
| `public/js/state.js` | Create — client state with history management |
| `public/js/render.js` | Create — DOM rendering with clearHistory |
| `src/app.ts` | Verify — no message storage |

## Dependencies

- US-02 (session lifecycle events trigger history clear)
