# TDD-M0-S01: Project Scaffold

**Milestone:** M0 Foundations
**Status:** ✅ Implemented
**Gaps:** None

## Story

As a **developer**, I want a TypeScript project with strict mode, ES modules, dev/build/test scripts, and git tracking, so that all future milestones build on a consistent, type-safe foundation.

## What Was Built

| Item | Implementation | Status |
|---|---|---|
| TypeScript strict mode | `tsconfig.json` with `strict: true` | ✅ |
| ES modules | `"type": "module"` in package.json, `.js` extensions in imports | ✅ |
| Dev server | `tsx watch src/index.ts` | ✅ |
| Production build | `tsc` → `dist/`, `node dist/index.js` | ✅ |
| Test runner | Vitest (`npm test`, `npm run test:watch`) | ✅ |
| Type checking | `npm run typecheck` (`tsc --noEmit`) | ✅ |
| Git | `.gitignore` for `node_modules/`, `dist/`, `.env` | ✅ |
| GitHub templates | PR template, issue templates (bug, feature) | ✅ |

## Files

```
realtime-chat/
├── src/
│   ├── index.ts          # Entry point: listen, graceful shutdown
│   ├── app.ts            # buildServer(): Express + Socket.IO (testable)
│   └── types.ts          # Event contracts
├── public/               # Static frontend
├── package.json          # Scripts, dependencies, engines (Node >=20)
├── tsconfig.json         # Strict, ESM, outDir: dist
├── .gitignore
└── .github/              # PR + issue templates
```

## Tests to Verify

Since M0 is scaffolding, the "tests" are structural:
1. `npm run typecheck` passes with zero errors
2. `npm run build` produces `dist/index.js`
3. `npm test` runs (even if no test files yet)
4. `npm run dev` starts the server on port 3000

## Retrospective

M0 delivered a clean scaffold. Gaps identified for the foundational layer:
- No Docker setup (see TDD-M0-S02)
- No environment variable pattern (see TDD-M0-S03)
- `better-sqlite3` still in deps despite ADR-0005 (see TDD-M0-S04)
