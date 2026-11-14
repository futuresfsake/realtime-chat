# Documentation

**realtime-chat** is an anonymous, end-to-end encrypted, one-to-one chat that connects strangers by shared interests. It is built and operated from the Philippines.

> **Mission:** connect people through safe, private, anonymous conversations, on a platform that stays **free**, runs **reliably** and **protects its users**.

**Structure last revised:** 2026-11-13. What moved and why: [10-reviews/README.md](10-reviews/README.md).

## Folder map
The folders follow the life of a change: why, what, exact rules, how it is built, how it is protected, how it is tested, how it runs, how we work, and what the law requires.

| Folder | The question it answers | Start with |
|---|---|---|
| [`00-overview/`](00-overview/README.md) | **Why** are we building this, and which decisions are still open? | `vision.md` |
| [`01-product/`](01-product/README.md) | **What** are we building: milestones, stories, features, commands | `milestones.md` |
| [`02-requirements/`](02-requirements/README.md) | What **exact rules and targets** must the system meet? | `specs.md` |
| [`03-design/`](03-design/README.md) | **How** is it built: architecture, decisions (ADRs), per-story technical designs (TDDs) | `high-level-design.md` |
| [`04-security/`](04-security/README.md) | How do we **protect users**: encryption, sessions, abuse controls, threat model | `README.md` |
| [`05-quality/`](05-quality/README.md) | How do we **know it works**? | `testing-strategy.md` |
| [`06-operations/`](06-operations/README.md) | How does it **run in production**: deploy, monitor, respond, recover | `deployment.md` |
| [`07-process/`](07-process/README.md) | How do **we work**: branching, CI/CD, the story pipeline, tooling | `workflows.md` |
| [`08-guides/`](08-guides/README.md) | **Hands-on** how-tos | `local-development.md` |
| [`09-compliance/`](09-compliance/README.md) | What does **Philippine law** require, and where is the proof we meet it? | `README.md` |
| [`10-reviews/`](10-reviews/README.md) | What did **past reviews** find? (archive, not current guidance) | `README.md` |
| [`GLOSSARY.md`](GLOSSARY.md) | Every acronym and term | — |

Every folder has a `README.md` listing its files.

## Where to start, by role
| You are | Read in this order |
|---|---|
| **New contributor** | `00-overview/vision.md` → `01-product/milestones.md` → `03-design/high-level-design.md` → `08-guides/local-development.md` → `07-process/workflows.md` |
| **Product owner** | `00-overview/open-decisions.md` → `01-product/milestones.md` → `09-compliance/README.md` (top open items) |
| **Operator on call** | `06-operations/runbook.md` → `06-operations/incident-response-plan.md` → `09-compliance/breach-notification.md` |
| **Data Protection Officer** | `09-compliance/README.md` → `compliance-matrix.md` → `data-inventory-and-retention.md` → `privacy-impact-assessment.md` |
| **Moderator or child-safety officer** | `04-security/trust-and-safety.md` → `09-compliance/child-protection-and-online-safety.md` → `09-compliance/roles-and-access.md` |
| **Legal counsel** | `09-compliance/regulatory-register.md` → `compliance-matrix.md` → `law-enforcement-requests.md` (decision D-11) → `public-policies.md` |
| **Security reviewer** | `04-security/threat-model.md` → `04-security/security-checklist.md` → `06-operations/deployment-security.md` |

## Three kinds of document
| Kind | Where | Rule |
|---|---|---|
| **Living** | Folders 00 to 09 | Describes the system as it is or is planned. Updated in the same PR as the change |
| **Decision record** | `03-design/adr/`, `00-overview/open-decisions.md` | Never rewritten. A changed decision gets a new ADR that supersedes the old one |
| **Archived review** | `10-reviews/` | Never edited. Findings become changes to living documents |

## Single sources of truth
When two documents disagree, these win. Other documents link to them.

| Fact | Lives only in |
|---|---|
| What data we touch, why and for how long | [`09-compliance/data-inventory-and-retention.md`](09-compliance/data-inventory-and-retention.md) |
| Which laws apply | [`09-compliance/regulatory-register.md`](09-compliance/regulatory-register.md) |
| Status of each legal obligation, and the gap list | [`09-compliance/compliance-matrix.md`](09-compliance/compliance-matrix.md) |
| Milestone scope and exit criteria | [`01-product/milestones.md`](01-product/milestones.md) |
| Numeric limits | [`02-requirements/specs.md`](02-requirements/specs.md) |
| Threats and mitigations | [`04-security/threat-model.md`](04-security/threat-model.md) |
| Open product decisions | [`00-overview/open-decisions.md`](00-overview/open-decisions.md) |
| Known limits, gaps and future work | [`00-overview/limits-and-roadmap.md`](00-overview/limits-and-roadmap.md) |
| What is protected today, with evidence | [`04-security/security-overview.md`](04-security/security-overview.md) |

## Traceability
```
Vision ─▶ Milestone (M#) ─▶ User Story (US-##) ─▶ Feature (F-##) ─▶ Requirement (FR/NFR-##) ─▶ Design (LLD/ADR/TDD) ─▶ Test
                                                                                └─▶ Threat (T-##) ─▶ Mitigation ─▶ Test
Law ─▶ Obligation (A/B/C/I-##) ─▶ Control ─▶ Evidence          Gap (G-##) ─▶ Milestone gate
```
| Prefix | Meaning | Defined in |
|---|---|---|
| M, US, F | Milestone, user story, feature | `01-product/` |
| FR, NFR | Requirement | `02-requirements/specs.md` |
| ADR, TDD | Decision record, technical design | `03-design/` |
| T, S | Threat, safety control | `04-security/` |
| D | Open product decision | `00-overview/open-decisions.md` |
| A, B, C, I | Legal obligation (A privacy, B cybercrime, C child safety, I ICT deployment) | `09-compliance/compliance-matrix.md` |
| G, R, V | Compliance gap, privacy risk, item to verify | `09-compliance/` |

## Rules for these docs
- **Docs live with code.** A PR that changes behaviour updates the matching docs in the same PR. A PR that changes what personal data we touch updates `09-compliance/data-inventory-and-retention.md`.
- **Say what is true today.** Mark planned work as planned. Status markers: ✅ done · 🚧 in progress · 🔜 planned · ⏸ needs decision · ❌ won't do · ⚠️ gap or accepted risk
- **Legal citations are unverified until counsel confirms them.** `09-compliance` marks each one. Nothing in this repository is legal advice.
- **No secrets, no personal contact details, no real user data** in any document. The repository is public.
- **Review cadence:** `09-compliance` and `04-security` before every milestone release and every quarter after launch; everything else when it changes.
