# Compliance Matrix

**Last reviewed:** 2026-11-13 (M3 code complete, not yet deployed publicly) · **Owner:** DPO (D-12)

Each row is one obligation from the [regulatory register](regulatory-register.md), the control that meets it, and its state. This replaces the matrix in the IT manager review and the crosswalk in the DICT-style review, with their citation errors corrected.

**Status:** ✅ in place with evidence · 🚧 partly in place · 🔜 planned for the milestone shown · ⏸ waiting on a decision · ⚠️ gap with no plan yet

> Section numbers are **not yet verified by counsel**. Treat them as pointers.

## A. Data privacy (RA 10173, NPC issuances)
| ID | Obligation | Source | Control | Owner | Status | Evidence or next step |
|---|---|---|---|---|---|---|
| A-01 | Collect only what a stated purpose needs | Sec 11 | No accounts; IP hashed then dropped; no content stored | Engineering | 🚧 | [Data inventory](data-inventory-and-retention.md). Plaintext relay buffer until M4 (G-12) |
| A-02 | A lawful basis for every purpose | Sec 12, 13 | Basis column in the data inventory; legitimate-interest test in the PIA | DPO | 🚧 | Counsel to confirm (G-13) |
| A-03 | Tell users what we do, before we do it | Sec 16 | Privacy notice shown at the 18+ gate | DPO | 🔜 M6 draft, M8 publish | [public-policies.md](public-policies.md) (G-01) |
| A-04 | Honour data subject rights | Sec 16, 18 | [data-subject-rights.md](data-subject-rights.md); DPO contact published | DPO | 🚧 | Procedure written; intake channel not live (G-16) |
| A-05 | Reasonable security measures | Sec 20; NPC Circular 2023-06 | Validation, rate limits, CSP, origin allowlist, TLS, no-IP logs, E2EE from M4 | Engineering | 🚧 | [Security checklist](../04-security/security-checklist.md); CI run |
| A-06 | Name an accountable person (DPO) | Sec 21; NPC Advisory 2017-01 | DPO named, contact in the privacy notice and `SECURITY.md` | Owner | ⏸ D-12 | G-04 |
| A-07 | Register with the NPC if a threshold applies | NPC Circular 2022-04 | Threshold assessment by counsel; register if required | DPO | ⏸ | G-03, needs a legal entity (G-11) |
| A-08 | Assess privacy impact before launch | NPC Advisory 2017-03 | [privacy-impact-assessment.md](privacy-impact-assessment.md) | DPO | 🚧 | Draft exists; sign at M8 (G-06) |
| A-09 | Notify a breach within 72 hours | Sec 20(f); NPC Circular 16-03 | [breach-notification.md](breach-notification.md); breach register | DPO | 🚧 | Procedure written; never drilled (G-02) |
| A-10 | Contract with every processor | Sec 14, 21 | Render data processing addendum on file | Operator | ⚠️ | G-05 |
| A-11 | Stay accountable for cross-border transfers | Sec 21 | Region recorded (Singapore); stated in the notice and PIA | DPO | 🚧 | `render.yaml`; D-13 |
| A-12 | Keep data no longer than needed | Sec 11(e) | Retention column in the inventory; daily key rotation; purge job from M6 | Engineering | 🚧 | Provisional until D-11 |
| A-13 | Valid consent where we rely on it | NPC Circular 2023-04 | Explicit 18+ and rules acknowledgement, versioned, enforced by the server; no pre-ticked boxes | Engineering | ✅ for the gate | Handshake tests; text not yet reviewed by counsel |
| A-14 | No tracking without a basis | Sec 11, 12 | No analytics, no cookies, no fingerprinting | Engineering | ✅ | Source; CSP |

## B. Cybercrime and law enforcement (RA 10175, Rule on Cybercrime Warrants)
| ID | Obligation | Source | Control | Owner | Status | Evidence or next step |
|---|---|---|---|---|---|---|
| B-01 | Preserve traffic data and subscriber information for six months | Sec 13 | Position to be set by counsel: hold nothing, retain a minimum, or preserve on demand | Owner, counsel | ⏸ D-11 | [law-enforcement-requests.md](law-enforcement-requests.md) (G-08) |
| B-02 | Preserve specific data when ordered | Sec 13 | Legal-hold flag stops the purge | Engineering | 🔜 M7 | Needs the safety ledger (G-14) |
| B-03 | Disclose on a court warrant, within 72 hours | Sec 14; A.M. No. 17-11-03-SC | Request procedure; DPO and counsel verify the warrant | DPO | 🚧 | Procedure written |
| B-04 | Do not obstruct | Sec 20 | Documented statement of what data exists and does not | DPO | 🚧 | Procedure written |
| B-05 | Do not record private communications | RA 4200 | No content logging; E2EE from M4 | Engineering | 🚧 | G-07, G-12 |

Removed from earlier matrices: "RA 10175 Sec 12 real-time collection" (struck down in *Disini*, 2014) and "Sec 30 security measures" (not a duty on us).

