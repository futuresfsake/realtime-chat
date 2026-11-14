# TDD-M4-US12: Messages Are End-to-End Encrypted

**Milestone:** M4 End-to-End Encryption
**Story:** US-12 — As a chatter, only my stranger can read my messages
**Features:** F-20 (ECDH P-256 + HKDF + AES-GCM-256)
**Gaps:** None — full protocol documented in `docs/04-security/e2ee.md`

## Acceptance Criteria

- Every message and reaction is encrypted in the browser before sending
- The server only receives and forwards ciphertext
- UI shows `🔒 end-to-end encrypted` once keys are exchanged
- No message can be sent before key exchange completes
- If key exchange fails or WebCrypto unavailable → session ends (NO plaintext fallback)

## Technical Design

### Client Crypto Module (`public/js/crypto.js`)

From `docs/04-security/e2ee.md` and LLD §7:

```js
// API
generateKeyPair()                    → { privateKey (non-extractable), publicKeyRaw }
deriveSessionKeys(privateKey, peerPublicRaw, { sessionId, role, myPublicRaw })
                                     → { sendKey, recvKey, safetyCode }
encrypt(sendKey, seq, plainObject, aadContext)     → ct (base64url)
decrypt(recvKey, seq, ct, aadContext)              → plainObject  // throws on tamper
```

### Protocol Steps

1. **Generate**: ephemeral ECDH P-256 key pair (private non-extractable)
2. **Exchange**: `e2e:key { publicKey: base64url(65 bytes) }` relayed by server
3. **Validate**: `importKey` rejects invalid curve points; reject if peer key === own key
4. **Derive**: ECDH shared secret → HKDF-SHA-256 → two AES-GCM-256 keys (per direction)
   - Salt: `SHA-256("rc/v1/salt|" + sessionId)`
   - Transcript hash: `SHA-256(initiatorPub ‖ responderPub)`
   - `keyI2R` info: `"rc/v1 i2r|" ‖ th`
   - `keyR2I` info: `"rc/v1 r2i|" ‖ th`
5. **Encrypt**: pad to 64-byte boundary → AES-GCM with counter IV and AAD
   - IV: `4-byte zero prefix ‖ seq as 8-byte big-endian` (12 bytes)
   - AAD: `"rc/v1|" + sessionId + "|" + direction + "|" + seq`
6. **Decrypt**: check seq > last → decrypt → remove padding → validate JSON shape
7. **End**: drop all key references; CryptoKeys were never extractable

### Server-Side Changes

- `e2e:key` handler: validate shape (87 chars base64url), ensure one key per side per session, relay to partner
- `e2e:envelope` handler: validate shape `{ seq: int, ct: string(≤3000) }`, relay to partner
- Server tracks `keysSeen: Set<string>` per session to enforce one key per side
- **Remove old `chat:send` plaintext handler** — replaced by envelope-only protocol

### No Plaintext Path

The old `chat:send` event is removed entirely. The only way to communicate is through `e2e:envelope`. If WebCrypto is unavailable (old browser, insecure context), the client shows an error and refuses to start a session.

### Padding

Before encryption, plaintext is padded to a multiple of 64 bytes:
```js
function pad(data) {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  const padded = new Uint8Array(Math.ceil(bytes.length / 64) * 64);
  padded.set(bytes);
  return padded;
}
```

## Test Plan (TDD)

### Unit Tests: `tests/unit/crypto/crypto.test.ts`

From `docs/04-security/e2ee.md` §9:

```
describe("crypto module")
  ✅ round trip: encrypt → decrypt returns same object
  ✅ both directions: A encrypts with keyI2R, B decrypts with keyI2R
  ❌ flip 1 bit of ct → decrypt throws (tamper detection)
  ❌ same ct delivered twice → second rejected (seq check)
  ❌ envelope from session X replayed into session Y → fails (AAD mismatch)
  ✅ both directions start at seq 1 → no IV collision (different keys)
  ❌ invalid public key → rejected by importKey
  ❌ own public key as peer key → rejected
  ✅ safety codes match on both sides
  ❌ MITM simulation (different keys) → safety codes differ
  ✅ padding: 1-byte message padded to 64 bytes
  ✅ padding: 65-byte message padded to 128 bytes
```

### Unit Tests: `tests/unit/validation/schemas.test.ts` (extend)

```
describe("E2eKeySchema")
  ✅ accepts 87-char base64url string
  ❌ rejects 86 chars (too short)
  ❌ rejects 88 chars (too long)
  ❌ rejects non-base64url characters

describe("E2eEnvelopeSchema")
  ✅ accepts { seq: 1, ct: "validBase64" }
  ❌ rejects seq: 0
  ❌ rejects ct > 3000 chars
```

### Integration Test: `tests/integration/blindRelay.test.ts`

```
describe("blind relay")
  ✅ server-side spy: relay function sees only { seq, ct } — no plaintext marker
  ✅ A encrypts "hello" → server relays ciphertext → B decrypts "hello"
  ❌ no plaintext string ever passes through the server (grep test)
```

### Integration Test: `tests/integration/noPlaintext.test.ts`

```
describe("no plaintext path")
  ❌ sending chat:send event → no handler (event ignored or rejected)
  ✅ only e2e:envelope accepted for message delivery
  ❌ WebCrypto unavailable → session refused with error message
```

## Files to Create/Modify

| File | Action |
|---|---|
| `public/js/crypto.js` | Create |
| `public/js/main.js` | Modify — integrate key exchange and envelope encryption |
| `src/gateway/registerHandlers.ts` | Add e2e:key and e2e:envelope handlers; remove chat:send |
| `src/sessions/sessionManager.ts` | Add keysSeen tracking per session |
| `src/validation/schemas.ts` | Add E2eKeySchema, E2eEnvelopeSchema |
| `src/types/events.ts` | Update event contracts |
| `tests/unit/crypto/crypto.test.ts` | Create |
| `tests/integration/blindRelay.test.ts` | Create |
| `tests/integration/noPlaintext.test.ts` | Create |

## Dependencies

- M3 (stable session manager for key exchange)
- WebCrypto (`crypto.subtle`) — built into Node 20+ and modern browsers
- No npm packages for crypto (only native WebCrypto)

## Threat Mitigations

- T-07 (server reads content): E2EE makes content unreadable to server
- T-10 (replay/reorder): seq check + AAD
- T-11 (IV reuse): per-direction keys + counter IVs
- T-12 (length analysis): 64-byte padding
- T-25 (downgrade): no plaintext path exists
