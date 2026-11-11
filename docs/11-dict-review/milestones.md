# DICT Security Gates by Milestone

Extends [01-product/milestones.md](../01-product/milestones.md). Each milestone keeps its own exit criteria; the gates below are **additional** and block the release.

| Milestone | DICT / privacy gate (must be true before deploy or promotion) | Evidence |
|---|---|---|
| **M2** Hardening + first deploy | Origin allowlist, rate limits, 4 KB cap, helmet + CSP; `npm audit` high = 0; secret scan clean; `better-sqlite3` removed; `SECURITY.md`, `.env.example`, `.node-version`, CODEOWNERS present; **not announced publicly** | CI run, header scan |
| **M3** 1:1 sessions | Global broadcast gone; forged session id test passes | Integration test |
| **M4** E2EE | Server spy sees only ciphertext; no plaintext fallback | Test report |
| **M5** Matchmaking | Country lookup stores no IP; DB-IP attribution shown | Unit test, screenshot |
| **M6** Trust & safety | 18+ gate enforced server-side; report/ban working; privacy notice + terms drafted; **D-10, D-11, D-12 decided**; DPO named; safety ledger live with purge job | Decision log, test report |
| **M7** Monitoring & moderation | Roles enforced; audit log append-only; legal-hold works; alerts reach a named person; retention report | Role tests, alert test |
| **M8** Public launch | Counsel sign-off; PIA signed; NPC registration/DPO registration done if required; breach register ready; vendor DPA filed; MFA everywhere | Sign-off pack |
| **M9** Production hardening | Pen test with no open high findings; restore drill; chaos test | Pen-test report |
| **M10** Operations | Breach tabletop drill within 72-hour target; first quarterly access review; retrospective | Drill report |

## Review cadence
- Every PR touching `src/` or deployment config: security checklist box ticked.
- Every milestone: update the [threat model](../04-security/threat-model.md) and [checklist](../04-security/security-checklist.md).
- Quarterly after launch: dependency review, access review, retention audit, policy review.

## Definition of "ready to announce"
All of M2 to M8 gates green **and** the post-deploy smoke test in [deployment-security.md](deployment-security.md) passes on the live URL.
