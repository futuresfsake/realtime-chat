# TDD-M5-US15: My Country or Worldwide

**Milestone:** M5 Matchmaking
**Story:** US-15 — `/country local` or `/country world`
**Features:** F-23 (server-side country lookup with DB-IP Lite)
**Gaps:** G-04 (D-01 — assumed: IP lookup), G-15 (DB-IP licensing)

## Acceptance Criteria

- `/country local` → matched only with same country
- `/country world` → matched with anyone whose setting allows
- A local-only user is never matched outside their country

## Technical Design

### Country Lookup (`src/geo/countryLookup.ts`)

```ts
export interface CountryLookup {
  lookup(ip: string): string;  // ISO 3166-1 alpha-2 or "XX"
}

// Production: DB-IP Lite MMDB file
export class DbIpLookup implements CountryLookup {
  private reader: MmdbReader;
  constructor(dbPath: string) { /* load MMDB */ }
  lookup(ip: string): string { /* return country code or "XX" */ }
}

// Test: deterministic fake
export class FakeCountryLookup implements CountryLookup {
  constructor(private map: Record<string, string>) {}
  lookup(ip: string): string { return this.map[ip] ?? "XX"; }
}
```

The IP is used only for the lookup call, then discarded. It is never stored or logged.

### Compatibility Rule (`src/matchmaking/compatibility.ts`)

From `docs/03-design/matchmaking.md` §3:

```ts
function scopeAllows(x: WaitingEntry, y: WaitingEntry): boolean {
  return x.scope === "world" || (x.country !== "XX" && x.country === y.country);
}

export function compatible(a: WaitingEntry, b: WaitingEntry, noRematch: NoRematchList): boolean {
  return a.id !== b.id
    && !noRematch.has(a.id, b.id)
    && scopeAllows(a, b)
    && scopeAllows(b, a);  // BOTH preferences must be satisfied
}
```

### Compatibility Matrix

| A \ B | B local (PH) | B local (JP) | B world (JP) |
|---|---|---|---|
| **A local (PH)** | ✅ | ❌ | ❌ (A wants PH only) |
| **A world (PH)** | ✅ | ❌ (B wants JP only) | ✅ |
| **A local (XX)** | ❌ (unknown country) | ❌ | ❌ |

### DB-IP Lite Setup

- Download `dbip-country-lite.mmdb` from db-ip.com (free, CC-BY-4.0)
- Store in `data/dbip-country-lite.mmdb`
- Attribution link required in footer: "IP Geolocation by DB-IP"
- Monthly update via CI job (M7)

## Test Plan (TDD)

### Unit Tests: `tests/unit/matchmaking/compatibility.test.ts`

```
describe("compatibility")
  ✅ local(PH) + local(PH) → compatible
  ❌ local(PH) + local(JP) → incompatible
  ❌ local(PH) + world(JP) → incompatible (A wants PH only)
  ✅ world(PH) + local(PH) → compatible
  ❌ world(PH) + local(JP) → incompatible (B wants JP only)
  ✅ world(PH) + world(JP) → compatible
  ❌ local(XX) + local(PH) → incompatible (unknown country can't match local)
  ❌ self-match → incompatible
  ❌ no-rematch pair → incompatible
```

### Unit Tests: `tests/unit/geo/countryLookup.test.ts`

```
describe("FakeCountryLookup")
  ✅ known IP → returns country code
  ✅ unknown IP → returns "XX"

describe("DbIpLookup")
  ✅ valid IP → returns 2-letter country code
  ✅ private IP → returns "XX"
  ✅ invalid IP → returns "XX" (no crash)
```

## Files to Create

| File | Action |
|---|---|
| `src/geo/countryLookup.ts` | Create |
| `src/matchmaking/compatibility.ts` | Create |
| `data/.gitkeep` | Create (DB-IP file not committed, downloaded at build) |
| `public/index.html` | Add DB-IP attribution link in footer |
| `tests/unit/matchmaking/compatibility.test.ts` | Create |
| `tests/unit/geo/countryLookup.test.ts` | Create |

## Dependencies

- DB-IP Lite MMDB file + MMDB reader package (e.g., `maxmind` or `mmdb-lib`)
- US-14 (matchmaker uses compatibility)
