# TDD-M3-US11: Survive Short Network Drops

**Milestone:** M3 1:1 Anonymous Sessions
**Story:** US-11 — As a chatter on a mobile network, brief disconnects don't end my chat
**Features:** F-05 (connection state recovery, extended)
**Gaps:** None

## Acceptance Criteria

- Connection drops for < 30s → session continues, missed messages delivered
- Connection drops for > 30s → session ends for both sides

## Technical Design

### Socket.IO Connection State Recovery

Enable in the server:

```ts
const io = new Server(httpServer, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 30_000,  // 30 seconds
    skipMiddlewares: true,
  },
});
```

When a client reconnects within 30s:
- `socket.recovered === true`
- The same `socket.id` is restored
- Missed events are delivered automatically by Socket.IO

### Server-Side Timeout

When a socket disconnects:

```ts
socket.on("disconnect", () => {
  const client = sessionManager.getClient(socket.id);
  if (!client?.sessionId) {
    sessionManager.removeClient(socket.id);
    return;
  }

  // Notify partner
  const partner = sessionManager.getPartner(socket.id);
  if (partner) io.to(partner).emit("partner:status", { state: "reconnecting" });

  // Start 30s recovery window
  const timer = setTimeout(() => {
    if (!io.sockets.sockets.has(socket.id)) {
      sessionManager.endSession(client.sessionId!, "partner_timeout");
      if (partner) io.to(partner).emit("session:ended", { reason: "partner_timeout" });
    }
  }, 30_000);

  // Cancel if they come back
  socket.once("connect", () => clearTimeout(timer));
});
```

### Client-Side Reconnection

Socket.IO auto-reconnects with exponential backoff. The client shows:
- `⟳ reconnecting…` during the attempt
- `● connected` on success
- Session history is preserved in browser memory (it was never cleared)

### What Happens to In-Flight Messages

Messages sent during disconnect are:
- **From the disconnected client:** queued by Socket.IO and delivered on reconnect
- **From the partner:** queued by Socket.IO connection state recovery and delivered on reconnect

## Test Plan (TDD)

### Unit Tests: `tests/unit/sessions/recovery.test.ts`

```
describe("connection recovery")
  ✅ disconnect + reconnect within 30s → session continues
  ❌ disconnect + no reconnect after 30s → session ends
  ✅ partner notified of "reconnecting" on disconnect
  ✅ partner notified of "connected" on reconnect
  ✅ timer cancelled if client reconnects
```

### Integration Test: `tests/integration/recovery.test.ts`

```
describe("network drop recovery")
  ✅ B disconnects briefly → B reconnects → session still active
  ✅ B disconnects, A sends message → B reconnects → B receives missed message
  ❌ B disconnects for > 30s → A receives session:ended "partner_timeout"
```

## Files to Create/Modify

| File | Action |
|---|---|
| `src/app.ts` | Add connectionStateRecovery config |
| `src/sessions/sessionManager.ts` | Add disconnect/reconnect handling with 30s timeout |
| `tests/unit/sessions/recovery.test.ts` | Create |
| `tests/integration/recovery.test.ts` | Create |

## Dependencies

- US-02 (session manager)
- US-06 (partner status events)
- Socket.IO v4.6+ (connection state recovery)
