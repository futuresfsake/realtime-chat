# ADR-0012: Scope is a portfolio project: build to M7, do not launch

- **Status:** Accepted · **Date:** 2026-11-14 · **Supersedes:** [ADR-0010](0010-deploy-early-and-continuously.md) (deploy early; public launch at M8) and the hosting plan in [ADR-0003](0003-render-free-hosting.md)

## Context
The project was planned as a service that would launch publicly at M8, with continuous deployment from M2. It is now clear that it is a **portfolio project**: a demonstration of engineering, not a service. A public anonymous chat with strangers needs things a portfolio project does not have: a lawyer to review the policies, a legal entity, registration with the National Privacy Commission, named privacy and child-safety officers, and people to moderate and be on call.

## Options
| Option | For | Against |
|---|---|---|
| **Build to M7, document, do not launch** | Everything that can be built and proven without those things is built; the rest is written down honestly | No live link |
| Launch a limited beta on free hosting | A live link | A public chat with strangers and no moderators, no counsel and no registered controller: the risks fall on real people and on the owner |
| Launch behind an invitation or allowlist | Smaller risk | Still needs the same legal and moderation groundwork to be responsible |

## Decision
Build milestones **M0 to M7**. **Do not pursue M8 (public launch), M9 (production hardening) or M10 (post-launch operations).** Do not deploy. Keep the plan for those milestones in `milestones.md`, and record exactly what launching would still take in [limits-and-roadmap.md](../../00-overview/limits-and-roadmap.md).

## Consequences
- ✅ The repository is a complete, honest demonstration with tests, docs and a measured load test
- ✅ Nobody is exposed to an unmoderated, unreviewed service
- ⚠️ No live demo: the README uses a recording and screenshots of the real app instead
- ⚠️ Items that need hosting or people (uptime monitor, alert delivery, a named moderator, a tabletop exercise, penetration test) stay open and are listed as such
- If this ever changes, start from the M8 checklist and the limits register, and write a new ADR that supersedes this one
