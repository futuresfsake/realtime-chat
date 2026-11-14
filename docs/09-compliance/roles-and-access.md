# Roles, Access and Management Capabilities

> **Living document.** First written in the DICT-style review (2026-10-28) and moved here on 2026-11-13. This folder now owns it: update it when the system changes. The original review record is in [10-reviews](../10-reviews/2026-10-28-dict/README.md).

What the people running this service must be able to do, and what they must **never** be able to do.

## 0. Accountable people
Philippine law expects named people, not "the operator". These are decided in D-12.

| Position | Required by | Person | Backup |
|---|---|---|---|
| **Data Protection Officer (DPO)** | RA 10173 Sec 21; NPC Advisory 2017-01 | To be named | To be named |
| **Child-safety officer** | RA 11930 duties on intermediaries | To be named | To be named |
| **Product owner** | Accepts risks and signs the PIA | Project owner | — |
| **Legal counsel** (external) | Verifies citations, reviews published documents, handles orders | To be engaged (D-17) | — |

On a one-person team the same person may hold several positions, with two limits: the DPO must be able to act independently on privacy matters, and there must be a **backup who can meet the 72-hour and 48-hour deadlines** if that person is unreachable. The DPO's contact details are published in the privacy notice and `SECURITY.md`.

## 1. Roles
| Role | Who | Can | Cannot |
|---|---|---|---|
| **Operator** | Engineer on call | See health, metrics, logs; deploy/rollback; toggle maintenance mode | See any user data beyond aggregates |
| **Moderator** | Trained reviewer | Review report cases (category, time, pseudonymous IDs); lift/extend bans | See message content (E2EE), raw IPs, or export data |
| **DPO** | Designated officer (RA 10173) | Handle rights requests; set/release legal holds; run retention audits; file NPC notices | Change code or deploy |
| **Auditor** | Read-only reviewer | Read the admin audit log and retention reports | Modify anything |

Rules: least privilege, MFA on every account, no shared accounts, access reviewed quarterly.

## 2. Capabilities by milestone
| Capability | Milestone | Notes |
|---|---|---|
| `/health` deep check (memory, connections, socket status) | M2 | US-34 |
| Structured logs with correlation IDs | M2 | US-33 |
| Maintenance / kill switch (env flag refuses new sessions, existing ones drain) | M2 | Needed for incident response |
| Metrics snapshot every 60 s and alert thresholds | M7 | US-41, US-42 |
| Report queue with priority for `minor` and `threats` | M7 | US-31 |
| Ban list view, lift, extend (reason required) | M7 | Every action written to the audit log |
| Legal hold set / release | M7 | Stops the purge job for named records |
| Retention report (rows purged, rows held) | M7 | Evidence for the DPO and NPC |
| Rights-request tracker (open, closed, due date) | M8 | Simple table; 30-day target |
| Breach register and NPC notification checklist | M8 | 72-hour clock |

## 3. Admin interface approach
- **No public admin UI at launch.** Start with an authenticated CLI / scripts run by the operator, then a minimal internal page behind SSO and MFA.
- Admin endpoints are separate from the public app, bound to an allowlisted network or identity-aware proxy, and rate limited.
- Every admin action writes `{actor, action, target, reason, time}` to the audit log. The audit log is append-only.

## 4. Operations the PO needs answered
| Question | Answer |
|---|---|
| Can we read a user's chat? | No. E2EE and no storage. |
| Can we identify a user? | Not from stored data; at most a keyed hash that expires. |
| Can we stop abuse quickly? | Yes: ban by hash, maintenance mode, report escalation. |
| Can we prove we deleted data? | Yes: purge job output plus retention report. |
| Can we respond to a court order? | Only for what exists. Procedure in [law-enforcement-requests.md](law-enforcement-requests.md). |

## 5. Acceptance criteria
- [ ] Role matrix enforced in code (tests for each denied action)
- [ ] Audit log append-only (DB role has no UPDATE/DELETE on it)
- [ ] MFA enabled on GitHub, Render and the database provider
- [ ] Quarterly access review scheduled
