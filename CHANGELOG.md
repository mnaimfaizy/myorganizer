# Changelog

## v0.2.0 - 2026-06-01

Date: 2026-06-01

## Changes since v0.1.0

Compare: https://github.com/mnaimfaizy/myorganizer/compare/v0.1.0...v0.2.0

### Features

- **release**: add preflight & version-bump agents; rewrite release workflow (c8ea649)
- add dark-theme logo and fix README picture element paths (5ff51ec)
- **workflow**: add shared AI commit and PR tooling (06f5432)
- **branding**: add OG image and generator script (fbbcaca)
- **branding**: add logo assets, AppLogo, SEO; rebrand to MyOrganiser (78f55eb)
- **design-tokens**: add Secure Modernism landing page and design tokens lib (a8db40e)
- **web-vault-ui**: replace vault conflict confirm with dialog (2d2bdb6)
- **web-pages-addresses**: improve address management UX (1d48241)
- **deployment**: update backend bundle to include prisma.config.cjs and adjust migration commands (7feff26)
- **web-pages-vault-settings**: add Google Drive cloud backup (208b835)
- **openspec**: add cloud vault backup Google Drive openspec (e413f61)
- **web-vault**: add export/import UI, API client integration, and e2e tests (cca5b18)
- **backend**: add vault export/import endpoints and update schemas (7b24fa9)
- **vault-core**: implement export/import envelope and import error types (87784e4)
- add agent guides for various components in the MyOrganizer application (7badd58)
- replace static user data with authenticated user info in sidebar (8030bdc)
- add bento-grid dashboard with 7 widgets (f246cd4)
- add video browsing UX with channel detail and video sync (2d580ca)
- add YouTube integration feature (6a1cb1c)
- **vault**: make todos vault-backed (remove /todo API) (627ed74)
- **web**: add subscriptions dashboard and account settings (c7a5918)
- **vault**: add subscriptions encrypted blob support (420b4a4)
- add structured address and mobile number fields with country support (a6a7b48)
- enhance list cards with interactive design (5bbbaec)
- add data table and edit mode for mobile-numbers usage locations (bcfd095)
- add edit mode support for addresses usage locations (2b71487)
- add data table with edit/delete for addresses usage locations (08d70d0)
- add Table and Badge UI components (30b3117)
- enhance addresses and mobile-numbers UI with separate add location pages (#59) (43425bb)
- dashboard vault session + usage locations UI (#58) (dac4dc7)
- changelog notes and automated release PR (4843675)
- generate release notes in release script (733d798)
- release checklist and version bump automation (7e07efb)

### Fixes

- **ai-create-pr**: validate reviewer handles in PR workflow (ed55f25)
- **create-pr**: push ahead branches and preserve PR titles (5df2311)
- **ai**: rebuild reused PR title and body from commit details (1814408)
- **branding**: fix duplicate logo in sidebar; update og-image script (ea438c6)
- patch vulnerable transitive dependencies (37af9ab)
- restore auth redirects and youtube refresh (b58fe95)
- **ci**: limit PR audit trigger to root manifests (2410732)
- **web-ui**: restore Storybook preview CSS build (57182ff)
- **myorganizer**: await dashboard dynamic route params (f1dbb6b)
- **ci**: fetch full history for PR dependency diff check (282f7c6)
- **ci**: detect deleted manifests in PR audit gate (06f28a5)
- **ci**: include deleted manifests in audit change detection (1ad5059)
- **ci**: skip npm audit for PRs without dependency manifest changes (b6cd1b6)
- **deps**: bump next for security advisories (4c88810)
- **deps**: resolve high audit advisories (73f03a0)
- **backend**: generate cpanel npm lockfile (271bb18)
- bump reviewed Vercel CLI pin to 50.1.1 (e43601f)
- upgrade Vercel CLI to 47.2.2 and enable Corepack in husky pre-commit hook (ad1a13a)
- bump basic-ftp 5.2.2 → 5.3.0 (GHSA-rp42-5vxx-qpwr) (a0f71b0)
- sync Vercel project settings before staging deploy (3ae7601)
- align Vercel staging deploy heredoc (cc54e5c)
- pin follow-redirects to patched release (72bad7b)
- keep vercel cli out of lockfile graph (db082b0)
- upgrade nodemailer to patched release (583d193)
- correct CI affected projects command (9678913)
- remediate dependency audit findings (61b9a41)
- update YouTube auth headers to use undefined instead of empty object (f5c8641)
- apply PR review feedback — type safety, N+1, schema output, hex validation, swagger POST, server component (6c76e82)
- redirect OAuth callback to frontend for authenticated code exchange (fd32acc)
- resolve YouTube integration issues (e545fda)
- make prisma config compile in backend build (be93950)
- guard prisma config in production (9f9efea)
- allow tests in app tsconfig spec (90f0184)
- align sidebar inset spacing (0006bad)
- **web-pages/subscriptions**: tidy currency + save navigation (4f945ff)
- **core**: harden FX rate fetching (b2b6200)
- **auth**: correct reset-password request body schema (cdd43a2)
- **auth**: align reset/verify requests with regenerated client (9e4fc5d)
- resolve TypeScript type errors for production build (0e1e094)
- allow PAT for release PR automation (c522c4c)
- release PR summary ref (00c2495)
- correct changelog range and release PR trigger (590ae03)
- commit release notes file (d24779e)
- allow tagging when release branch ahead of origin (dbbdf4b)

### Documentation

- add design token guidance to agents guide (d8443e3)
- **openspec**: sync cloud-vault-backup specs and archive change (1f0595d)
- align todos docs with vault-backed storage (5ff61ea)
- document subscriptions and account settings (cbbaa6a)
- update release notes guidance (4b75ed0)

### Refactors

- **core**: centralize randomId helper (6ca9077)

### Tests

- **web-vault**: add normalizeSubscriptions coverage (f56e595)

### CI

- make lockfile diff check ignore line-ending-only noise (f1d2c43)
- bump actions/dependency-review-action from 4.9.0 to 5.0.0 (96416b2)
- bump samkirkland/ftp-deploy-action from 4.3.6 to 4.4.0 (0b6bb15)
- bump actions/setup-node from 6.3.0 to 6.4.0 (a346238)
- bump actions/setup-node from 4.4.0 to 6.3.0 (2a69f93)
- bump actions/github-script from 7.0.1 to 9.0.0 (2fd759b)
- bump actions/cache from 4.2.4 to 5.0.5 (5cf3b7c)
- bump actions/checkout from 4.2.2 to 6.0.2 (6e4f12d)
- share dependency cache across workflow jobs (fa82738)
- set DATABASE_URL for prisma generate (49d4397)

### Chores

- **release**: v0.2.0 (68f536a)
- **release**: update RELEASE_NOTES.md for v0.2.0 (ce478a8)
- **openspec**: archive enhance-vault-export-import change (7fde881)
- update Prisma workflow instructions in documentation (91bdd29)
- commit add_vault_backup_record prisma migration (a101be6)
- add nx-monorepo-workflow skill with CLI runbook (34febe3)
- **openspec**: adopt OpenSpec for spec-driven changes (bfa9dad)
- **agents**: add .github/agents subagent definition files (3037d33)
- add repo-local workflow skills (7b65c8c)
- harden yarn-first dependency supply chain (b2415fe)
- **myorganizer**: sync next-env.d.ts with Next (1b376e7)
- **backend**: dedupe dotenv initialization (b865223)
- upgrade dependencies and tooling (7070a0c)
- **openapi**: sync specs and regenerate clients (71c7461)
- add @tanstack/react-table dependency (3f0f198)
- remove outdated release notes for v0.1.1 and v0.1.2 (ee56b6d)
- **release**: v0.1.3 (#57) (dcf8f1f)
- **release**: v0.1.2 (#56) (2b9c097)

### Other changes

- Initial plan (ac02411)
- Release/v0.1.1 (#55) (12eb72e)

## Changes since v0.1.0

Compare: https://github.com/mnaimfaizy/myorganizer/compare/v0.1.0...v0.2.0

### Features

- **release**: add preflight & version-bump agents; rewrite release workflow (c8ea649)
- add dark-theme logo and fix README picture element paths (5ff51ec)
- **workflow**: add shared AI commit and PR tooling (06f5432)
- **branding**: add OG image and generator script (fbbcaca)
- **branding**: add logo assets, AppLogo, SEO; rebrand to MyOrganiser (78f55eb)
- **design-tokens**: add Secure Modernism landing page and design tokens lib (a8db40e)
- **web-vault-ui**: replace vault conflict confirm with dialog (2d2bdb6)
- **web-pages-addresses**: improve address management UX (1d48241)
- **deployment**: update backend bundle to include prisma.config.cjs and adjust migration commands (7feff26)
- **web-pages-vault-settings**: add Google Drive cloud backup (208b835)
- **openspec**: add cloud vault backup Google Drive openspec (e413f61)
- **web-vault**: add export/import UI, API client integration, and e2e tests (cca5b18)
- **backend**: add vault export/import endpoints and update schemas (7b24fa9)
- **vault-core**: implement export/import envelope and import error types (87784e4)
- add agent guides for various components in the MyOrganizer application (7badd58)
- replace static user data with authenticated user info in sidebar (8030bdc)
- add bento-grid dashboard with 7 widgets (f246cd4)
- add video browsing UX with channel detail and video sync (2d580ca)
- add YouTube integration feature (6a1cb1c)
- **vault**: make todos vault-backed (remove /todo API) (627ed74)
- **web**: add subscriptions dashboard and account settings (c7a5918)
- **vault**: add subscriptions encrypted blob support (420b4a4)
- add structured address and mobile number fields with country support (a6a7b48)
- enhance list cards with interactive design (5bbbaec)
- add data table and edit mode for mobile-numbers usage locations (bcfd095)
- add edit mode support for addresses usage locations (2b71487)
- add data table with edit/delete for addresses usage locations (08d70d0)
- add Table and Badge UI components (30b3117)
- enhance addresses and mobile-numbers UI with separate add location pages (#59) (43425bb)
- dashboard vault session + usage locations UI (#58) (dac4dc7)
- changelog notes and automated release PR (4843675)
- generate release notes in release script (733d798)
- release checklist and version bump automation (7e07efb)

### Fixes

- **ai-create-pr**: validate reviewer handles in PR workflow (ed55f25)
- **create-pr**: push ahead branches and preserve PR titles (5df2311)
- **ai**: rebuild reused PR title and body from commit details (1814408)
- **branding**: fix duplicate logo in sidebar; update og-image script (ea438c6)
- patch vulnerable transitive dependencies (37af9ab)
- restore auth redirects and youtube refresh (b58fe95)
- **ci**: limit PR audit trigger to root manifests (2410732)
- **web-ui**: restore Storybook preview CSS build (57182ff)
- **myorganizer**: await dashboard dynamic route params (f1dbb6b)
- **ci**: fetch full history for PR dependency diff check (282f7c6)
- **ci**: detect deleted manifests in PR audit gate (06f28a5)
- **ci**: include deleted manifests in audit change detection (1ad5059)
- **ci**: skip npm audit for PRs without dependency manifest changes (b6cd1b6)
- **deps**: bump next for security advisories (4c88810)
- **deps**: resolve high audit advisories (73f03a0)
- **backend**: generate cpanel npm lockfile (271bb18)
- bump reviewed Vercel CLI pin to 50.1.1 (e43601f)
- upgrade Vercel CLI to 47.2.2 and enable Corepack in husky pre-commit hook (ad1a13a)
- bump basic-ftp 5.2.2 → 5.3.0 (GHSA-rp42-5vxx-qpwr) (a0f71b0)
- sync Vercel project settings before staging deploy (3ae7601)
- align Vercel staging deploy heredoc (cc54e5c)
- pin follow-redirects to patched release (72bad7b)
- keep vercel cli out of lockfile graph (db082b0)
- upgrade nodemailer to patched release (583d193)
- correct CI affected projects command (9678913)
- remediate dependency audit findings (61b9a41)
- update YouTube auth headers to use undefined instead of empty object (f5c8641)
- apply PR review feedback — type safety, N+1, schema output, hex validation, swagger POST, server component (6c76e82)
- redirect OAuth callback to frontend for authenticated code exchange (fd32acc)
- resolve YouTube integration issues (e545fda)
- make prisma config compile in backend build (be93950)
- guard prisma config in production (9f9efea)
- allow tests in app tsconfig spec (90f0184)
- align sidebar inset spacing (0006bad)
- **web-pages/subscriptions**: tidy currency + save navigation (4f945ff)
- **core**: harden FX rate fetching (b2b6200)
- **auth**: correct reset-password request body schema (cdd43a2)
- **auth**: align reset/verify requests with regenerated client (9e4fc5d)
- resolve TypeScript type errors for production build (0e1e094)
- allow PAT for release PR automation (c522c4c)
- release PR summary ref (00c2495)
- correct changelog range and release PR trigger (590ae03)
- commit release notes file (d24779e)
- allow tagging when release branch ahead of origin (dbbdf4b)

### Documentation

- add design token guidance to agents guide (d8443e3)
- **openspec**: sync cloud-vault-backup specs and archive change (1f0595d)
- align todos docs with vault-backed storage (5ff61ea)
- document subscriptions and account settings (cbbaa6a)
- update release notes guidance (4b75ed0)

### Refactors

- **core**: centralize randomId helper (6ca9077)

### Tests

- **web-vault**: add normalizeSubscriptions coverage (f56e595)

### CI

- make lockfile diff check ignore line-ending-only noise (f1d2c43)
- bump actions/dependency-review-action from 4.9.0 to 5.0.0 (96416b2)
- bump samkirkland/ftp-deploy-action from 4.3.6 to 4.4.0 (0b6bb15)
- bump actions/setup-node from 6.3.0 to 6.4.0 (a346238)
- bump actions/setup-node from 4.4.0 to 6.3.0 (2a69f93)
- bump actions/github-script from 7.0.1 to 9.0.0 (2fd759b)
- bump actions/cache from 4.2.4 to 5.0.5 (5cf3b7c)
- bump actions/checkout from 4.2.2 to 6.0.2 (6e4f12d)
- share dependency cache across workflow jobs (fa82738)
- set DATABASE_URL for prisma generate (49d4397)

### Chores

- **release**: update RELEASE_NOTES.md for v0.2.0 (ce478a8)
- **openspec**: archive enhance-vault-export-import change (7fde881)
- update Prisma workflow instructions in documentation (91bdd29)
- commit add_vault_backup_record prisma migration (a101be6)
- add nx-monorepo-workflow skill with CLI runbook (34febe3)
- **openspec**: adopt OpenSpec for spec-driven changes (bfa9dad)
- **agents**: add .github/agents subagent definition files (3037d33)
- add repo-local workflow skills (7b65c8c)
- harden yarn-first dependency supply chain (b2415fe)
- **myorganizer**: sync next-env.d.ts with Next (1b376e7)
- **backend**: dedupe dotenv initialization (b865223)
- upgrade dependencies and tooling (7070a0c)
- **openapi**: sync specs and regenerate clients (71c7461)
- add @tanstack/react-table dependency (3f0f198)
- remove outdated release notes for v0.1.1 and v0.1.2 (ee56b6d)
- **release**: v0.1.3 (#57) (dcf8f1f)
- **release**: v0.1.2 (#56) (2b9c097)

### Other changes

- Initial plan (ac02411)
- Release/v0.1.1 (#55) (12eb72e)

## v0.1.3 - 2026-01-08

Date: 2026-01-08

## Changes since v0.1.0

Compare: https://github.com/mnaimfaizy/myorganizer/compare/v0.1.0...v0.1.3

### Features

- changelog notes and automated release PR (4843675)
- generate release notes in release script (733d798)
- release checklist and version bump automation (7e07efb)

### Fixes

- release PR summary ref (00c2495)
- correct changelog range and release PR trigger (590ae03)
- commit release notes file (d24779e)
- allow tagging when release branch ahead of origin (dbbdf4b)

### Chores

- **release**: v0.1.2 (#56) (2b9c097)

### Other changes

- Release/v0.1.1 (#55) (12eb72e)

## v0.1.2 - 2026-01-08

Date: 2026-01-08

## Initial release

### Features

- changelog notes and automated release PR (4843675)
- generate release notes in release script (733d798)
- release checklist and version bump automation (7e07efb)
- auto-dispatch prod deploy on release branch create (46a791e)
- CI/CD workflows + release process (#53) (ef3207e)
- **myorganizer**: add ETag-aware vault sync wrapper (#37) (81ed82a)
- **backend**: harden vault endpoints (#24) (#35) (f0959d1)
- **backend**: add vault controller endpoints (#33) (dccd264)
- **backend**: add encrypted vault prisma models (#32) (feff9c5)
- **vault**: add encrypted addresses & mobile numbers (e5db2ce)
- create nx generator for open-api-contract for frontend applicat… (#18) (f0cab0b)

### Fixes

- commit release notes file (d24779e)
- allow tagging when release branch ahead of origin (dbbdf4b)
- valid job if expression for create trigger (5156772)
- production deploy frontend needs validate (8d7074c)
- production latest dispatcher finds release branches (485b433)
- add latest-release dispatcher for production deploy (ff75d0c)
- repair latest release branch selection (743465e)
- improve production deploy branch selection (3e44d71)
- align vercel deploy with nx guide (7e896ad)
- include hoisted deps in vercel prebuilt (47cca1b)
- disable next standalone on vercel (5914cbc)
- improve postinstall script resolution for cPanel compatibility (f3ca189)
- stabilize vercel output for prebuilt deploy (694c154)
- vercel build outputs .next in app root (acfc7f0)
- make Vercel builds run from repo root (92cce78)
- serialize deploy jobs and parameterize staging dir (#54) (7d3a209)
- wrong build command for backend api in deploy file (185feb3)
- deploy.yml with home-dir problem (fef8eda)
- deploy.yml (92910df)
- server-dir in deploy file for FTP (26c2ed3)
- home directory for server-dir in deploy file (ebf6fd0)
- folder structures the local and server (713925c)
- the deploy where the server-dir is not working (4f9f517)
- the deploy where the folder-dir is not working (55de59c)
- deploy job for FTP (620a275)

### Documentation

- add comprehensive monorepo development guide (#49) (2ae9899)

### Tests

- stabilize vault integration test (#47) (cd41fd1)
- **e2e**: migrate myorganizer from Cypress to Playwright (#45) (9a3ff35)

### Chores

- format deploy production workflow (2cd106b)
- **nx**: remove unused backend-e2e project (a59e7a9)
- **prisma**: ignore generated client + engines (f61c9e0)
- properlty connect to Nx Cloud (#8) (a5a847d)
- generate migrations for User and Todo models chore: install open-api and swaggerUI for implementing the API docs chore: add api docs generation commands to package.json to use tsoa CLI (e237eff)
- create prisma library for ORM and migration of database create routes for TODO create controller for TODO implement swagger for documentation of the API (9e42ef3)
- include docker-compose file which includes postgresql and pgAdmin (0fd8032)
- include cors option for backend API (d3db383)
- apply the build functionality for Express API and also fixing the directory problem in deploy-ftp (b792aa6)
- implement the automatic deploy using FTP for backend API (2cbecfc)
- create backend express application (#1) (390d74d)
- implement the functionalty and design of Todo page/form (5667168)
- create the sidebar for dashboard and the include the required UI components (4332029)
- install shadcn-ui and it's dependencies (28c947a)

### Other changes

- Release/v0.1.1 (#55) (12eb72e)
- Add GitHub Copilot instructions for repository conventions (#52) (fe1ae78)
- Issue #16: Production hardening + optional global API rate limiting (#50) (3624c61)
- cPanel Node deployments: runtime API base URL, backend routing + packaging (#48) (d91ad6a)
- Vault sync coverage + docs (Fixes #29 #30 #31) (#46) (c2d732e)
- Install and configure Storybook with Chromatic for web-ui library (#44) (67a7971)
- Frontend auth (access token + refresh cookie) + signup profile fields (#43) (84b3432)
- Add sign-up page with SSO integration (#42) (06bca75)
- Add login page with SSO support (#41) (29c6494)
- Vault export/import UI (issue #28) (#40) (b030fd1)
- Document vault blob deletion limitation in migration logic (#39) (66a59ca)
- Issue #27: Vault migration (Phase 1 → Phase 2) (#38) (a8d6fd2)
- Align OpenAPI generation via Nx (issue #25) (#36) (86ecb46)
- stabilize tsoa JWT auth context (#23) (#34) (9de0840)
- Add comprehensive backend REST API documentation (#19) (f41ec2a)
- Implement the user authentication api endpoints (#11) (1663e1a)
- 6 setup testing for every app and library (#7) (577a475)
- 2 install and implement husky (#3) (c65b24f)
- Update deploy-ftp.yml (f991fa3)
- Initial commit (e9e9145)

## v0.1.1 - 2026-01-08

Date: 2026-01-08

## Initial release

### Features

- changelog notes and automated release PR (4843675)
- generate release notes in release script (733d798)
- release checklist and version bump automation (7e07efb)
- auto-dispatch prod deploy on release branch create (46a791e)
- CI/CD workflows + release process (#53) (ef3207e)
- **myorganizer**: add ETag-aware vault sync wrapper (#37) (81ed82a)
- **backend**: harden vault endpoints (#24) (#35) (f0959d1)
- **backend**: add vault controller endpoints (#33) (dccd264)
- **backend**: add encrypted vault prisma models (#32) (feff9c5)
- **vault**: add encrypted addresses & mobile numbers (e5db2ce)
- create nx generator for open-api-contract for frontend applicat… (#18) (f0cab0b)

### Fixes

- allow tagging when release branch ahead of origin (dbbdf4b)
- valid job if expression for create trigger (5156772)
- production deploy frontend needs validate (8d7074c)
- production latest dispatcher finds release branches (485b433)
- add latest-release dispatcher for production deploy (ff75d0c)
- repair latest release branch selection (743465e)
- improve production deploy branch selection (3e44d71)
- align vercel deploy with nx guide (7e896ad)
- include hoisted deps in vercel prebuilt (47cca1b)
- disable next standalone on vercel (5914cbc)
- improve postinstall script resolution for cPanel compatibility (f3ca189)
- stabilize vercel output for prebuilt deploy (694c154)
- vercel build outputs .next in app root (acfc7f0)
- make Vercel builds run from repo root (92cce78)
- serialize deploy jobs and parameterize staging dir (#54) (7d3a209)
- wrong build command for backend api in deploy file (185feb3)
- deploy.yml with home-dir problem (fef8eda)
- deploy.yml (92910df)
- server-dir in deploy file for FTP (26c2ed3)
- home directory for server-dir in deploy file (ebf6fd0)
- folder structures the local and server (713925c)
- the deploy where the server-dir is not working (4f9f517)
- the deploy where the folder-dir is not working (55de59c)
- deploy job for FTP (620a275)

### Documentation

- add comprehensive monorepo development guide (#49) (2ae9899)

### Tests

- stabilize vault integration test (#47) (cd41fd1)
- **e2e**: migrate myorganizer from Cypress to Playwright (#45) (9a3ff35)

### Chores

- **release**: v0.1.1 (558398f)
- format deploy production workflow (2cd106b)
- **nx**: remove unused backend-e2e project (a59e7a9)
- **prisma**: ignore generated client + engines (f61c9e0)
- properlty connect to Nx Cloud (#8) (a5a847d)
- generate migrations for User and Todo models chore: install open-api and swaggerUI for implementing the API docs chore: add api docs generation commands to package.json to use tsoa CLI (e237eff)
- create prisma library for ORM and migration of database create routes for TODO create controller for TODO implement swagger for documentation of the API (9e42ef3)
- include docker-compose file which includes postgresql and pgAdmin (0fd8032)
- include cors option for backend API (d3db383)
- apply the build functionality for Express API and also fixing the directory problem in deploy-ftp (b792aa6)
- implement the automatic deploy using FTP for backend API (2cbecfc)
- create backend express application (#1) (390d74d)
- implement the functionalty and design of Todo page/form (5667168)
- create the sidebar for dashboard and the include the required UI components (4332029)
- install shadcn-ui and it's dependencies (28c947a)

### Other changes

- Add GitHub Copilot instructions for repository conventions (#52) (fe1ae78)
- Issue #16: Production hardening + optional global API rate limiting (#50) (3624c61)
- cPanel Node deployments: runtime API base URL, backend routing + packaging (#48) (d91ad6a)
- Vault sync coverage + docs (Fixes #29 #30 #31) (#46) (c2d732e)
- Install and configure Storybook with Chromatic for web-ui library (#44) (67a7971)
- Frontend auth (access token + refresh cookie) + signup profile fields (#43) (84b3432)
- Add sign-up page with SSO integration (#42) (06bca75)
- Add login page with SSO support (#41) (29c6494)
- Vault export/import UI (issue #28) (#40) (b030fd1)
- Document vault blob deletion limitation in migration logic (#39) (66a59ca)
- Issue #27: Vault migration (Phase 1 → Phase 2) (#38) (a8d6fd2)
- Align OpenAPI generation via Nx (issue #25) (#36) (86ecb46)
- stabilize tsoa JWT auth context (#23) (#34) (9de0840)
- Add comprehensive backend REST API documentation (#19) (f41ec2a)
- Implement the user authentication api endpoints (#11) (1663e1a)
- 6 setup testing for every app and library (#7) (577a475)
- 2 install and implement husky (#3) (c65b24f)
- Update deploy-ftp.yml (f991fa3)
- Initial commit (e9e9145)
