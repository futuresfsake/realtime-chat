# ADR-0007: End-to-end encryption with WebCrypto

- **Status:** Accepted · **Date:** 2026-10-08

## Context
Requirement: end-to-end encryption must be strictly implemented. Only the two participants may read messages.

## Options
| Option | Pros | Cons |
|---|---|---|
| **WebCrypto: ECDH P-256 + HKDF-SHA-256 + AES-GCM-256** | Built into every modern browser, audited, fast, no dependencies | We design the small protocol ourselves (mitigated: only standard building blocks) |
| WebCrypto with X25519 instead of P-256 | Modern curve | Shipped in Chrome only from v133 (2025); P-256 works everywhere today |
| libsodium.js | Excellent API | ~200 KB of JS to download (hurts slow networks); another supply-chain dependency |
| Signal protocol (Double Ratchet) | Gold standard; per-message forward secrecy | Complex; designed for long-lived chats; overkill for short sessions |
| TLS only | Free, already there | The server can read everything; not E2EE |

## Decision
WebCrypto with **ephemeral ECDH P-256** per session, **HKDF-SHA-256** to derive one **AES-GCM-256** key per direction, counter-based IVs, sequence numbers + AAD for replay protection, and a **safety code** for optional verification. Full protocol in [04-security/e2ee.md](../../04-security/e2ee.md).

## Consequences
- ✅ The server and logs never contain plaintext; forward secrecy per session (keys die with the session)
- ✅ Encryption runs in the users' browsers, so it adds no server CPU cost
- ⚠️ Web E2EE trusts the JavaScript the server delivers (documented, partially mitigated)
- ⚠️ No content moderation is possible; safety relies on reports and limits
- 🔁 Revisit X25519 when all target browsers support it; revisit re-keying if sessions get long
