# TDD-M7-US30: Abuse Patterns Detected Automatically

**Milestone:** M7 Quality, Observability, Monitoring & Moderation
**Story:** US-30 — Automated monitoring detects abuse patterns without reading messages
**Features:** F-34 (behavioral monitoring)
**Gaps:** None

## Acceptance Criteria

- Track report velocity, session churn, connection anomalies per IP hash
- Safety metrics logged every 60 seconds for trend analysis
- Pattern detection flags potential coordinated harassment for human review

## Technical Design

### Behavioral Signals (from `docs/04-security/trust-and-safety.md` §4)

| Signal | Detection | Action |
|---|---|---|
| Report velocity | Multiple reports against same IP hash in short window | Auto-ban (3/1h, already in M6) |
| Session churn | Rapid match-and-skip cycles | Rate limit `/next` + `/start` |
| Connection spikes | Same IP opening many sockets quickly | Per-IP cap (5), cooldown |
| Report category clustering | Multiple `minor`/`harassment` reports against one IP hash | Priority escalation |
| Message frequency | Burst messaging | Rate limiting |
| Ban recurrence | Same IP hash triggering bans repeatedly | Extended monitoring flag |

### Abuse Scorer (`src/observability/abuseScorer.ts`)

```ts
export class AbuseScorer {
  private scores = new Map<string, AbuseScore>();

  recordEvent(ipHash: string, event: AbuseEvent): void {
    const score = this.scores.get(ipHash) ?? newScore();
    switch (event.type) {
      case "report_received": score.reportCount++; break;
      case "session_churn": score.churnCount++; break;
      case "rate_limited": score.rateLimitHits++; break;
      case "connection_spike": score.connectionSpikes++; break;
    }
    score.lastEvent = event.timestamp;
    this.scores.set(ipHash, score);
  }

  getScore(ipHash: string): number {
    const s = this.scores.get(ipHash);
    if (!s) return 0;
    return s.reportCount * 10 + s.churnCount * 2 + s.rateLimitHits * 1 + s.connectionSpikes * 5;
  }

  flaggedForReview(): string[] {
    return [...this.scores.entries()]
      .filter(([_, s]) => this.getScoreFromRecord(s) > REVIEW_THRESHOLD)
      .map(([hash]) => hash);
  }
}
```

### Safety Metrics (every 60s, part of the metrics log)

```json
{
  "event": "safety_metrics",
  "activeReportTargets": 3,
  "activeBans": 1,
  "highAbuseScores": 2,
  "priorityReports": 0,
  "sessionsCreated60s": 15,
  "reportsReceived60s": 1,
  "avgSessionDuration": 120
}
```

### No Message Content

All monitoring is behavioral — based on events, timing, and metadata. The system never reads, stores, or analyzes message content.

## Test Plan (TDD)

### Unit Tests: `tests/unit/observability/abuseScorer.test.ts`

```
describe("AbuseScorer")
  ✅ no events → score 0
  ✅ report_received → score increases by 10
  ✅ session_churn → score increases by 2
  ✅ multiple events compound the score
  ✅ flaggedForReview returns IP hashes above threshold
  ✅ different IP hashes scored independently
```

## Files to Create

| File | Action |
|---|---|
| `src/observability/abuseScorer.ts` | Create |
| `src/observability/metrics.ts` | Extend with safety metrics |
| `tests/unit/observability/abuseScorer.test.ts` | Create |

## Dependencies

- M6 (report system, bans)
- M7 US-25 (logger, metrics framework)
