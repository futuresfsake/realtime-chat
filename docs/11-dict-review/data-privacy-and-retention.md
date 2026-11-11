# Data Privacy & Retention: Product Owner Decisions

**Question:** do we make data last, in what database, and for how long?
**Answer in one line:** *Chat content never lasts. A tiny, encrypted, expiring safety ledger lasts. Everything else is memory-only.*

## 1. Principles (RA 10173 Sec 11: transparency, legitimate purpose, proportionality)
1. Collect only what a stated purpose needs.
2. Anything that can identify a person is hashed, short-lived, or absent.
3. Every stored field has an owner, a purpose, a retention period and an automatic deletion job.

## 2. What lasts and what does not
| Data | Lasts? | Where | Retention | Decision |
|---|---|---|---|---|
| Message plaintext | No | Two browsers' memory | Session | Fixed by ADR-0005 |
| Ciphertext envelopes | No | Relay only | Milliseconds | Never stored, never logged |
| Encryption keys | No | Browser memory (non-extractable) | Session | |
| Raw IP | No | Process memory | Milliseconds | Hash then discard (see 4 for the legal caveat) |
| IP hash (keyed HMAC) | Briefly | Memory | 24 h | Rate limits, no-rematch |
| Ban record | **Yes** | Safety ledger | 24 h to 30 d by severity | D-10 |
| Report case (category, time, reporter/target pseudonyms) | **Yes** | Safety ledger | 30 d, then purge | D-10 |
| Legal-hold flag | **Yes** | Safety ledger | Until released by DPO | Needed for lawful orders |
| Admin audit log (who did what) | **Yes** | Safety ledger | 1 year | Accountability, contains no user data |
| Aggregate counters | Yes | Logs/metrics | 30 d | Non-identifying |
| Server logs | Yes | Platform logs | 7 to 30 d | No content, no raw IP (CI-enforced) |

## 3. Which database? (D-10)
| Option | For | Against | Verdict |
|---|---|---|---|
| **No database** (memory only) | Zero breach surface | Restart wipes bans/reports; cannot honour a legal hold; ban evasion by waiting for a deploy | Fine for M2 to M5 only |
| SQLite on Render disk | Already familiar; no extra service | Needs a paid persistent disk; single writer; blocks multi-instance | Acceptable stop-gap |
| **Managed PostgreSQL (Singapore region)** | Durable, encrypted at rest, backups, row-level roles, scales past one instance | Another service to secure; cost | **Recommended from M6** |
| Redis | Fast TTL for 24 h data | Not durable by default | Use only when scaling to many instances |

**Recommendation:** keep chat content database-free. Introduce one small PostgreSQL schema, the *safety ledger*, in M6 (when reports and bans arrive). Remove `better-sqlite3` now (D-05), because nothing uses it.

### Safety ledger rules
- No message content, no ciphertext, no raw IP, no user agent.
- Identifiers are `HMAC-SHA-256(server_secret, ip)`. The secret is rotated on a schedule, which makes old hashes unlinkable.
- Application role has `INSERT/SELECT/DELETE` on its own tables only. Migrations run under a separate role.
- Encrypted at rest (provider-managed) and TLS in transit. Daily purge job; the purge is itself logged.
- Backups: 7-day retention, encrypted; a restore never resurrects expired rows (purge re-runs after restore).

## 4. The RA 10175 Sec 13 conflict (D-11)
Sec 13 requires service providers to preserve **traffic data and subscriber information for a minimum of six months**, and content data for six months **on receipt of a preservation order**. Our design deliberately retains almost no traffic data.

Options for counsel to decide:
- **A. Treat the operator as not holding preservable traffic data** (we hold only hashed, expiring data) and say so in the law-enforcement procedure. Strongest privacy; some legal risk.
- **B. Retain minimal connection metadata (keyed hash, timestamp, country) for 6 months.** Lowest legal risk; weaker privacy; must be in the privacy notice and PIA.
- **C. Preserve on demand only** (legal-hold flag stops purge from the moment an order arrives). Middle path.

**PO recommendation: C**, with counsel's written confirmation before M8. If counsel requires B, retain only the keyed hash plus timestamp, never raw IP.

## 5. Data subject rights (RA 10173 Sec 16)
| Right | Our answer | How it works |
|---|---|---|
| Informed | Privacy notice at the age gate | M6 |
| Access / correction / erasure | Almost nothing is linkable to a person | DPO workflow in [management-capabilities.md](management-capabilities.md); user supplies a report case ID or hash proof |
| Object / withdraw | Leave the site; session ends; nothing remains | |
| Damages / complaint | Contact DPO, then NPC | Contact on the privacy notice |

## 6. Processing agreements and transfers
- Render (US company, Singapore servers) is a **personal information processor**. Obtain and file its DPA; record the cross-border transfer in the PIA.
- Accountability stays with us (RA 10173 Sec 21), whichever region hosts the data.

## 7. Acceptance criteria
- [ ] Data inventory in [privacy-and-sessions.md](../04-security/privacy-and-sessions.md) matches the table above
- [ ] CI check proves no raw IP / content in logs
- [ ] Purge job unit-tested with a fake clock
- [ ] Counsel memo on D-11 filed
