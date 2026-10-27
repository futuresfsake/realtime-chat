# Incident Response Plan — IT Manager Review

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

### 3.1 Data Breach Procedure (RA 10173)

```
 DISCOVER → ASSESS → CONTAIN → NOTIFY NPC → NOTIFY SUBJECTS → REVIEW
              │                    │               │
              ▼                    ▼               ▼
         Is personal          Within 72h       If sensitive
         data affected?       of discovery     personal info
```

1. **Assess:** What data was exposed? Is it personal information under RA 10173?
   - For this platform: IP hashes (pseudonymized PII), behavioral data, report data
   - Message content is E2EE and server never has it — not applicable
2. **Notify NPC:** Within 72 hours of discovery (NPC Circular 16-03)
   - NPC breach notification form
   - Description of breach, data affected, number of data subjects
   - Measures taken to contain and remediate
3. **Notify data subjects:** If the breach involves sensitive personal information or is likely to cause harm
4. **Document:** Maintain a breach log even if no notification required

### 3.2 Child Safety Procedure (RA 11930)

When a `minor` report is received or moderator identifies child exploitation risk:

1. **Immediate:** Flag for priority human review (automated)
2. **Assess:** Review aggregated behavioral data (not message content — E2EE)
3. **Preserve:** Retain all available metadata (IP hash, timestamps, session ID, report details) for up to 90 days
4. **Report to authorities:**
   - Philippine National Police Anti-Cybercrime Group (PNP-ACG)
   - National Bureau of Investigation Cybercrime Division (NBI-CCD)
   - Inter-Agency Council Against Trafficking (IACAT) if trafficking suspected
5. **Cooperate:** Provide preserved metadata on lawful request
6. **Document:** Record all actions taken, decisions made, and authority contacted
7. **Limitation:** Plainly disclose to authorities that message content is E2EE and not available

### 3.3 Law Enforcement Request (RA 10175)

1. **Verify:** Confirm the request is from a legitimate authority with valid legal basis
2. **Scope:** Identify what data is requested and what data exists
3. **Comply:** Provide available data (metadata only — no message content)
4. **Disclose limitation:** E2EE means message content is unavailable
5. **Document:** Log the request, response, and legal basis
6. **Legal counsel:** Consult Philippine lawyer for any ambiguous request

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
