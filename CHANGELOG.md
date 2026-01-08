# Changelog

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
