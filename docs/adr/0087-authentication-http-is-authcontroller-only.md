---
status: proposed
---

# Authentication HTTP is served only by AuthController

`/auth/*` was defined twice: a hand-written Express router mounted ahead of TSOA, and `AuthController`, which generates the OpenAPI spec. Express won by registration order, so the spec lied, and the serving logout handler called Passport `req.logout` in a JWT app with no `express-session` (#577, the silent-swap in #321). TSOA is awkward with `res.cookie`; that convenience is how the second router appeared.

## Decision

Authentication HTTP is served only by `AuthController`. Cookie setting lives in that controller, or a helper it calls. Do not remount an Express router on `/auth` to paper over TSOA, handle Passport, or "just set cookies."

This is not a blanket ban on shadowing. Legacy `/user` remains the deliberate close-off in [ADR 0011](0011-platform-admin-console.md): an Express stub that 404s so the old surface cannot be used. Auth is not a closed surface.

## Considered Options

- **Keep both and test the mount order** — rejected. The tests exist to catch a swap; they do not make two implementations of one contract cheaper than one.
- **Reorder `RegisterRoutes` ahead of `authRouter`** — rejected. That is the #321 hazard: production flips with no failing test until a caller notices.
- **Patch `req.logout` out of the Express handler and leave the duplicate** — rejected. The 500 is a symptom; the duplicate is the defect.
- **Ban every Express router that shares a prefix with TSOA** — rejected. `/user` is a closed surface on purpose.

## Consequences

- #577 deletes `routes/auth.ts` and its `api.use('/auth', …)` mount after `AuthController` matches the serving contract (including login/refresh cookies and Logout clearing `refresh_cookie`).
- A later change that reintroduces `routes/auth` for cookies is reversing this ADR, not following TSOA-is-awkward.
- [ADR 0006](0006-mobile-refresh-token-delivery.md) still owns cookie-versus-body delivery; this ADR owns which module may implement `/auth`.
