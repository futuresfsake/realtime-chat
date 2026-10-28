# Deployment Security Checklist

Applies to the Render (Singapore) deployment. A release is blocked until every **Must** is checked. Evidence goes in `testresults/dod/`.

## 1. Pre-deploy gates
| # | Control | Level | How to verify |
|---|---|---|---|
| D1 | Current code is **not** public: it has no origin check, rate limit, headers or per-session isolation (global broadcast) | Must | M2 and M3 exit criteria pass first |
| D2 | `npm audit --omit=dev` shows no high/critical | Must | CI job; currently 2 high (zod), see [tooling.md](tooling.md) |
| D3 | Secret scan clean (no keys in history) | Must | gitleaks in CI and pre-commit |
| D4 | Static analysis clean | Must | semgrep / CodeQL in CI |
| D5 | Dependencies pinned by lockfile; `npm ci` only | Must | CI |
| D6 | Node version pinned (`.node-version`, `engines`) | Must | file present |
| D7 | Branch protection: PR + green CI + review on `main` | Must | GitHub settings screenshot |

## 2. Transport and browser hardening
| Control | Setting |
|---|---|
| TLS | HTTPS and WSS only; HTTP redirects |
| HSTS | `max-age=63072000; includeSubDomains` (preload after a stable week) |
| CSP | `default-src 'self'`; `connect-src 'self' wss://<host>`; `frame-ancestors 'none'`; no inline script except by hash; `report-to` |
| Other headers | `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` denying camera, mic, geolocation |
| WebSocket origin | Strict allowlist via `ALLOWED_ORIGINS`; reject missing or `null` Origin |
| Payload cap | 4 KB (`maxHttpBufferSize`) |
| Rate limits | Handshake: 5 per IP per 10 s. Messages: token bucket per socket |
| Rendering | `textContent` only, never `innerHTML` |

## 3. Secrets and configuration
- All config via environment variables, documented in `.env.example` with **no real values**.
- Secrets (HMAC key, DB URL) live only in Render's secret store; rotate on a schedule and after any suspected exposure.
- Separate staging and production; no production secrets in staging.
- Never log: content, ciphertext, keys, raw IPs, user agents, environment.

## 4. Runtime and platform
- Run as non-root; read-only filesystem where possible; memory ceiling set (`--max-old-space-size=400`).
- `/health` for the platform probe; deep metrics not publicly exposed in detail.
- Graceful shutdown on SIGTERM (already in `src/index.ts`).
- Single instance until a shared store exists. The session ticket design is in [scaling.md](../06-operations/scaling.md).
- Free-tier cold starts: show a loading state; do not treat cold start as an outage.

## 5. Monitoring and response
- Uptime monitor on `/health`; alert to a named person, not a shared inbox.
- Incident plan: [incident-response-plan.md](../09-it-review/incident-response-plan.md). Breach clock: **NPC and affected persons within 72 hours** of knowledge of a notifiable breach.
- Child-safety (`minor`) reports escalate immediately to the designated officer.
- Rollback: redeploy the previous green build; rehearse once before launch (M9).

## 6. Post-deploy smoke test (must pass on the live URL)
1. `curl -I https://<host>` shows the headers in section 2.
2. WebSocket from a foreign Origin is refused.
3. A 10 KB message is rejected; 20 rapid messages get "slow down".
4. Two phones chat; refresh clears history.
5. Logs for that run contain no content or IP (grep).

## 7. Scope reminder
Anonymous chat with strangers is high-risk (see Omegle). **Adult-only gate, reporting and bans (M6) ship before any public announcement (M8).**
