# Child Protection and Online Safety Obligations

**Last reviewed:** 2026-11-13 · **Owner:** Child-safety officer (to be named, D-12) · **Applies from:** the first public deployment

Our legal duties on child safety, gender-based online harassment and trafficking, and the procedure for each. How the controls are built is in [04-security/trust-and-safety.md](../04-security/trust-and-safety.md).

> **Child safety is a launch blocker.** Anonymous stranger chat is the product shape that Omegle shut down over. No public announcement happens before the M6 controls and this procedure are live.

## 1. Our duties as an internet intermediary (RA 11930)
Deadlines below are engineering's reading of Sec 9 and its IRR. **Counsel must confirm each one (◻).**

| Duty | Deadline ◻ | How we meet it | Status |
|---|---|---|---|
| Prohibit child sexual abuse or exploitation in our terms | Before launch | Rules page and terms of service | 🔜 M6 |
| Have mechanisms to prevent, detect, respond and report | Before launch | Section 2 | 🚧 |
| Notify the PNP or NBI on learning that abuse is being committed through our service | **Within 48 hours** of receiving the information | Section 3. Internal target: 24 hours | Procedure written |
| Block or take down on notice from a competent authority | **Within 24 hours** of the notice | Ban by hash; maintenance mode if needed | 🚧 bans in M6 |
| Report the action taken to the DOJ | Within the period the Act sets | DPO files the report | 🔜 |
| Preserve data in our control and possession | Six months, extendible | Legal hold on the report case | 🔜 M7 |
| Give user particulars to authorities on lawful request | As ordered | [law-enforcement-requests.md](law-enforcement-requests.md) | Procedure written |

RA 11930 states that these duties apply notwithstanding the Data Privacy Act. Preserving and reporting under this Act is a lawful basis for processing.

## 2. Prevention by design
| Control | Why it matters for child safety | Status |
|---|---|---|
| 18+ gate enforced by the server | States the service is for adults; no chat without it | ✅ |
| Text only: no images, video, voice, files | Removes the medium for abuse material | ✅ by design |
| No profiles, no user-chosen names, no friend lists | Nothing to browse or search for; no grooming over time | ✅ by design |
| No way to reconnect with the same person | Breaks repeated contact | ✅ by design; no-rematch in M6 |
| Links shown as plain text | Makes it harder to move a child to another platform | ✅ |
| Safety line at the start of each chat | Reminds users not to share personal details | ✅ |
| Curated interests: no dating, sexual or age-related tags | Removes signals predators look for | 🔜 M5 |
| `/report minor` with priority handling | The detection route | 🔜 M6 |
| Rate limits on `/start` and `/next` | Slows someone cycling through strangers looking for a target | ✅ |
| Behaviour monitoring (report clusters, skip patterns) | Detection without reading content | 🔜 M7 |

**The limit we state openly:** age is self-declared, and from M4 we cannot read messages. We cannot detect abuse in content. Detection depends on reports and behaviour. See accepted risk in the [PIA](privacy-impact-assessment.md).

## 3. Procedure: a `minor` report or any sign of child abuse
| Step | Action | Who | When |
|---|---|---|---|
| 1 | The report enters the priority queue. The reported hash is blocked from matching at once, pending review | Automatic | Immediately. **Built differently:** the report writes a `report_priority` log line and the summary tool leads with it, but it does **not** block at once (three different reporters block, as for any category). A one-report block is abusable; owner and counsel decide ([limits L-36](../00-overview/limits-and-roadmap.md)) |
| 2 | Set a legal hold on the report case and related records | Automatic, or moderator | Immediately. **Not built:** there is no case file or ledger (D-10); the log line is the only record |
| 3 | Review what we have: category, any second category (for example `sexual`), time, earlier reports on the same hash | Child-safety officer | Within 24 hours |
| 4 | Decide: does the information indicate sexual abuse or exploitation of a child? If yes or unsure, go to step 5. If clearly not (for example "they said they were 17" with nothing else), keep the block, record the reason | Child-safety officer | Within 24 hours |
| 5 | Report to the **PNP Women and Children Protection Center** or the **NBI**. Give the report record, times, and the plain statement of what we do not hold | Child-safety officer | **Within 48 hours of the report** ◻ |
| 6 | Extend the ban. Keep the hold until the authority or counsel releases it | Moderator | After step 5 |
| 7 | Record every action and time in the case file | Child-safety officer | Throughout |

Which reports must be forwarded (every `minor` report, or only those with signs of abuse) is a threshold for **counsel to set**. Until then: when unsure, report.

### What staff must never do
- Ask the reporter to send screenshots, images or the messages. We do not want the material and must not hold it
- Contact, question or warn the reported user
- Investigate on their own, pose as a child, or try to identify anyone
- Delete anything related to the report
- Discuss the case outside the officer, the DPO and counsel

## 4. Gender-based online sexual harassment (RA 11313)
The Safe Spaces Act makes online sexual harassment a crime **by the person who does it**. It does not clearly list duties for a platform (◻ counsel to confirm). We act anyway, because a victim needs a way out and a way to complain.

| What a user needs | What we give | Status |
|---|---|---|
| Stop it now | `/next` and `/leave`, one keystroke, always work | ✅ |
| Never meet that person again | No-rematch after a report | 🔜 M6 |
| Report it | `/report harassment`, `/report sexual`, `/report hate`, `/report threats` | 🔜 M6 |
| See action | Three distinct reporters in an hour: 24-hour block; repeat offenders escalated to a moderator | 🔜 M6, M7 |
| Take it to the police | The rules page explains that complaints go to the PNP Anti-Cybercrime Group, and what we can and cannot give investigators | 🔜 M6 |

Honest limit: we cannot give a victim the harasser's identity or a transcript. The rules page must tell users this, and tell them a screenshot taken during the chat is their own evidence.

## 5. Trafficking (RA 9208 as amended)
If a report or pattern suggests trafficking, follow the procedure in section 3 and also notify the Inter-Agency Council Against Trafficking through the authority receiving the report.

## 6. Threats of violence
A `threats` report is priority. If it describes an immediate danger to life, use the emergency path in [law-enforcement-requests.md](law-enforcement-requests.md).

## 7. People
| Role | Duty |
|---|---|
| Child-safety officer (named person, with a backup) | Owns section 3; reachable within 24 hours every day |
| Moderator | Works the queue; never sees content |
| DPO | Legal holds, authority correspondence, privacy duties |
| Counsel | Thresholds, deadlines, correspondence review |

Everyone who handles reports reads this page and the rules page before their first shift, and again each year. Reviewing abuse reports is hard work: keep shifts short and make sure reviewers can step away.

## 8. Done when
- [ ] Child-safety officer and backup named (D-12)
- [ ] Deadlines and the forwarding threshold confirmed by counsel
- [ ] Reporting contacts for the PNP and NBI verified and kept in the incident contact sheet
- [ ] `/report minor` flow, auto-block and legal hold tested (M6, M7)
- [ ] One practice case run end to end before launch
