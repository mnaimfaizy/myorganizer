# Mobile Auth Agent Guide

## Scope

React Native auth: access-token memory, refresh-token keychain, and the auth API client.

## Commands

- Test: `yarn nx test mobile-feat-auth`.
- Lint: `yarn nx lint mobile-feat-auth`.

## Do

- Store the refresh token in the OS keychain and send it in the refresh body (ADR 0006).
- Keep the access token in memory only.
- Clear session state when refresh fails.

## Do Not

- Do not treat mobile refresh as an httpOnly cookie.
- Do not store refresh tokens in AsyncStorage or other JavaScript-accessible storage.
