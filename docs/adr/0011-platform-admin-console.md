---
status: accepted
---

# Platform Admin console lives in the same web app under `/admin`

MyOrganizer needs operator tooling to manage Users' account metadata (directory, disable/enable with session kill, force logout, resend verification, promote/demote). That is a **Platform Admin** concern — not Organization membership (still emerging) and not Vault access (E2EE plaintext stays client-only).

## Decision

- A **Platform Admin** is a privileged **User** (same login/JWT stack) marked with a single role (`user` | `platform_admin`), not a separate staff identity or permission matrix.
- The console is **web-only**, in the existing Next.js app, as a separate **`/admin/**` shell** (own nav/layout) — not nested under the personal dashboard and not a second deployable/`apps/admin`.
- v1 capabilities are account-lifecycle only; directory fields are identity metadata only (no vault/YouTube operational hints). No impersonation, no admin-set passwords.
- **Disabled User** means soft-block from auth with **immediate** refresh/session invalidation; Ciphertext and profile remain until a separate delete/purge decision.
- First Platform Admin is bootstrapped (seed/env); afterward promote/demote happens in-app, with a last-admin guard. Mutations write a durable **Admin Audit Log**.
- Legacy `/user` list/get/create routes are **replaced** by Platform-Admin-only APIs (not left open alongside the new console).
- Delivery is one PRD with vertical slices: close the `/user` hole and foundation first; deeper auth consolidation (dual `/auth` router, refresh reuse detection) is later, not a blocker.

## Considered options

- **Organization Admin first** — rejected; Organization is not implemented; operator user-management is the immediate need.
- **Separate `apps/admin` or admin subdomain** — deferred; same-app `/admin` ships faster; split later if deploy isolation or cookie hardening requires it. Security still depends on API role checks, not on a second UI.
- **Nested under `/dashboard/admin`** — rejected; personal Vault UX and service operation should not share chrome.
- **Fine-grained permissions or env-only allowlist** — rejected for v1; one role matches one toolkit; allowlist alone makes revoke/redeploy painful.
- **Leave legacy `/user` routes** — rejected; public/over-broad user APIs must not survive the console launch.

## Consequences

- Prisma `User` gains role (+ disabled state); every admin mutation re-checks Platform Admin server-side and appends an Admin Audit Log entry.
- Normal Users must not receive list-all-users or public get-by-id; self-profile stays on existing account/auth surfaces, not the removed `/user` CRUD.
- Future Organization roles should not overload `platform_admin`; keep platform operation distinct from org membership when Organization lands.
