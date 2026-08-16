# Auth Session Runbook

## Owning Surfaces

- Frontend auth utilities and UI helpers in `@myorganizer/auth`
- Backend auth controllers and services in `apps/backend`
- Generated client output if auth endpoint shapes change

## Session Invariants

- Refresh tokens stay in HTTP-only cookies only.
- Access token goes to `localStorage` only when remember-me is enabled.
- Otherwise the access token goes to `sessionStorage`.
- Non-auth requests use `withCredentials: true` so refresh cookies flow correctly.
- Refresh failure clears session state.
- Email verification gating and resend cooldown behavior stay intact unless the feature is explicitly being redesigned.

## Change Workflow

1. Identify whether the change is frontend-only, backend-only, or a cross-boundary auth flow change.
2. If browser session behavior changes, inspect `@myorganizer/auth` before editing backend code in isolation.
3. If endpoint shapes, DTOs, or public auth responses change, regenerate contract outputs:
   - `yarn openapi:sync`
   - `yarn api:generate`
4. Update docs if user-visible login, verification, storage, or refresh behavior changed.

## Checkpoints

- If refresh tokens move into JavaScript-accessible storage, stop and redesign.
- If login or refresh behavior changed without checking `@myorganizer/auth`, the work is probably incomplete.
- If auth responses changed but generated client output was not regenerated, the work is incomplete.

## Validation

- `yarn nx test auth`
- `yarn nx test backend`
- `yarn nx lint auth`
- `yarn nx lint backend`
- Add focused e2e coverage if the user-facing flow changed materially.

## Repo References

- `docs/authentication/README.md`
- `libs/auth/AGENTS.md`
- `apps/backend/AGENTS.md`
- `libs/app-api-client/AGENTS.md`
- `.github/copilot-instructions.md`
