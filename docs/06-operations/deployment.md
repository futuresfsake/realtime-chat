# Deployment

## Environments
| Env | Where | URL | Deploys |
|---|---|---|---|
| Local | GitHub Codespace | forwarded port 3000 | `npm run dev` |
| Production | Render free web service (Singapore) | `https://<name>.onrender.com` | Auto on push to `main` |

## Render configuration
| Setting | Value | Why |
|---|---|---|
| Build command | `npm ci && npm run build` | Exact versions from the lockfile; compile TS → `dist/` |
| Start command | `npm start` | Runs `node dist/index.js` |
| Health check path | `/health` | A new deploy only goes live if this returns 200 |
| Node version | from `.node-version` (`22`) | Same version locally and in prod |
| Instance | Free | $0 |
| Auto-deploy | On commit to `main` | `main` = production |

## Environment variables
| Name | Required | Default | Notes |
|---|---|---|---|
| `PORT` | set by Render | 3000 | Never hard-code |
| `ALLOWED_ORIGINS` 🔜 | prod | — | Comma-separated, e.g. `https://realtime-chat-xxxx.onrender.com` |
| `NODE_ENV` 🔜 | prod | — | `production` |
| `DB_PATH` 🔜 | no | `./data/chat.db` | SQLite file location |

## Release process
1. PR merged to `main` (CI green).
2. Render builds → health check → switches traffic to the new version.
3. Run the **release smoke test** ([testing-strategy.md](../05-quality/testing-strategy.md#release-smoke-test-manual-3-min-after-every-deploy)).
4. If broken → **roll back** (below), then fix forward on a branch.

## Rollback
Render dashboard → service → **Events** → choose the last good deploy → **Rollback**. Or `git revert <bad-commit>` on `main` and push.

## Free-tier limits to watch
- Sleeps after 15 min without traffic → ~1 min cold start
- 750 instance-hours / month per workspace
- 5 GB outbound bandwidth / month (Hobby workspace); without a card, overage suspends the service
- Ephemeral disk: SQLite data is lost on restart/redeploy
