# TDD-M0-S02: Docker Setup

**Milestone:** M0 Foundations
**Status:** 🔄 Assumed — skip for v1 (Gap G-01)
**Gaps:** G-01 (PO to confirm)

## Story

As a **developer**, I want a Docker setup for local development, so that the environment is consistent across machines and ready for future multi-instance scaling.

## Analysis

| Factor | Assessment |
|---|---|
| Render deployment | Deploys from source via `npm ci && npm run build`. Docker is optional, not required. |
| Local dev | `npm run dev` works directly. No system-level dependencies beyond Node.js >=20. |
| Multi-instance (post-v1) | Redis adapter for Socket.IO will need Docker. Not needed until scaling.md triggers. |
| Team size | Single developer. Docker overhead is not justified yet. |
| DB-IP Lite (M5) | A local MMDB file, not a running service. No container needed. |

## Decision (assumed, pending PO)

**Skip Docker for v1.** Rationale:
1. No database or external service to containerize
2. Render doesn't use Docker for free-tier builds
3. Single developer, Node.js is the only runtime dependency
4. Adding Docker now adds maintenance cost (Dockerfile, docker-compose, CI changes) with no benefit

## When to Revisit

Add Docker when:
- Multi-instance scaling requires Redis (post-v1, see scaling.md)
- A second developer joins and needs environment parity
- CI needs a containerized test environment

## If PO Decides YES to Docker

### Files to Create

```
Dockerfile              # Multi-stage: build + runtime
docker-compose.yml      # dev service with volume mounts
.dockerignore           # node_modules, dist, .git
```

### Test Plan (TDD)

1. `docker compose up` starts the server on port 3000
2. `docker compose run app npm test` passes all tests
3. `docker compose run app npm run typecheck` passes
4. Hot-reload works: edit a `.ts` file → server restarts inside the container
5. Image size < 200 MB (Node alpine + deps)

### Dockerfile Design

```dockerfile
# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
```
