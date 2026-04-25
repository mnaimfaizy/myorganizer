# YouTube Page Agent Guide

## Scope

YouTube dashboard page library for OAuth status, subscriptions, videos, and notification settings.

## Do

- Use backend YouTube APIs through the generated client.
- Treat Google OAuth tokens as backend-managed encrypted-at-rest data, separate from the E2EE vault.
- Avoid quota-expensive flows such as YouTube `search.list`.

## Do Not

- Do not expose Google client secrets, cron secrets, or tokens in frontend code.
- Do not call Google APIs directly from the browser for synced data.
