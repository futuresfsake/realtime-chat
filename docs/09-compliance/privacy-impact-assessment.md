# Privacy Impact Assessment (PIA)

**Status:** DRAFT, not signed · **Version:** 0.1 (2026-11-13) · **Owner:** DPO (D-12) · **Sign-off needed at:** M8

A PIA asks, before launch: what personal data does this system touch, what could go wrong for the people behind it, and are our controls enough? It follows the outline in NPC Advisory 2017-03 (◻ verify the current guidance). Redo it when a feature changes what data we touch.

## 1. Project
| | |
|---|---|
| System | realtime-chat: anonymous one-to-one text chat between adults |
| Controller | The operator (legal entity pending, D-16) |
| Processor | Render (hosting, Singapore region) |
| Users | Adults, initially in the Philippines |
| Stage | M3 code complete; not publicly deployed |

## 2. Is a PIA needed? (threshold)
| Question | Answer |
|---|---|
| Do we process personal data? | Yes: IP addresses (briefly), keyed IP hashes, and from M6 report records |
| Vulnerable people? | Possibly: minors may lie at the 18+ gate; users may be harassed |
| Sensitive information? | Users may type anything, including sensitive facts. Report records may allege offences |
| Data leaves the Philippines? | Yes: hosted in Singapore by a United States company |
| New or high-risk technology? | Anonymous stranger chat is a known high-risk category |

**Result: a full PIA is required.**

## 3. Data flows
The full list is the [data inventory](data-inventory-and-retention.md). In short:

```
Browser ──TLS──▶ Render edge (sees IP) ──▶ Our Node.js process
                                              │ IP ─▶ keyed hash (memory, 24 h) ─▶ rate limits
                                              │ message ─▶ relay to partner (+ ~100 s recovery buffer)
                                              │ events, counts, hash prefix ─▶ platform logs
                                              ▼
                                           Partner's browser (history in memory only)
```
From M4 the message is ciphertext the server cannot read. From M6 a report writes a small record to the safety ledger.

## 4. Who was consulted
| Stakeholder | How | Status |
|---|---|---|
| Product owner | Open decisions D-10 to D-18 | In progress |
| Engineering | Threat model, security checklist | Done for M2, M3 |
| Legal counsel | Review of this PIA and the public documents | Not engaged (D-17) |
| Users | Beta feedback on the gate and rules wording | Planned for the beta |

## 5. Necessity and proportionality
| Purpose | Could we do it with less? | Conclusion |
|---|---|---|
| Rate limiting and connection caps by IP | We already keep only a keyed hash that expires daily | Proportionate |
| Recovery buffer for dropped connections | A shorter buffer loses messages on mobile networks (V-02 checks whether it can shrink) | Proportionate once encrypted (M4) |
| Report records for 30 days | Needed to see patterns and to meet legal duties | Proportionate; period to confirm (D-14) |
| Country matching by IP lookup | Only a two-letter code is kept, in memory | Proportionate |
| Logging a hash prefix | 8 characters correlate events without identifying anyone on their own | Proportionate |

**Legitimate-interest test** (for abuse prevention and security): the purpose is lawful and real; the processing is necessary and cannot be done with less; users would expect a chat service to stop spam and abuse, and the data is pseudonymous and short-lived, so their interests do not override ours. Counsel to confirm (G-13).

## 6. Risks
Likelihood and impact: Low, Medium, High. Residual is what remains after the controls.

| ID | Risk to the person | L | I | Controls | Residual | Owner |
|---|---|---|---|---|---|---|
| R-01 | Message text is readable on the server and held in memory for up to about 100 s (before M4). A memory dump or a compromised server exposes live chats | M | H | No disk, no logs; not announced publicly; preview banner; E2EE in M4 | **High until M4**, then Low | Engineering |
| R-02 | A minor passes the self-declared 18+ gate and is exposed to an adult | M | H | Gate enforced by server; text only; no profiles or re-contact; `minor` report with priority escalation; rate limits on `/next` | **Medium, accepted with reasons** (see 7) | Child-safety officer |
| R-03 | A user is harassed or sexually harassed | H | M | One-key exit; reports and bans (M6); content warnings; no way to find the person again | Medium until M6, then Low to Medium | Engineering |
| R-04 | A user reveals personal details to a stranger | H | M | Safety line at the start of every chat; links not clickable; personal-info warning (M6) | Medium | Product |
| R-05 | Logs or the ledger let someone link sessions to a person | L | M | No raw IP anywhere; keyed hash with daily rotation; only a prefix in logs; role-limited access | Low | Engineering |
| R-06 | The processor or its staff access data | L | M | Minimal data; processor agreement (G-05); E2EE from M4 | Low | Operator |
| R-07 | Data held abroad is reached under foreign law | L | M | Almost nothing is stored; stated in the privacy notice | Low | DPO |
| R-08 | We cannot meet a lawful order because we keep nothing, or we keep more than promised to meet one | M | M | Decision D-11; legal hold; honest statement of what exists | Medium until decided | Owner, counsel |
| R-09 | A false report gets an innocent user banned | M | L | Three distinct reporters; 24-hour limit; moderator can lift; appeal route in the rules | Low | Moderator |
| R-10 | A breach of the safety ledger exposes report records | L | M | Hashed identifiers; no content; encryption; least privilege; 30-day purge | Low | Engineering |
| R-11 | Users do not understand what we do with their data | M | L | Plain-language notice at the gate; "what we can't promise" section | Low | DPO |
| R-12 | The JavaScript we serve is altered to defeat encryption | L | H | Strict CSP; no third-party scripts; pinned dependencies; `/verify` safety code (M4) | Low to Medium (limit of web E2EE) | Engineering |

## 7. Accepted risks, with reasons
1. **Self-declared age (R-02).** Real age verification needs an ID or a face scan. That would end anonymity and create a store of sensitive data far riskier than the one we avoid. We accept self-declaration, say so plainly in the notice, remove the highest-risk features (media, profiles, re-contact), and treat every `minor` report as urgent. Re-assess if the law introduces an age-verification duty or if reports show minors are present.
2. **We cannot moderate content we cannot read (from M4).** Safety comes from design, behaviour signals and reports, not from reading messages.
3. **Web-delivered encryption (R-12)** depends on the code we serve. Stated in the notice.

## 8. Actions before sign-off
| # | Action | Milestone |
|---|---|---|
| 1 | Ship E2EE; close R-01 | M4 |
| 2 | Decide D-11 with counsel; fix retention periods | M6 |
| 3 | Name the DPO and child-safety officer | M6 |
| 4 | Draft and review the privacy notice | M6 to M8 |
| 5 | File the processor agreement | M8 |
| 6 | Re-run this PIA against the M6 and M7 features | M7 |

## 9. Sign-off
| Role | Name | Date | Decision |
|---|---|---|---|
| DPO | | | |
| Product owner | | | |
| Legal counsel | | | |
