# Specifications

**FR** = functional requirement (what it does). **NFR** = non-functional requirement (how well it does it).
Each requirement is testable. The "Verified by" column says how.

## Functional requirements

| ID | Requirement | Verified by | Status |
|---|---|---|---|
| FR-01 | The server broadcasts a valid message to all clients in the sender's room | Integration test | ✅ (global room) |
| FR-02 | The server assigns `id` (UUID v4) and `sentAt` (epoch ms, UTC) to every message | Unit test | ✅ |
| FR-03 | Messages are trimmed; empty or > 500 chars are rejected | Unit test | ✅ basic / 🔜 zod |
| FR-04 | Username: 2–20 chars, `^[A-Za-z0-9_-]+$`, unique per room (case-insensitive) | Unit test | 🔜 |
| FR-05 | Room name: 1–30 chars, `^[a-z0-9-]+$`; default `general` | Unit test | 🔜 |
| FR-06 | Online list updates on join / leave / disconnect | Integration test | 🔜 |
| FR-07 | Typing indicator auto-expires 3 s after the last keystroke | Unit test (fake timers) | 🔜 |
| FR-08 | On join, the client receives up to the last 50 messages of that room | Repository test | 🔜 |
| FR-09 | Invalid events get an error ack `{ ok: false, error: { code, message } }` | Unit test | 🔜 |
| FR-10 | `GET /health` returns `200 {"status":"ok"}` | Integration test | ✅ |
| FR-11 | The theme choice persists per browser; invalid stored values fall back to `phosphor` | Manual / browser test | ✅ |

## Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | p95 message delivery < 200 ms for users in the same region (excluding cold start) |
| NFR-02 | Performance | Client keeps at most 500 lines in the DOM |
| NFR-03 | Capacity | Handles 50 concurrent sockets on a free instance (512 MB RAM) |
| NFR-04 | Security | Max incoming payload 1 KB (`maxHttpBufferSize`) |
| NFR-05 | Security | Rate limit: burst 5 msgs, refill 1 msg / 2 s per socket; max 5 sockets per IP |
| NFR-06 | Security | User content is only ever rendered via `textContent` |
| NFR-07 | Security | SQL only via prepared statements |
| NFR-08 | Security | Only allowed Origins can open a socket |
| NFR-09 | Availability | Best effort (free tier). Auto-recovery via client reconnect + health check |
| NFR-10 | Cost | $0 / month |
| NFR-11 | Privacy | No emails/passwords collected; logs don't contain message text |
| NFR-12 | Maintainability | `strict` TypeScript; CI green required to merge |
| NFR-13 | Accessibility | Keyboard-usable; `aria-live` log; respects `prefers-reduced-motion` |
| NFR-14 | Compatibility | Latest 2 versions of Chrome, Edge, Firefox, Safari; mobile ≥ 360 px wide |

## Limits (single source of truth: `src/config.ts`, planned)

| Limit | Value |
|---|---|
| Message length | 1–500 chars |
| Username length | 2–20 chars |
| Room name length | 1–30 chars |
| History on join | 50 messages |
| Payload size | 1 KB |
| Rate limit | burst 5, refill 0.5 / s |
| Typing timeout | 3 s |
