# 11 · DICT-Style Security & Data Privacy Review

**Perspective:** a Philippine government ICT (DICT-style) reviewer plus the Product Owner (PO).
**Date:** 2026-10-28 · **Status:** Proposed. PO decisions need confirmation in [open-decisions](../00-overview/open-decisions.md) (D-10 to D-15).

> **Honest scope note.** This is an *engineering review written from the DICT point of view*. It is **not** an official DICT or NPC opinion, and it is not legal advice. Statute and circular citations must be verified by a Philippine lawyer before launch (already required in M6/M8).

## Questions this folder answers
| Question | Document |
|---|---|
| Which gates must each milestone pass before it deploys? | [milestones.md](milestones.md) |
| Do we make data last? What, where, how long, which database? | [data-privacy-and-retention.md](data-privacy-and-retention.md) |
| What can operators, moderators and the DPO actually do? | [management-capabilities.md](management-capabilities.md) |
| How do we deploy without exposing users? | [deployment-security.md](deployment-security.md) |
| Which tools do we use, and what do they say today? | [tooling.md](tooling.md) |
| How does this map to DICT / NPC / CICC expectations, and what did earlier docs get wrong? | [compliance-crosswalk.md](compliance-crosswalk.md) |

## Headline findings
1. **Messages must not last.** ADR-0005 stands: no server-side message storage, no message database.
2. **RA 10175 Sec 13 vs. "discard IP in milliseconds".** The law has a 6-month preservation rule for traffic data. Our design keeps almost none. Counsel must decide the position (D-11).
3. **Safety state is in memory only**, so a restart wipes bans and reports. A small durable "safety ledger" is proposed (D-10).
4. **Today's code is the M1 walking skeleton.** It has no origin check, no rate limit, no headers and a global broadcast. It must not be deployed publicly until M2 gates pass.
5. **`npm audit` shows 3 vulnerabilities** (2 high, 1 moderate) in the lockfile. See [tooling.md](tooling.md).
