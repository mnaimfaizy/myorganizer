# Mobile Auth Agent Guide

## Scope

React Native auth: access-token memory, refresh-token keychain, and the auth API client.

## Commands

- Lint: `yarn nx lint mobile-feat-auth`.
- Test: `node node_modules/.bin/jest --config=libs/mobile/feat/auth/jest.config.ts --no-coverage --forceExit`. The project runs in a `node` environment, so a spec covers pure modules only (`src/api/sessionRefresh.ts`) and must not import `react-native`, the keychain, `client.ts`, or the library barrel.

## Do

- Store the refresh token in the OS keychain and send it in the refresh body (ADR 0006).
- Keep the access token in memory only.
- End the Session only when the server rejects the refresh, or when no Refresh Token is stored. A refresh that got no answer or met a server failure keeps the Refresh Token and is asked again later; `REFRESH_FAILURE_ENDS_SESSION` in `src/api/sessionRefresh.ts` is the one place that rules on a failure kind.
- Refresh through `refreshSession` in `src/api/client.ts`. Session restore on launch and refresh-on-401 share it, so they cannot disagree about what a failure means.

## Do Not

- Do not treat mobile refresh as an httpOnly cookie.
- Do not store refresh tokens in AsyncStorage or other JavaScript-accessible storage.
