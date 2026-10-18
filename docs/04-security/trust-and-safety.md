# Trust & Safety

Security protects the **system** from attackers. Trust & Safety protects **users from each other**. For an anonymous stranger chat, this is the make-or-break part.

## 1. Why this matters
- **Omegle (2009–2023)** connected anonymous strangers and shut down after sustained abuse, including harm to minors. Our product has the same shape, so these controls are **launch requirements**.
- E2EE means **we can't read message content after encryption**. Safety must come from design (limits, gates, reporting, friction for abusers), automated behavioral monitoring, and human moderator oversight of abuse patterns.
- **Philippine law requires it:** the Safe Spaces Act (RA 11313) mandates mechanisms against gender-based online harassment, the Anti-OSAEC Law (RA 11930) requires child safety controls, and the Cybercrime Prevention Act (RA 10175) expects reasonable security measures.

## 2. Risks
| Risk | Who's harmed | Likelihood |
|---|---|---|
| Minors using the service | Minors | High without a gate |
| Harassment, hate, sexual messages | Chatters | High |
| Users sharing personal info (doxxing themselves or others) | Chatters | Medium |
| Spam / scam links / bots | Chatters | High |
| Ban evasion via VPN | Everyone | Medium |

## 3. Controls
| # | Control | How | Milestone |
|---|---|---|---|
| S-01 | **18+ gate + rules** | Must confirm "I am 18 or older" and accept the rules before the first search; the server refuses `session:start` without consent | M6 |
| S-02 | **Text only** | No images, files, voice or video, which removes the worst content types | by design |
| S-03 | **No user-chosen names, no profiles** | Nothing to impersonate or search for | M3 |
| S-04 | **Instant exit** | `/next` and `/leave` always work, in one keystroke | M3 |
| S-05 | **Report** | `/report <reason>` ends the chat and prevents rematch | M6 |
| S-06 | **Automatic temporary bans** | 3 reports from **distinct** IP hashes within 1 h → blocked from matching for 24 h | M6 |
| S-07 | **Rate limits** | Messages, `/start`/`/next` (stops bots "farming" matches), reports | M2 |
| S-08 | **Personal info warning** | First message of every session: `*** stay safe: don't share your name, address, phone or social accounts` | M3 |
| S-09 | **Link friction** | URLs are displayed as plain text, never clickable | M3 |
| S-10 | **IP hidden from partners** | Server relay, not WebRTC (ADR-0008) | by design |
| S-11 | **Curated interests** | No dating/sexual/political tags (matchmaking.md) | M5 |
| S-12 | **Clear rules page** | Plain language; what's not allowed; how reporting works; references RA 11313 and RA 11930 obligations | M6 |
| S-13 | **Automated behavioral monitoring** | Track report velocity, session patterns, connection anomalies, and abuse scoring per IP hash; flag patterns for human review | M7 |
| S-14 | **Human moderator review** | Scheduled review of aggregated report data, abuse trends, and escalated cases; moderators never see message content | M7 |
| S-15 | **Content filters (pre-encryption)** | Client-side filters for known slurs, spam patterns, and personal info warnings; server enforces content policy acknowledgment | M6 |
| S-16 | **Escalation workflow** | Reports tagged `minor` or `threats` are flagged for immediate human moderator review; documented escalation to law enforcement when required by RA 11930 | M7 |

### Why "distinct reporters"?
One angry user could report everyone they meet. Requiring 3 **different** reporters within an hour makes bans reflect a pattern, not one opinion.

### Collateral risk of IP-based bans
Mobile carriers often share one public IP among many users (CGNAT). A ban could hit innocent people on the same IP, so bans are **short (24 h)** and affect **matching only** (the page still loads with an explanation).

## 4. Automated monitoring

E2EE means we can't read message content, but we can monitor behavioral signals at the metadata level to detect and respond to abuse.

| Signal | What it detects | Action |
|---|---|---|
| Report velocity | Multiple reports against same IP hash in a short window | Auto-ban after 3 distinct reporters / 1 hour |
| Session churn | Rapid match-and-skip cycles (potential predatory scanning) | Rate limit on `/next` and `/start` |
| Connection spikes | Same IP opening many sockets quickly | Per-IP cap (5 sockets), escalating cooldown |
| Report category clustering | Multiple `minor` or `harassment` reports against one IP hash | Priority escalation to human moderator |
| Message frequency | Burst messaging beyond normal conversation patterns | Rate limiting, temporary cooldown |
| Ban recurrence | Same IP hash triggering bans repeatedly across salt rotations | Extended monitoring flag |

Monitoring data is aggregated and anonymized (IP hashes only, no raw IPs, no content). Logs are retained for 7-30 days and contain no message content.

## 5. Human moderator oversight

Human moderators **do not read encrypted conversations**. Their role is to oversee automated systems and handle escalations.

### Moderator responsibilities
1. Review aggregated report patterns on a regular schedule (at minimum weekly)
2. Adjust automated filter thresholds and ban parameters based on observed abuse trends
3. Handle escalated reports (child safety concerns, credible threats, repeat offenders)
4. Coordinate with law enforcement when required by RA 10175, RA 11930, or valid court orders
5. Update community guidelines based on observed behavior patterns
6. Monitor abuse metrics: report volume, ban frequency, false positive indicators

### Moderator access
- Moderators see: report reason codes, IP hash prefixes, timestamps, session metadata, abuse scores
- Moderators **never** see: message content, encryption keys, raw IP addresses, full IP hashes

### Moderator training
Moderators must be trained on:
- Philippine laws: RA 11313 (Safe Spaces Act), RA 11930 (Anti-OSAEC), RA 10173 (Data Privacy Act)
- Escalation procedures for child safety concerns
- Law enforcement cooperation procedures
- Data privacy obligations when handling report data

## 6. What we deliberately don't do
| Not doing | Why |
|---|---|
| Reading or scanning encrypted messages | E2EE makes this impossible by design; safety relies on behavioral monitoring and user reports |
| Collecting chat transcripts with reports | Unverifiable content, privacy cost, and RA 10173 data minimization |
| Identity / ID verification | Contradicts anonymity; creates data collection obligations under RA 10173 |
| Permanent bans | No reliable identity; collateral damage from shared IPs (CGNAT) |

## 7. Rules (draft for the rules page)
1. You must be **18 or older**.
2. No harassment, threats, hate speech or bullying.
3. No sexual content involving minors, ever. No unsolicited sexual content.
4. Don't share personal information, yours or anyone else's.
5. No spam, scams, or advertising.
6. Be kind. You can always `/next`.

## 8. Legal compliance *(not legal advice)*

The platform operates from the Philippines and must comply with the following statutes:

| Law | Key obligation for this platform |
|---|---|
| **Data Privacy Act (RA 10173)** | Minimize data collection, publish privacy notice, appoint DPO, breach notification |
| **Cybercrime Prevention Act (RA 10175)** | Implement security measures, cooperate with law enforcement, preserve data on valid legal orders |
| **Anti-OSAEC Law (RA 11930)** | Prevent child exploitation, report CSAEM to authorities, implement child safety controls |
| **Safe Spaces Act (RA 11313)** | Provide mechanisms to report gender-based harassment, take action on reports, don't facilitate harassment |

With a global audience, additional laws may apply (GDPR for EU users, COPPA considerations for US). **Before M8, have the rules, the age gate, and the privacy notice reviewed by a qualified Philippine lawyer.**
