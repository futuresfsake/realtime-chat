# Matchmaking Design (M5)

How we pair two strangers: **shared interests first, a random stranger as fallback, always respecting the country preference.**

## 1. Inputs
| Input | Source | Example |
|---|---|---|
| `interests` | Chosen by the user from the allowed list, 0–5 | `["gaming","music"]` |
| `scope` | `/country local` or `/country world` | `"world"` |
| `country` | Server-side IP lookup (DB-IP Lite). **The IP is discarded immediately** | `"PH"` or `"XX"` (unknown) |
| `since` | Time the user started waiting | `1760000000000` |

## 2. Allowed interests (v1, open decision D-02)
```
anime, art, books, cars, coding, cooking, dance, design, fashion, fitness,
food, gaming, history, languages, memes, movies, music, nature, pets, philosophy,
photography, science, space, sports, study, technology, travel, tv-series, writing
```
Rules: lowercase slugs, max 5, unique. **Excluded on purpose:** dating/sexual topics, politics and religion (high conflict and harassment risk), anything that encourages sharing personal info.

## 3. Compatibility rule (pure function, `compatibility.ts`)
```ts
scopeAllows(x, y) = x.scope === "world" || (x.country !== "XX" && x.country === y.country)

compatible(a, b) =
     a.id !== b.id
  && !noRematch.has(a, b)
  && scopeAllows(a, b) && scopeAllows(b, a)      // BOTH preferences must be satisfied
```

| A \ B | B local (PH) | B local (JP) | B world (JP) |
|---|---|---|---|
| **A local (PH)** | ✅ | ❌ | ❌ (A wants PH only) |
| **A world (PH)** | ✅ | ❌ (B wants JP only) | ✅ |

Users whose country is unknown (`XX`) and who choose `local` can't be matched locally. They're told: *"we couldn't detect your country, try worldwide"*.

## 4. Algorithm

Two phases per waiting user:
1. **Interest phase** (0–10 s): match only with someone sharing ≥ 1 interest.
2. **Open phase** (after 10 s, or immediately if the user picked no interests): match with **any** compatible user who is also open.

```
enqueue(a):
  # 1. try interest match right now
  best = null
  for each interest i in a.interests:
    for each id in byInterest[i]:
      b = waiting[id]
      if compatible(a, b):
        score = |a.interests ∩ b.interests|
        if best is null or score > best.score or (score == best.score and b.since < best.since):
          best = (b, score)
  if best: return pair(a, best.b)

  # 2. no interests → try open pool now
  if a.interests is empty: return tryOpen(a)

  # 3. wait; index by interest; schedule fallback
  add a to waiting + byInterest
  schedule(a.since + 10s, () => tryOpen(a))

tryOpen(a):
  for b in openPool ordered by since (oldest first):
    if compatible(a, b): return pair(a, b)
  add a to openPool

pair(a, b):
  remove a, b from waiting, byInterest, openPool; cancel their timers
  sessionManager.createSession(a, b, shared = a.interests ∩ b.interests)
```

### Data structures
```ts
waiting:    Map<socketId, WaitingEntry>          // all searching users
byInterest: Map<interest, Set<socketId>>         // inverted index
openPool:   Map<socketId, WaitingEntry>          // insertion order = oldest first
timers:     Map<socketId, TimerHandle>           // via Clock (fake in tests)
```

### Complexity
| Operation | Cost | Notes |
|---|---|---|
| Interest search | O(k · m) | k ≤ 5 interests, m = waiting users per interest |
| Open search | O(n) worst case | n = open users; fine for hundreds. Optimization: bucket the open pool by country |
| Remove (pair/leave) | O(k) | delete from k interest sets |
| Memory | O(n · k) | |

### Fairness
Ties go to the **longest-waiting** user, so nobody waits forever while newcomers get matched.

## 5. Edge cases
| Case | Behavior |
|---|---|
| User leaves while waiting | Removed from all structures; timer cancelled |
| User disconnects during the fallback timer | Timer callback checks the user still exists |
| Only one person online | They wait; UI shows `searching… (1 online)` |
| Two users `/next` simultaneously | Safe: Node runs pairing synchronously (single thread) |
| Rematch with the person just skipped | Blocked by `noRematch` (24 h) |
| Banned user | Rejected before enqueue (`BANNED`) |

## 6. Tests (unit, with a fake clock)
Interest beats random · most shared interests wins · tie → oldest · compatibility matrix (all 6 cells) · fallback fires at exactly 10 s · cancelled on leave · no self-match · no rematch · `XX` + local refused.

## 7. Future improvements
Country-bucketed open pools (O(1) average), language preference for global reach, a smarter wait (expand gradually: same interest+country → interest only → anyone).
