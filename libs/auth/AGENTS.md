# Auth Library Agent Guide

## Scope

Frontend authentication utilities, token storage, Axios setup, refresh-on-401, and auth UI helpers.

## Commands

- Test: `yarn nx test auth`.

## Do

- Preserve access-token storage keys and refresh-cookie behavior.
- Keep requests credential-aware where refresh cookies are required.
- Clear session state when refresh fails.

## Portable Entry Point

`src/portable.ts` (`@myorganizer/auth/portable`) is what the Mobile App's native code imports; the main entry point reaches the browser session storage adapter and `@myorganizer/core`'s `window` helpers. Keep everything re-exported from `portable.ts` free of browser globals — the mobile native typecheck program has no `dom` and fails on them ([ADR 0103](../../docs/adr/0103-mobile-native-code-is-typechecked-without-dom-and-reaches-shared-libraries-through-a-portable-entry-point.md)).

## Do Not

- Do not store refresh tokens in JavaScript-accessible storage.
- Do not break email-verification gating or resend cooldown behavior.
