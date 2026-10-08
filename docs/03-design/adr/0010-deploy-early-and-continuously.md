# ADR-0010: Deploy early (M2) and continuously; launch publicly at M8

- **Status:** Accepted · **Date:** 2026-10-08

## Context
Question: should we deploy only at the end of development?

## Options
| Option | Pros | Cons |
|---|---|---|
| Deploy once at the end ("big bang") | Nothing public until it's finished | All deployment problems (env vars, proxies, WebSockets behind TLS, cold starts, CSP on a real domain) appear at the very end, at once |
| Deploy from day one, unprotected | Fast feedback | Bots find it; an unprotected server is a liability |
| **Deploy at M2 (after hardening), then every merge; announce at M8** | Real-environment feedback every milestone; small, reversible changes; the pipeline is proven long before launch | The URL is technically public before launch (mitigated: hardened, not shared) |

## Decision
First deploy at the **end of M2**; continuous deployment of every green `main` afterwards; **public launch (sharing the link) only at M8**, after the security checklist passes.

## Consequences
- ✅ Production-only bugs (e.g. WSS through Render's proxy, real client IPs via `X-Forwarded-For`) are found early, one at a time
- ✅ Every milestone demo runs on the real URL (phone + laptop)
- ⚠️ Pre-launch, the app shows a "preview: not launched yet" banner
