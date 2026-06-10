---
status: accepted
---

# Mobile receives the refresh token in the login body, not an httpOnly cookie

The web app authenticates with a short-lived access token plus a refresh token delivered as an httpOnly `refresh_cookie` and replayed automatically by the browser cookie jar. React Native has no equivalent reliable cookie jar (Android OkHttp drops cookies across restarts, and httpOnly cookies can't be moved into secure storage), so the mobile client needs the refresh token in hand.

## Decision

The `/auth/login` request carries a client type. When it is `mobile`, the response body additionally includes `refresh_token`; the default (web) response is unchanged and continues to rely on the httpOnly cookie. The mobile app stores the refresh token in the OS keychain (`react-native-keychain`) and sends it in the `/auth/refresh` request body — a path the backend already supports (`refresh_token` body falls back to `refresh_cookie`).

## Consequences

- `app-api-client` is regenerated with an additive optional `refresh_token` field on the login response; web behavior is unaffected, but the web auth flow gets a smoke check in the same change.
- The refresh token now exists in two delivery channels (cookie for web, body for mobile) gated by client type — both must be kept in sync if the token contract changes.
