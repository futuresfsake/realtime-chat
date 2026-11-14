# 09-compliance: Philippine law, data privacy and ICT deployment

This folder is the **single source of truth** for what Philippine law and regulators expect from this service, and how we meet it. Engineering docs in other folders explain *how the system works*; this folder says *what we are obliged to do and where the proof is*.

> **Not legal advice.** These documents are written by engineering for planning. Every statute, section number and circular cited here is marked for verification by a Philippine lawyer before public launch (M8). Where a citation is uncertain, the document says so. Do not publish any of this as a legal position.

## Who we are in the eyes of the law
| Law | Our role | Why |
|---|---|---|
| RA 10173 (Data Privacy Act) | **Personal information controller (PIC)** | We decide why and how IP-derived data, reports and logs are processed |
| RA 10173 | Render is our **personal information processor (PIP)** | It hosts the service on our instructions |
| RA 10175 (Cybercrime Prevention Act) | **Service provider** | We give users the ability to communicate through a computer system |
| RA 11930 (Anti-OSAEC and Anti-CSAEM Act) | **Internet intermediary** | We provide an online platform that carries user communications |

## Documents
| Read this | To answer |
|---|---|
| [regulatory-register.md](regulatory-register.md) | Which laws, rules and regulators apply to us, and which do not? |
| [compliance-matrix.md](compliance-matrix.md) | For each obligation: what control meets it, who owns it, what is the status, where is the evidence? |
| [data-inventory-and-retention.md](data-inventory-and-retention.md) | What personal data do we touch, on what lawful basis, where, and for how long? (Our record of processing activities) |
| [privacy-impact-assessment.md](privacy-impact-assessment.md) | What privacy risks does the processing create, and are the controls enough? |
| [data-subject-rights.md](data-subject-rights.md) | How does a user exercise their rights, and how do we answer within the deadline? |
| [breach-notification.md](breach-notification.md) | What do we do in the 72 hours after a personal data breach? |
| [law-enforcement-requests.md](law-enforcement-requests.md) | What do we do with a preservation request, warrant or subpoena, and what can we actually produce? |
| [child-protection-and-online-safety.md](child-protection-and-online-safety.md) | What are our duties on child safety, gender-based online harassment and trafficking? |
| [ict-deployment-standards.md](ict-deployment-standards.md) | What must be true of hosting, vendors, access, security baselines and the operator's legal identity before we deploy? |
| [roles-and-access.md](roles-and-access.md) | Who are the accountable people (DPO, child-safety officer, operator, moderator), and what can each do? |
| [compliance-gates.md](compliance-gates.md) | Which compliance gates block each milestone, and what is the launch checklist? |
| [public-policies.md](public-policies.md) | Which public documents (privacy notice, terms, rules) must exist, and what is their status? |

## Where related material lives
| Topic | Home |
|---|---|
| How E2EE, sessions and logging work | [04-security](../04-security/README.md) |
| Abuse controls and moderation design | [04-security/trust-and-safety.md](../04-security/trust-and-safety.md) |
| Incident handling steps and templates | [06-operations/incident-response-plan.md](../06-operations/incident-response-plan.md) |
| Pre-deploy and post-deploy security checks | [06-operations/deployment-security.md](../06-operations/deployment-security.md) |
| Decisions the product owner still has to make | [00-overview/open-decisions.md](../00-overview/open-decisions.md) |
| Past reviews (IT manager, DICT-style, legal brief) | [10-reviews](../10-reviews/README.md) |

## Rules for this folder
1. **One fact, one place.** The data inventory lives only in `data-inventory-and-retention.md`. The list of laws lives only in `regulatory-register.md`. Other docs link to them.
2. **Every obligation has an owner, a status and evidence.** An obligation without those three is a gap, and gaps are listed in the matrix.
3. **Code changes that touch personal data update this folder in the same PR.** That means a new field, a new log line, a new vendor, a longer retention or a new region.
4. **Reviewed every quarter and before every milestone release** by the DPO. The review date goes at the top of each document.
5. **Citations carry a verification mark:** ✔ confirmed by counsel · ◻ not yet verified. Today every citation is ◻.

## Top open items (as of 2026-11-13)
| # | Item | Blocks | Decision |
|---|---|---|---|
| 1 | Position on the six-month traffic-data preservation rule | M6 design, M8 launch | D-11 |
| 2 | Name the DPO and the child-safety officer | M6 | D-12 |
| 3 | The operator has no registered legal entity yet | NPC registration, vendor agreements, M8 | D-16 |
| 4 | Engage a Philippine lawyer | M6 to M8 | D-17 |
| 5 | Relayed messages are plaintext on the server until M4 | Any public announcement | [PIA risk R-01](privacy-impact-assessment.md) |
