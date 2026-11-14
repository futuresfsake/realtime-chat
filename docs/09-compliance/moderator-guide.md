# Moderator guide (DRAFT)

> **Status: no moderator exists yet, and this guide has not been reviewed by counsel.** It describes the job as it can be done **with what is built today** (a command-line summary of the server's logs), so that whoever takes the role starts from something real. Legal points marked ◻ are unverified. People are named in [D-12](../00-overview/open-decisions.md); roles and limits are in [roles-and-access.md](roles-and-access.md); the child-safety procedure is in [child-protection-and-online-safety.md](child-protection-and-online-safety.md).
>
> **Version:** draft 1 · **Date:** 2026-11-14

## 1. What the job is, and is not
You look for **patterns of abuse** from counts and categories, and you make sure the serious ones reach the right person fast. You do **not** read chats, because **nobody can**: messages are end-to-end encrypted and the server never has them. You cannot identify anyone, because the logs hold only an 8 character fragment of a scrambled network address that changes every day.

That is a deliberate privacy promise, and it limits what you can do. You cannot confirm what happened in a chat. You can see that something was reported, how often, and whether several different people said the same about the same connection.

## 2. What you can and cannot see
| You can see | You cannot see, and must never try to get |
|---|---|
| Report counts by category | Message text or ciphertext |
| Priority reports (`minor`, `threats`) | Anyone's address, name or location |
| Which 8 character prefixes were reported more than once | Who reported whom (the reporter is not in the log) |
| Which connections were blocked, and when | Which interests or country anyone chose |
| Alerts (report spikes, connection spikes, error spikes) | Anything about a chat that was not reported |
| Signs of automation (puzzle refusals, refused connections) | |

A prefix is only a hint: two different connections can share one. Never treat it as proof of who someone is.

## 3. The tool
```
npm run moderation -- <logfile> --since 24h        # a readable summary
npm run moderation -- <logfile> --since 7d --json   # the same, for a spreadsheet
<command that prints logs> | npm run moderation -- - --since 24h
```
It reads the server's log lines and nothing else; it does not connect to the server. The logs come from the host's log viewer or export (7 days are kept on the free tier, so **export weekly**). The summary has a **NEEDS A PERSON** section first: read that, then the rest.

**Access:** the host's account with multi-factor authentication, one account per person, no shared logins, reviewed every quarter. There is no web admin page, so there is no admin password or API key to protect. If one is built later, it needs authentication and an audit log first.

## 4. Every day (about ten minutes)
1. Export or open the last 24 hours of logs and run the summary.
2. Read **NEEDS A PERSON**. A priority report goes to section 5 **now**, not at the end of the day.
3. Look at **blocks**. Each block means three different connections reported one. Ask: do the categories fit one pattern (for example repeated `harassment`)? Does it look like a pile-on, with many reports in a few minutes?
4. Look at **alerts**. A `report_spike` means more than 20 reports in 10 minutes: check whether it is one event or a campaign, and whether the reports name one prefix (a possible raid) or many (an incident).
5. Look at **automation signals**. A burst of puzzle refusals or refused connections suggests a script. Tell the operator.
6. Write one line in the review log (section 7).

## 5. A priority report (`minor` or `threats`)
The goal is that the right person hears **the same day**. You do not investigate.

1. Note the time, the category and the 8 character prefix.
2. **Tell the child-safety officer** (and their backup if they cannot be reached) straight away. For a `minor` report the officer follows the [child-safety procedure](child-protection-and-online-safety.md#3-procedure-a-minor-report-or-any-sign-of-child-abuse): review within 24 hours, decide, and if there are signs of abuse or the officer is unsure, **report to the PNP or NBI within 48 hours**. ◻ Counsel sets the exact threshold.
3. For `threats`, tell the operator and the child-safety officer. If a report suggests someone is in immediate danger, **the reporter should contact the police themselves**: they hold the evidence and we do not.
4. Do not wait for a block. A block needs three reporters and may never happen for a serious single report.

**Known gap:** the procedure says a `minor` report should block the reported connection immediately. The software does **not** do that (see [limits L-36](../00-overview/limits-and-roadmap.md)): one report is counted like any other. Treat the priority line as the alarm.

### Never
- Ask the reporter for screenshots, images or messages. We do not want the material and must not hold it.
- Contact, question or warn the reported person, or try to find out who they are.
- Pose as a child, or investigate on your own.
- Delete anything related to a report.
- Discuss a case outside the child-safety officer, the DPO and counsel.

## 6. Mistakes and appeals
- **Blocks end by themselves** after 24 hours. There is no button to lift one.
- A wrongly blocked person writes to the contact address in the [terms](policies/terms-of-service.md). Answer honestly: we can see a report count and a prefix, not what was said, and on a shared network (a school, mobile data) a block can reach others on it.
- Restarting the server clears every block, report count and active chat. **Do not do that for one person.** It is for a serious wrongful-block incident only, decided by the operator.
- A suspected **coordinated false-report campaign** (many reports against one prefix in minutes, from connections that never chat) is an incident: tell the operator and write it down.

## 7. Keeping a record
One line per day in the review log, kept by the DPO. It must **not** contain anything personal, only: date, who reviewed, reports by category, priority reports and who was told, blocks, alerts, any decision and why. Example: `2026-11-14 · reviewer · 3 reports (2 harassment, 1 spam) · 0 priority · 1 block · no action`.

## 8. What the law asks of you ◻
Short and **unverified until counsel confirms**; the source is the [regulatory register](regulatory-register.md).
- **RA 10173 (Data Privacy Act):** handle only what you need, keep nothing personal, report a suspected breach to the DPO at once (72-hour clock, see [breach-notification.md](breach-notification.md)).
- **RA 11313 (Safe Spaces Act):** online sexual harassment is covered; the `harassment` and `sexual` categories exist for this.
- **RA 11930 (Anti-OSAEC law):** child sexual abuse or exploitation is a crime and must be reported to the authorities within the time set in the child-safety procedure.
- **RA 10175 (Cybercrime Prevention Act):** lawful orders from the authorities go to counsel and the DPO, not to you. See [law-enforcement-requests.md](law-enforcement-requests.md).

## 9. Before you start (training checklist)
- [ ] Read this guide, the [child-safety procedure](child-protection-and-online-safety.md) and [roles-and-access.md](roles-and-access.md)
- [ ] Read the [privacy notice](policies/privacy-notice.md) and [community rules](policies/community-rules.md) drafts, so you know what users were told
- [ ] Run `npm run moderation` on a sample log and explain every section back to the DPO
- [ ] Know who the child-safety officer and DPO are and how to reach them, day or night
- [ ] Walk through a priority report with the officer (a tabletop exercise)
- [ ] Sign that you have read the "Never" list
- [ ] Counsel has confirmed the legal points marked ◻

## 10. Looking after yourself
Reports of threats or of harm to children are heavy even without reading messages. Take breaks, say if it is affecting you, and make sure the backup can take over.
