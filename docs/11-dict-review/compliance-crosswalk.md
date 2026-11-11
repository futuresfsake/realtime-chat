# Compliance Crosswalk and Corrections

> Citations are from the reviewer's knowledge and **must be verified by counsel**. Where unsure, the row says so.

## 1. Crosswalk
| Source | Expectation | Where we meet it | Status |
|---|---|---|---|
| RA 10173 (Data Privacy Act of 2012) | Transparency, legitimate purpose, proportionality; security measures; breach notice | [data-privacy-and-retention.md](data-privacy-and-retention.md), M6 notice | Planned |
| NPC Circular 16-03 | Breach notification within 72 hours | [incident-response-plan.md](../09-it-review/incident-response-plan.md); breach register in M8 | Gap CG-02 |
| NPC registration of DPO and processing systems | Register where thresholds apply (verify current NPC circular) | Counsel to confirm threshold | Open |
| Privacy Impact Assessment | Required for high-risk processing; follow current NPC guidance (verify which advisory applies) | PIA drafted at M6, signed at M8 | Gap CG-05 |
| RA 10175 Sec 13 | 6-month preservation of traffic data; content on order | D-11 | **Decision needed** |
| RA 11313 Sec 12 | Online gender-based harassment reporting and action | Report categories, bans (M6) | Planned |
| RA 11930 | Child protection: prevention, reporting, designated officer | 18+ gate, `minor` escalation | Planned |
| DICT Cloud First Policy (Dept. Circular 2020-010) | Government-facing: prefer secure cloud; classify data; use accredited hosting | We are private, but we apply the same data classification and region record | Applied voluntarily |
| National Cybersecurity Plan 2023 to 2028 | Protect critical info, build capacity, public-private cooperation | Vulnerability disclosure policy, incident contact | `SECURITY.md` |
| PH CERT / CICC reporting | Report significant incidents to national CERT | Contact in incident plan | Add contact |

## 2. Corrections to earlier docs (to be applied as separate PRs)
| File | Issue | Fix |
|---|---|---|
| `09-it-review/compliance-matrix.md` | Heading says "Data Privacy Act of 2010" | The Act is **2012** |
| `09-it-review/compliance-matrix.md` | Lists RA 10175 "Sec 12 real-time collection" as an obligation | The Supreme Court (*Disini v. Secretary of Justice*, 2014) struck down Sec 12. Verify, then remove |
| `09-it-review/compliance-matrix.md` | Cites NPC Circular 16-01 for PIA | 16-01 concerns government agencies' data security. Verify the correct PIA guidance |
| `09-it-review/compliance-matrix.md` | Preservation row says only "procedure needed" | Add the 6-month traffic-data rule and link D-11 |
| `04-security/privacy-and-sessions.md` | "No raw IPs logged" with no legal caveat | Link D-11 |
| `package.json` | Still depends on `better-sqlite3` | Remove (D-05, ADR-0005) |

## 3. Decisions needed from the PO / owner
| ID | Decision | Recommendation |
|---|---|---|
| D-10 | Add a durable safety ledger (PostgreSQL) at M6? | Yes, minimal and expiring |
| D-11 | Position on RA 10175 Sec 13 | Option C (preserve on demand), confirm with counsel |
| D-12 | Who is DPO and compliance officer? | Name a person, not "the operator" |
| D-13 | Hosting region | Keep Singapore; record the cross-border transfer in the PIA |
| D-14 | Retention of report cases | 30 days |
| D-15 | Public vulnerability disclosure policy | Yes, via `SECURITY.md` |
