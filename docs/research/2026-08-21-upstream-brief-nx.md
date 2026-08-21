# Upstream Brief: nx and 16 `@nx/*` plugins

- **Date:** 2026-08-21
- **Subjects:** (current resolved from `TECH_STACK.md` per `upstream-brief.config.yml`)
  - `nx` current `22.3.3` → target `22.7.7`
  - `@nx/eslint` current `22.3.3` → target `22.7.7`
  - `@nx/eslint-plugin` current `failed` → target `22.7.7`
  - `@nx/express` current `22.3.3` → target `22.7.7`
  - `@nx/jest` current `22.3.3` → target `22.7.7`
  - `@nx/js` current `22.3.3` → target `22.7.7`
  - `@nx/next` current `22.3.3` → target `22.7.7`
  - `@nx/node` current `22.3.3` → target `22.7.7`
  - `@nx/playwright` current `22.3.3` → target `22.7.7`
  - `@nx/react` current `22.3.3` → target `22.7.7`
  - `@nx/react-native` current `22.3.3` → target `22.7.7`
  - `@nx/storybook` current `22.3.3` → target `22.7.7`
  - `@nx/vite` current `22.3.3` → target `22.7.7`
  - `@nx/vitest` current `22.3.3` → target `22.7.7`
  - `@nx/web` current `22.3.3` → target `22.7.7`
  - `@nx/webpack` current `22.3.3` → target `22.7.7`
  - `@nx/workspace` current `22.3.3` → target `22.7.7`
- **Sources:** primary upstream pages only (linked on each finding)

## Run notes

The invocation named `nx` and `@nx/eslint` at `27.7.7` and the other fifteen plugins at `22.7.7`. Nx
ships core and plugins in lockstep and there is no 27.x line; the human confirmed **22.7.7 for all
seventeen subjects**.

Two facts frame every finding below:

1. `TECH_STACK.md` — the adapter's current-version source — records `22.3.3`, but `package.json`
   already pins all seventeen at `22.7.7`. The named target is **already installed**; the recorded
   current version is stale. That is a `dep-sync` matter, not an upstream one, and is listed under
   Follow-on.
2. The hops were run by the main agent, not the `Research` specialist. See the Follow-on entry on the
   `Research` tool grant.

## Findings

### nx

#### Future-risk

- **Claim:** Nx 22 is no longer the Current major — v23 became Current on June 16, 2026, moving v22 to
  LTS, which receives only security patches and critical fixes for 12 months from that date.
