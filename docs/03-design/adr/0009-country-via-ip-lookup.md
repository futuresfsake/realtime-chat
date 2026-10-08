# ADR-0009: Country from a server-side IP lookup

- **Status:** Proposed (needs D-01 sign-off) · **Date:** 2026-10-08

## Context
Users can choose to match only within their country. We need each user's country without accounts.

## Options
| Option | Pros | Cons |
|---|---|---|
| **Server-side IP → country (DB-IP "IP to Country Lite")** | No prompt; client can't simply claim a country; free; works offline from a local file | VPN users appear in the VPN's country; monthly DB updates; attribution required |
| User picks a country | Simple | Anyone can lie; "local" becomes meaningless |
| Browser Geolocation API | Precise | Permission prompt; far too precise (privacy); easy to spoof |
| Cloudflare `CF-IPCountry` header | Zero code | Requires putting Cloudflare in front, which needs a custom domain |

## Decision
DB-IP **IP to Country Lite** (CC BY 4.0, updated monthly, MMDB format), read with a local MMDB reader. Only the 2-letter code is kept, in memory, for the session. Attribution link to DB-IP.com in the footer, as the license requires.

## Consequences
- ✅ No raw IP stored; country-level only
- ⚠️ VPN users can choose their "country". Accepted (T-22)
- ⚠️ The database must be refreshed monthly (automate in M7)
