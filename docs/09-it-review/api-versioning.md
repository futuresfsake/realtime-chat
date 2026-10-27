# API Versioning Strategy — IT Manager Review

**Date:** 2026-10-27

---

## 1. Problem

The "API" for this system is the **WebSocket event protocol** between client and server. There is no REST API (except `/health`). When the event schema changes (new fields, renamed events, changed payload structure), clients running old code will break.

Unlike HTTP APIs where clients can target a version, WebSocket clients load fresh JavaScript on every page visit. But:
- A client may keep a tab open for hours across a deploy
- Two tabs opened minutes apart may run different code versions
- The E2EE envelope format is especially sensitive — a mismatch corrupts decryption

## 2. Current State

- **No versioning.** Events are `chat:send` and `chat:message` with no version field.
- The planned events (`session:start`, `e2e:key`, `e2e:envelope`) have no version prefix.
- A breaking change during a session would crash the client silently.

## 3. Versioning Scheme

### 3.1 Protocol Version

Add a protocol version string to the connection handshake:

```ts
// Client sends during Socket.IO handshake (auth option)
const socket = io({
  auth: {
    protocolVersion: "rc/v1",
    connectToken: "...",
  },
});

// Server validates during connection
io.use((socket, next) => {
  const { protocolVersion } = socket.handshake.auth;
  if (protocolVersion !== CURRENT_PROTOCOL_VERSION) {
    return next(new Error("PROTOCOL_MISMATCH"));
  }
  next();
});
```

### 3.2 Protocol Version Rules

| Type of Change | Version Bump | Example |
|---|---|---|
| New optional field in payload | No bump (backward compatible) | Add `timestamp` to envelope |
| New event type | No bump (unknown events ignored) | Add `session:typing_batch` |
| Changed field type or name | **Bump** | `ct` → `ciphertext` |
| Removed field | **Bump** | Remove `from` field |
| Changed encryption parameters | **Bump** | P-256 → X25519 |
| Changed HKDF info string | **Bump** | `rc/v1` → `rc/v2` in HKDF |

### 3.3 Version Format

`rc/v{major}` — e.g., `rc/v1`, `rc/v2`

- Only major versions (breaking changes)
- The `rc/v1` prefix is already used in the E2EE HKDF info strings — this aligns with it
- Increment on any breaking change to event payloads or crypto protocol

## 4. Deployment Strategy for Breaking Changes

### 4.1 Same-Version Deploy (Non-Breaking)

```
Deploy new server → clients continue working → new clients get new features
```

### 4.2 Cross-Version Deploy (Breaking)

```
1. Deploy server that accepts BOTH rc/v1 AND rc/v2
2. New clients connect with rc/v2 and get new behavior
3. Old clients (open tabs) continue with rc/v1
4. After 30 minutes (all old tabs have refreshed or disconnected):
5. Deploy server that only accepts rc/v2
6. Any remaining rc/v1 clients get PROTOCOL_MISMATCH and see "Please refresh"
```

### 4.3 Client Refresh Notification

When the server detects an outdated client:

```ts
// Server → Client
socket.emit("system:refresh", {
  reason: "A new version is available. Please refresh the page.",
  deadline: Date.now() + 300_000, // 5 minutes
});
```

Client shows a banner: "A new version is available. Your chat will continue, but please refresh when convenient."

After the deadline, force-disconnect with a clear message.

## 5. E2EE Version Coupling

The encryption protocol is tightly coupled to the event protocol:
- HKDF info strings contain `rc/v1`
- AAD contains `rc/v1`
- If the crypto protocol changes, the event protocol version MUST bump

This ensures two clients in the same session always use the same crypto parameters.

## 6. AsyncAPI Specification (Recommended)

Document the WebSocket protocol using [AsyncAPI](https://www.asyncapi.com/) (the WebSocket equivalent of OpenAPI):

```yaml
asyncapi: '3.0.0'
info:
  title: realtime-chat WebSocket API
  version: 'rc/v1'
  description: Anonymous E2EE chat protocol
channels:
  session:start:
    description: Request to find a stranger
    messages:
      sessionStart:
        payload:
          type: object
          properties:
            consent: { ... }
            interests: { ... }
            scope: { ... }
  e2e:envelope:
    description: Encrypted message relay
    messages:
      envelope:
        payload:
          type: object
          properties:
            seq: { type: integer, minimum: 1 }
            ct: { type: string, maxLength: 3000 }
```

This provides:
- Machine-readable protocol documentation
- Client code generation possibility
- Contract testing (validate events against schema)

## 7. Findings Summary

| ID | Severity | Finding | Milestone |
|---|---|---|---|
| AV-01 | MAJOR | No protocol versioning — breaking changes crash clients | M2 |
| AV-02 | MAJOR | No client refresh notification for outdated versions | M3 |
| AV-03 | MINOR | No AsyncAPI specification for protocol documentation | M7 |
| AV-04 | MINOR | No cross-version deployment strategy documented | M7 |
