# ADR-0003: Host on Render free tier

- **Status:** Accepted · **Date:** 2026-10-08

## Context
Goal: public internet, $0, must support a long-running Node process with WebSockets.

## Options (checked Oct 2026)
| Option | Free? | WebSockets / long-running? |
|---|---|---|
| **Render** | Free web service, no card | ✅ |
| Railway | Trial, then ~$1/mo credit | ⚠️ not enough to run all month |
| Fly.io | Trial only, card required | ✅ but paid |
| Vercel / Netlify | Free | ❌ serverless, no long-lived sockets |

## Decision
Render free web service, region Singapore (closest to the Philippines), auto-deploy from `main`.

## Consequences
- ✅ HTTPS, health checks and auto-deploy included
- ⚠️ Sleeps after 15 min idle (~1 min cold start)
- ⚠️ Ephemeral disk (see ADR-0002)
- ⚠️ 750 instance-hours/month and 5 GB outbound bandwidth on the Hobby workspace
- Revisit if we need always-on or durable storage.
