# Incident Response Plan

> **Living document.** First written in the IT Manager production review (2026-10-27) and moved here on 2026-11-13. This folder now owns it: update it when the system changes. The original review record is in [10-reviews](../10-reviews/2026-10-27-it-manager/README.md).

**Date:** 2026-10-27
**Owner:** Platform Operator (DPO)

---

## 1. Severity Classification

| Level | Definition | Examples | Response Time | Escalation |
|---|---|---|---|---|
| **SEV-1: Critical** | Service down or child safety concern | Server unresponsive; `minor` report surge; data breach suspected | 15 minutes | Immediate: operator + lawyer (if legal) |
| **SEV-2: Major** | Service degraded or active abuse wave | High error rate; coordinated harassment; memory near limit | 1 hour | Operator + moderator |
| **SEV-3: Minor** | Isolated issue, no user impact | Single user report; minor bug; slow response | 24 hours | Operator |
| **SEV-4: Info** | Cosmetic or planned | Theme bug; documentation error | Next sprint | Developer |

## 2. Incident Response Flow

```
 DETECT → TRIAGE → CONTAIN → INVESTIGATE → RESOLVE → REVIEW
   │         │         │          │            │         │
   ▼         ▼         ▼          ▼            ▼         ▼
 Alert    Classify   Stop the   Find root    Fix and   Post-
 fires    severity   bleeding   cause        deploy    incident
                                                       review
```

### Phase 1: Detection
- **Automated:** UptimeRobot down alert, metric threshold breach, `minor` report auto-escalation
- **Manual:** User reports via `/report`, moderator pattern review, developer observation
- **External:** Security researcher disclosure, legal notice, law enforcement request

### Phase 2: Triage (within response time)
1. Acknowledge the alert
2. Classify severity using the table above
3. Assign an incident lead (operator by default for SEV-1/2)
4. Create an incident record (timestamp, initial assessment, severity)

### Phase 3: Containment
| Scenario | Containment Action |
|---|---|
| Server down | Check Render dashboard → rollback or restart |
| Abuse wave | Tighten rate limits via env vars → redeploy |
| Suspected data breach | Preserve logs → assess scope → begin notification |
| Child safety (`minor` reports) | Preserve available data → follow RA 11930 procedure |
| Bot attack | Enable proof-of-work challenge → block IP ranges if identifiable |
| DDoS | Cloudflare (if configured) → rate limiting → service suspension as last resort |
| Crypto vulnerability | Disable new sessions → deploy fix → force reconnect |

### Phase 4: Investigation
1. Gather evidence: logs, metrics, timeline of events
2. Identify root cause (not just symptoms)
3. Assess impact: users affected, data exposed, duration
4. Document findings in the incident record

### Phase 5: Resolution
1. Deploy fix (standard PR → CI → deploy flow for non-emergencies)
2. For SEV-1: hotfix directly to `main` if CI is too slow (document exception)
3. Verify fix in production
4. Notify affected parties if applicable

### Phase 6: Post-Incident Review (within 48 hours)
1. Write post-incident report (timeline, root cause, impact, actions)
2. Identify preventive measures (test, monitoring, code change)
3. Create tasks for follow-up actions
4. Update runbook with new symptom → fix mapping
5. Archive incident record

## 3. Special Procedures

### 3.1 Personal data breach (RA 10173)
The authoritative procedure, including the 72-hour timeline and the test for whether notification is mandatory, is [09-compliance/breach-notification.md](../09-compliance/breach-notification.md).

In short: record the time of discovery, tell the DPO, contain, assess, and notify the National Privacy Commission and affected users **within 72 hours** of knowing or reasonably believing a notifiable breach happened. Every breach is logged, notifiable or not.

### 3.2 Child safety (RA 11930)
The authoritative procedure is [09-compliance/child-protection-and-online-safety.md](../09-compliance/child-protection-and-online-safety.md).

In short: a `minor` report is blocked from matching and put on legal hold at once, reviewed by the child-safety officer within 24 hours, and reported to the PNP Women and Children Protection Center or the NBI within the legal deadline. Staff never ask for the content, never contact the reported user, and never investigate on their own.

### 3.3 Law-enforcement request (RA 10175)
The authoritative procedure is [09-compliance/law-enforcement-requests.md](../09-compliance/law-enforcement-requests.md).

In short: every request goes to the DPO; preserve first, verify, call counsel, disclose only what a valid order names and only what exists. Message content is never available.

## 4. Communication Templates

### 4.1 Service Disruption (public)
```
[Date] — Service Status Update

We are aware of [brief description].
Current status: [investigating / identified / fixing / resolved]
Impact: [what users experience]
Next update: [time]

Updates will be posted at [URL or channel].
```

### 4.2 NPC Breach Notification (regulatory)
```
To: National Privacy Commission
From: [DPO name], Data Protection Officer, realtime-chat
Date: [date]
Re: Personal Data Breach Notification (NPC Circular 16-03)

1. Nature of the breach: [description]
2. Date/time of discovery: [datetime]
3. Personal data involved: [list — e.g., IP hashes, behavioral metadata]
4. Approximate number of affected data subjects: [number or estimate]
5. Measures taken to contain: [actions]
6. Measures taken to remediate: [actions]
7. Contact: [DPO contact information]
```

## 5. Incident Record Template

```yaml
incident_id: INC-001
severity: SEV-2
title: "Coordinated harassment wave via VPN rotation"
reported_at: "2026-11-15T14:30:00+08:00"
detected_by: "Automated monitoring — report velocity spike"
incident_lead: "operator"
status: "resolved"
timeline:
  - "14:30 — Alert fired: 25 reports in 10 minutes"
  - "14:35 — Triage: SEV-2, active abuse wave"
  - "14:40 — Containment: tightened rate limits, deployed"
  - "14:50 — Investigation: 5 IP hashes, VPN rotation pattern"
  - "15:15 — Resolution: additional rate limiting on /start"
  - "15:30 — Verified: report velocity returned to baseline"
root_cause: "Attacker used VPN rotation to bypass IP-hash bans"
impact: "~20 users received harassment before attacker was rate-limited"
follow_up:
  - "Add browser fingerprint hashing (M6)"
  - "Add proof-of-work on /start (M2)"
  - "Update runbook with VPN rotation pattern"
review_date: "2026-11-16"
```

## 6. Findings Summary

| ID | Severity | Finding | Milestone |
|---|---|---|---|
| IRP-01 | CRITICAL | No incident response procedure exists | M7 |
| IRP-02 | CRITICAL | No breach notification procedure for NPC | M8 |
| IRP-03 | CRITICAL | No child safety escalation procedure | M7 |
| IRP-04 | MAJOR | No law enforcement cooperation procedure | M8 |
| IRP-05 | MAJOR | No communication templates for incidents | M8 |
| IRP-06 | MAJOR | No post-incident review process | M7 |
| IRP-07 | MINOR | No incident record template in use | M7 |
