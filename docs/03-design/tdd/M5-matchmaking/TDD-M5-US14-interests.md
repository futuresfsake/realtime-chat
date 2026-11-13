# TDD-M5-US14: Choose My Interests

**Milestone:** M5 Matchmaking
**Story:** US-14 — I can pick up to 5 interests from a predefined list
**Features:** F-22 (interest matching)
**Gaps:** G-05 (D-02 — assumed: predefined list)

## Acceptance Criteria

- Pick up to 5 interests from a predefined list
- Given I and a waiting stranger share ≥ 1 interest, we are matched and see `shared: <interest>`

## Technical Design

### Interest List (`src/matchmaking/interests.ts`)

From `docs/03-design/matchmaking.md` §2:

```ts
export const ALLOWED_INTERESTS = [
  "anime", "art", "books", "cars", "coding", "cooking", "dance", "design",
  "fashion", "fitness", "food", "gaming", "history", "languages", "memes",
  "movies", "music", "nature", "pets", "philosophy", "photography", "science",
  "space", "sports", "study", "technology", "travel", "tv-series", "writing",
] as const;

export type Interest = typeof ALLOWED_INTERESTS[number];
```

Excluded: dating/sexual, politics, religion (high harassment risk).

### Matchmaker Algorithm (`src/matchmaking/matchmaker.ts`)

From `docs/03-design/matchmaking.md` §4:

```ts
export class Matchmaker {
  private waiting = new Map<string, WaitingEntry>();
  private byInterest = new Map<string, Set<string>>();
  private openPool = new Map<string, WaitingEntry>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  enqueue(socketId: string, interests: string[], country: string, scope: Scope): void;
  remove(socketId: string): void;
  private tryInterestMatch(entry: WaitingEntry): WaitingEntry | null;
  private tryOpenMatch(entry: WaitingEntry): WaitingEntry | null;
}
```

Interest matching priority:
1. **Most shared interests** wins
2. Tie → **longest waiting** (FIFO fairness)

### Validation

Part of `SessionStartSchema`:
```ts
interests: z.array(z.enum(ALLOWED_INTERESTS)).max(5).default([])
  .refine(arr => new Set(arr).size === arr.length, "duplicate interests"),
```

### Session Matched Payload

```ts
session:matched {
  sessionId, myName, partnerName,
  sharedInterests: ["gaming", "music"],  // intersection of both users' interests
  role: "initiator" | "responder"
}
```

## Test Plan (TDD)

### Unit Tests: `tests/unit/matchmaking/matchmaker.test.ts`

From `docs/03-design/matchmaking.md` §6:

```
describe("interest matching")
  ✅ interest beats random: A[gaming] matches B[gaming] over C[none]
  ✅ most shared interests wins: A[gaming,music] prefers B[gaming,music] over C[gaming]
  ✅ tie → oldest waiting first (FIFO fairness)
  ❌ no self-match: A cannot be matched with A
  ❌ no rematch with blocked pair (from M6 no-rematch list)
  ✅ 0 interests → goes to open pool immediately
  ✅ shared interests reported in session:matched payload
```

### Unit Tests: `tests/unit/validation/schemas.test.ts` (extend)

```
describe("interests validation")
  ✅ accepts 0–5 valid interests
  ❌ rejects > 5 interests
  ❌ rejects duplicates ["gaming", "gaming"]
  ❌ rejects unknown interest "dating"
```

## Files to Create/Modify

| File | Action |
|---|---|
| `src/matchmaking/interests.ts` | Create |
| `src/matchmaking/matchmaker.ts` | Create (replaces simpleMatchmaker from M3) |
| `src/validation/schemas.ts` | Extend SessionStartSchema with interest validation |
| `tests/unit/matchmaking/matchmaker.test.ts` | Create |

## Dependencies

- M3 (session manager)
- M2 (validation framework)
