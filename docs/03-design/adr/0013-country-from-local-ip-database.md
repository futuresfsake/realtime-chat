# ADR-0013: Country from a local IP database, optional and fail-soft

- **Status:** Accepted · **Date:** 2026-11-14 · **Completes:** [ADR-0009](0009-country-via-ip-lookup.md) (which was still marked Proposed)

## Context
ADR-0009 chose a server-side lookup with DB-IP "IP to Country Lite" so people could choose "my country only" without an account, a prompt, or being able to simply claim a country. It was left as Proposed. The feature is now built (M5) and its behaviour needed a few decisions the ADR did not make.

## Decision
1. **A local file, no outside call.** The database (an `.mmdb` file, about 8 MB, CC BY 4.0) is read from disk with the `maxmind` reader. The address is looked up once at the WebSocket handshake and never sent to anyone. Only the two-letter code is kept, in memory, while connected.
2. **Optional.** The file is not committed. `npm run geo:update` downloads it; `COUNTRY_DB_PATH` points at it. Without it, or if it cannot be read, **every country is "XX" (unknown)**: the server logs the problem, "my country only" is refused with a clear message, and everything else works.
3. **Unknown never matches locally.** "XX" is never "the same country", so two unknowns are not paired under a local preference. **Both** people's preferences must be satisfied.
4. **The client cannot claim a country.** The search payload has no country field, and a test proves that sending one is refused.
5. **Attribution** to DB-IP.com is shown on the page (a licence condition) and in the README.
6. **Refresh** by rebuilding: the database is downloaded at build time (`render.yaml`), and a monthly workflow asks the host to redeploy. That workflow has never run because nothing is hosted.

## Consequences
- ✅ No raw address or country in logs (tested); no third party sees addresses
- ✅ Works offline and degrades gracefully
- ⚠️ A VPN or a mobile carrier gives a wrong country (T-20, accepted); country-level only
- ⚠️ On `localhost` every address is private, so the feature cannot be demonstrated locally without a forwarded-address header (the tests use one)
- ⚠️ Needs a monthly refresh once hosted
