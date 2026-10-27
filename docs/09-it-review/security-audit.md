# Security Audit — IT Manager Review

**Date:** 2026-10-27
**Scope:** Transport security, cryptographic protocol, abuse prevention, supply chain, static analysis, client-side security

---

## 1. Transport Layer Security

### 1.1 TLS Configuration (Render-managed)
- **Status:** Acceptable — Render handles TLS termination with modern cipher suites
- **Finding SA-01 (MAJOR):** No TLS certificate pinning or HSTS preload registration. While HSTS is enforced by Render, the domain is not on the browser preload list, leaving a window for the first visit.
- **Recommendation:** Register for HSTS preload at hstspreload.org after M2 deploy. Requires `max-age=63072000; includeSubDomains; preload`.

### 1.2 WebSocket Security
- **Finding SA-02 (CRITICAL):** WebSocket connections have no authentication token. The Origin check prevents CSWSH but does not prevent:
  - Automated scripts setting the correct Origin header
  - Browser extensions or dev tools replaying connections
  - Bot frameworks that spoof Origin
- **Recommendation:** Implement a short-lived connection token (issued via HTTPS, validated on WS upgrade). Not a JWT (no accounts) but a server-signed nonce with a 30s TTL.

### 1.3 Origin Allowlist
- **Status:** Planned for M2 (US-23)
- **Finding SA-03 (MINOR):** No documentation on how `ALLOWED_ORIGINS` handles subdomains, protocol variations, or `null` Origin (privacy-mode browsers).
- **Recommendation:** Document the exact matching logic. Reject `null` Origin. Test with common edge cases.

## 2. Cryptographic Protocol

### 2.1 E2EE Design Review
- **Status:** Well-designed. Standard primitives, no custom crypto, per-session ephemeral keys.
- **Finding SA-04 (MINOR):** The ECDH P-256 choice is documented as pragmatic (browser support) but P-256's NIST origin carries residual distrust in some security communities. X25519 migration path is noted but has no timeline.
- **Recommendation:** Add X25519 as a tracked post-v1 item with a specific browser-support threshold (e.g., "when >95% of our traffic supports it").

### 2.2 Key Exchange
- **Finding SA-05 (MAJOR):** No key exchange timeout. If one client sends a public key and the other never responds, the session hangs in a half-keyed state indefinitely.
- **Recommendation:** Add a 10s timeout on key exchange. If both keys aren't exchanged within 10s, end the session with `CRYPTO_TIMEOUT`.

### 2.3 Forward Secrecy
- **Status:** Forward secrecy per session (ephemeral keys). No intra-session re-keying.
- **Finding SA-06 (MINOR):** Very long sessions (hours) use the same keys. A compromise of a session key exposes the entire conversation.
- **Recommendation:** Track re-keying as a post-v1 item. Document the accepted risk in the privacy notice.

### 2.4 Safety Code Verification
- **Status:** Well-designed (SHA-256 over session ID + sorted public keys)
- **Finding SA-07 (MINOR):** The `/verify` UX doesn't explain *when* to verify or *how* to compare out-of-band for users who don't understand MITM.
- **Recommendation:** Add a brief in-chat tooltip: "Compare this code with your partner over a phone call or different app. If the codes don't match, someone may be intercepting your chat."

## 3. Abuse Prevention

### 3.1 Rate Limiting
- **Status:** Planned (M2), well-designed token bucket with configurable rates
- **Finding SA-08 (CRITICAL):** No rate limiting on the WebSocket handshake itself. An attacker can open and close thousands of connections per second before any per-socket rate limiter kicks in.
- **Recommendation:** Add connection-rate limiting at the gateway level: max 5 new connections per IP per 10 seconds. This runs BEFORE the Socket.IO connection event.

### 3.2 Bot Prevention
- **Finding SA-09 (CRITICAL):** Zero bot prevention beyond rate limits. A headless browser (Puppeteer, Playwright) can:
  - Pass Origin checks
  - Pass the 18+ consent gate
  - Farm matches at scale
  - Spam users before rate limits kick in (burst of 5 messages is enough to harass)
- **Recommendation:** Implement proof-of-work (PoW) on `/start`:
  - Server sends a challenge (random prefix + difficulty)
  - Client must find a nonce where SHA-256(prefix + nonce) has N leading zeros
  - Difficulty adjustable (50ms for humans, expensive for bot farms)
  - Alternative: integrate a free CAPTCHA (hCaptcha, Cloudflare Turnstile) before first session

