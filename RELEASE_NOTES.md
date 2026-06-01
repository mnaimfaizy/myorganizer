# v0.2.0 — 2026-06-01

## Highlights

- ⚠️ Vault export/import UI + backend API and envelope support, enabling vault data portability (`cca5b18`, `7b24fa9`, `87784e4`)
- Todos converted to vault-backed storage; plaintext `/todo` API removed (`627ed74`)
- YouTube integration: OAuth linking, subscription sync, video browsing, and notifications (`6a1cb1c`)
- New branding and design tokens: MyOrganiser rebrand, OG image, and landing page (`78f55eb`, `a8db40e`)

## ⚠ Breaking Changes

- Todos API removed; todos are now stored in the encrypted vault — Migration: migrate clients to vault-backed todos and remove `/todo` calls (`627ed74`)
- OAuth callback method changed for YouTube; frontend now exchanges codes — Migration: update OAuth flow to use the frontend callback POST flow and set `GOOGLE_REDIRECT_URI` to frontend (`fd32acc`)
- OpenAPI/TSOA client regen renamed some generated schema names; regenerate API client and update callers — Migration: run `yarn openapi:sync` and regen the app client (`cdd43a2`, `71c7461`)

## New Features

- Add vault export/import UI and integrate with backend endpoints (`cca5b18`)
- Add backend vault export/import endpoints and update Prisma schemas (`7b24fa9`)
- Implement vault export/import envelope and import error types in `vault-core` (`87784e4`)
- Add Google Drive cloud backup for vault settings with connect/restore flows (`208b835`)
- Make todos vault-backed and remove plaintext todo REST endpoints (`627ed74`)
- YouTube integration: OAuth, subscription sync, video browsing, and notifications (`6a1cb1c`)
- Video browsing UX with channel detail and sync controls (`2d580ca`)
- Add structured address & mobile fields with country support and validation (`a6a7b48`)
- Subscriptions dashboard and account settings UI (`c7a5918`)
- Add subscriptions encrypted blob support to vault storage (`420b4a4`)
- Replace vault conflict confirm with reusable dialog UI (`2d2bdb6a`)
- Add repo release and AI tooling: preflight/version-bump agents and ai commit/PR scripts (`c8ea649`, `06f5432`)
- Add design tokens library and Secure Modernism landing page (`a8db40e`)

## Bug Fixes

- Restore auth redirects and fix YouTube refresh behavior (`b58fe95`)
- Fix OAuth redirect to use frontend POST exchange for authenticated code handling (`fd32acc`)
- Fix duplicate AppLogo rendering and OG image generation script (`ea438c6`)
- Await dashboard dynamic route params to prevent race conditions (`f1dbb6b`)
- Resolve various YouTube integration issues and add Authorization headers (`e545fdac`)
- Patch vulnerable transitive dependencies and remediate high audit findings (`37af9ab`, `73f03a0`, `61b9a41`)
- Restore Storybook preview CSS build for web UI (`57182ff`)
- Fix currency rendering and save navigation in subscriptions page (`4f945ff`)
- Hardening fixes for Prisma config and production builds (`be93950`, `0e1e094`)

## Improvements

- Add bento-grid dashboard with 7 interactive widgets and vault-aware widgets (`f246cd4`)
- Centralize `randomId()` helper in core and dedupe implementations (`6ca9077`)
- Harden FX rate fetching with timeouts, retries, and validation (`b2b6200`)
- Improve list card UI for addresses and mobile numbers (`5bbbaec`)
- CI and workflow hardening: corepack/yarn pinning, immutable installs, dependency policies (`b2415fe`)
- Add structured release workflow and agent definitions for repo automation (`c8ea649`, `3037d33`)

## Documentation / Chores

- Sync OpenSpec changes for cloud vault backup and archive completed changes (`e413f61`, `7fde881`)
- Sync OpenAPI specs and regenerate clients after API changes (`71c7461`)
- Update Prisma workflow docs and commit migration files for vault backup (`91bdd29`, `a101be6`)
- Add agent guides, repo-local workflow skills, and agent definition files (`7badd58`, `3037d33`)
- Various CI dependency bumps and action upgrades (dependabot and manual fixes) (`96416b`, `6e4f12d`, `2fd759b`)

## Contributors

- @mnaimfaizy
- @dependabot[bot]
- @copilot-swe-agent[bot]
