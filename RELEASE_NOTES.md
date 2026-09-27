# Release v1.1.0

Date: 2026-09-27

Compare: https://github.com/mnaimfaizy/myorganizer/compare/v1.0.0...v1.1.0

## Added

- **Passphrase reset after recovery** — unlocking your vault with the Recovery Key now prompts you to
  set a new passphrase straight away. (#874)
- **Escape Copy reader** — every GitHub Release now includes a standalone, offline HTML page (with a
  SHA-256 checksum) that opens an Escape Copy backup with your passphrase or Recovery Key, no app
  required. (#864)

## Changed

- **YouTube channel sync and upload sync are now separate** — channel management moves to its own
  Channels page with a _Refresh channels_ button, and the main YouTube page keeps _Sync uploads_.
  Channel refresh has a 5-minute cooldown, upload sync keeps its 15-minute cooldown, and only one runs
  at a time. (#871)
- **Faster vault sync** — the web vault checks the server's blob inventory first and skips
  downloading data it already has. (#867)

## Fixed

- Deleting a task, address, mobile number, or subscription on the web now records the deletion, so
  syncing with another device no longer brings the item back. Web saves also no longer discard
  deletion history written by the mobile app. (#907)
- The YouTube page now refreshes as soon as a sync you started finishes, instead of sometimes
  missing it. (#902)
- Toast notifications shown in quick succession no longer drop one another. (#886)

## Mobile

Mobile changes reach users with the next mobile app build; the production deploy ships the backend
and the web app.

- **Edit tasks on your phone** — the Tasks screen can now add a task by title, mark a task done, and
  delete a task. Changes appear immediately; if saving fails, the change is undone and the app tells
  you why. (#903)
- **Vault Push** — edits made on mobile are written back to your encrypted vault on the server. If
  another device changed the same data first, the app merges both versions and retries, up to three
  times. (#903)
- **Offline adds are safe to retry** — if adding a task fails while offline, what you typed stays in
  the field, and it clears once a retry succeeds, so the task is not added twice. (#903)
- **Fixed:** the Tasks screen no longer shows an empty list after the web app has saved your tasks
  together with their deletion history. (#903)
- **Fixed:** the app now bundles the React version that React Native's renderer requires, avoiding a
  version-mismatch error at startup. (#869)

## Internal

- New CI gates: a fix must name the pull request that introduced its defect, an ADR cannot land as
  `proposed`, and the Prisma migration history is checked before merge.
- Code review pipeline and golden replay hardening.
- The build-time `image-size` audit exception now tracks the npm registry's re-keyed advisory IDs,
  restoring green CI on `main`. (#922)
- Web libraries moved under `libs/web/`, and vault records moved into `vault-core`. Native mobile
  code is now typechecked without DOM types.