- **Source:** [Nx Release Schedule and Support Policy](https://nx.dev/docs/reference/releases) — describes v23 Current / v22 LTS / v21 LTS
- **Local evidence:** `.agents/skills/nx-monorepo-workflow/SKILL.md:27` states "The repo uses **Nx 22**";
  `.agents/skills/nx-monorepo-workflow/references/nx-cli-runbook.md:228` states plugins are "all at
  version 22". Both hard-code the major, so a v23 hop becomes an instruction-edit sweep rather than a
  version bump.
- **Disposition:** plan

#### Mismatch

- **Claim:** `nx affected:apps` and `nx affected:libs` were removed in Nx 16 and no longer run.
- **Source:** [Nx CLI reference](https://nx.dev/docs/reference/nx-commands) — no `affected:*` colon-form subcommand is listed; [nrwl/nx#21134](https://github.com/nrwl/nx/issues/21134) records the removal and the resulting error
- **Local evidence:** `package.json:11` and `package.json:15` define `affected:apps` and `affected:libs`.
  Both fail at the installed 22.7.7 — verified by running them:
  `NX  Both project and target have to be specified`. **These two scripts are broken today.** The
  documented replacement is `nx show projects --affected`.
- **Disposition:** plan

- **Claim:** The colon-form legacy commands are absent from the CLI reference entirely. The documented
  forms are `nx graph`, `nx affected -t <target>`, and `nx affected --graph`.
- **Source:** [Nx CLI reference](https://nx.dev/docs/reference/nx-commands) — command list and `nx affected` options table
- **Local evidence:** Six undocumented colon forms are taught or scripted in this repo. Each was run at
  the installed 22.7.7 to check whether absence from the docs means removal — it does not, they are
  still-resolving legacy aliases:

  | Form                    | Resolves to         | Taught / scripted at                                                                                     |
  | ----------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
  | `nx dep-graph`          | `nx graph`          | `package.json:48`; `nx-cli-runbook.md:185` (which also teaches `nx graph` on line 187, as if equivalent) |
  | `nx affected:dep-graph` | `nx affected:graph` | `package.json:13`                                                                                        |
  | `nx affected:build`     | itself              | `package.json:12`                                                                                        |
  | `nx affected:test`      | itself              | `package.json:17`                                                                                        |
  | `nx affected:lint`      | itself              | `package.json:16`                                                                                        |
  | `nx affected:e2e`       | itself              | `package.json:14`                                                                                        |

  Being undocumented makes them unsupported rather than broken: nothing upstream commits to keeping
  them, and `affected:apps` / `affected:libs` are the precedent for what happens when that runs out.

- **Disposition:** plan

  > **Correction.** An earlier draft of this brief asserted that `nx dep-graph` and `nx affected:graph`
  > do not exist, citing their absence from the CLI reference. Running them disproved that. Absence
  > from the docs is the finding; removal is not.

- **Claim:** Since 22.0.0, `nx format` and generators no longer sort TypeScript path mappings by
  default — the behaviour now requires `--sort-root-tsconfig-paths`.
- **Source:** [Release 22.0.0 · nrwl/nx](https://github.com/nrwl/nx/releases/tag/22.0.0) — breaking change (#32781), the target's own major line
- **Local evidence:** `.agents/skills/nx-monorepo-workflow/SKILL.md` step 3 tells agents to hand-add the
  alias to `tsconfig.base.json`, and `DEVELOPMENT.md:616` teaches `yarn nx format:write`. Neither says
  the sort no longer happens, so `tsconfig.base.json` path order now drifts silently.
- **Disposition:** plan

#### Missed improvement

- **Claim:** The 22.7.7 patch itself is two self-hosted-remote-cache security fixes plus `@nx/dotnet`
  sandbox fixes: "prevent path traversal / zip-slip in self-hosted remote cache" and "warn when the
  self-hosted remote cache disables TLS verification".
- **Source:** [Release 22.7.7 · nrwl/nx](https://github.com/nrwl/nx/releases/tag/22.7.7)
- **Local evidence:** No Nx Cloud or self-hosted remote cache is configured — `nxCloud`, `nx-cloud`,
  `NX_SELF_HOSTED*`, and `remoteCache` have no occurrences in `nx.json`, `package.json`,
  `.github/workflows/*.yml`, or `.env.example`. Neither fix reaches this repo, and `@nx/dotnet` is not
  installed. **22.7.7 carries no security exposure for MyOrganizer.**
- **Disposition:** plan (record the reasoning so the next audit does not re-derive it)

### @nx/eslint

#### Future-risk

- **Claim:** Nx v23 deprecates executor-based tooling in favour of inferred plugin targets, naming
  "Jest, Cypress, Playwright, Webpack, Storybook, Next.js, ESLint, and others", with removal in v24.
- **Source:** [Nx 23 Release](https://nx.dev/blog/nx-23-release) — vendor release notes, deprecations table
- **Local evidence:** The repo runs the opposite pattern. `nx.json` moves the inferred
  `@nx/eslint/plugin` target aside to `targetName: "eslint:lint"`, and 22 explicit executor targets are
  declared by hand across `apps/*/project.json` and `libs/**/project.json` — 8 × `@nx/eslint:lint`,
  7 × `@nx/jest:jest`, 3 × `@nx/playwright:playwright`, 1 each of `@nx/webpack:webpack`,
  `@nx/next:server`, `@nx/next:build`, `@nx/js:node`. Every instruction file teaches
  `yarn nx lint <project>` (`AGENTS.md:23,38`, `DEVELOPMENT.md:596-603`, and ten Skill runbooks), which
  resolves through the hand-declared executor target, not the inferred one. Meanwhile
  `.agents/skills/nx-monorepo-workflow/SKILL.md:20` forbids hand-editing `project.json` — the
  instruction and the configuration already contradict each other, and v24 will remove the pattern the
  configuration depends on.
- **Disposition:** plan (instruction wording) + follow-on (the `project.json` targets themselves)

_Checked and clear:_ v23 deprecates ESLint v8 support in favour of v9+; this repo is on `eslint` 9.39.2.

### @nx/next

#### Future-risk

- **Claim:** "The Next.js `withNx` helper is deprecated", with removal in v24.
- **Source:** [Nx 23 Release](https://nx.dev/blog/nx-23-release) — deprecations table
- **Local evidence:** `apps/myorganizer/next.config.js:4` imports `{ composePlugins, withNx }` from
  `@nx/next` and line 41 composes with it. No instruction file mentions `withNx`, so nothing teaches
  agents that this call site is on a removal path.
- **Disposition:** follow-on (application code)

### @nx/webpack

#### Future-risk

- **Claim:** The webpack/Rspack helper functions `composePlugins`, `withNx`, `withWeb`, and `withReact`
  are deprecated in favour of plugin classes — `NxAppWebpackPlugin`, `NxReactWebpackPlugin` — with
  removal in v24.
- **Source:** [Nx 23 Release](https://nx.dev/blog/nx-23-release) — deprecations table
- **Local evidence:** `apps/backend/webpack.config.js:8` imports `{ composePlugins, withNx }` from
  `@nx/webpack` and line 13 calls `withNx()`.
- **Disposition:** follow-on (application code)

_Checked and clear:_ 22.0.0 removed the `deleteOutputPath` and `sassImplementation` options
([Release 22.0.0](https://github.com/nrwl/nx/releases/tag/22.0.0), #32828); neither appears anywhere in
`apps/` or `libs/`.

### @nx/workspace

#### Mismatch

- **Claim:** `@nx/nest` is a separately installed Nx plugin; a workspace cannot run its generators
  unless the package is a dependency.
- **Source:** [Nx CLI reference](https://nx.dev/docs/reference/nx-commands) — `nx generate` resolves generators from installed plugin packages
- **Local evidence:** `.agents/skills/nx-monorepo-workflow/SKILL.md:36` lists `@nx/nest` with
  `application` and `library` generators in its "plugins installed" table. `@nx/nest` has **zero**
  occurrences in `package.json`. The table also asserts a `hook` generator for `@nx/react` (line 31),
  which this run could not verify against a live docs page. The table is hand-maintained and has drifted
  from the installed set.
- **Disposition:** plan

### @nx/eslint-plugin, @nx/express, @nx/jest, @nx/js, @nx/node, @nx/playwright, @nx/react, @nx/react-native, @nx/storybook, @nx/vite, @nx/vitest, @nx/web

No findings specific to these subjects beyond the cross-cutting LTS and executor-deprecation findings
recorded under `nx` and `@nx/eslint`, which apply to the whole plugin set because Nx versions them in
lockstep. Two upstream changes were checked and do not reach this repo:

- v23 raises the Node minimum to 22 LTS+ ([Nx 23 Release](https://nx.dev/blog/nx-23-release));
  `package.json` already declares `"node": ">=22.0.0"` and every CI job pins `node-version: '22'`.
- v23 moves Vitest out of `@nx/vite` into `@nx/vitest` ([Nx 23 Release](https://nx.dev/blog/nx-23-release));
  `package.json` already depends on both at 22.7.7.

## Proposed plan

Repo-owned instructions and hygiene/test scripts only. No package bumps. No application-code edits.

- **Root scripts — broken** (`package.json:11,15`): `affected:apps` and `affected:libs` error out at the
  installed pin. Replace both with `nx show projects --affected`, or delete them if nothing calls them.
  Check CI and Husky for callers first.
- **Root scripts — undocumented aliases** (`package.json:12,13,14,16,17,48`): retarget the six legacy
  colon forms onto documented syntax, so the repo stops depending on aliases upstream does not commit to:

  | Script               | Now                     | Should be              |
  | -------------------- | ----------------------- | ---------------------- |
  | `affected:build`     | `nx affected:build`     | `nx affected -t build` |
  | `affected:test`      | `nx affected:test`      | `nx affected -t test`  |
  | `affected:lint`      | `nx affected:lint`      | `nx affected -t lint`  |
  | `affected:e2e`       | `nx affected:e2e`       | `nx affected -t e2e`   |
  | `affected:dep-graph` | `nx affected:dep-graph` | `nx affected --graph`  |
  | `dep-graph`          | `nx dep-graph`          | `nx graph`             |

  **`affected:lint` is load-bearing:** `.husky/pre-commit:52` runs
  `corepack yarn affected:lint --uncommitted --outputStyle=static` on every commit. Retarget that one
  first and verify a commit still passes. A grep of `DEVELOPMENT.md`, `README.md`, `.github/workflows/`,
  `.husky/`, and `.agents/skills/` finds **no other caller** for any of the eight scripts, so the rest can
  be retargeted or deleted without breaking a documented workflow. Renaming the script _keys_
  (`dep-graph` → `graph`) is optional churn; retarget the values first.

- **Nx CLI runbook** (`.agents/skills/nx-monorepo-workflow/references/nx-cli-runbook.md`): drop the
  `yarn nx dep-graph` line and keep `yarn nx graph` as the single taught graph command.
- **Developer guide** (`DEVELOPMENT.md`, around line 1050): replace `yarn nx affected:graph` with
  `yarn nx affected --graph`.
- **Nx workflow Skill** (`.agents/skills/nx-monorepo-workflow/SKILL.md`): the path-alias step should say
  that since Nx 22 `nx format:write` no longer sorts `tsconfig.base.json` path mappings, and name
  `--sort-root-tsconfig-paths` as the flag that restores it. `DEVELOPMENT.md:616` should carry the same
  caveat where it teaches `nx format:write`.
- **Nx workflow Skill** generator table: rebuild it from the installed set rather than by hand — remove
  `@nx/nest`, and verify each remaining generator with `nx list <plugin>` before writing it down. Add a
  line telling future editors to regenerate rather than edit in place.
- **Nx workflow Skill** version claims: replace the literal "The repo uses **Nx 22**" (SKILL.md:27) and
  "all at version 22" (runbook:228) with a pointer to `TECH_STACK.md`, so the next major hop is one file,
  not a grep sweep. This matches the rule `AGENTS.md` already applies to Next.js.
- **Nx workflow Skill** executor guidance: SKILL.md:20 forbids hand-editing `project.json` while the repo
  declares 22 executor targets by hand. Either the rule states the exception, or it names the
  inferred-plugin direction as the target state. Pick one before v24 forces the question.
- **Nx workflow Skill / DEVELOPMENT.md**: record that Nx 22 is on LTS until roughly June 2027 and that
  22.7.x carries security fixes only, so the next Nx work item is a v23 migration, not a patch bump.

## Follow-on

Application-code findings and harness-configuration findings. The human may file a separate issue after
grilling.

- `apps/myorganizer/next.config.js` uses the deprecated `@nx/next` `withNx` helper — removal in v24 — code
- `apps/backend/webpack.config.js` uses the deprecated `composePlugins` / `withNx` webpack helpers; the
  replacement is `NxAppWebpackPlugin` — removal in v24 — code
- 22 hand-declared executor targets across `apps/*/project.json` and `libs/**/project.json`, plus the
  `targetName: "eslint:lint"` sidestep in `nx.json`, sit on the executor-based path that v23 deprecates
  and v24 removes. Migrating to inferred plugin targets is a single coordinated change, not seven — code
- `TECH_STACK.md` records all seventeen Nx packages at `22.3.3` while `package.json` pins `22.7.7`. The
  adapter reads `TECH_STACK.md` as the current-version source, so every future Upstream Brief inherits
  this drift. Run the `dep-sync` Skill — code
- `.claude/agents/research.md` grants `tools: [Read, Glob, Grep, Edit, Write, Bash]` while the canonical
  body `.github/agents/research.agent.md` declares `tools: [web, read, search]`. The Claude Code copy has
  no web access, so the `Research` specialist cannot fetch a page — its own body opens "gather information
  from the web". The `web` role is being dropped in the sync mapping. This run fell back to the main agent
  per the skill's own fallback clause — vendor-skill

## Failed hops

- `@nx/eslint-plugin` — absent from `TECH_STACK.md`, the adapter's current-version source, so the current
  version failed closed and was not invented. `package.json:374` pins it at `22.7.7`. Research for this
  subject still ran and is folded into the `@nx/eslint` findings, since Nx versions the two in lockstep.
- `https://nx.dev/docs/reference/deprecated` — the canonical deprecations reference is client-rendered and
  returned an empty body on two fetches. Deprecation claims in this brief are cited to the Nx 23 release
  notes and the 22.0.0 GitHub release instead, both of which returned full content.
- `https://nx.dev/docs/technologies/react/api/generators/hook` — 404. The `@nx/react:hook` generator
  claimed by SKILL.md:31 is therefore **unverified in both directions**; this brief does not assert it is
  missing.
