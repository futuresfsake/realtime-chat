# Compliance Gates by Milestone

> **Living document.** First written in the DICT-style review (2026-10-28) and moved here on 2026-11-13. This folder now owns it: update it when the system changes. The original review record is in [10-reviews](../10-reviews/2026-10-28-dict/README.md).

Extends [01-product/milestones.md](../01-product/milestones.md). Each milestone keeps its own exit criteria; the gates below are **additional** and block the release. They are the milestone view of the [compliance matrix](compliance-matrix.md).

| Milestone | Privacy and security gate (must be true before deploy or promotion) | Evidence |
|---|---|---|
| **M2** Hardening + first deploy | Origin allowlist, rate limits, 4 KB cap, helmet + CSP; `npm audit` high = 0; secret scan clean; `better-sqlite3` removed; `SECURITY.md`, `.env.example`, `.node-version`, CODEOWNERS present; **not announced publicly** | CI run, header scan |
| **M3** 1:1 sessions | Global broadcast gone; forged session id test passes | Integration test |
| **M4** E2EE | Server spy sees only ciphertext; no plaintext fallback; CI check that message content cannot reach the logger (G-07); data inventory row 4 updated | Test report, CI run |
| **M5** Matchmaking | Country lookup stores no IP; DB-IP attribution shown | Unit test, screenshot |
| **M6** Trust & safety | 18+ gate enforced server-side; report/ban working; privacy notice + terms drafted; **D-10, D-11, D-12, D-17 decided**; DPO and child-safety officer named; counsel engaged; safety ledger live with purge job; PIA re-run | Decision log, test report |
| **M7** Monitoring & moderation | Roles enforced; audit log append-only; legal-hold works; alerts reach a named person; retention report | Role tests, alert test |
| **M8** Public launch | Legal entity registered (D-16); launch scope enforced (D-18); counsel sign-off; PIA signed; NPC registration/DPO registration done if required; privacy notice, terms and rules published; rights-request channel live; breach register ready; vendor DPA filed; MFA everywhere | Sign-off pack |
| **M9** Production hardening | Pen test with no open high findings; restore drill; chaos test | Pen-test report |
| **M10** Operations | Breach tabletop drill within 72-hour target; first quarterly access review; retrospective | Drill report |

## Review cadence
- Every PR touching `src/` or deployment config: security checklist box ticked.
- Every milestone: update the [threat model](../04-security/threat-model.md) and [checklist](../04-security/security-checklist.md).
- Quarterly after launch: dependency review, access review, retention audit, policy review.

## Definition of "ready to announce"
All of M2 to M8 gates green **and** the post-deploy smoke test in [deployment-security.md](../06-operations/deployment-security.md) passes on the live URL **and** the go-live checklist in [ict-deployment-standards.md](ict-deployment-standards.md) is complete.

## Launch readiness checklist
Carried over from the 2026-10-18 legal brief and grouped by the law each item serves. Tick an item only when its evidence exists.

### Privacy (RA 10173)
- [ ] Privacy notice published ([public-policies.md](public-policies.md))
- [ ] [Data inventory](data-inventory-and-retention.md) reviewed against the released code
- [ ] No message storage confirmed by code review and tests
- [ ] [PIA](privacy-impact-assessment.md) signed
- [ ] NPC registration assessed, and done if required
- [ ] DPO named and contact published
- [ ] Processor agreement with the host on file
- [ ] [Breach procedure](breach-notification.md) and register ready

### Cybercrime and law enforcement (RA 10175)
- [ ] D-11 decided with counsel's written opinion
- [ ] [Request procedure](law-enforcement-requests.md) and public guidelines ready
- [ ] Legal hold tested
- [ ] [Security checklist](../04-security/security-checklist.md) passed; [threat model](../04-security/threat-model.md) reviewed

### Child protection and online safety (RA 11930, RA 11313)
- [ ] Rules and terms published, with the express prohibition RA 11930 requires
- [ ] 18+ gate enforced by the server
- [ ] Report flow works for every category; `minor` and `threats` are prioritised
- [ ] Child-safety officer and backup named; [procedure](child-protection-and-online-safety.md) practised once
- [ ] Bans, no-rematch and content warnings active
- [ ] Moderator guide written; first moderators trained

### ICT deployment
- [ ] Legal entity registered
- [ ] [Go-live checklist](ict-deployment-standards.md) complete
- [ ] Monitoring and alerts reach a named person
- [ ] Rollback rehearsed
