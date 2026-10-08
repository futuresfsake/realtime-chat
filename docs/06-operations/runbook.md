# Runbook

What to do when something goes wrong. Each entry: **symptom → check → fix**.

### Site takes ~1 minute to load
- **Check:** was it idle for > 15 min? This is free-tier spin-down.
- **Fix:** expected. (Optional: an uptime monitor pinging `/health` keeps it warm but uses instance hours.)

### Site is down / 502 / "Service suspended"
- **Check:** Render dashboard → Logs and Events. Look for crash loops, a failed health check, or suspension (hours or bandwidth exhausted).
- **Fix:** crash → roll back to the last good deploy; quota → wait for the monthly reset or reduce traffic.

### Deploy failed
- **Check:** build log. Common causes: TypeScript error, lockfile out of sync (`npm ci` fails), missing `.js` in imports.
- **Fix:** reproduce locally with `npm ci && npm run build && npm start`, fix on a branch, PR.

### Spam / abuse in progress
- **Check:** logs for `RATE_LIMITED` spikes from one hashed IP.
- **Fix (short term):** suspend the service in Render, or tighten the rate limit and redeploy. **Long term:** add a block list.

### Messages history disappeared
- **Check:** was there a restart or deploy? The free-tier disk is ephemeral.
- **Fix:** expected in v1 (ADR-0002). Follow-up decision in M4.

### `EADDRINUSE` locally
- Another server is still running: Ctrl+C it, or `kill $(lsof -t -i :3000)`, or `PORT=3001 npm run dev`.
