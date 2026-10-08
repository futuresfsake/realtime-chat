# Deployment

## When do we deploy? Not only at the end.
**Decision (ADR-0010):** first deploy at the **end of M2**, then **continuously** (every green merge to `main`), and **public launch** (sharing the link) at **M8**.

| Approach | Risk |
|---|---|
| Deploy only at the end | Every production-only problem shows up at once, at the worst time: WSS through the proxy, real IPs, CSP on a real domain, env vars, cold starts |
| **Deploy at M2, then continuously** ✅ | Problems appear one small change at a time, when they're easy to fix |
| Deploy now, before hardening | An unprotected public URL gets found by bots |

**Before M8:** the site shows a banner `preview: not launched yet` and the link isn't shared.

## Environments
| Env | Where | Deploys |
|---|---|---|
| Local | Codespace / your machine ([local-development.md](../08-guides/local-development.md)) | `npm run dev` |
| Production | Render free web service, Singapore | Automatically, **after CI checks pass** on `main` |

## One-time setup (end of M2)
1. Make sure CI exists and is green on `main` (`.github/workflows/ci.yml`, M2).
2. Pin Node: `echo "22" > .node-version`, commit.
3. Test the production build locally: `npm run build && npm start`.
4. render.com → **Sign up with GitHub** → **New + → Web Service** → grant access to **only** this repo.
5. Settings:

| Setting | Value | Why |
|---|---|---|
| Region | Singapore | Closest to the Philippines and much of Asia |
| Branch | `main` | `main` = production |
| Build command | `npm ci && npm run build` | Exact lockfile versions; compile TypeScript |
| Start command | `npm start` | Runs `node dist/index.js` |
| Instance type | Free | $0 |
| Health check path | `/health` | Deploy gating + auto-restart |
| **Auto-Deploy** | **After CI Checks Pass** | A red CI never reaches users |

6. Environment variables (below) → **Deploy**.
7. Run the release smoke test ([testing-strategy.md](../05-quality/testing-strategy.md#release-smoke-test-manual-5-min-after-each-deploy)).

## Environment variables
| Name | Example | Required |
|---|---|---|
| `PORT` | set by Render | auto |
| `NODE_ENV` | `production` | yes |
| `ALLOWED_ORIGINS` | `https://realtime-chat-xxxx.onrender.com` | yes |
| `TRUST_PROXY_HOPS` | `1` | yes (Render's proxy) |
| `GEO_DB_PATH` | `./data/dbip-country-lite.mmdb` | from M5 |
| `PREVIEW_BANNER` | `true` | until M8 |

All are validated at startup by `config.ts` (zod). A bad value → the process exits → the health check fails → the old version stays live.

## Release flow
```
PR → CI green → merge → CI on main green → Render builds → /health OK → traffic switches → smoke test
```

## Rollback
1. **Fastest:** Render dashboard → service → **Events** → last good deploy → **Rollback**.
2. **Then:** `git revert <bad-commit>` on a branch → PR → merge (so `main` matches what's live).

## Watch list
Instance hours (750/mo), bandwidth (5 GB/mo), cold starts, error rate in logs. See [scaling.md](scaling.md) for when to move off the free tier.
