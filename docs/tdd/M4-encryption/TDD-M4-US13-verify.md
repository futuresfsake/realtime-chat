# TDD-M4-US13: Verify Nobody Is in the Middle

**Milestone:** M4 End-to-End Encryption
**Story:** US-13 — As a privacy-conscious chatter, I want to compare a safety code
**Features:** F-21 (safety code, `/verify`)
**Gaps:** None

## Acceptance Criteria

- `/verify` shows a code like `48213 99307 17742 03621`
- The code is identical on both sides when keys weren't tampered with
- Help text explains the code is only meaningful if compared over a different channel

## Technical Design

### Safety Code Computation

From `docs/04-security/e2ee.md` §7:

```js
async function computeSafetyCode(sessionId, initiatorPub, responderPub) {
  const input = concat(
    utf8("rc/v1/safety|" + sessionId),
    initiatorPub,
    responderPub,
  );
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", input));

  // First 20 bytes → four 5-byte chunks
  const chunks = [];
  for (let i = 0; i < 4; i++) {
    const slice = hash.slice(i * 5, (i + 1) * 5);
    const num = bigEndianToInt(slice) % 100000;
    chunks.push(String(num).padStart(5, "0"));
  }
  return chunks.join(" ");
}
```

### `/verify` Command

Client-side command:
```js
case "/verify":
  if (!sessionKeys) {
    appendSystem("No active encrypted session.");
    return;
  }
  const code = await computeSafetyCode(sessionId, initiatorPub, responderPub);
  appendSystem(`Safety code: ${code}`);
  appendSystem("Compare this code with your stranger over a DIFFERENT channel (voice call, another app).");
  appendSystem("If the codes match, nobody intercepted your key exchange.");
  break;
```

### MITM Detection

If the server (or a network attacker) swaps public keys during the exchange:
- A thinks B's key is `keyM` (the attacker's)
- B thinks A's key is `keyM` (the attacker's)
- A computes the code over `(pubA, keyM)`, B computes over `(keyM, pubB)`
- The codes will NOT match → users detect the MITM

### Important Limitation

The safety code is only useful if compared **outside** this chat. If compared inside the chat, a MITM can rewrite the messages containing the code. The help text makes this explicit.

## Test Plan (TDD)

### Unit Tests: `tests/unit/crypto/safetyCode.test.ts`

```
describe("computeSafetyCode")
  ✅ both sides compute identical codes with same keys and sessionId
  ✅ code format: "NNNNN NNNNN NNNNN NNNNN" (4 groups of 5 digits)
  ❌ MITM simulation: different key pairs → codes differ
  ✅ different sessionId → different codes
  ✅ code is deterministic (same inputs → same output)
  ✅ each chunk is 00000–99999
```

### Manual Verification

- Open two tabs → `/start` → both get `🔒 end-to-end encrypted`
- Both type `/verify` → compare codes → identical
- Dev tools → Network → WS frames show only ciphertext

## Files to Create/Modify

| File | Action |
|---|---|
| `public/js/crypto.js` | Add computeSafetyCode function |
| `public/js/commands.js` | Add /verify command |
| `tests/unit/crypto/safetyCode.test.ts` | Create |

## Dependencies

- US-12 (crypto module with key exchange must be working)

## Threat Mitigations

- T-08 (active MITM): safety code detects key swap (residual: users must verify out-of-band)
