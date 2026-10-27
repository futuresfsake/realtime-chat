# Authentication & Authorization Analysis — IT Manager Review

**Date:** 2026-10-27

---

## 1. Current Authentication Model

This system uses **no traditional authentication** (no accounts, no passwords, no JWT, no OAuth). This is by design (ADR-0006) and aligns with the anonymity goal. However, "no authentication" does not mean "no access control." The system must still verify:

1. **Connection legitimacy** — is this a real browser, not a bot?
2. **Consent verification** — has this user confirmed 18+ and accepted rules?
3. **Session membership** — is this socket authorized to participate in this session?
4. **Rate compliance** — is this connection within acceptable usage limits?
5. **Ban status** — is this IP hash currently banned?

## 2. Connection Authentication Flow

### 2.1 Current (M1)

```
Browser → WebSocket handshake → Origin check → Connected
```

**Gap AA-01 (CRITICAL):** No proof that the connecting client is a legitimate browser. The Origin header is trivially spoofable outside a browser context.

### 2.2 Recommended (M2+)

```
Browser → GET /connect-token (HTTPS) → Server issues signed nonce (30s TTL)
Browser → WebSocket handshake + token → Origin check + token validation → Connected
```

**Connection token design:**
```
token = base64url(JSON.stringify({
  nonce: crypto.randomUUID(),
  iat: Date.now(),
  exp: Date.now() + 30_000,
  ipHash: hmac(dailySalt, clientIp)
})) + "." + base64url(HMAC-SHA-256(serverSecret, payload))
```

- Token is bound to the IP hash that requested it (prevents token theft across networks)
- 30-second TTL prevents replay
- Server-side secret rotates daily alongside the IP salt
- No user identity in the token (preserves anonymity)

### 2.3 Bot Mitigation Layer (M2)

Before issuing a connection token, require one of:

| Method | Friction | Effectiveness | Cost |
|---|---|---|---|
| **Proof-of-work** (SHA-256 challenge) | ~50ms compute | Medium (stops commodity bots) | $0 |
| **Cloudflare Turnstile** (invisible CAPTCHA) | Near zero for humans | High | Free tier available |
| **hCaptcha** | Low-medium | High | Free tier available |

**Recommendation:** Start with proof-of-work (zero cost, no third-party dependency). Add Turnstile if bot abuse persists post-launch.

## 3. Consent Verification

### 3.1 Current Design
- Client stores consent in `sessionStorage`
- Server checks `consent: { adult: true, rulesVersion }` in `session:start` event

### 3.2 Gaps

**AA-02 (CRITICAL):** Server-side consent enforcement is designed but not implemented. Until M6, there is no gate at all.

**AA-03 (MAJOR):** The consent `rulesVersion` field has no server-side validation of which versions are current. A client could send `rulesVersion: "0.0.1"` (an ancient version) and the server would accept it.

**Recommendation:**
- Implement consent check in `session:start` handler as part of M2 (earlier than planned M6)
- Server should maintain a `CURRENT_RULES_VERSION` constant
- Reject any `rulesVersion` that doesn't match current
- Return `CONSENT_REQUIRED` error with the current version URL

### 3.3 Session Consent Persistence

**AA-04 (MINOR):** `sessionStorage` is cleared when the browser tab closes, which means users must re-consent on every visit. This is good for safety (confirms age each session) but may cause friction.

**Recommendation:** Keep `sessionStorage` (not `localStorage`). Re-consent per browser session is the right trade-off for an 18+ platform.

## 4. Session Authorization

### 4.1 Session Membership Check
- **Design:** Every event checks `clients.get(sender).sessionId === session.id` (O(1))
- **Status:** Not yet implemented (M3)
- **Assessment:** Sound design. The synchronous check in single-threaded Node prevents race conditions.

### 4.2 Session ID Predictability

**AA-05 (MAJOR):** Session IDs are UUIDs (v4). While UUIDs are unpredictable, there's no documentation on:
- Whether `crypto.randomUUID()` is used (cryptographically random) vs `uuid` package
- Whether session IDs are validated as UUIDs on incoming events
- What happens if a client guesses or brute-forces a session ID

**Recommendation:**
- Use `crypto.randomUUID()` (Node 20+ built-in, crypto-random)
- Validate session ID format in the zod schema
- Log and rate-limit failed session membership checks (potential probe)

## 5. Privilege Model

### 5.1 User Roles

| Role | Capabilities | Authentication |
|---|---|---|
| **Anonymous chatter** | Connect, search, chat, skip, leave, report, verify | Connection token + consent |
| **Operator (admin)** | Read logs, adjust config, deploy | GitHub access + Render dashboard |
| **Human moderator** | Read aggregated report data, adjust thresholds | TBD (no moderator auth designed) |
| **Automated monitor** | Read metrics, trigger alerts | Server process (same Node instance) |

### 5.2 Gaps

**AA-06 (MAJOR):** No moderator authentication or authorization system designed. US-31 describes moderator tools but doesn't specify:
- How moderators authenticate (separate admin UI? CLI with API key? Log access only?)
- What RBAC controls exist (can a moderator adjust ban thresholds? deploy?)
- Audit logging of moderator actions

**Recommendation:**
- For v1 (CLI-based moderation): require an API key set via environment variable
- Log every moderator action to the audit trail
- Never expose the moderator interface on the public WebSocket
- Design RBAC for post-v1 web dashboard

**AA-07 (MINOR):** No separation between "operator" and "developer" roles. Anyone with GitHub repo access can deploy to production.

**Recommendation:** Enable GitHub branch protection rules (already planned). Consider CODEOWNERS for security-critical files (`src/security/`, `src/gateway/`, crypto code).

## 6. Authorization Matrix

| Action | Anon Chatter | Operator | Moderator |
|---|---|---|---|
| Connect (WebSocket) | Token + Origin | N/A | N/A |
| Start session | Consent + not banned | N/A | N/A |
| Send message | In CHATTING state + rate limit | N/A | N/A |
| Report | In CHATTING state + rate limit | N/A | N/A |
| Read aggregated reports | No | Yes | Yes |
| Adjust ban thresholds | No | Yes | With approval |
| Deploy code | No | Yes | No |
| Access raw logs | No | Yes (Render) | No |
| View IP hashes | No | No | Partial (prefixes only) |
| Read message content | No | No | No |

## 7. Findings Summary

| ID | Severity | Finding | Milestone |
|---|---|---|---|
| AA-01 | CRITICAL | No connection authentication beyond Origin check | M2 |
| AA-02 | CRITICAL | Server-side consent enforcement not implemented | M2 (moved from M6) |
| AA-03 | MAJOR | No rules version validation on server | M2 |
| AA-04 | MINOR | sessionStorage consent requires re-consent per session | Accepted |
| AA-05 | MAJOR | Session ID generation and validation not specified | M3 |
| AA-06 | MAJOR | No moderator authentication/authorization design | M7 |
| AA-07 | MINOR | No CODEOWNERS for security-critical files | M2 |
