# Specifications

**FR** = functional requirement · **NFR** = non-functional requirement. Each one is testable; "Verified by" says how.

## Functional requirements

### Sessions & identity
| ID | Requirement | Verified by | M |
|---|---|---|---|
| FR-01 | The server assigns each session participant a random name `adjective-animal-NN` from curated lists. Clients can't set names | Unit | M3 |
| FR-02 | A session has **exactly two** participants. The server rejects any event for a session the socket isn't part of | Integration | M3 |
| FR-03 | Session states per client: `READY → SEARCHING → CHATTING → ENDED`. Events not allowed in the current state are rejected with `INVALID_STATE` | Unit | M3 |
| FR-04 | `/next` ends the session for both sides and re-queues the requester; `/leave` ends it without re-queuing | Integration | M3 |
| FR-05 | When a participant disconnects for > 30 s (connection-state-recovery window), the session ends and the partner is notified | Integration | M3 |
| FR-06 | The server relays an `envelope` only to the sender's partner, and never stores or logs it | Integration + review | M3/M4 |
| FR-07 | The online count is broadcast at most every 5 s and contains only a number | Unit | M3 |
| FR-08 | Reactions: one of `👍 ❤️ 😂 😮 😢 🙏`, referencing a message sequence number | Unit | M3 |

### Privacy & encryption
| ID | Requirement | Verified by | M |
|---|---|---|---|
| FR-10 | Clients generate an ephemeral **ECDH P-256** key pair per session (WebCrypto, private key non-extractable) | Unit (browser) | M4 |
| FR-11 | Keys: shared secret → **HKDF-SHA-256** → two **AES-GCM-256** keys (one per direction) | Unit | M4 |
| FR-12 | Each envelope = `{ seq, ct }`. IV = 4-byte direction prefix + 8-byte `seq`; AAD = `sessionId|direction|seq` | Unit | M4 |
| FR-13 | Receivers reject envelopes with `seq` ≤ the last accepted `seq` (replay) or failed authentication (tampering), and end the session after 3 failures | Unit | M4 |
| FR-14 | No message can be sent before the key exchange completes. There is **no unencrypted fallback** | Integration | M4 |
| FR-15 | Safety code = SHA-256(sessionId ‖ sorted public keys); the first 20 bytes are split into four 5-byte chunks, each shown as (big-endian integer mod 100000), zero-padded → `48213 99307 17742 03621` | Unit | M4 |
| FR-16 | Chat history exists only in browser memory and is cleared when the session ends | Manual + unit | M3 |
| FR-17 | Plaintext is padded to a multiple of 64 bytes before encryption (hides the exact message length) | Unit | M4 |
| FR-18 | A peer public key that is invalid or equal to the client's own key is rejected | Unit | M4 |

### Matchmaking
| ID | Requirement | Verified by | M |
|---|---|---|---|
| FR-20 | Interests: 0–5 tags from the allowed list (`03-design/matchmaking.md`) | Unit | M5 |
| FR-21 | Country = ISO 3166-1 alpha-2 code from a server-side IP lookup; `XX` if unknown. The IP isn't stored | Unit | M5 |
| FR-22 | Scope `local` matches only the same (known) country; `world` matches anyone whose scope allows it | Unit (matrix) | M5 |
| FR-23 | Matching priority: most shared interests → longest waiting. After 10 s with no interest match → any compatible user | Unit (fake timers) | M5 |
| FR-24 | Never match a client with itself or with anyone on its no-rematch list | Unit | M5/M6 |

### Trust & safety
| ID | Requirement | Verified by | M |
|---|---|---|---|
| FR-30 | `/start` is refused until the client sends `consent: { adult: true, rulesVersion }` | Integration | M6 |
| FR-31 | A report ends the session and adds both sides to each other's no-rematch list for 24 h | Unit | M6 |
| FR-32 | 3 reports from distinct clients within 1 h → the reported IP hash is blocked from matching for 24 h | Unit | M6 |
| FR-33 | IP hash = HMAC-SHA-256(dailySalt, ip). The salt is random, held in memory, and rotates every 24 h | Unit | M6 |

### Platform
| ID | Requirement | Verified by | M |
|---|---|---|---|
| FR-40 | Every client→server event is validated with a zod `.strict()` schema; invalid → ack `{ ok:false, error:{ code } }` | Unit | M2 |
| FR-41 | `GET /health` → `200 {"status":"ok"}`, and `503` while shutting down; `Cache-Control: no-store` | Integration | M2 |
| FR-42 | Socket connections from origins outside `ALLOWED_ORIGINS` are refused | Integration | M2 |
| FR-43 | Theme choice persists per browser; invalid stored values fall back to the default | Manual | ✅ |

## Non-functional requirements
| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Latency | p95 relay time on the server < 50 ms; end-to-end p95 < 300 ms within Asia (excluding cold start) |
| NFR-02 | Capacity | ≥ 200 concurrent clients on one free instance (load-tested in M7) |
| NFR-03 | Payload | Max incoming Socket.IO message 4 KB (`maxHttpBufferSize`) |
| NFR-04 | Abuse | Messages: token bucket burst 5, refill 0.5/s. `/start` + `/next`: 10/min. ≤ 5 sockets per IP |
| NFR-05 | Privacy | No persistent storage of messages, names, interests, countries or raw IPs. Logs contain no content and no raw IPs |
| NFR-06 | Security | All user content rendered with `textContent`; CSP without `unsafe-inline`; HTTPS/WSS only in production |
| NFR-07 | Crypto | Only WebCrypto primitives; no custom crypto; keys never leave memory |
| NFR-08 | Availability | Best effort on the free tier; automatic recovery via health checks + client reconnect |
| NFR-09 | Cost | $0/month |
| NFR-10 | Global | Works on 3G-class networks: initial page < 100 KB (excluding the Socket.IO client); UI ≥ 360 px wide |
| NFR-11 | Accessibility | Keyboard-only usable; `aria-live` chat log; respects `prefers-reduced-motion`; contrast ≥ WCAG AA |
| NFR-12 | Compatibility | Latest 2 versions of Chrome, Edge, Firefox, Safari (WebCrypto ECDH/AES-GCM required) |
| NFR-13 | Maintainability | TypeScript `strict`; CI must pass to merge; ≥ 80% coverage on core modules |

## Limits (single source of truth in code: `src/config.ts`)
| Limit | Value |
|---|---|
| Message length | 1–500 characters (checked in the client before encryption; the server checks envelope size) |
| Envelope `ct` | ≤ 3,000 base64url characters |
| Interests | 0–5 from the allowed list |
| Interest-match wait | 10 s, then fallback |
| Reconnect window | 30 s |
| Typing timeout | 3 s |
| Report content | Reason code only, no transcript |
| No-rematch / ban duration | 24 h |
| Payload | 4 KB |
