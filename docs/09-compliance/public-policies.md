# Public Policy Documents

**Last reviewed:** 2026-11-13 · **Owner:** DPO (D-12) · **None of these is written yet**

The documents users and authorities will read. They are drafted in M6, reviewed by counsel in M7, and published in M8. This page tracks them and says what each must contain. The drafts themselves will live in `docs/09-compliance/policies/` once started, and the published versions are served by the app.

## 1. Register
| Document | Audience | Must exist by | Status | Gap |
|---|---|---|---|---|
| Privacy notice | Users | Draft M6, publish M8 | Not started | G-01 |
| Terms of service | Users | Draft M6, publish M8 | Not started | G-09 |
| Community rules (acceptable use) | Users | Draft M6, publish M8 | **Preview text** shown at the gate today (`RULES_VERSION` in `src/types/events.ts`); not reviewed by counsel | G-09 |
| Law-enforcement guidelines | Authorities | M8 | Not started | G-08 |
| Vulnerability disclosure policy | Researchers | Now | ✅ `SECURITY.md` | — |
| Yearly transparency note | Public | First anniversary | Not started | — |

Internal documents that back these: [data inventory](data-inventory-and-retention.md), [breach procedure](breach-notification.md), [incident response plan](../06-operations/incident-response-plan.md), moderator guide (M7).

## 2. Privacy notice: required content
Based on RA 10173 Sec 16 and NPC guidance on transparency (◻ verify). It must be readable in two minutes.

- [ ] Who we are: the legal name of the operator and how to reach the DPO
- [ ] What we process, from the [data inventory](data-inventory-and-retention.md), in plain words: "we see your IP address for a moment, turn it into a code that changes every day, and throw the address away"
- [ ] Why, and the lawful basis for each purpose
- [ ] How long each item is kept
- [ ] Who else handles it: the hosting company, and that the servers are in Singapore
- [ ] What we never collect
- [ ] **What we cannot promise:** the host sees IP addresses; a chat partner can screenshot; age is self-declared; web encryption depends on the code we serve
- [ ] Before M4 only: messages are not yet end-to-end encrypted
- [ ] The user's rights and how to use them ([procedure](data-subject-rights.md))
- [ ] The right to complain to the National Privacy Commission
- [ ] What happens on a breach
- [ ] How we respond to lawful orders, and what we cannot produce
- [ ] The date and version, and how changes are announced

## 3. Terms of service: required content
- [ ] Adults only: 18 or older; minors must not use the service
- [ ] The service is provided free, as is, with no uptime promise
- [ ] Prohibited conduct, by reference to the rules
- [ ] **Express prohibition of child sexual abuse or exploitation** (RA 11930 Sec 9)
- [ ] What we may do: disconnect, block, report to authorities
- [ ] No expectation of recovering chat history
- [ ] Philippine law governs; venue
- [ ] Limits of liability, as counsel advises
- [ ] Scope of the beta (D-18)

## 4. Community rules: required content
Short, in plain language, shown at the gate.

| Not allowed | Related law |
|---|---|
| Anything sexual involving a minor; any attempt to contact minors | RA 11930, RA 7610 |
| Sexual harassment, unwanted sexual remarks, sexist, homophobic or transphobic slurs | RA 11313 |
| Threats, intimidation, stalking | Revised Penal Code; RA 10175 Sec 6 |
| Sharing someone else's personal details | RA 10173 |
| Scams, phishing, fraud, impersonation | RA 10175 |
| Recruiting for trafficking or exploitation | RA 9208 as amended |
| Spam and advertising | Service rule |

The rules also say: how to leave (`/next`, `/leave`), how to report, what happens after a report, how a wrongly blocked user can ask for review, and where a victim can file a police complaint.

## 5. Law-enforcement guidelines: required content
A public summary of [law-enforcement-requests.md](law-enforcement-requests.md): where to send legal process, what we require, what data exists and does not, and the emergency route.

## 6. How these documents are managed
- **Versioned.** A material change to the rules or notice bumps `RULES_VERSION`, which makes every user acknowledge again. The server already enforces this.
- **Reviewed by counsel** before first publication and on every material change.
- **Plain language first.** English for v1; a Filipino version is recommended for the Philippine beta.
- **Reachable** from the gate and from every screen, without starting a chat.
- **Archived.** Every published version is kept with its dates.
- **Honest.** A notice may not promise anything the [data inventory](data-inventory-and-retention.md) contradicts. The DPO compares the two at each release.
