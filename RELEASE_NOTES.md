# Release v0.4.0

Date: 2026-08-18

## Changes since v0.3.0

Compare: https://github.com/mnaimfaizy/myorganizer/compare/v0.3.0...v0.4.0

### Features

- **youtube**: deep-link digest and subscription channels to directory (f280020)
- **storybook**: add Pattern A stories for vault backup cards (#289) (#375) (10d626c)
- **youtube**: add sync freshness indicator for failures and delays (187af7d)
- **storybook**: add Sidebar primitive stories (#374) (39390f0)
- **youtube**: add keyboard navigation and duration estimate to queue rail (00d0758)
- **storybook**: add Pattern B stories for ten UI primitives (#373) (b3e668c)
- **youtube**: implement focused channel directory (Variant C) (98ad931)
- **youtube**: surface privacy wording for YouTube metadata (3148359)
- **storybook**: add Pattern C stories for eight UI primitives (#372) (e3fce5e)
- **storybook**: add Pattern A stories for six UI primitives (#289) (#370) (0575b3b)
- **storybook**: establish required story precedent and three scopes (#289) (#369) (e7609f0)
- **tooling**: add PR Surface Labels workflow (ADR 0025) (#366) (395fd05)
- **upstream-brief**: add portable instruction-truth audit skill (#358) (99a01c4)
- **youtube**: split digest delivery into its own resumable worker (7e9e93e)
- **youtube**: classify Shorts by runtime and isolate them from long-form (5b2dce0)
- **youtube**: add Shorts page with Daily Budget and Hard Stop (4041869)
- **nx**: disable analytics in configuration (546f989)
- **youtube**: align queue rail with locked Variant B model (86d9805)
- **youtube**: add in-session queue rail (d9ed6b7)
- **youtube**: replace view-mode toggle with channel-first directory (a856214)
- **youtube**: add privacy-enhanced in-app playback (157bc24)
- **youtube**: add watched state to synced videos (70ec294)
- **youtube**: add sync freshness and cooldown tracking (2eb7c50)
- **graphify**: add project-edge fidelity benchmark (#317) (61981ae)
- **skills**: add design-brief skill and scope vault export caps (#315) (96249a4)
- **agents**: add PrAuthor sub-agent for PR draft workflow (#314) (5fa8871)
- **sandcastle**: add sweep dispatch mode and dry-run support (#309) (737f3f4)
- **ai-commit**: add failure trailers and secret path guards (#313) (264efb9)
- **sandcastle**: add standalone dispatch and resolve Claude auth (#300) (b259c49)

### Fixes

- **deps**: pin deepmerge-ts@8.0.1 to patch stack exhaustion (f25f145)
- **youtube**: announce the channel selector as the tab set it behaves like (eac2184)
- **youtube**: clear per-video player state on an in-place swap (bcf31cc)
- **youtube**: give each queue rail its own heading id (fa9e710)
- **youtube**: meter Shorts from the Play press, not the embed alone (c115254)
- **youtube**: align channel list arrow keys to layout orientation (f95f3bf)
- **youtube**: arbitrate single active player between surfaces (be2b475)
- **storybook**: wait for Dialog fade-in before visibility assertion (#289) (#371) (f281c47)
- **backend**: do not claim digest period on empty window (3bad7d6)
- **deps**: update nanoid to 3.3.18 (#328) (3a00306)
- correct timezone handling in subscription date picker (#243) (df38774)
- **auth**: make error codes reachable and stop token lifetimes drifting (#325) (9050b30)
- **hooks**: stop agent hooks firing on reads and file content (#324) (2748700)
- **graphify**: guard command substitutions from errexit (#311) (8f0cf47)
- **security**: run the agent security hooks in Claude Code and guard secret reads (#298) (8eabccf)
- **graphify**: graduate from probation and make the agent wiring survive sync (#297) (8598720)
- **graphify**: close SQL and parse-error coverage gaps (#292) (#296) (719d779)
- **graphify**: repair the MCP server setup and auto-refresh the graph on commit (#293) (bc2ada7)
- **deps**: resolve nanoid DoS advisories and document image-size exception (#283) (f5e62d2)
- **hooks**: unify agent hooks across Copilot, Cursor, and Claude (#275) (bed8ae6)

### Documentation

- **youtube**: move prototype reference map onto the PRD (72e5bd8)
- **youtube**: document Namecheap cPanel cron and SMTP setup (c5d2ad7)
- **libs**: enforce ADR 0023 markdown allowlist in Husky and CI (#363) (347770b)
- **apps**: restrict apps markdown to agent guides and READMEs (#361) (a072433)
- **agents**: add Next.js 16 instruction truth and ADR 0019 (#359) (#360) (5a0c5f1)
- **adr**: record component hygiene enforcement decision (#343) (45a929f)
- **youtube**: record why the digest window filters on publishedAt (7be5fc8)
- **tech-stack**: revalidate image-size audit exception (#331) (e70a89d)
- **youtube**: point agents at the locked prototype variants (3bd155c)
- **auth**: add the session lifecycle explainer, brief, and drift guard (#329) (e5d97ae)
- **context**: add identity and session vocabulary to the glossary (#327) (96239bd)
- **readme**: make the README a front door and guard it against drift (#326) (ef36d1c)
- **vault**: add trust boundary and lifecycle pages with a drift guard (#316) (a91d263)
- **agents**: add the sub-agent orchestration map and work-item journey (#312) (efa35f7)
- **security**: point the image-size audit exception at its tracking issue (#286) (4bb4e7b)
- **agents**: adopt tiered quality gates and issue unblock (#277) (571408e)
- **context**: add Shorts Daily Budget and Hard Stop terms (#274) (dcdd5bf)
- **context**: add Followed Channel and watching glossary terms (#260) (1aaaf5a)
- **context**: add Shorts Daily Budget and Hard Stop terms (#259) (c3fcbb5)

### Refactors

- **agents**: script the component shape rules and slim the UI pipelines (#287) (995cb83)
- **testing**: rework the Jest test pipeline guardrails (#282) (a5eead7)

### Tests

- **backend**: replace once mock queues in YouTube service specs (13c3a8f)

### CI

- **chromatic**: add Chromatic UI Tests job to CI (#376) (f1a3775)
- **security**: trigger the npm audit on dependency content, not file paths (#284) (5e02d89)

### Chores

- **release**: add plan gate and correct the production approval model (a2f0a38)
- **agents**: fix component pipeline gaps; add builder bash (1eef3b5)
- **agents**: add project-scoped implement skill to override global (0289fab)
- **license**: adopt Elastic License 2.0 (#320) (#365) (83f5a9f)
- **agents**: consolidate harness instructions under ADR 0020 SSOT (#362) (c4ce919)
- **agents**: cap gated pipeline reject cycles at 2 (4662632)
- format prisma schema on commit and allow data migrations (cf89947)
- **agents**: add one-shot API contract specialists (#342) (1c4ba5d)
- **tooling**: enforce test hygiene in CI and pre-commit (#330) (5c8a23d)
- **agents**: align model policy with the agent definitions (eb4f06f)
- **agents**: update agent model lists (0110c51)
- **release**: remove unused semver tag functions (#299) (6853bca)
- **claude-code**: configure permissions with allow/ask/deny rules (#295) (369539a)
- **agents**: govern sub-agent model assignments across harnesses (#280) (5c875b4)
- **skills**: selective mattpocock sync through v1.2.3 (#279) (26b05b7)

### Other changes

- Add `GoogleChrome/modern-web-guidance` to approved external skills baseline (#255) (a06b703)
- [WIP] Fix failing GitHub Actions job Secure Install Review (#278) (c72002d)
- Fix failing GitHub Actions job Secure Install Review (#276) (adf0c88)
