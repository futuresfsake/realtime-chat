# ADR-0011: WebSocket-only transport (no long-polling fallback)

- **Status:** Accepted · **Date:** 2026-11-11

## Context
US-23 requires that a socket opened from another website is refused, and the deployment checklist requires rejecting a missing or `null` Origin. Socket.IO starts with HTTP long-polling by default and upgrades to WebSocket afterwards. Browsers do **not** send an `Origin` header on a same-origin `GET`, so the first polling request from our own page arrives without one. A strict Origin check would refuse our own users; a lenient one ("allow when missing") lets any non-browser script through.

## Options
| Option | Pros | Cons |
|---|---|---|
| Polling + WebSocket, allow a missing Origin | Works behind proxies that block WebSockets | The Origin check is no longer strict; polling also needs sticky sessions once there is more than one instance |
| **WebSocket only, strict Origin** | Browsers always send `Origin` on a WebSocket handshake, so the check is exact; no sticky sessions needed later; one code path to test | Users on a network that blocks WebSockets cannot connect |
| Polling only | Works everywhere | Slow, more requests, same Origin problem |

## Decision
Server and client both set `transports: ["websocket"]`. The Origin allowlist is enforced in `allowRequest`, before the connection is accepted, and a missing or `null` Origin is refused.

## Consequences
- ✅ Origin check is exact (T-04, cross-site WebSocket hijacking)
- ✅ Simpler scaling later: no sticky sessions for polling
- ⚠️ Networks that block WebSockets are not supported. The page shows the connection as offline and keeps retrying
- ⚠️ Origin is a browser control only. Scripts can forge it, which is why the handshake also needs a connection token (US-32) and is rate limited
