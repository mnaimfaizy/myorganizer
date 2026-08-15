# Design brief — Session Lifecycle

**Branch: grounded.** Every claim below is traced to `file:line` in this repo. Where this brief
and `docs/authentication/README.md` disagree, the source won and the disagreement is recorded in
**Contradictions found**.

> A backend or frontend engineer new to MyOrganizer should be able to answer: **when a login is
> rejected or a session silently ends, which check did it — and which of the two auth
> implementations actually ran?**

---

## What I want

A self-contained HTML page at `docs/authentication/session-lifecycle.html`. No CDN, no external
assets, no network at load, correct in light and dark. It animates one account from creation to
revocation.

The page steps through scenes. It needs template bindings for the token timeline, so it will carry
the React runtime the way `docs/vault/lifecycle.html` does; `docs/vault/trust-boundary.html` binds
nothing and ships at roughly a third the size, so keep interactivity to the timeline and the scene
stepper and let everything else be plain DOM.

## Why this exists

The concrete failure: **an engineer reads `AuthController`, believes they know what `POST
/auth/login` does, and ships a client against behaviour that never executes.**

`apps/backend/src/main.ts:182` mounts the hand-written `authRouter`; `apps/backend/src/main.ts:188`
then calls `RegisterRoutes(api)`. Express is first-match-wins, so
`apps/backend/src/routes/auth.ts` serves **every** `/auth/*` path and the tsoa `AuthController`
handlers never run for them — but `AuthController` is what generates
`libs/api-specs/src/api-specs.openapi.yaml`, which generates the typed client that
`libs/auth` calls.

The contract the frontend is generated against is written by code that does not execute. The two
have already drifted (see the hero). A reader who cannot see this will keep getting surprised, and
no amount of prose has fixed it.

## The system in one sentence

An account moves through five durable states carried on one `User` row, guarded by four
independently-signed token families and cut short by three unrelated revocation mechanisms.

## The hero

**The split path at `/auth/*`, drawn once, at the top, above every scene.**

One request enters. It hits `authRouter` and stops there. `AuthController` sits beside it, greyed
but clearly present, with an arrow running _sideways_ into the OpenAPI spec → generated client →
`libs/auth`. Two arrows, two destinations, one of them never touching a request.

The three divergences must be legible on this hero, not buried in a footnote:

| Behaviour               | `routes/auth.ts` (runs)                                                    | `AuthController` (specs)                                                                          |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Unverified email login  | `403` ([auth.ts:52-58](../../apps/backend/src/routes/auth.ts))             | no check at all ([AuthController.ts:47-79](../../apps/backend/src/controllers/AuthController.ts)) |
| Refresh cookie on login | set ([auth.ts:88](../../apps/backend/src/routes/auth.ts))                  | never set                                                                                         |
| Refresh token rotation  | rotates, new cookie ([auth.ts:433](../../apps/backend/src/routes/auth.ts)) | no rotation ([AuthController.ts:161](../../apps/backend/src/controllers/AuthController.ts))       |

Four handlers are _not_ divergent — `/verify/email`, `/verify/resend`, `/password/reset`,
`/password/reset/confirm` delegate straight back into the controller
([auth.ts:270,339,344,349](../../apps/backend/src/routes/auth.ts)). Show that as a partial overlap.
Drawing it as a clean fork would be wrong.

## Supporting panels

**1. Four keyrings, not one JWT.** Settles: _which secret signs what, and for how long._
All from [`ApiTokens.ts`](../../apps/backend/src/helpers/ApiTokens.ts): access `ACCESS_JWT_SECRET`
`10m` (:30), refresh `REFRESH_JWT_SECRET` `7d` (:35), verify `VERIFY_JWT_SECRET` `10m` (:20), reset
`RESET_JWT_SECRET` `10m` (:10). Four separate secrets — a token minted for one purpose cannot be
replayed at another.

**2. Registration is a compensating transaction.** Settles: _what happens when the mail server is
down._ Order, read from [`AuthController.ts:216-239`](../../apps/backend/src/controllers/AuthController.ts):
create user → send verification mail → **on send failure, delete the user just created** (:220) →
otherwise persist the token (:231). The token is stored only after the send succeeded. Animate the
rollback; it is the one place this system undoes itself.

**3. The cooldown is the token itself.** Settles: _why a resend says "already sent recently"._
There is no cooldown column. `sendVerificationMail` decodes the previously stored token, and if it
still verifies, returns an error instead of sending
([`UserService.ts:410-421`](../../apps/backend/src/services/UserService.ts)); the reset path does the
same at [`AuthController.ts:359-377`](../../apps/backend/src/controllers/AuthController.ts). The
still-valid token _is_ the rate limiter, so the cooldown equals the token TTL — `10m` — by
construction rather than by configuration.

**4. Three revocations that cut differently.** Settles: _what "log everyone out" actually kills._
This is the panel most worth animating.

