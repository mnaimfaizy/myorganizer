# Subscriptions Page Agent Guide

## Scope

Dashboard subscriptions list page backed by the encrypted vault. Add and edit happen in dialogs summoned from the list; there is no detail route (see ADR 0037).

## Do

- Store subscription data inside the `subscriptions` encrypted blob.
- Use account currency preferences for totals and conversions when needed.

## Do Not

- Do not send plaintext subscription details to backend APIs.
