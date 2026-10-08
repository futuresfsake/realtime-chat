# Documentation

Everything about **realtime-chat** beyond the code: what we're building, why, how, and how we keep it safe.

> **End goal:** a real-time chat app that is live on the public internet, **free** to run, **safe** to use, and **secure** against common attacks.

## How this folder is organized

| Folder | Answers the question | Files |
|---|---|---|
| [`00-overview/`](00-overview/) | *Why does this exist and what does "done" look like?* | [vision.md](00-overview/vision.md) |
| [`01-product/`](01-product/) | *What are we building, for whom, and in what order?* | [features.md](01-product/features.md), [user-stories.md](01-product/user-stories.md), [milestones.md](01-product/milestones.md) |
| [`02-requirements/`](02-requirements/) | *Exactly what must the system do, and how well?* | [specs.md](02-requirements/specs.md) |
| [`03-design/`](03-design/) | *How is it built?* | [high-level-design.md](03-design/high-level-design.md), [low-level-design.md](03-design/low-level-design.md), [adr/](03-design/adr/) |
| [`04-security/`](04-security/) | *What can go wrong, and how do we stop it?* | [threat-model.md](04-security/threat-model.md), [security-checklist.md](04-security/security-checklist.md) |
| [`05-quality/`](05-quality/) | *How do we know it works?* | [testing-strategy.md](05-quality/testing-strategy.md) |
| [`06-operations/`](06-operations/) | *How do we deploy and run it?* | [deployment.md](06-operations/deployment.md), [runbook.md](06-operations/runbook.md) |
| [`07-process/`](07-process/) | *How do we work?* | [workflows.md](07-process/workflows.md), [templates/](07-process/templates/) |

GitHub-native templates (PR + issues) live in [`/.github`](../.github/).

## Reading order for a new contributor

1. `00-overview/vision.md` (5 min)
2. `01-product/milestones.md`: where we are now
3. `03-design/high-level-design.md`: the big picture
4. `07-process/workflows.md`: how to make a change
5. Everything else as needed

## Rules for these docs

- **Docs live with code.** If a PR changes behavior, it updates the matching doc in the same PR.
- **Status markers:** ✅ done · 🚧 in progress · 🔜 planned · ❌ won't do
- **Decisions are recorded, not rewritten.** If we change our mind, add a new ADR that supersedes the old one.
