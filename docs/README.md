# Documentation

**realtime-chat** is an anonymous, end-to-end encrypted, one-to-one chat that connects strangers around the world by shared interests.

> **Mission:** connect people across the world through safe, private, anonymous conversations, on a platform that stays **free**, runs **reliably** and **protects its users**.

## Folder map: what each folder is for

| Folder | Purpose (the question it answers) | Start with |
|---|---|---|
| [`00-overview/`](00-overview/README.md) | **Why** we build this, what success means, which decisions are still open | `vision.md` |
| [`01-product/`](01-product/README.md) | **What** we build: features, user stories, slash commands, milestones | `milestones.md` |
| [`02-requirements/`](02-requirements/README.md) | **Exact rules** the system must follow, plus quality targets (FR/NFR) | `specs.md` |
| [`03-design/`](03-design/README.md) | **How** it's built: HLD, LLD, matchmaking, validation (zod), decisions (ADRs) | `high-level-design.md` |
| [`04-security/`](04-security/README.md) | **How we protect users**: E2EE, privacy and sessions, trust & safety, threat model | `README.md` |
| [`05-quality/`](05-quality/README.md) | **How we know it works**: testing strategy | `testing-strategy.md` |
| [`06-operations/`](06-operations/README.md) | **How it runs in production**: Render, deployment, health checks, scaling, runbook | `render.md` |
| [`07-process/`](07-process/README.md) | **How we work**: workflows, Definition of Done, CI/CD, automation, templates | `workflows.md` |
| [`08-guides/`](08-guides/README.md) | **Hands-on how-tos**: local development (Codespaces + your own machine) | `local-development.md` |
| [`GLOSSARY.md`](GLOSSARY.md) | Every acronym and technical term used in these docs | — |

Every folder has its own `README.md` summary.

## Reading order for a new contributor
1. [`00-overview/vision.md`](00-overview/vision.md): the product in 5 minutes
2. [`01-product/milestones.md`](01-product/milestones.md): where we are, what's next
3. [`03-design/high-level-design.md`](03-design/high-level-design.md): the big picture
4. [`04-security/e2ee.md`](04-security/e2ee.md) and [`04-security/privacy-and-sessions.md`](04-security/privacy-and-sessions.md): our core promises
5. [`08-guides/local-development.md`](08-guides/local-development.md): run it
6. [`07-process/workflows.md`](07-process/workflows.md): make your first change
| [`09-deliberations/`](09-deliberations/README.md) | **My thinking and research log**: working notes, not decisions | `README.md` |

## Traceability: how the docs connect
```
Vision ─▶ Milestone (M#) ─▶ User Story (US-##) ─▶ Feature (F-##) ─▶ Requirement (FR/NFR-##) ─▶ Design (LLD/ADR) ─▶ Test
                                                                                └─▶ Threat (T-##) ─▶ Mitigation ─▶ Test
```
Every ID is unique and referenced across docs, PRs and tests.

## Rules for these docs
- **Docs live with code:** a PR that changes behavior updates the matching docs in the same PR.
- **Status markers:** ✅ done · 🚧 in progress · 🔜 planned · ⏸ needs decision · ❌ won't do
- **Decisions are appended, not rewritten:** a changed decision gets a new ADR that supersedes the old one.
