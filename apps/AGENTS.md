# Apps Agent Guide

## Scope

Application projects live here: backend API, Next.js frontend shell, and Playwright e2e tests.

## Do

- Use each app's project-specific Nx targets.
- Keep shared logic in `libs/**`.
- Read the nearest app AGENTS.md before changing files.

## Do Not

- Do not duplicate reusable code across apps.
- Do not bypass app-specific security, routing, or testing notes.
