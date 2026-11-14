# TDD-M3-US07: See When the Stranger Is Typing

**Milestone:** M3 1:1 Anonymous Sessions
**Story:** US-07 — When my partner types, I see `<name> is typing…`
**Features:** F-18 (typing indicator)
**Gaps:** G-11 (D-08 — plaintext vs encrypted typing signal, assumed plaintext)

## Acceptance Criteria

- When my partner types, I see `<name> is typing…`
- It disappears 3s after they stop, or as soon as their message arrives

## Technical Design

### Typing Event (plaintext signal, per D-08 recommendation)

The typing indicator carries no message content — just a boolean:

```ts
// Client → Server
socket.emit("typing", { isTyping: true });   // started typing
socket.emit("typing", { isTyping: false });  // stopped typing

// Server relays to partner (unchanged)
// Server → Partner: partner:status { state: "typing" | "idle" }
```

### Server-Side Handling

```ts
socket.on("typing", withHandler(TypingSchema, typingLimiter, (data) => {
  const partner = sessionManager.getPartner(socket.id);
  if (!partner) return;
  io.to(partner).emit("partner:status", {
    state: data.isTyping ? "typing" : "idle",
  });
}));
```

Rate limited: typing bucket (capacity 10, refill 2/s) to prevent abuse.

### Client-Side Logic

```js
// Send typing signal on input (debounced)
let typingTimeout;
inputEl.addEventListener("input", () => {
  socket.emit("typing", { isTyping: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit("typing", { isTyping: false }), 3000);
});

// On message send, clear typing
function sendMessage() {
  socket.emit("typing", { isTyping: false });
  clearTimeout(typingTimeout);
  // ... send message
}

// On receiving partner's message, clear their typing indicator
socket.on("chat:message", () => {
  updateTypingIndicator(false);
});
```

### 3-Second Timeout

If the partner stops typing but doesn't send the `isTyping: false` signal (e.g., switched tabs), the client-side indicator auto-clears after 3 seconds using a local timer reset on each `typing` event.

## Test Plan (TDD)

### Unit Tests: `tests/unit/gateway/typing.test.ts`

```
describe("typing handler")
  ✅ typing { isTyping: true } → partner receives partner:status "typing"
  ✅ typing { isTyping: false } → partner receives partner:status "idle"
  ❌ typing when not in session → no crash, no event sent
  ✅ rate limited: 11th typing event in burst → RATE_LIMITED
```

### Integration Test: (part of `tests/integration/status.test.ts`)

```
describe("typing indicator")
  ✅ A sends typing:true → B receives partner:status "typing"
  ✅ A sends typing:false → B receives partner:status "idle"
  ✅ A sends message → typing indicator implicitly clears
```

## Files to Create/Modify

| File | Action |
|---|---|
| `src/gateway/registerHandlers.ts` | Add typing handler |
| `public/js/main.js` (or client.js) | Add typing send/receive logic |
| `tests/unit/gateway/typing.test.ts` | Create |
| `tests/integration/status.test.ts` | Extend |

## Dependencies

- US-06 (partner:status event already exists)
- M2 US-22 (typing rate limit bucket)