## C. Child protection and online safety (RA 11930, RA 11313, RA 11862)
| ID | Obligation | Source | Control | Owner | Status | Evidence or next step |
|---|---|---|---|---|---|---|
| C-01 | Prohibit child sexual abuse or exploitation in our terms | RA 11930 Sec 9 | Rules page and terms | DPO | 🔜 M6 | G-09 |
| C-02 | Adults only | Risk control; RA 6809 | 18+ gate enforced on the handshake; text only; no profiles | Engineering | ✅ gate · 🔜 notice | Handshake tests. Self-declared: accepted risk, see the PIA |
| C-03 | Mechanisms to prevent, detect, respond and report | RA 11930 Sec 9 | Rate limits; `/report minor`; priority queue; bans; behavioural monitoring | Engineering | 🔜 M6, M7 | [trust-and-safety.md](../04-security/trust-and-safety.md) |
| C-04 | Report suspected abuse to the PNP or NBI within the legal deadline | RA 11930 Sec 9 | [Child-safety procedure](child-protection-and-online-safety.md); named officer | Child-safety officer | ⏸ D-12 | Procedure written; officer not named (G-04) |
| C-05 | Preserve related data in our possession | RA 11930 Sec 9 | Legal hold on the report case | Engineering | 🔜 M7 | G-14 |
| C-06 | Act on a takedown or blocking notice within 24 hours | RA 11930 Sec 9 | Ban by hash; maintenance mode | Operator | 🚧 | Maintenance mode exists; bans M6 |
| C-07 | Give users a way to report harassment and act on it | RA 11313 Sec 12 (good practice) | `/next`, `/leave` today; `/report harassment`, `/report sexual`, temp bans | Engineering | 🚧 exit ✅ · report 🔜 M6 | Integration tests |
| C-08 | Train the people who handle reports | Good practice | Moderator guide covering RA 11313 and RA 11930 | DPO | 🔜 M7 | — |

## I. ICT deployment and security governance
Rows here use the prefix **I-** so they are not confused with product decisions (D-01 to D-18 in [open-decisions](../00-overview/open-decisions.md)).

| ID | Expectation | Source | Control | Owner | Status | Evidence or next step |
|---|---|---|---|---|---|---|
| I-01 | A legal person operates the service | Practical precondition for A-07, A-10 | Business registration | Owner | ⏸ D-16 | G-11 |
| I-02 | Data classified before hosting is chosen | DICT Cloud First (voluntary) | Classes C0 to C3; region recorded | DPO | ✅ | [Data inventory](data-inventory-and-retention.md) |
| I-03 | Secrets never in code | NPC Circular 2023-06 | Platform secret store; gitleaks secret scan in CI | Engineering | ✅ | CI `ci.yml`; see [security-tooling.md](../07-process/security-tooling.md) |
| I-04 | Least privilege and MFA for every admin account | NPC Circular 2023-06 | [roles-and-access.md](roles-and-access.md) | Operator | 🚧 | Not evidenced (G-15) |
| I-05 | Changes are reviewed and traceable | Good practice | PR + CI + CODEOWNERS on `main` | Engineering | ✅ | Branch protection |
| I-06 | Vulnerabilities can be reported privately | National Cybersecurity Plan (voluntary) | `SECURITY.md` | Operator | ✅ | `SECURITY.md` |
| I-07 | Significant incidents reported to the national CERT | National Cybersecurity Plan (voluntary) | Contact in the incident plan | Operator | 🔜 M8 | [incident-response-plan.md](../06-operations/incident-response-plan.md) |
| I-08 | Known-vulnerable dependencies are not shipped | Good practice | `npm audit` gate; semgrep static analysis; Dependabot with cooldown | Engineering | ✅ | CI `ci.yml` |
| I-09 | Recovery is rehearsed | Good practice | Rollback and restore drill | Operator | 🔜 M9 | [disaster-recovery.md](../06-operations/disaster-recovery.md) |

## Gap list
Ordered by what blocks the next step. "Was" gives the ID used in the archived reviews.

| ID | Gap | Blocks | Target | Owner | Was |
|---|---|---|---|---|---|
| G-12 | Relayed messages are readable by the server and buffered in memory until E2EE ships | Any public announcement | M4 | Engineering | new |
| G-07 | CI already blocks raw IP access outside one module and unstructured logging. There is still no check that message content can never reach the logger | M4 release | M4 | Engineering | DG-06 |
| G-10 | No Philippine lawyer engaged | D-11, G-03, all published documents | Start in M6 | Owner | CG-14 |
| G-04 | DPO and child-safety officer not named | M6 | M6 | Owner | CG-04, CG-10 |
| G-08 | No decision on six-month preservation | Retention design, safety ledger schema | M6 | Owner, counsel | CG-06 |
| G-11 | Operator is not a registered legal entity | NPC registration, processor agreements | Before M8 | Owner | new |
| G-01 | Privacy notice not drafted | M6 | M6 draft, M8 publish | DPO | CG-01 |
| G-09 | Terms of service and acceptable use policy not drafted | M6 | M6 draft, M8 publish | DPO | CG-07, CG-08 |
| G-13 | Lawful-basis and legitimate-interest analysis not confirmed by counsel | M8 | M6 | DPO | CG-13 |
| G-14 | Safety state is lost on restart; no legal hold | M6, M7 | M6 | Engineering | DICT finding 3 |
| G-06 | PIA not complete or signed | M8 | M8 | DPO | CG-05 |
| G-05 | No processor agreement with Render on file | M8 | M8 | Operator | CG-09 |
| G-03 | NPC registration threshold not assessed | M8 | M8 | DPO, counsel | CG-03 |
| G-16 | No live channel for rights requests | M8 | M8 | DPO | DG-04 |
| G-15 | MFA and access review not evidenced | M8 | M8 | Operator | new |
| G-02 | Breach procedure never drilled; no breach register | M8, M10 | Register M8, drill M10 | DPO | CG-02 |
| G-17 | Other jurisdictions (GDPR transfer assessment, EU representative) | Opening beyond the Philippines | After v1 | DPO, counsel | CG-11, CG-12 |

## How this file is kept honest
- A status changes to ✅ only when the evidence column points to something that exists (a test, a CI run, a signed document).
- Closing a gap is a PR that updates this file and the affected document together.
- The DPO re-reads every row before each milestone release and every quarter after launch.
