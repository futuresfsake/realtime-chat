# Data Inventory and Retention

**Last reviewed:** 2026-11-13 against the code on `main` (M3 code complete) · **Owner:** DPO (D-12)

This is our **record of processing activities** and the only place the data inventory is kept. It replaces the three earlier inventories (privacy-and-sessions, the IT review's data governance, and the DICT-style retention table). How the mechanisms work is explained in [04-security/privacy-and-sessions.md](../04-security/privacy-and-sessions.md).

**Rule:** a PR that adds a field, a log line, a vendor, or changes how long something is kept must update this file in the same PR.

## 1. Principles (RA 10173 Sec 11)
1. **Transparency:** everything in this table appears in the privacy notice in plain language.
2. **Legitimate purpose:** each row has one stated purpose and one lawful basis.
3. **Proportionality:** if a purpose can be met with a hash, a count or nothing, we do not keep the real value.
4. Every stored item has an owner, a retention period and an automatic way of being deleted.

## 2. Classification
| Class | Meaning | Handling |
|---|---|---|
| **C3 Content** | What users type | Never stored, never logged. Encrypted end to end from M4 |
| **C2 Personal** | Can identify or single out a person, directly or when combined (IP address, keyed IP hash, report records) | Memory only unless this file says otherwise; never in logs in raw form; access limited by role |
| **C1 Operational** | Session ids, random names, counters, health data | No personal link; may appear in logs |
| **C0 Public** | Source code, docs, online count | Public |

A keyed hash of an IP address is **still personal information** for as long as it can be linked back (the same day, by someone holding the secret). We treat it as C2.

## 3. What we process today (M3)
| # | Data | Class | Purpose | Lawful basis ◻ | Where | Kept for | Deleted by | Who else sees it |
|---|---|---|---|---|---|---|---|---|
| 1 | IP address | C2 | Accept the connection; rate limits; make the hash | Needed to provide the service the user asked for; legitimate interest in security | Server process memory | The length of one request or handshake | Not retained after hashing | Render (network level) |
| 2 | Keyed IP hash (HMAC-SHA-256, key changes every 24 h) | C2 | Per-IP connection cap and rate limits | Legitimate interest: abuse prevention | Server memory | Up to 24 h of linkability | Daily key rotation; lost on restart | No one |
| 3 | IP hash prefix (first 8 characters) | C2 | Correlate log lines during an abuse investigation | Legitimate interest: security | Platform logs | Render's log retention (confirm the exact period, V-01) | Render log expiry | Render |
| 4 | Message text, in transit | C3 | Deliver the message to the partner | Needed to provide the service | Server memory only | Relay, plus a recovery buffer of **up to about 100 seconds** | Buffer sweep; lost on restart | Partner |
| 5 | Message history | C3 | Let the user scroll back | Under the user's own control | The two browsers' memory (max 500 lines) | One session | Tab close, refresh, or session end | No one |
| 6 | Reactions and typing signals | C1 | Chat features | Needed to provide the service | Relayed; reactions share the recovery buffer | Same as row 4 | Same as row 4 | Partner |
| 7 | Session id, random names | C1 | Pair two people | Needed to provide the service | Server memory | One session | Session end | Partner (names only) |
| 8 | 18+ and rules acknowledgement (version accepted) | C1 | Enforce the adult-only gate | Consent; legitimate interest in child safety | Browser `sessionStorage`; server memory for the connection | Until the tab closes | Browser | No one |
| 9 | Connection token | C1 | Stop cross-site and scripted connections | Legitimate interest: security | Server memory | Seconds | Expiry | No one |
| 10 | Aggregate counters, event types, error codes | C1 | Operate and monitor | Legitimate interest | Platform logs | Render's log retention | Render log expiry | Render |
| 11 | Theme preference | C0 | Remember the user's theme | Not sent to us | Browser `localStorage` | Until the user clears it | User | No one |

### Honest notes on today's state
- **Row 4 is plaintext until M4.** The server relays readable text and holds it in memory for up to about 100 seconds so a dropped connection can catch up. It is never written to disk or logs. This is the main reason the service must not be announced publicly before M4. See [PIA risk R-01](privacy-impact-assessment.md).
- There are **no** reports, bans, country codes, interests or database yet.
- We do not read or store the browser's user agent. Render's edge may log it under its own policy.

## 4. What is added by later milestones
| Milestone | Data | Class | Purpose | Where | Kept for |
|---|---|---|---|---|---|
| M4 | Public keys | C1 | Key exchange | Relayed; server memory | One session |
| M4 | Ciphertext envelopes (replaces row 4) | C3, unreadable by us | Relay | Server memory, recovery buffer | Up to about 100 seconds |
| M5 | Country code derived from IP (local DB-IP file, no outside call) | C1 | Country matching | Server memory | While connected |
| M5 | Interests (fixed list, max 5) | C1 | Interest matching | Server memory | While searching |
| M6 | Report case: category, time, pseudonymous reporter and target | C2 | Safety enforcement; legal duties | Safety ledger (D-10) | 30 days (D-14), longer under legal hold |
| M6 | Ban record | C2 | Enforce bans | Safety ledger | 24 hours to 30 days by severity |
| M6 | No-rematch pairs | C2 | Keep a reported pair apart | Server memory | 24 hours |
| M7 | Legal-hold flag | C1 | Stop deletion when the law requires | Safety ledger | Until the DPO releases it |
| M7 | Admin audit log (actor, action, reason, time) | C2 (staff data) | Accountability | Safety ledger, append-only | 1 year |
| M8 | Rights-request tracker, breach register | C2 | Legal records | Restricted document store | 5 years (confirm with counsel) |

Report records may describe an alleged offence. Treat them as **sensitive**: restricted to the moderator and DPO roles, never exported, never in logs.

## 5. Never collected, stored or logged
Accounts, names, emails, phone numbers, government IDs, exact location, device fingerprints, analytics or advertising identifiers, cookies for tracking, message content in any log, encryption keys, raw IP addresses in any log or database.

CI already fails the build if code reads a raw IP outside `clientIp.ts` or logs outside the structured logger. A check that message content can never reach the logger is still missing (gap G-07 in the [compliance matrix](compliance-matrix.md)).

## 6. The safety ledger (proposed, D-10)
Memory-only safety state has three problems: a restart wipes bans, a deploy lets a banned user back in, and we cannot honour a legal hold. The proposal is one small PostgreSQL schema from M6.

- No message content, ciphertext, raw IP or user agent, ever.
- Identifiers are keyed hashes. Rotating the key makes old rows unlinkable.
- The application role can insert, read and delete its own tables only. Migrations run under a separate role. The audit log allows insert and read only.
- Encrypted at rest and in transit. Hosted in the same region as the app (D-13).
- A daily purge job deletes expired rows and logs how many. Backups are kept 7 days; after any restore the purge runs again so expired rows do not come back.

Options considered and why: [the archived DICT-style review](../10-reviews/2026-10-28-dict/data-privacy-and-retention.md).

## 7. The retention conflict (D-11)
RA 10175 Sec 13 and RA 11930 Sec 9 both speak of keeping traffic data and subscriber information for six months. We hold no subscriber information and almost no traffic data. Whether "hold nothing" is acceptable, or we must retain a minimal record, is a question for counsel. The options and our recommendation are in [law-enforcement-requests.md](law-enforcement-requests.md). **Until it is decided, the retention periods above are provisional.**

## 8. Processors and transfers
| Party | Role | What it handles | Location | Agreement |
|---|---|---|---|---|
| Render | Processor (hosting) | All traffic in transit, IP addresses at the edge, logs | Singapore region; United States company | Data processing addendum to be obtained and filed (G-05) |
| GitHub | Vendor (source and CI) | Source code, CI logs. **No user data** | United States | Standard terms |
| DB-IP (from M5) | Data supplier | Nothing. We download a file and look it up locally | Not applicable | Licence requires attribution |
| Managed PostgreSQL provider (from M6, if D-10 is yes) | Processor | Safety ledger | Same region as the app | To be signed before any data is stored |

Hosting in Singapore is a **cross-border transfer**. Under RA 10173 Sec 21 we remain accountable for the data wherever it is. The transfer is recorded in the [PIA](privacy-impact-assessment.md) and must be stated in the privacy notice.

## 9. Things to verify
| ID | Question | Owner |
|---|---|---|
| V-01 | Exact log retention on our Render plan, and whether Render's edge logs keep IP addresses or user agents | Operator |
| V-02 | Whether Socket.IO's recovery buffer can be shortened without breaking the 30-second reconnect promise | Engineering |
| V-03 | That no log line can ever carry message content (the raw-IP half is already checked in CI) | Engineering |
| V-04 | Retention period for the breach register and rights-request tracker | Counsel |
