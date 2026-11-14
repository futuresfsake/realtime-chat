# Personal Data Breach Notification

**Last reviewed:** 2026-11-13 · **Owner:** DPO (D-12) · **Never drilled yet** (gap G-02; first drill in M10)

What we do when personal data may have been exposed. The clock is short: under RA 10173 Sec 20(f) and NPC Circular 16-03 (◻ verify the current circular), the National Privacy Commission and the affected people must be notified **within 72 hours** of knowing, or reasonably believing, that a notifiable breach happened.

General incident handling (severity, containment, templates) is in the [incident response plan](../06-operations/incident-response-plan.md). This page covers only the privacy duties.

## 1. Is it a personal data breach?
A breach is any loss of confidentiality, integrity or availability of personal data: someone saw it who should not, it was changed, or it was lost.

| Event | Personal data breach? |
|---|---|
| Server compromised or memory dumped **before M4** | **Yes, serious:** live message text may be exposed |
| Server compromised after M4 | Yes: IP hashes and, from M6, report records. Not message content |
| Safety ledger read, copied or leaked | Yes |
| The IP-hash secret leaks | Yes: hashes from that day can be linked. Rotate it at once |
| A log line is found containing a raw IP or message text | Yes: treat as a breach even if no outsider saw it |
| Render reports an incident affecting our service | Yes, until shown otherwise |
| Outage with no data exposure | No. It is an incident, not a breach |
| A user's partner screenshots the chat | No. That is user conduct, covered by the rules |

## 2. Must we notify?
Notification is mandatory when **all three** are true (◻ per NPC Circular 16-03):
1. The data is sensitive personal information, or information that could enable identity fraud;
2. There is reason to believe an unauthorized person may have acquired it;
3. The acquisition is likely to give rise to a real risk of serious harm to the people affected.

Our position: **when in doubt, notify.** Chat content can contain anything, and report records may allege offences, so treat both as sensitive. Every breach is logged in the breach register whether or not it is notifiable.

## 3. The 72 hours
The clock starts when anyone on the team knows or reasonably believes there was a breach, not when the investigation ends.

| When | Action | Who |
|---|---|---|
| Hour 0 | Record the time of discovery. Tell the DPO. Open an incident record | Whoever finds it |
| Hours 0 to 4 | Contain: maintenance mode, rotate `IP_HASH_SECRET` and other secrets, revoke access, preserve evidence (do not wipe logs) | Operator |
| Hours 4 to 24 | Assess: what data, how many people, was it acquired, what harm is likely. Apply the test in section 2. Call counsel | DPO |
| By hour 48 | Draft the NPC notification and the notice to users. Counsel reviews | DPO |
| **By hour 72** | Submit to the NPC through its breach notification system. Publish the user notice | DPO |
| After | Send the fuller report if the first one was incomplete; fix the cause; hold a review within 48 hours of closing | DPO, engineering |

If the full facts are not known by hour 72, notify with what is known and say more will follow. A late complete report is worse than a timely partial one. Concealing a breach is a criminal offence under the Act.

## 4. What the NPC notification contains
- Nature of the breach, how and when it happened, when we learned of it
- The personal data possibly involved and the likely number of people affected
- Measures taken to contain it and reduce harm
- What we are doing to stop it happening again
- Name and contact details of the DPO

A template is in the [incident response plan](../06-operations/incident-response-plan.md).

## 5. Telling affected users
We cannot message individuals: we have no accounts, emails or phone numbers. So the notice to data subjects is **public**:
- A banner on the site and a notice page, for at least 30 days
- In plain language: what happened, what data, what it means for them, what we did, what they can do, how to reach the DPO and the NPC

Ask counsel and the NPC whether this public notice satisfies individual notification in our case (◻).

## 6. Breach register
One row per event, kept by the DPO: date found, description, data involved, estimated people affected, notifiable (yes or no and why), actions, dates of notifications, lessons. Restricted access. Created at M8.

## 7. Other reports that may be needed
| If the breach also involves | Also tell |
|---|---|
| A crime (intrusion, extortion) | PNP Anti-Cybercrime Group or NBI Cybercrime Division |
| A significant security incident | The national CERT (DICT) |
| A child-safety matter | Follow [child-protection-and-online-safety.md](child-protection-and-online-safety.md) |

## 8. Done when
- [ ] DPO named, with a backup who can act if the DPO is unreachable
- [ ] Breach register created
- [ ] NPC submission route tested (account exists, form known)
- [ ] Tabletop drill completed inside 72 hours (M10)
