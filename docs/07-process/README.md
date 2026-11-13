# 07-process: How we work

| File | What it contains |
|---|---|
| [workflows.md](workflows.md) | Branching, commits, PR flow, the three levels of Definition of Done, hotfixes, documentation workflow |
| [ci-cd.md](ci-cd.md) | The automated CI/CD pipeline: stages, the planned GitHub Actions file, branch protection, rollout plan |
| [automation.md](automation.md) | Everything else worth automating, prioritized, and what we deliberately keep manual |
| [security-tooling.md](security-tooling.md) | Security tools by pipeline stage (secret scan, static analysis, dependency audit) and how to run them locally |
| [pipeline/](pipeline/README.md) | The detailed story-to-production pipeline: milestone, story and hotfix pipelines, Definition of Ready and Done, story classification, agents, merge strategy |
| [templates/](templates/README.md) | Templates for feature specs, user stories, ADRs, bug reports |

`workflows.md` is the short version of how we work. `pipeline/` is the full specification; where they differ, `pipeline/` wins.
