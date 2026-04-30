## 1. Backend audit contract updates

- [ ] 1.1 Extend `apps/backend` backup constants, controller queries, and service validation to allow `source='google-drive'` and optional `source` filtering on latest/history backup queries
- [ ] 1.2 Add or update backend unit tests covering Google Drive backup records, latest-by-source queries, history filtering, and rejected invalid source values
- [ ] 1.3 Regenerate the contract outputs with `yarn openapi:sync` and `yarn api:generate`, then review the generated `libs/api-specs` and `libs/app-api-client` changes

## 2. Cloud backup core in `libs/web-vault`

- [ ] 2.1 Add the `CloudBackupProvider` abstraction, cloud-backup coordinator, and browser-local preference storage for provider state plus auto-backup interval
- [ ] 2.2 Implement `GoogleDriveCloudBackupProvider` with GIS token acquisition, `drive.appdata`-scoped REST helpers, connect/disconnect handling, and in-memory token lifecycle management
- [ ] 2.3 Implement upload finalization, retention pruning, stale pending cleanup, and latest-backup download logic for Google Drive backups
- [ ] 2.4 Extend the existing export/import integration points to use `source='google-drive'` for cloud backup and restore while reusing the current hardened envelope flow
- [ ] 2.5 Implement interval math and a client-side scheduler that checks the latest successful Google Drive audit record to determine when daily, weekly, or monthly backup is due
- [ ] 2.6 Add unit tests for provider connection flow, token renewal/error handling, interval math, scheduler triggering, and partial-upload recovery

## 3. Vault settings UI integration

- [ ] 3.1 Add `libs/web-vault` hooks or actions for connection state, latest Google Drive backup lookup, manual backup, restore, disconnect, and auto-backup settings updates
- [ ] 3.2 Build the cloud backup UI in `libs/web-vault-ui` with connect/disconnect controls, interval selection (`off | daily | weekly | monthly`), Back up now, Restore from cloud, and last cloud backup state
- [ ] 3.3 Integrate the new cloud backup UI into `libs/web/pages/vault-settings` while keeping `apps/myorganizer/src/app/dashboard/account/vault/page.tsx` as a thin wrapper
- [ ] 3.4 Add unit tests for vault settings cloud-backup states, reconnect messaging, action-button enablement, and latest-backup rendering via `source='google-drive'`

## 4. End-to-end coverage

- [ ] 4.1 Add deterministic Playwright mocks for Google Identity Services and Google Drive `appDataFolder` operations so no live Google dependency is required
- [ ] 4.2 Add a Playwright flow for connect Google Drive, run a manual backup, and verify the vault settings page shows the updated last cloud backup timestamp via Google Drive
- [ ] 4.3 Add a Playwright flow for automatic backup triggering when the configured interval is due, including the non-interactive reauthorization fallback path
- [ ] 4.4 Add a Playwright flow for restore from cloud on a fresh local state and for disconnecting Google Drive afterward

## 5. Verification and polish

- [ ] 5.1 Run targeted Jest suites for the affected backend, `web-vault`, `web-vault-ui`, and vault settings page-library projects and fix any regressions
- [ ] 5.2 Run lint for the affected projects and apply repository formatting to the changed files
- [ ] 5.3 Run `yarn openapi:check` to confirm the backend contract and generated client stay in sync
- [ ] 5.4 Run the relevant Playwright e2e suite and confirm the full cloud backup acceptance flow passes
- [ ] 5.5 Run final affected builds or type-aware project validation for backend and frontend surfaces before merge
