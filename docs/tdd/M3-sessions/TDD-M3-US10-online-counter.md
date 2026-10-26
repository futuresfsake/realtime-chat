# TDD-M3-US10: See How Many People Are Online

**Milestone:** M3 1:1 Anonymous Sessions
**Story:** US-10 — The top bar shows `N online`
**Features:** F-15 (global online counter)
**Gaps:** G-09 (D-06 — confirmed: yes, show counter)

## Acceptance Criteria

- Top bar shows `N online`, updated at most every 5s
- No names, no locations — just the count

## Technical Design

### Server-Side Counter

```ts
// In sessionManager or a dedicated module
function getOnlineCount(): number {
  return io.engine.clientsCount;
  // Or: clients.size (from the session manager's client map)
}

// Broadcast every 5 seconds
setInterval(() => {
  io.emit("stats:online", { count: getOnlineCount() });
}, 5000);
```

The interval uses a fixed 5s timer. The count is an aggregate — no individual client information is revealed.

### Client-Side Display

```js
socket.on("stats:online", ({ count }) => {
  onlineCountEl.textContent = `${count} online`;
});
```

Displayed in the top bar alongside connection status.

### Privacy

- The count reveals only that N sockets are connected
- No breakdown by country, interest, or state
- No way to correlate count changes with specific users

## Test Plan (TDD)

### Unit Tests: `tests/unit/sessions/onlineCount.test.ts`

```
describe("online counter")
  ✅ returns 0 when no clients connected
  ✅ returns N after N clients connect
  ✅ decrements when a client disconnects
  ✅ count is a non-negative integer
```

### Integration Test

```
describe("stats:online broadcast")
  ✅ client receives stats:online within 5s of connecting
  ✅ count includes all connected clients
  ✅ count updates when clients join/leave
```

## Files to Create/Modify

| File | Action |
|---|---|
| `src/sessions/sessionManager.ts` | Add getOnlineCount() |
| `src/app.ts` | Add 5s broadcast interval |
| `public/js/main.js` | Handle stats:online, update UI |
| `tests/unit/sessions/onlineCount.test.ts` | Create |

## Dependencies

- US-02 (client tracking in session manager)
