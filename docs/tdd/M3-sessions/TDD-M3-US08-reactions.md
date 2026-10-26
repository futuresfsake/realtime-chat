# TDD-M3-US08: React to a Message

**Milestone:** M3 1:1 Anonymous Sessions
**Story:** US-08 — As a chatter, I want to react with an emoji
**Features:** F-19 (emoji reactions)
**Gaps:** None

## Acceptance Criteria

- `/react 😂` adds the reaction to the stranger's latest message
- Both sides see the reaction
- Only `👍 ❤️ 😂 😮 😢 🙏` are accepted

## Technical Design

### Reaction in M3 (pre-encryption)

In M3, reactions are sent as plaintext (encryption comes in M4). The reaction payload:

```ts
// Client → Server (M3, plaintext)
{ type: "react", ref: number, emoji: string }

// In M4, this becomes part of the encrypted envelope:
// Plain = { t: "react", ref: seqNumber, emoji: Reaction }
```

### Allowed Reactions

```ts
export const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
export type Reaction = typeof ALLOWED_REACTIONS[number];
```

### Server-Side Validation

Part of the zod schema:

```ts
export const ReactionSchema = z.strictObject({
  ref: z.number().int().positive(),
  emoji: z.enum(ALLOWED_REACTIONS),
});
```

The server validates the emoji and relays to the partner. It does not validate that `ref` matches an actual message sequence (the server doesn't store messages). The client ignores reactions to unknown `ref` values.

### Client-Side UI

- Reactions appear inline below the referenced message
- Multiple reactions on the same message stack horizontally
- The `/react` command parses the emoji from the argument

## Test Plan (TDD)

### Unit Tests: `tests/unit/validation/schemas.test.ts` (extend)

```
describe("ReactionSchema")
  ✅ accepts { ref: 1, emoji: "😂" }
  ✅ accepts each of the 6 allowed emojis
  ❌ rejects emoji not in the allowed list ("🔥")
  ❌ rejects ref: 0 or negative
  ❌ rejects ref: non-integer (1.5)
  ❌ rejects extra fields
```

### Integration Test: `tests/integration/reactions.test.ts`

```
describe("reactions")
  ✅ A sends reaction → B receives it with correct ref and emoji
  ❌ reaction when not in session → NOT_IN_SESSION
  ❌ invalid emoji → VALIDATION error
```

## Files to Create/Modify

| File | Action |
|---|---|
| `src/validation/schemas.ts` | Add ReactionSchema, ALLOWED_REACTIONS |
| `src/gateway/registerHandlers.ts` | Add reaction handler |
| `public/js/commands.js` | Add `/react` command |
| `public/js/render.js` | Add reaction display |
| `tests/unit/validation/schemas.test.ts` | Extend |
| `tests/integration/reactions.test.ts` | Create |

## Dependencies

- US-02 (session manager for partner relay)
- M2 US-21 (zod validation)
