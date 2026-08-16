# YouTube Integration Runbook

## Responsibility Split

- Frontend page logic belongs in `libs/web/pages/youtube`.
- Backend OAuth, token encryption, sync, cron, and cached metadata behavior belongs in `apps/backend`.

## Non-Negotiable Constraints

- Use backend YouTube APIs through the generated client from the frontend.
- Google OAuth tokens remain backend-managed encrypted-at-rest data, not vault data.
- Do not call Google APIs directly from the browser for synced data.
- Avoid quota-expensive endpoints such as `search.list`.
- Do not expose Google client secrets, cron secrets, or tokens in frontend code.

## Change Workflow

1. Identify whether the change is frontend page behavior, backend integration behavior, or both.
2. Preserve the frontend callback flow and exact redirect URI expectations for Google OAuth.
3. Keep token encryption and decryption on the backend only.
4. If endpoint shapes or DTOs change, regenerate contract outputs:
   - `yarn openapi:sync`
   - `yarn api:generate`
   - `yarn openapi:check`
5. Update feature docs if OAuth setup, environment variables, or sync behavior changed.

## Checkpoints

- If frontend code handles Google client secrets or decrypted tokens, stop and redesign.
- If the dashboard starts calling Google directly for synced data, stop and redesign.
- If backend endpoint changes were made without regenerating the client, the work is incomplete.

## Validation

- `yarn nx test backend`
- `yarn nx test web-pages-youtube`
- `yarn nx lint backend`
- `yarn nx lint web-pages-youtube`

## Repo References

- `libs/web/pages/youtube/AGENTS.md`
- `docs/features/youtube-integration.md`
- `docs/features/google-youtube-oauth-setup.md`
- `apps/backend/AGENTS.md`
- `libs/app-api-client/AGENTS.md`
