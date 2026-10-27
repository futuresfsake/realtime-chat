# Disaster Recovery Plan — IT Manager Review

**Date:** 2026-10-27

---

## 1. Recovery Objectives

| Metric | Target | Justification |
|---|---|---|
| **RTO (Recovery Time Objective)** | 15 minutes | Anonymous chat is real-time; users leave if service is down |
| **RPO (Recovery Point Objective)** | 0 (no persistent data) | In-memory only; no data to recover |
| **MTTR (Mean Time to Recover)** | < 10 minutes for known failures | Runbook-driven recovery |

## 2. Disaster Scenarios

### 2.1 Render Service Failure

| Scenario | Probability | Impact | Recovery |
|---|---|---|---|
| Service crash (unhandled exception) | Medium | All sessions lost, auto-restart in ~30s | Automatic (Render health check restarts) |
| Bad deploy | Medium | Service broken until rollback | Render dashboard → rollback (< 2 min) |
| Render platform outage | Low | Total downtime | Wait for Render; no failover on free tier |
| Free tier quota exhaustion | Low-Medium | Service suspended until month resets | Monitor usage; move to paid if needed |
| Render region failure (Singapore) | Very Low | Extended downtime | No multi-region failover on free tier |

### 2.2 Code/Repository Failure

| Scenario | Probability | Impact | Recovery |
|---|---|---|---|
| Accidental force push to main | Low | Code loss, broken deploy | `git reflog` + restore; branch protection prevents this |
| Corrupted repository | Very Low | Development blocked | GitHub has redundant storage; clone from mirrors |
| Compromised GitHub account | Low | Malicious code deployed | Revoke access; rollback deploy; audit commits |
| CI/CD pipeline compromise | Low | Malicious code bypasses checks | Review GitHub Actions permissions; audit workflows |

### 2.3 Security Incident

| Scenario | Probability | Impact | Recovery |
|---|---|---|---|
| XSS vulnerability discovered | Low | E2EE keys at risk | Emergency deploy with fix; force client refresh |
| E2EE protocol flaw | Very Low | Message confidentiality broken | Suspend service; design fix; deploy + force reconnect |
| Secret leaked (server signing key) | Low | Connection tokens forgeable | Rotate key; deploy; all connections invalidated |
| DDoS attack | Medium | Service unavailable | Rate limiting; Cloudflare (if configured); scale up |

## 3. Recovery Procedures

### 3.1 Service Restart (Automatic)

```
[Process crash] → Render detects /health failure → Restart process → /health returns 200
Time: ~30 seconds
Data lost: All in-memory state (sessions, bans, rate limits, pool)
User impact: All active sessions terminated; clients auto-reconnect
```

### 3.2 Rollback Procedure

```
1. Render dashboard → Service → Events → Find last good deploy
2. Click "Rollback" on the last good deploy
3. Wait for health check to pass (~1-2 minutes)
4. Verify on live URL (smoke test)
5. On main branch: git revert <bad-commit> → PR → merge
```

### 3.3 Emergency Hotfix

When CI is too slow for SEV-1:

```
1. Create hotfix branch from main
2. Apply minimal fix
3. Push to main (requires admin override of branch protection)
4. Render auto-deploys
5. Follow up: create PR retroactively, run full CI, document exception
```

**This procedure requires:** GitHub admin access. Document who has it.

### 3.4 Complete Service Rebuild

If the Render service is lost entirely:

```
1. render.com → New Web Service → connect to GitHub repo
2. Configure: Region=Singapore, Build=npm ci && npm run build, Start=npm start
3. Set environment variables (PORT, NODE_ENV, ALLOWED_ORIGINS, etc.)
4. Deploy → verify /health → run smoke test
Time: ~15 minutes
```

## 4. State Recovery (Post-Restart)

### 4.1 What's Lost on Restart

| State | Impact | Mitigation |
|---|---|---|
| Active sessions | Users disconnected | Client auto-reconnect + re-pair |
| Matchmaking pool | Queue emptied | Users re-queue automatically |
| Ban list | Abusers unblocked | Temporary; bans accumulate quickly for repeat offenders |
| Rate limit buckets | Limits reset | Temporary; buckets refill within seconds |
| Report counts | Counts reset | Reports accumulate again from next interactions |
| No-rematch list | Pairs can re-match | Temporary; 24h window restarts |
| IP hash salt | New salt = new hashes | By design (daily rotation); slight acceleration on restart |

### 4.2 State Persistence (Recommended for v1)

On graceful shutdown (`SIGTERM`):
1. Serialize ban list to a JSON file in `/tmp/realtime-chat-state.json`
2. On startup: check if file exists and is < 5 minutes old
3. If yes: reload ban list (preserves active bans across deploys)
4. If no: start fresh (file is stale or missing)

```ts
interface PersistedState {
  exportedAt: number;
  bans: Array<{ ipHash: string; expiresAt: number; reportCount: number }>;
  reportCounts: Array<{ ipHash: string; count: number; windowStart: number }>;
}
```

**Limitation:** Render's ephemeral filesystem means the file is lost if the instance is replaced (not just restarted). This is acceptable for v1.

## 5. Backup Strategy

### 5.1 Code Backups

| What | Where | Frequency |
|---|---|---|
| Source code | GitHub (primary) | Every push |
| Source code | Local developer machine | On every pull |
| CI/CD configuration | In-repo (`.github/workflows/`) | Every push |
| Environment variables | Render dashboard (manual) | Document in encrypted file |

### 5.2 Configuration Backup

Environment variables and Render settings should be documented in a secure location outside the repo:

```
ALLOWED_ORIGINS=https://realtime-chat-xxxx.onrender.com
NODE_ENV=production
TRUST_PROXY_HOPS=1
GEO_DB_PATH=./data/dbip-country-lite.mmdb
PREVIEW_BANNER=true
```

**Never commit actual env values to the repo.** Use `.env.example` with placeholder values.

### 5.3 Data Backups

| Data | Backup Needed? | Why |
|---|---|---|
| Messages | No | E2EE, never stored |
| Session state | No | Ephemeral by design |
| Ban list | Optional | Short-lived (24h), rebuilds quickly |
| Logs | Optional | Render retains ~7 days; export if needed for compliance |
| Audit trail (agents-run.jsonl) | Yes | In git repo, backed up on push |
| Documentation | Yes | In git repo, backed up on push |

## 6. Disaster Recovery Testing

### 6.1 Test Schedule

| Test | Frequency | Procedure | Pass Criteria |
|---|---|---|---|
| Rollback drill | Before M8 launch | Deploy intentionally broken version → rollback | Service restored in < 5 minutes |
| Service rebuild | Before M8 launch | Delete Render service → recreate from scratch | Service operational in < 20 minutes |
| Force restart | Monthly (post-launch) | Render dashboard → Manual Deploy → verify | Service healthy in < 2 minutes |
| State recovery | Before M8 launch | Restart with state file → verify bans persist | Bans survive restart |

## 7. Findings Summary

| ID | Severity | Finding | Milestone |
|---|---|---|---|
| DR-01 | MAJOR | No disaster recovery plan exists | M7 |
| DR-02 | MAJOR | No state persistence across restarts | M7 |
| DR-03 | MAJOR | No DR testing schedule | M9 |
| DR-04 | MINOR | No env var backup procedure | M2 |
| DR-05 | MINOR | Emergency hotfix procedure not documented | M7 |
| DR-06 | MINOR | No multi-region failover (accepted for free tier) | Post-v1 |
