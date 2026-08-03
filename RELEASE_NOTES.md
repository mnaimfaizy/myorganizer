# Release v0.3.0

Date: 2026-08-03

## Changes since v0.2.0

Compare: https://github.com/mnaimfaizy/myorganizer/compare/v0.2.0...v0.3.0

### Breaking changes

- **vault**: separate catalog items from list lines in groceries payload (7f57787)
- **skills**: add domain-modeling; remove openspec (#172) (1ed6728)

### Features

- **groceries**: add TripBoardIndex for grocery trip browsing (05913cb)
- **groceries**: separate Catalog Item and List Line edit flows (8bb01da)
- **groceries**: add catalog suggestions and item validation (0a2d820)
- **web-groceries**: add catalog membership + trip lifecycle actions (4269ddc)
- **web-groceries**: implement Trip Board detail screen (#231) (ef57c59)
- implement ensureSandboxImage function to verify and build Docker image (c253ac5)
- add providerEnvironment function to manage environment variables for API keys (750a4fe)
- **sandcastle**: add 1Password dispatch and slice issue filtering (#235) (de4312b)
- **auth**: unify auth pages on split-screen Option A design (#215) (8fb1087)
- **admin**: add user lifecycle actions and audit log UI (#202) (#211) (d586d5a)
- **admin**: add platform admin console shell and user directory (#200) (#209) (b9d09ce)
- **backend**: implement platform admin user lifecycle APIs and audit logging (#208) (85f0779)
- **backend**: implement platform admin foundation (#206) (ebc7f49)
- **admin-console**: add Platform Admin console documentation and decision rationale (9967e82)
- **triage**: add AI triage skill, agent briefs, and routing wrappers (#194) (056d430)
- **sandcastle**: add multi-provider agent support with runtime selection (#179) (34c7ce2)
- **skills**: add prototype, handoff, and ask-matt workflows (#173) (c431fd1)
- **design-tokens**: add native preset for NativeWind with resolved token values (#151) (#159) (f960e96)
- **groceries**: refactor library structure into groceries-page/ and groceries-list-detail/ domains (#139) (f23dd39)
- **agents**: add 3-stage test pipeline with TestReviewer and TestRunner (d22263d)
- **tasks**: add archive/restore toggle to TaskItem (6359dc7)
- **tasks**: retire Todo feature and add Playwright E2E coverage (b350241)
- **tasks**: add edit, delete, archive, and context filter to Tasks page (7d346a9)
- **tasks**: register tasks vault blob type and vault sync integration (cff507e)
- **tasks**: add TasksSummaryCard and register tasks vault blob type (e43c6eb)
- **tasks**: scaffold Tasks page with create, list, sort, and auto-migration (46ec537)
- **planning**: add to-prd/to-issues skills and sandcastle orchestration (a13e4c2)
- **vault-import**: add 'groceries' to blobTypes in importVault function (74487cf)
- **vault-export**: include groceries blob in vault export/import (25f4bc9)
- **agents**: introduce ComponentBuilder, ComponentReviewer, DepSync agents and UI guidelines (5d56e05)
- **agents**: introduce CodeExplorer cross-IDE sub-agent (3449b83)
- integrate grill-with-docs skill across all AI IDEs (8ba0bfb)
- **groceries**: add Add Item dialog and redesign item CRUD UI (54007d9)
- **groceries**: polish and optimize components for Phase 4 release (a0731b1)
- **grocery-items**: implement CRUD, validation, and tests (d59e0ff)
- **groceries**: add grocery CRUD with categories and extended fields (26c7fff)
- **groceries**: update GroceryListSelector to support multi-select functionality (c0f1a10)
- **groceries**: phase 5 refinement and polish – accessibility, performance, testing, and documentation (8af81a1)
- **test-web-pages-groceries**: add Jest config, targets, and unit tests for useGroceriesVault (b0aaf6b)
- **groceries**: add vault persistence and state management with error handling (694be2d)
- **storybook**: add StorybookCurator sub-agent and delegation workflows (962e4df)
- **web-pages-groceries**: add groceries UI with CRUD + vault (9382c16)
- **agents**: add TestScaffold unit-test delegation for IDEs (85cf901)
- **testing**: add TestScaffold unit-test delegation workflow and docs (dc08545)
- **web-pages-groceries**: add groceries page library with VaultGate auth (bbb4630)
- **groceries**: add data model, Zod schemas, and normalization (52b7417)
- **api-specs**: sync OpenAPI and regenerate API client for groceries vault blob type (b917685)
- **backend**: add groceries vault blob type and tests (8af34b3)
- add issue-creation-workflow skill and IssueCreator sub-agent (18aebff)

### Fixes

- **groceries**: provide form context in edit item dialog (#238) (10a72a0)
- upgrade style-dictionary to ^5.4.4 to resolve GHSA-vj5c-m527-mpff (#233) (d0c3d4d)
- update model version for commit, component reviewer, and dependency audit agents (72249a8)
- **deps**: resolve 7 high-severity CVEs blocking Secure Install Review CI (#174) (c6c90b3)
- **sandcastle**: host-side push, no-install gate, idle headroom (#153) (460982b)
- **dependencies**: update shell-quote to version 1.8.4 to address security vulnerability (eb3524b)
- **sandcastle**: auto-merge slice PRs into feature branch and delete slice branch (b5e8f92)
- **sandcastle**: instruct agents to push branch after committing (e84bbd2)
- **sandcastle**: use absolute paths for Docker node_modules cache mount (f2248d6)
- **sandcastle**: prevent Nx WASM hang by seeding Linux node_modules (486fd39)
- **web-vault**: add 'tasks' to reportFailure blobTypes union type (c58c19a)
- **vault,tasks,dashboard**: correct normalizeTasks semantics and fix failing test setup (5ef5f2e)
- **tasks**: remove redundant normalizeTodos call and fix Radix Select empty value (74d801e)
- **settings**: restructure PostToolUse hook to include matcher and hooks (bcfb6ac)
- **hooks**: add missing "type" field to command hooks in JSON configuration (2bdedc4)
- **web-pages-groceries**: use sync zod validation; stabilize tests & CI (29adf0b)
- **backend**: resolve CI test failures in VaultController integration tests (ff796d4)
- **copilot-hooks**: use bash/powershell keys; allow .env.example edits (fce75a9)

### Documentation

- **sandcastle**: update 1Password Environment setup instructions for beta CLI (dd9af23)
- **context**: add Groceries domain glossary terms (#223) (da871a5)
- **skills**: add implement and code-review skills from mattpocock (7759e38)
- **mobile**: record phase-1 RN decisions and domain glossary (#150) (33fe99b)
- **developer-workflow**: add delegation guardrails and checklist (caa7831)
- **features**: add Groceries guide and vault blob reference (b0efc81)
- **e2e**: add form-state E2E guidance and agent/test-scaffold updates (e0741be)
- **web-pages-groceries**: update plan to three-tier directory layout (9277256)
- **e2e**: update E2E testing docs and agent workflows (d50e188)

### Refactors

- **agents**: update models for various agents to improve performance and compatibility (039d242)
- **backend**: extract platform-specific login response logic to PlatformTokenHandler (#192) (6cec1ac)
- **auth**: add shared refresh client contract for web and mobile (#185) (864ff91)
- Enhance testing workflows and documentation for Jest and Playwright (558058d)

### Tests

- **groceries**: retarget stale fixture to current ListLine shape (d78ca54)
- **myorganizer-e2e**: add Platform Admin access control E2E (#204) (#214) (25edfd7)
- **admin**: add lifecycle actions and audit log tests (#203) (#212) (5252b00)
- **admin**: add AdminGuard and user directory tests (#201) (#210) (795b381)
- **tasks**: thin TasksPageClient behavior tests via workflow seam (#180) (98b8ee3)
- **myorganizer-e2e**: add groceries export/import E2E tests and helpers (8afa00f)
- **groceries**: E2E and multi-select implementation (a99ac05)

### CI

- **release**: publish GitHub Releases from version tags (#239) (b6f60a7)
- bump actions/checkout from 7.0.0 to 7.0.1 (#205) (c1404e5)
- bump actions/setup-node from 6.4.0 to 7.0.0 (#196) (169f4b6)
- bump actions/cache from 5.0.5 to 6.1.0 (#171) (6ecb9b3)
- bump actions/checkout from 6.0.3 to 7.0.0 (#166) (6751ff3)
- bump actions/checkout from 6.0.2 to 6.0.3 (ef22461)

### Chores

- **agents**: update model and tool metadata (#234) (bea9e40)
- **agents**: update models for various agents to enhance performance and compatibility (fc88e28)
- **agents**: update model versions for various agents to improve performance and compatibility (76278cc)
- **sub-agents**: add sync script and update agent workflow docs (555fe1c)
- **graphify**: evaluate knowledge-graph tool and adopt narrow MCP index (#158) (#169) (f726756)
- **tasks**: update domain docs, ADR, and sandcastle dispatch fixes (5e9300c)
- **deps**: remove unused Nest & rxjs packages and sync docs (576fba0)
- **copilot-hooks**: add repo guardrail hooks (7337377)

### Other changes

- Fix Secure Install Review audit failures (#213) (8c30423)
- Fix Secure Install Review by patching audited dependency set (#207) (f9a22a2)
- **sandcastle**: pre-warm Yarn 4 and install deps before agent starts (49582a0)
- Add comprehensive tests for RenameListDialog, useGroceriesVault, and vault utilities (7c65c7e)
- Enhance unit test delegation workflow and quality review processes (c1b66bd)
