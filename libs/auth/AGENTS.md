# Auth Library Agent Guide

## Scope

Frontend authentication utilities, token storage, Axios setup, refresh-on-401, and auth UI helpers.

## Commands

- Test: `yarn nx test auth`.

## Do

- Preserve access-token storage keys and refresh-cookie behavior.
- Keep requests credential-aware where refresh cookies are required.
- Clear session state when refresh fails.

## Do Not

- Do not store refresh tokens in JavaScript-accessible storage.
- Do not break email-verification gating or resend cooldown behavior.
