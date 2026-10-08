# ADR-0004: Plain HTML/CSS/JS frontend

- **Status:** Accepted · **Date:** 2026-10-08

## Context
The UI is one screen: log, sidebar, prompt. The team is learning fundamentals.

## Options
React/Vue/Svelte (components, ecosystem, but a build step and more concepts) vs. **plain JS** (no build, tiny, direct DOM).

## Decision
Plain HTML + CSS variables + vanilla JS, served as static files.

## Consequences
- ✅ No build step, fast load, easy to deploy
- ✅ Teaches the DOM, events and XSS-safe rendering directly
- ⚠️ If the UI grows (many screens, complex state), revisit with a new ADR
