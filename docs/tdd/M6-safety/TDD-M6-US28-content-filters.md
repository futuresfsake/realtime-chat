# TDD-M6-US28: Content Is Filtered for Harmful Patterns

**Milestone:** M6 Trust & Safety
**Story:** US-28 — Obvious harmful content caught before it reaches the screen
**Features:** F-32 (client-side content filters, pre-encryption)
**Gaps:** G-16 (banned word list source — PO to review)

## Acceptance Criteria

- Client-side filters check messages before encryption for banned words, spam patterns, personal info
- Users warned when messages appear to contain personal info (phone, email, handles)
- URLs displayed as plain text, never rendered as clickable links

## Technical Design

### Architecture: Client-Side, Pre-Encryption

Content filters run in the **browser before encryption**. The server cannot filter encrypted content, so this is the only point where content checking is possible.

```
user types → content filter → encrypt → send envelope
                ↓
         block/warn/allow
```

### Filter Categories

1. **Banned words**: curated list of slurs, explicit terms
2. **Spam patterns**: repeated characters, excessive caps, known spam phrases
3. **Personal info warnings**: phone number regex, email regex, social handle patterns
4. **URL handling**: URLs detected but never rendered as clickable links

### Content Filter Module (`public/js/contentFilter.js`)

```js
export function checkMessage(text) {
  const result = { allowed: true, warnings: [], blocked: false, reason: null };

  // 1. Banned words (case-insensitive, word boundary)
  for (const word of BANNED_WORDS) {
    if (new RegExp(`\\b${escapeRegex(word)}\\b`, "i").test(text)) {
      result.blocked = true;
      result.reason = "Message contains prohibited content.";
      return result;
    }
  }

  // 2. Spam patterns
  if (/(.)\1{10,}/.test(text)) { result.warnings.push("spam_repetition"); }
  if (text === text.toUpperCase() && text.length > 10) { result.warnings.push("excessive_caps"); }

  // 3. Personal info warnings
  if (/\b\d{10,11}\b/.test(text)) { result.warnings.push("phone_number"); }
  if (/\S+@\S+\.\S+/.test(text)) { result.warnings.push("email"); }
  if (/@\w{2,}/.test(text)) { result.warnings.push("social_handle"); }

  return result;
}
```

### Banned Word List

Initial list: English slurs and explicit terms. To be reviewed by PO before merge.

```ts
// Stored in a separate file, not hardcoded in the filter
// public/js/bannedWords.js
export const BANNED_WORDS = [/* PO-reviewed list */];
```

### URL Rendering

URLs are detected but rendered as plain text using `textContent` (already the rendering approach — no `innerHTML` with user content anywhere). Links are never made clickable (S-09).

### Server-Side Enforcement

The server cannot read encrypted content, but it can:
- Require a `contentPolicyAck: true` flag in `session:start` (client confirms filters are active)
- Log if a client appears to bypass filters (behavioral signals)

## Test Plan (TDD)

### Unit Tests: `tests/unit/client/contentFilter.test.ts`

```
describe("checkMessage")
  ✅ normal message → allowed: true
  ❌ message with banned word → blocked: true
  ❌ banned word with different casing → blocked
  ✅ message with phone number → warning "phone_number"
  ✅ message with email → warning "email"
  ✅ message with @handle → warning "social_handle"
  ✅ repeated characters (aaaaaaaaaa) → warning "spam_repetition"
  ✅ ALL CAPS long message → warning "excessive_caps"
  ✅ URL in message → allowed but rendered as plain text
  ✅ clean message → no warnings, no blocks
```

## Files to Create

| File | Action |
|---|---|
| `public/js/contentFilter.js` | Create |
| `public/js/bannedWords.js` | Create (PO-reviewed) |
| `public/js/main.js` | Integrate filter before encrypt + send |
| `tests/unit/client/contentFilter.test.ts` | Create |

## Dependencies

- M4 (encryption — filter runs before encrypt step)
- G-16 (PO must review banned word list)
