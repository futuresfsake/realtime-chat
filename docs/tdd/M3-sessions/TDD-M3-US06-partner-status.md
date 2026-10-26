# TDD-M3-US06: See My Partner's Status

**Milestone:** M3 1:1 Anonymous Sessions
**Story:** US-06 — As a chatter, I want to see whether my stranger is still there
**Features:** F-14 (partner status)
**Gaps:** None

## Acceptance Criteria

- Sidebar shows `● connected`, `✎ typing…` or `○ left` within 1s of a change
- If partner's connection drops briefly, I see `reconnecting…`
- After 30s without recovery, the session ends

## Technical Design

### Partner Status Events

The server emits `partner:status` to the remaining client whenever the partner's connection state changes:

```ts
type PartnerState = "connected" | "reconnecting" | "typing" | "idle" | "left";
// Server → Client: partner:status { state: PartnerState }
```

### Connection State Tracking

Socket.IO fires `disconnect` when a socket drops. With connection state recovery enabled (30s window):

```ts
io.on("connection", (socket) => {
  if (socket.recovered) {
    // Client reconnected within 30s — session continues
    const client = sessionManager.getClient(socket.id);
    if (client?.sessionId) {
      const partner = sessionManager.getPartner(socket.id);
      if (partner) io.to(partner).emit("partner:status", { state: "connected" });
    }
  }
});

socket.on("disconnect", () => {
  const client = sessionManager.getClient(socket.id);
  if (client?.sessionId) {
    const partner = sessionManager.getPartner(socket.id);
    if (partner) io.to(partner).emit("partner:status", { state: "reconnecting" });
    // Start 30s timeout
    setTimeout(() => {
      if (!sessionManager.getClient(socket.id)) {
        sessionManager.endSession(client.sessionId!, "partner_timeout");
      }
    }, 30_000);
  }
});
```

### Client-Side UI

The sidebar (or status bar) updates on `partner:status` events:
- `connected` → `● <name> connected` (green)
- `typing` → `✎ <name> is typing…`
- `reconnecting` → `⟳ reconnecting…` (yellow)
- `idle` → `● <name> connected` (green, typing stopped)
- `left` → `○ stranger left` (grey)

## Test Plan (TDD)

### Unit Tests: `tests/unit/sessions/sessionManager.test.ts` (extend)

```
describe("partner status")
  ✅ partner disconnect → partner:status "reconnecting" sent
  ✅ partner reconnects within 30s → partner:status "connected" sent
  ❌ partner doesn't reconnect within 30s → session ends, "left" sent
  ✅ normal session end → "left" sent
```

### Integration Test: `tests/integration/status.test.ts`

```
describe("partner status")
  ✅ B disconnects → A receives partner:status "reconnecting"
  ✅ B reconnects → A receives partner:status "connected"
  ✅ B gone > 30s → A receives session:ended
```

## Files to Create/Modify

| File | Action |
|---|---|
| `src/sessions/sessionManager.ts` | Add connection tracking |
| `src/app.ts` | Add disconnect/reconnect handlers |
| `public/js/render.js` | Create (or extend client.js) — status UI |
| `tests/unit/sessions/sessionManager.test.ts` | Extend |
| `tests/integration/status.test.ts` | Create |

## Dependencies

- US-02 (session manager)
- Socket.IO connection state recovery (`connectionStateRecovery` option)
