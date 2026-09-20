# Release v1.0.0

Date: 2026-09-20

## Changes since v0.4.0

Compare: https://github.com/mnaimfaizy/myorganizer/compare/v0.4.0...v1.0.0

## Highlights

Vault data can now sync across devices: pull, converge, sync status, recovery-key
rotation, and owner-bound storage on shared devices. YouTube can be hidden by an
operator availability switch, and disconnect confirms while preserving Watched
marks by default. Add/edit flows for tasks, subscriptions, addresses, and mobile
numbers open in summoned dialogs.

## Breaking Changes

- **Unclaimed vault unlock.** Passphrase and recovery-key unlock no longer claim
  an unclaimed local vault. Claim it explicitly from the vault page
  (`claimUnclaimedLocalVaultLocked` or `claimUnclaimedLocalVaultByRecoveryKey`).
- **`todos` blob type removed.** Vault export/import no longer accepts `todos`.
  That data lives under `tasks`; re-export if you still have a `todos`-era backup.

## Added

### Vault / E2EE

- Cross-device vault sync: pull, blob convergence, sync status, and deletion logs.
- Recovery-key rotation from the vault page, with a server reachability check.
- Claim an unclaimed local vault via evidence instead of passphrase alone.
- Change the vault passphrase from an already-unlocked session.
- Per-user owner-bound vault handles so shared devices keep data isolated.
- Import preview (merge, replace, or skip) before committing.
- Explicit local vault removal, with confirmation naming unsent blob types.
- `GET /vault/blobs` inventory endpoint for cross-device blob discovery.

### YouTube

- Operator-controlled availability switch; nav, Shorts, and dashboard cards hide when off.
- Disconnect confirmation; Watched marks are preserved by default via a server ledger.
- Live sync-run progress during subscription refreshes.

### Elsewhere

- Privacy Policy and Terms of Service pages with operator contact details.
- Summoned add/edit dialogs for tasks, subscriptions, addresses, and mobile numbers.
- Single `/dashboard/vault` page for vault management.
- Shared email frame for verification and notification mail.
- Dynamic dashboard breadcrumbs.
- Reusable confirm-delete dialog with a customizable confirm label.

## Fixed

### Security

- **`adm-zip` denial of service** — bumped to 0.6.1, patching the high-severity
  memory-exhaustion advisory.
- Vault unlock no longer hands an unclaimed local vault to a second user on a
  shared device who happens to use the same passphrase.

### Vault / E2EE

- Never merge vault blobs when device identity differs.
- Restore the unlock card after a hard reload on the vault page.
- Disclose credential replacement when import replaces existing data.
- Clear sync bookmarks on restore so stale server data cannot overwrite a restore.

### Auth / Sessions

- Logout no longer 500s; all `/auth` routes are served from AuthController.
- Login validation errors return field-level Zod details.
- API requests replay with a refreshed token after 401.

### YouTube

- Disconnect is blocked while a sync run is still live.
- Sync progress no longer races the run-claim step.
- Dashboard nav and Shorts are gated strictly on availability status.

### UI

- Groceries page styling restored via semantic colour and spacing tokens.
- DatePicker opens on the selected date’s month instead of today.
- Sign-up password labels are associated with their inputs.

## Changed

- Vault management lives on one `/dashboard/vault` page instead of split routes.
- Unlock never claims as a side effect; claiming is a separate, evidence-checked path.

## Internal

Agent code-review pipeline (tier classifier, golden replay, obligation gates),
Nx inferred-target migration, staging host-apply preflight, assertion gates
(doc file-refs, Tailwind classes, mobile platform imports, checker contracts),
dependency security patches (Next.js 16.3.4, nodemailer 9.1.1, mysql2,
browserslist, fast-uri), and expanded vault / YouTube / auth test coverage.
None of this changes application behaviour on its own.
