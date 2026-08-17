---
name: youtube-integration-workflow
description: 'Use when working on YouTube OAuth, subscription sync, cached videos, notification settings, cron sync, or the dashboard YouTube page in MyOrganizer.'
---

# YouTube Integration Workflow

## Use This Skill When

- Changing the YouTube dashboard page library or related account settings
- Updating Google OAuth flow, callback handling, or integration status logic
- Modifying subscription sync, cached video queries, or notification settings
- Editing cron sync behavior, token encryption, or YouTube-related backend endpoints

## Core Rules

- Use backend YouTube APIs through the generated client from the frontend.
- Treat Google OAuth tokens as backend-managed encrypted-at-rest data, separate from the E2EE vault.
- Do not call Google APIs directly from the browser for synced data.
- Avoid quota-expensive endpoints such as `search.list`.
- Do not expose Google client secrets, cron secrets, or tokens in frontend code.

## Procedure

1. Split responsibility cleanly between `libs/web/pages/youtube` and `apps/backend`.
2. Keep OAuth callback expectations, token encryption, and cron secrets on the backend side only.
3. If endpoint shapes change, run `yarn openapi:sync`, `yarn api:generate`, and `yarn openapi:check`.
4. Follow the detailed [YouTube integration runbook](./references/runbook.md) for quota rules, validation, and repo references.
