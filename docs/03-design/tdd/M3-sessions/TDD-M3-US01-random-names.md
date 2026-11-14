# TDD-M3-US01: Get a Random Name

**Milestone:** M3 1:1 Anonymous Sessions
**Story:** US-01 — As a chatter, I want the system to give me a random name
**Features:** F-12
**Gaps:** None

## Acceptance Criteria

- Assigned a name like `quiet-otter-42` (adjective-animal-two digits) from curated word lists
- New session (`/next`) → new name
- No way to type or change my own name

## Technical Design

### `src/sessions/nameGenerator.ts`

```ts
const ADJECTIVES = ["quiet", "brave", "calm", "swift", "bright", ...]; // ~50 curated words
const ANIMALS = ["otter", "fox", "hawk", "wolf", "bear", ...];        // ~50 curated words

export function generateName(rng: () => number = Math.random): string {
  const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(rng() * ANIMALS.length)];
  const num = String(Math.floor(rng() * 100)).padStart(2, "0");
  return `${adj}-${animal}-${num}`;
}
```

Word list curation rules:
- No offensive, sexual, or violent words
- No words that could be mistaken for real names
- English only (i18n is post-v1)
- Short (≤ 8 chars per word) for mobile display

The server calls `generateName()` when creating a session, assigning one name per participant. Names are never stored beyond the session.

## Test Plan (TDD)

### Unit Tests: `tests/unit/sessions/nameGenerator.test.ts`

```
describe("generateName")
  ✅ returns format "adjective-animal-NN" (regex: /^[a-z]+-[a-z]+-\d{2}$/)
  ✅ all adjectives are lowercase, alphabetic, ≤ 8 chars
  ✅ all animals are lowercase, alphabetic, ≤ 8 chars
  ✅ digits are 00–99 (zero-padded)
  ✅ with seeded rng → deterministic output (for test reproducibility)
  ✅ two calls with different seeds → different names (high probability)
  ❌ no word in ADJECTIVES or ANIMALS is offensive (checked against a blocklist)
```

## Files to Create

| File | Action |
|---|---|
| `src/sessions/nameGenerator.ts` | Create |
| `tests/unit/sessions/nameGenerator.test.ts` | Create |

## Dependencies

- None (uses `Math.random`, injectable for tests)