| Mechanism                 | Written by                                                                                              | Checked at                                                                                                                                         | Kills                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `blacklisted_tokens[]`    | logout ([UserService.ts:496](../../apps/backend/src/services/UserService.ts))                           | refresh only ([auth.ts:412](../../apps/backend/src/routes/auth.ts))                                                                                | that one refresh token                        |
| `sessions_invalidated_at` | admin disable / force-logout ([UserService.ts:170,212](../../apps/backend/src/services/UserService.ts)) | every access token ([passport.ts:97](../../apps/backend/src/utils/passport.ts)) and refresh ([auth.ts:401](../../apps/backend/src/routes/auth.ts)) | all tokens issued before the timestamp        |
| `disabled`                | admin disable ([UserService.ts:169](../../apps/backend/src/services/UserService.ts))                    | four separate gates                                                                                                                                | all future authentication, tokens still valid |

The comparison is `tokenIat * 1000 < sessionsInvalidatedAt.getTime()`
([`sessionInvalidation.ts:12`](../../apps/backend/src/helpers/sessionInvalidation.ts)).

The scene to build: five live tokens on the timeline, admin clicks force-logout, and the reader
watches which go dark **and which do not** — an in-flight verify or reset token is signed by a
different secret and checked by neither mechanism. It survives. That is the counter-intuitive
result the panel exists to deliver.

**5. Single-use reset, enforced by the database.** Settles: _what stops a reset link being
replayed._ `resetPassword` updates
`where: { id, reset_password_token: token }` and sets the column to `null` in the same statement
([`UserService.ts:378-397`](../../apps/backend/src/services/UserService.ts)). The row is the lock;
a second use matches no row. Show the WHERE clause literally — this is one of the few places the
guarantee is visible in one line.

**6. Web and mobile split at the same endpoint.** Settles: _where the refresh token lives._
`shouldIncludeRefreshTokenInLoginBody`
([`refresh-client-contract.ts:64`](../../libs/auth/src/lib/refresh-client-contract.ts)) forks on
`client_type`. Web gets an httpOnly `refresh_cookie`, `sameSite: 'lax'`, `secure` only in
production ([auth.ts:88-93](../../apps/backend/src/routes/auth.ts)), 7-day expiry
([`cookieHelper.ts`](../../apps/backend/src/helpers/cookieHelper.ts)). Mobile gets it in the JSON
body and stores it in the OS keychain (ADR 0006). Same endpoint, two trust models.

**7. The client's three-state session.** Settles: _why a hard refresh does not log me out._
`getSnapshot` returns `authenticated` | `restorable` | `guest`
([`auth-session-module.ts:95-103`](../../libs/auth/src/lib/auth-session-module.ts)) — `restorable`
means the user object survived in `localStorage` but the access token did not, so the cookie is
worth trying. Two guards consume it: inbound keeps signed-in users off `/login`, outbound keeps
guests out of `/dashboard`
([`guard-orchestration.ts`](../../libs/auth/src/lib/guard-orchestration.ts)).

Pair it with the 401 interceptor
([`auth-session-transport-adapter.ts:63-98`](../../libs/auth/src/lib/auth-session-transport-adapter.ts)):
single-flight via `refreshInFlight` (:86), one retry only via `_retry` (:75), and an exclusion list
so a 401 from `/auth/login` never triggers a refresh loop (:33-41). Show two concurrent 401s
collapsing into **one** refresh call.

## Visual guidance

- The four token families must be distinguishable from each other at a glance and must stay
  distinguishable when a token dies. Do not encode "revoked" in colour alone — the force-logout
  scene depends on a reader seeing exactly which of five survives.
- The executing path must dominate the specified path. Greyed-but-present, not absent.
- Time runs one way on the timeline. The registration rollback is the only backwards arrow on the
  page; let it read as the exception it is.

## Anti-goals

- **Not** a threat model. Where keys live and what crosses the line is
  [`docs/vault/trust-boundary.html`](../vault/trust-boundary.html); do not restate it.
- **Not** an endpoint reference. `README.md` in this directory lists paths and bodies. Link, do not
  duplicate.
- **Not** the Platform Admin console. Admin actions appear only as the _cause_ of revocation in
  panel 4; the audit-log side of that story is out of scope.
- **Not** machine-first. This page is for humans. Do not compromise the reading experience for the
  manifest — the manifest is a hidden `<script type="application/json">`, exactly as the vault
  pages do it.
- Do not draw the express/tsoa split as a clean fork. It is a partial overlap.

## The reading test

Put this on the page, near the hero:

> If your change touches `/auth/*`, ask which file serves it. If you edited `AuthController` and
> the path also exists in `routes/auth.ts`, your change reached the OpenAPI spec and the generated
> client — **and no request.**

## The halt

Two points where the animation must stop and refuse to advance without an explicit action:

1. **Email verification.** The account sits in `pending_verification` until the user clicks the
   link. Login returns `403` until then ([auth.ts:52-58](../../apps/backend/src/routes/auth.ts)).
   The stepper must not glide past this.
2. **Password reset confirmation.** The reset token exists but the password is unchanged until
   `PATCH /auth/password/reset/confirm` arrives.

