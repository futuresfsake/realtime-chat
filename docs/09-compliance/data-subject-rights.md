# Data Subject Rights Procedure

**Last reviewed:** 2026-11-13 · **Owner:** DPO (D-12) · **Live from:** M8 (the intake channel does not exist yet, gap G-16)

RA 10173 Sec 16 and 18 give every person rights over their personal data. Because we are anonymous by design, the honest answer to most requests is "we hold nothing that can be tied to you". This procedure makes sure we still answer properly, on time, and with a record.

## 1. The rights and our answer
| Right | What the user can ask | Our answer |
|---|---|---|
| To be informed | What do you do with my data? | The privacy notice at the 18+ gate, in plain language |
| Access | What do you hold about me? | Nothing linked to an identity. If the user gives a report case ID, we can confirm that case exists, its category and date |
| Rectification | Correct my data | Nothing to correct: we hold no profile |
| Erasure or blocking | Delete my data | Session data is gone when the chat ends. IP hashes become unlinkable within 24 hours. A report case can be deleted early unless a legal hold applies |
| Object, withdraw consent | Stop processing | Close the tab. Nothing continues |
| Portability | Give me a copy | Nothing held. Chat history exists only in the user's own browser while the chat is open |
| Damages, complaint | I was harmed | Contact the DPO first; the user may complain to the National Privacy Commission at any time |

## 2. Why we usually cannot find "your" data
We cannot look a person up by name, email or phone because we never have them. An IP address alone does not prove who is asking, and we do not keep raw IPs. So:

- We **never** ask for an ID to process a request. That would collect more data than we protect.
- The only handle a user can give us is a **report case ID** (shown to the reporter when they file a report, from M6).
- If someone asks "what did the person I chatted with say about me?", the answer is that we have no chat content.

## 3. Steps
| Step | Who | When |
|---|---|---|
| 1. Request arrives at the DPO contact published in the privacy notice | DPO | Day 0 |
| 2. Log it in the rights-request tracker: date, right invoked, case ID if any. **Do not** log the requester's identity beyond a reply address | DPO | Day 0 |
| 3. Acknowledge | DPO | Within 3 working days |
| 4. Check the safety ledger for the case ID; check for a legal hold | DPO | Within 10 days |
| 5. Reply in plain language: what we hold, what we did, or why we hold nothing | DPO | **Within 30 days** (◻ confirm the period with counsel) |
| 6. If we refuse (legal hold, or a request that would expose another person), say why and name the NPC as the place to complain | DPO | With the reply |
| 7. Delete the reply address from the tracker when the request closes | DPO | On closure |

## 4. Requests we must be careful with
| Situation | What to do |
|---|---|
| The request is really a law-enforcement request | Stop. Use [law-enforcement-requests.md](law-enforcement-requests.md) |
| A parent says their child used the service | Treat as a child-safety report: [child-protection-and-online-safety.md](child-protection-and-online-safety.md) |
| The requester asks about another person | Refuse. We do not disclose anything about one user to another |
| Erasure of a record under legal hold | Refuse for now, explain that the law requires us to keep it, erase when the hold is released |

## 5. Records
The tracker holds: request date, right, case ID, outcome, closing date. No names. Retention: to be confirmed by counsel (V-04 in the [data inventory](data-inventory-and-retention.md)).

## 6. Done when
- [ ] DPO contact published in the privacy notice and `SECURITY.md`
- [ ] Tracker exists and is restricted to the DPO
- [ ] Reply templates reviewed by counsel
- [ ] One practice request handled end to end before launch