### 3.3 Ban Evasion
- **Status:** Acknowledged accepted risk (T-19). VPN users get fresh IPs.
- **Finding SA-10 (MAJOR):** No browser fingerprinting or behavioral fingerprinting to detect ban evasion. The daily-salted IP hash means even the same IP is effectively a new user every 24 hours.
- **Recommendation:** Consider lightweight browser fingerprinting (canvas, WebGL, timezone, language, screen) stored as a salted hash alongside the IP hash. This isn't foolproof but raises the bar for casual ban evasion.

### 3.4 Content Filters
- **Status:** Planned client-side filters (M6, US-28)
- **Finding SA-11 (MAJOR):** Client-side content filters are bypassable. A modified client can skip the filter entirely. The server cannot verify filter compliance because messages are E2EE.
- **Recommendation:** Document this as an accepted risk explicitly. Add server-side rate-limit tightening when a client's report-rate is high (behavioral signal that the client may be bypassing filters).

## 4. Supply Chain Security

### 4.1 Dependencies
- **Finding SA-12 (CRITICAL):** `better-sqlite3` is still in `package.json` (v13.0.3). This is:
  - A **native addon** requiring node-gyp build toolchain
  - An unused attack surface (no message storage per ADR-0005)
  - A build complexity cost on every `npm ci`
- **Recommendation:** Remove immediately (`npm uninstall better-sqlite3 @types/better-sqlite3`). This should be the first commit of M2.

### 4.2 Dependency Pinning
- **Finding SA-13 (MINOR):** Dependencies use caret ranges (`^`). While `package-lock.json` pins exact versions, a fresh `npm install` (without `--ci`) can introduce untested versions.
- **Recommendation:** CI already uses `npm ci` (good). Document that developers must use `npm ci` for local development. Consider switching to exact versions for production dependencies.

### 4.3 npm Audit
- **Status:** Planned for CI (M2)
- **Recommendation:** Run `npm audit --audit-level=high` now and fix any existing vulnerabilities before starting M2.

## 5. Client-Side Security

### 5.1 XSS Prevention
- **Status:** `textContent` only (good). CSP planned for M2.
- **Finding SA-14 (MINOR):** The current `public/client.js` uses `innerHTML` for the theme switcher or command output rendering. Need to verify no user-controlled data flows into any `innerHTML` call.
- **Recommendation:** Run a grep for `innerHTML` in all client code before M2. Add a semgrep rule (already planned in TDD-M0-S05).

### 5.2 CSP
- **Status:** Planned for M2 (helmet)
- **Finding SA-15 (MAJOR):** No `report-uri` or `report-to` directive planned. CSP violations in production will be invisible.
- **Recommendation:** Add `Content-Security-Policy-Report-Only` first (to catch issues), then enforce. Use a free CSP reporting endpoint (report-uri.com free tier, or a custom `/csp-report` endpoint that logs violations).

## 6. Findings Summary

| ID | Severity | Finding | Milestone |
|---|---|---|---|
| SA-01 | MAJOR | No HSTS preload | M2 |
| SA-02 | CRITICAL | No WebSocket connection authentication token | M2 |
| SA-03 | MINOR | Origin allowlist edge cases undocumented | M2 |
| SA-04 | MINOR | No X25519 migration timeline | Post-v1 |
| SA-05 | MAJOR | No key exchange timeout | M4 |
| SA-06 | MINOR | No intra-session re-keying | Post-v1 |
| SA-07 | MINOR | `/verify` UX doesn't guide users | M4 |
| SA-08 | CRITICAL | No connection-rate limiting on WS handshake | M2 |
| SA-09 | CRITICAL | No bot prevention (PoW or CAPTCHA) | M2 |
| SA-10 | MAJOR | No browser fingerprinting for ban evasion detection | M6 |
| SA-11 | MAJOR | Client-side content filters are bypassable | M6 |
| SA-12 | CRITICAL | Unused `better-sqlite3` in dependencies | Immediate |
| SA-13 | MINOR | Caret version ranges in dependencies | M2 |
| SA-14 | MINOR | Need innerHTML audit in client code | M2 |
| SA-15 | MAJOR | No CSP violation reporting | M2 |