An animation that runs straight through either gate teaches the opposite of the truth.

## Machine-readable requirement

Embed one block, `id="auth-session-manifest"`, checked by
`tools/scripts/check-auth-pages.mjs` (`yarn auth:pages:check`). Key names are scope-qualified —
`accessTokenTtl`, never `ttl`.

```json
{
  "tokens": {
    "accessTokenTtl": "10m",
    "refreshTokenTtl": "7d",
    "verifyTokenTtl": "10m",
    "resetTokenTtl": "10m",
    "accessTokenExpiresInMs": 600000
  },
  "cookie": { "refreshCookieName": "refresh_cookie", "refreshCookieDays": 7 },
  "hashing": { "bcryptSaltRounds": 10 },
  "clientStorage": {
    "accessTokenStorageKey": "myorganizer_access_token",
    "userStorageKey": "myorganizer_user",
    "tokenStorageModeKey": "myorganizer_token_storage"
  },
  "rateLimit": {
    "globalRateLimitDefaultWindowMs": 60000,
    "globalRateLimitDefaultMax": 300
  },
  "authErrorCodes": ["invalid_credentials", "email_not_verified", "email_already_registered", "verification_resent", "network_error", "unknown"],
  "adminAuditActions": ["disable", "enable", "force_logout", "resend_verification", "promote", "demote"],
  "routerPrecedence": { "authRouterBeforeTsoaRoutes": true },
  "notYetExported": ["tokens.accessTokenTtl", "tokens.refreshTokenTtl", "tokens.verifyTokenTtl", "tokens.resetTokenTtl", "tokens.accessTokenExpiresInMs", "cookie.refreshCookieDays", "hashing.bcryptSaltRounds", "clientStorage.accessTokenStorageKey", "clientStorage.userStorageKey", "clientStorage.tokenStorageModeKey"]
}
```

`routerPrecedence.authRouterBeforeTsoaRoutes` is the important one. It asserts that
`api.use('/auth', authRouter)` still precedes `RegisterRoutes(api)` in
`apps/backend/src/main.ts`. If someone reorders those two lines, every behaviour on this page
changes and the check must fail rather than let the page lie.

Most values are module-private today, hence `notYetExported` — the checker reads them from source
text, the same technique `tools/scripts/check-vault-pages.mjs` uses. To tighten, export them and
add them to `SOURCES`.

---

## Contradictions found

Surfaced separately from the brief, per `GROUNDING.md` §3.

1. **`invalid_credentials` is unreachable.** `classifyMessage` requires the message to contain
   `'invalid'` plus `'credential'` or `'password'`
   ([auth-error-mapping.ts:18-23](../../libs/auth/src/lib/auth-error-mapping.ts)). The backend's
   actual message is `'Incorrect email or password!'`
   ([passport.ts:42,56](../../apps/backend/src/utils/passport.ts)) — no `'invalid'`. Every
   wrong-password login classifies as `'unknown'`. One of six error codes is dead.

2. **The spec omits the most common login failure.** `/auth/login` documents `200` and `401` only
   ([api-specs.openapi.yaml:1214-1245](../../libs/api-specs/src/api-specs.openapi.yaml)). The
   running handler also returns `403` (unverified) and `422` (validation). The typed client cannot
   see either; `libs/auth` recovers the 403 by string-matching the message.

3. **`600_000` is written three times.** Named once as `ACCESS_TOKEN_EXPIRES_IN_MS`
   ([PlatformTokenHandler.ts:10](../../apps/backend/src/helpers/PlatformTokenHandler.ts)), then as a
   bare literal at [AuthController.ts:169](../../apps/backend/src/controllers/AuthController.ts) and
   [auth.ts:441](../../apps/backend/src/routes/auth.ts). It also duplicates the `10m` TTL in
   `ApiTokens.ts` in a different unit. Four places, one fact.

4. **`README.md` documents two storage keys; there are three.** `myorganizer_token_storage`
   ([auth-session-storage-adapter.ts:15](../../libs/auth/src/lib/auth-session-storage-adapter.ts))
   is undocumented, and it is the one that decides whether the token lands in `localStorage` or
   `sessionStorage`.

5. **`README.md` does not mention refresh-token rotation.** `/auth/refresh` mints a new refresh
   token and resets the cookie ([auth.ts:417-437](../../apps/backend/src/routes/auth.ts)). Line 18
   of the README describes only the access token coming back.

Collision check: `ACCESS_JWT_SECRET`, `REFRESH_JWT_SECRET`, `VERIFY_JWT_SECRET`, `RESET_JWT_SECRET`,
`refresh_cookie`, the three storage keys, `SaltRounds`, and the global rate-limit defaults were each
searched repo-wide. Only `600_000` returned conflicting definitions (item 3); the rest hold a single
value. `AuthErrorCode` (6) and `AdminAuditAction` (6) were compared against their canonical
definitions in `auth-session-types.ts:5-11` and `user.prisma` and are cited complete.
