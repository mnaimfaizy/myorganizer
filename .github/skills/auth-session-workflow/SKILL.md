---
name: auth-session-workflow
description: 'Use when changing login, logout, registration, refresh-token flow, email verification, token storage, or auth UI helpers in MyOrganizer.'
---

# Auth Session Workflow

## Use This Skill When

- Changing authentication endpoints, auth UI helpers, or browser session behavior
- Modifying login, registration, logout, refresh-token, or remember-me flows
- Updating email verification, resend cooldowns, or token storage behavior

## Core Rules

- Keep refresh tokens in HTTP-only cookies only.
- Preserve the existing access-token storage keys and remember-me behavior.
- Keep credential-aware requests where refresh cookies are required.
- Do not break email-verification gating or resend cooldown behavior.

## Procedure

1. Start from the owning auth surface in `@myorganizer/auth` or `apps/backend`.
2. Update frontend and backend together when the session flow crosses that boundary.
3. If auth endpoint shapes change, run `yarn openapi:sync` and `yarn api:generate`.
4. Follow the detailed [auth session runbook](./references/runbook.md) for session invariants, validation, and repo references.
