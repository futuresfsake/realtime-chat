# Security Checklist (pre-launch gate for M6)

Every box must be checked before we share the URL publicly.

## Input & output
- [ ] Every client→server event validated by a zod `.strict()` schema
- [ ] `maxHttpBufferSize` set to 1 KB
- [ ] All user content rendered with `textContent` (search the code: no `innerHTML` with user data)
- [ ] Server sets `id`, `sentAt`, `from`; ignores client-sent values

## Abuse
- [ ] Per-socket token-bucket rate limit
- [ ] Per-IP connection limit
- [ ] Repeat offenders disconnected

## Transport & headers
- [ ] HTTPS only (Render provides TLS)
- [ ] `helmet` enabled: CSP, `X-Content-Type-Options`, `frame-ancestors 'none'`, `Referrer-Policy`
- [ ] CSP allows the inline theme script **by hash** only (no `'unsafe-inline'`)
- [ ] Socket.IO Origin allowlist (production URL + localhost for dev)

## Data
- [ ] SQL via prepared statements only
- [ ] DB retention limit (no unbounded growth)
- [ ] No secrets in the repo; `.env` ignored

## Errors & logs
- [ ] Clients only ever see generic error codes
- [ ] Logs exclude message text; IPs hashed
- [ ] `unhandledRejection` / `uncaughtException` → log + exit (Render restarts)

## Supply chain
- [ ] `npm audit --audit-level=high` passes in CI
- [ ] Dependabot enabled
- [ ] `package-lock.json` committed; CI uses `npm ci`

## Verification (manual, before launch)
- [ ] Send `<img src=x onerror=alert(1)>` → shown as text
- [ ] Send 20 messages quickly → "slow down" after 5
- [ ] Send a 2 KB payload from the dev tools console → rejected
- [ ] Connect from another origin (e.g. a CodePen) → refused
- [ ] Check headers at securityheaders.com → grade A or better
