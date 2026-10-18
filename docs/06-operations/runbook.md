# Runbook

**Symptom → Check → Fix.** Keep entries short; add new ones after every incident.

### Site takes ~1 minute to load
- **Check:** idle > 15 min? That's a free-tier cold start.
- **Fix:** expected. (An uptime ping every 5 min keeps it warm but uses instance hours; decide consciously.)

### Site down / 502 / "service suspended"
- **Check:** Render → Events + Logs. Crash loop? Failed health check? Quota exhausted (hours/bandwidth)?
- **Fix:** crash → roll back; quota → wait for the monthly reset, reduce traffic, or move to paid (scaling.md triggers).

### Deploy didn't happen after merge
- **Check:** Auto-Deploy = "After CI Checks Pass": did CI fail on `main`?
- **Fix:** fix CI on a branch → PR → merge.

### Deploy failed
- **Check:** build log. Common causes: TypeScript error; lockfile out of sync (`npm ci`); missing `.js` in imports; config validation error at startup.
- **Fix:** reproduce locally: `npm ci && npm run build && NODE_ENV=production npm start`.

### Users stuck on "searching…"
- **Check:** online count. Only one user? Country `local` with few users from that country?
- **Fix:** expected with low traffic; the fallback after 10 s helps; suggest `/country world`.

### "secure channel error" reports
- **Check:** recent client deploy? Mixed old/new clients during a deploy can use incompatible protocol versions.
- **Fix:** protocol strings are versioned (`rc/v1`); bump the version on any crypto change and refuse mismatches cleanly.

### Abuse wave (spam / harassment)
- **Check:** logs for `RATE_LIMITED`, `BANNED`, report spikes by ipHash prefix. Check automated monitoring metrics for unusual report velocity or session churn.
- **Fix (short term):** tighten limits via env vars and redeploy, or suspend the service. Notify human moderators for immediate pattern review. **Long term:** add a challenge (e.g. a free CAPTCHA) on `/start`; adjust content filter thresholds.
- **If child safety concern (`minor` reports):** escalate immediately per RA 11930 procedures; follow the incident response plan.

### High-priority escalation (moderator action needed)
- **Trigger:** automated monitoring flags clustering of `minor` or `threats` reports against an IP hash pattern, or a human moderator identifies a systemic abuse trend.
- **Action:** review aggregated report data (never message content); adjust ban thresholds or content filters; if RA 11930 or RA 10175 obligations are triggered, follow the law enforcement cooperation guidelines.

### `EADDRINUSE` locally
- Another server is running: Ctrl+C it, or `kill $(lsof -t -i :3000)`, or `PORT=3001 npm run dev`.

### Crypto not working locally on a phone
- **Check:** are you on `http://192.168…`? WebCrypto needs HTTPS or localhost.
- **Fix:** use the Codespaces HTTPS forwarded URL or the Render URL.
