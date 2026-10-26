# TDD-M6-US17: Confirm Age and Rules Before Chatting

**Milestone:** M6 Trust & Safety
**Story:** US-17 — Before the first search I must confirm I am 18+ and accept rules
**Features:** F-25 (18+ gate + rules)
**Gaps:** G-06 (D-03 — assumed: 18+), G-17 (rules wording needs legal review)

## Acceptance Criteria

- Must confirm "I am 18 or older" and accept the rules before first search
- Confirmation remembered only for the browser session (`sessionStorage`)
- Server refuses `session:start` without consent

## Technical Design

### Client-Side Gate

```html
<div id="consent-gate">
  <h2>Before you begin</h2>
  <ul>
    <li>You must be <strong>18 or older</strong></li>
    <li>No harassment, threats, or hate speech</li>
    <li>No sexual content involving minors</li>
    <li>Don't share personal information</li>
  </ul>
  <label><input type="checkbox" id="age-confirm"> I am 18 or older</label>
  <label><input type="checkbox" id="rules-confirm"> I accept the rules</label>
  <button id="enter-btn" disabled>Enter</button>
</div>
```

On confirmation:
```js
sessionStorage.setItem("consent", JSON.stringify({ adult: true, rulesVersion: "1.0" }));
```

### Server-Side Enforcement

The `session:start` schema requires:
```ts
consent: z.strictObject({
  adult: z.literal(true),
  rulesVersion: z.string().min(1),
})
```

If `adult` is not `true` or consent is missing → `{ ok: false, error: { code: "CONSENT_REQUIRED" } }`.

### Rules Version

`rulesVersion` is a string like `"1.0"`. When rules change, the version increments. Old consent is invalidated (the gate re-appears). The server logs the version for compliance but never the user's identity.

### Why `sessionStorage` (not `localStorage`)

- `sessionStorage` clears when the tab closes → user must re-confirm each browser session
- This prevents stale consent (rules may have changed)
- `localStorage` would persist indefinitely, which is wrong for an age declaration

## Test Plan (TDD)

### Unit Tests: `tests/unit/validation/schemas.test.ts` (extend)

```
describe("consent validation")
  ✅ accepts { adult: true, rulesVersion: "1.0" }
  ❌ rejects { adult: false, rulesVersion: "1.0" }
  ❌ rejects missing adult field
  ❌ rejects missing rulesVersion
  ❌ rejects empty rulesVersion ""
```

### Integration Test: `tests/integration/consent.test.ts`

```
describe("consent gate")
  ❌ session:start without consent → CONSENT_REQUIRED
  ❌ session:start with adult: false → CONSENT_REQUIRED
  ✅ session:start with valid consent → proceeds to matching
```

## Files to Create/Modify

| File | Action |
|---|---|
| `public/index.html` | Add consent gate UI |
| `public/styles.css` | Style consent gate |
| `public/js/main.js` | Gate logic, sessionStorage, attach consent to session:start |
| `src/gateway/registerHandlers.ts` | Enforce consent in session:start handler |
| `tests/integration/consent.test.ts` | Create |

## Dependencies

- M2 (validation framework)

## Threat Mitigations

- T-17 (minors): 18+ self-declaration gate (residual: can be lied about)
- S-01 (control): server enforces consent
