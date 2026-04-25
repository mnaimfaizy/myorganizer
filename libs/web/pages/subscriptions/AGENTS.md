# Subscriptions Page Agent Guide

## Scope

Dashboard subscriptions list/detail pages backed by the encrypted vault.

## Do

- Store subscription data inside the `subscriptions` encrypted blob.
- Use account currency preferences for totals and conversions when needed.

## Do Not

- Do not send plaintext subscription details to backend APIs.
