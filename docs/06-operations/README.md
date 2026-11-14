# 06-operations: How it runs in production

| File | What it contains |
|---|---|
| [render.md](render.md) | What Render is, where it fits, how it works, free-tier limits, alternatives, when not to use it |
| [deployment.md](deployment.md) | **When** we deploy (and why not only at the end), step-by-step setup, environment variables, releases, rollback |
| [health-checks.md](health-checks.md) | The `/health` endpoint explained thoroughly |
| [scaling.md](scaling.md) | Horizontal scaling strategy that stays free as long as possible, and honest limits |
| [runbook.md](runbook.md) | What to do when something breaks (symptom → check → fix) |
| [deployment-security.md](deployment-security.md) | The checklist a release must pass before and after deploy |
| [infrastructure-requirements.md](infrastructure-requirements.md) | Availability, capacity, network, DNS and CDN requirements |
| [monitoring-observability.md](monitoring-observability.md) | SLIs, SLOs, alerts, dashboards, logs |
| [incident-response-plan.md](incident-response-plan.md) | Severity levels, response phases, communication templates, incident record |
| [disaster-recovery.md](disaster-recovery.md) | Recovery objectives, backup, failover, drills |

**Legal deadlines during an incident** (72-hour breach notice, child-safety reports, police requests) are in [`09-compliance/`](../09-compliance/README.md). The standard for hosting, vendors and access is [`09-compliance/ict-deployment-standards.md`](../09-compliance/ict-deployment-standards.md).
