# Upstream Brief: nx

- **Date:** 2026-09-17
- **Commit:** `f9fa66cb8a590bfd85f3176454bb03015742de84` — every local citation below was checked against the tree at this commit
- **Ecosystems:**
  - `nx` — Baseline `22.7.7`, no Horizon; members `@nx/cypress`, `@nx/detox`, `@nx/devkit`, `@nx/docker`, `@nx/eslint`, `@nx/eslint-plugin`, `@nx/express`, `@nx/jest`, `@nx/js`, `@nx/module-federation`, `@nx/next`, `@nx/node`, `@nx/nx-darwin-arm64`, `@nx/playwright`, `@nx/react`, `@nx/react-native`, `@nx/rollup`, `@nx/storybook`, `@nx/vite`, `@nx/vitest`, `@nx/web`, `@nx/webpack`, `@nx/workspace`, `nx`

## Delta

_None._

## Upstream Findings

### Broken now

- **mismatch** — libs/email-shell/AGENTS.md teaches `yarn nx run email-shell:eslint:lint` and says nx.json names the inferred ESLint target `eslint:lint`, but `@nx/eslint/plugin` at 22.7.7 defaults the inferred target to `lint`, this workspace sets `targetName` to `lint`, and the taught command fails.
  - **Ecosystem:** `nx`
  - **Source:** <https://raw.githubusercontent.com/nrwl/nx/22.7.7/packages/eslint/src/plugins/plugin.ts> (page version `22.7.7`) — “targetName: options?.targetName ?? 'lint',”
  - **Evidence:** `executed`
  - **Executed:** `yarn nx run email-shell:eslint:lint --skip-nx-cache` → exit 1
  - **Local evidence:**
    - `libs/email-shell/AGENTS.md:15` — ``- Lint: `yarn nx run email-shell:eslint:lint`. This library has no `lint` target of its own — the``
    - `libs/email-shell/AGENTS.md:16` — ``  one it runs is inferred by `@nx/eslint/plugin`, which nx.json names `eslint:lint`.``
    - `nx.json:56` — `        "targetName": "lint"`

### Advisory

- **mismatch** — The Nx workflow Skill generator table lists a `library` generator on `@nx/workspace`, but `@nx/workspace` at 22.7.7 has no such generator — its project generators are `move` and `remove`.
  - **Ecosystem:** `nx`
  - **Source:** <https://raw.githubusercontent.com/nrwl/nx/22.7.7/packages/workspace/generators.json> (page version `22.7.7`) — “"description": "Move an application or library to another folder."”
  - **Evidence:** `executed`
  - **Executed:** `yarn nx list @nx/workspace` → exit 0
  - **Local evidence:**
    - `.agents/skills/nx-monorepo-workflow/SKILL.md:41` — ``| `@nx/workspace`  | `library`, `move`, `remove`        |``

## Checked and clear

### nx

- `yarn nx lint <project>` matches the inferred ESLint target name this workspace configures (`lint`) and the plugin default at 22.7.7.
  - **Holds for:** `22.x`
  - **Source:** <https://raw.githubusercontent.com/nrwl/nx/22.7.7/packages/eslint/src/plugins/plugin.ts> (page version `22.7.7`) — “targetName: options?.targetName ?? 'lint',”
  - **Local evidence:**
    - `AGENTS.md:23` — ``- Do not suggest `next lint`. Lint with Nx/ESLint (`yarn nx lint <project>` or `yarn lint`).``
- `yarn nx test <project-name>` is the documented infix form for running a project's test target.
  - **Holds for:** `22.x`
  - **Source:** <https://nx.dev/docs/reference/nx-commands> (page version `22.7.7`) — “nx affected -t custom-target”
  - **Local evidence:**
    - `AGENTS.md:44` — ``- Test one Jest project: `yarn nx test <project-name>`.``
- `yarn nx graph` is the documented graph command; this repo no longer teaches `nx dep-graph`.
  - **Holds for:** `22.x`
  - **Source:** <https://nx.dev/docs/reference/nx-commands> (page version `22.7.7`) — “Graph dependencies within workspace.”
  - **Local evidence:**
    - `.agents/skills/nx-monorepo-workflow/references/nx-cli-runbook.md:186` — `yarn nx graph`
- `yarn nx show projects --affected` is the documented replacement for the removed `affected:apps` / `affected:libs` commands.
  - **Holds for:** `22.x`
  - **Source:** <https://nx.dev/docs/reference/nx-commands> (page version `22.7.7`) — “nx show projects --affected”
  - **Local evidence:**
    - `DEVELOPMENT.md:1147` — `yarn nx show projects --affected`
- `yarn nx affected -t <target>` is the documented affected form; colon-form `affected:build` aliases are no longer taught.
  - **Holds for:** `22.x`
  - **Source:** <https://nx.dev/docs/reference/nx-commands> (page version `22.7.7`) — “Run target for affected projects. Affected projects are projects that have been changed and projects that depend on the changed projects.”
  - **Local evidence:**
    - `.agents/skills/nx-monorepo-workflow/SKILL.md:68` — ``5. If affected commands are needed (e.g. CI), use `yarn nx affected -t <target>`. To see which projects``
- Since 22.0.0, `nx format` no longer sorts TypeScript path mappings by default; `--sort-root-tsconfig-paths` restores it, and the instructions teach that flag.
  - **Holds for:** `>=22.0.0 <23.0.0`
  - **Source:** <https://github.com/nrwl/nx/releases/tag/22.0.0> (page version `22.0.0`) — “BREAKING CHANGE: The `nx format` command and generators no longer default to sorting TypeScript path mappings. To keep the previous behavior, pass the `--sort-root-tsconfig-paths` flag to the command or set `NX_FORMAT_SORT_TSCONFIG_PATHS=true`.”
  - **Local evidence:**
    - `DEVELOPMENT.md:701` — `yarn nx format:write --sort-root-tsconfig-paths`
    - `DEVELOPMENT.md:704` — ``Since Nx 22.0.0, `nx format` no longer sorts `tsconfig.base.json` path mappings by default, and neither``
- `@nx/react:hook` exists at 22.7.7, so the generator table's `hook` row holds.
  - **Holds for:** `22.x`
  - **Source:** <https://raw.githubusercontent.com/nrwl/nx/22.7.7/packages/react/generators.json> (page version `22.7.7`) — “"description": "Create a hook."”
  - **Local evidence:**
    - `.agents/skills/nx-monorepo-workflow/SKILL.md:34` — ``| `@nx/react`      | `library`, `component`, `hook`     |``
- `yarn nx g @nx/react:lib` is a documented alias of `@nx/react:library` at 22.7.7.
  - **Holds for:** `22.x`
  - **Source:** <https://nx.dev/docs/reference/nx-commands> (page version `22.7.7`) — “Generate or update source code (e.g., nx generate @nx/js:lib mylib).”
  - **Local evidence:**
    - `DEVELOPMENT.md:1105` — `yarn nx g @nx/react:lib my-new-lib`
- `nx generate` / `nx g` is the documented scaffolding command; the Skill tells agents to use it instead of hand-creating libraries.
  - **Holds for:** `22.x`
  - **Source:** <https://nx.dev/docs/reference/nx-commands> (page version `22.7.7`) — “Generate or update source code (e.g., nx generate @nx/js:lib mylib).”
  - **Local evidence:**
    - `.agents/skills/nx-monorepo-workflow/SKILL.md:19` — ``- **Always use the Nx CLI** (`nx generate` / `nx g`) instead of creating library or app scaffolding by hand. This ensures consistent project config, `project.json`, `tsconfig`, Jest config, and ESLint config are all wired up correctly.``
- The Skill no longer hard-codes an Nx version literal; it points at TECH_STACK.md as the pin.
  - **Holds for:** `22.x`
  - **Source:** <https://github.com/nrwl/nx/releases/tag/22.7.7> (page version `22.7.7`) — “**core:** prevent path traversal / zip-slip in self-hosted remote cache (#36116)”
  - **Local evidence:**
    - `.agents/skills/nx-monorepo-workflow/SKILL.md:73` — `` `TECH_STACK.md` records which Nx version is pinned — do not restate it here or anywhere else in this ``

## Upstream Opportunities

_None._

## Incidental Observations

_None._

## Follow-on

_None._

## Unverified

_None._

## Failed hops

_None._

## Scanned

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `DEVELOPMENT.md`
- `.github/copilot-instructions.md`
- `.claude/checklist.md`
- `docs/ui/GUIDELINES.md`
- `apps/AGENTS.md`
- `apps/backend/AGENTS.md`
- `apps/myorganizer/AGENTS.md`
- `apps/mobile/AGENTS.md`
- `apps/myorganizer-e2e/AGENTS.md`
- `libs/AGENTS.md`
- `libs/email-shell/AGENTS.md`
- `libs/design-tokens/AGENTS.md`
- `libs/web/pages/AGENTS.md`
- `.agents/skills/nx-monorepo-workflow/SKILL.md`
- `.agents/skills/nx-monorepo-workflow/references/nx-cli-runbook.md`
- `.agents/skills/implement/SKILL.md`
- `.agents/skills/frontend-page-library-workflow/SKILL.md`
- `.agents/skills/vault-feature-workflow/SKILL.md`
- `.agents/skills/backend-api-contract-change/SKILL.md`
- `.agents/skills/prisma-migration-workflow/SKILL.md`
- `.agents/skills/playwright-e2e-workflow/SKILL.md`
- `.agents/skills/unit-test-delegation-workflow/SKILL.md`
- `.agents/skills/commit-change-workflow/SKILL.md`
- `.agents/skills/code-review/SKILL.md`
- `.github/agents/audit.agent.md`
- `.github/agents/test-reviewer.agent.md`
- `.github/agents/test-scaffold.agent.md`
- `.github/agents/test-runner.agent.md`
- `.github/agents/explore.agent.md`
- `tools/scripts/check-component-hygiene.mjs`
- `tools/scripts/check-test-hygiene.mjs`
- `tools/scripts/check-readme.mjs`
- `tools/scripts/check-vault-pages.mjs`
- `tools/scripts/check-auth-pages.mjs`
- `tools/scripts/check-mobile-platform.mjs`
- `nx.json`
- `https://github.com/nrwl/nx/releases/tag/22.0.0`
- `https://github.com/nrwl/nx/releases/tag/22.7.7`
- `https://nx.dev/docs/reference/nx-commands`
- `https://nx.dev/docs/reference/releases`
- `https://raw.githubusercontent.com/nrwl/nx/22.7.7/astro-docs/src/content/docs/concepts/inferred-tasks.mdoc`
- `https://raw.githubusercontent.com/nrwl/nx/22.7.7/astro-docs/src/content/docs/reference/releases.mdoc`
- `https://raw.githubusercontent.com/nrwl/nx/22.7.7/packages/eslint/src/plugins/plugin.ts`
- `https://raw.githubusercontent.com/nrwl/nx/22.7.7/packages/workspace/generators.json`
- `https://raw.githubusercontent.com/nrwl/nx/22.7.7/packages/react/generators.json`
- `nx — https://raw.githubusercontent.com/nrwl/nx/22.7.7/astro-docs/src/content/docs/concepts/inferred-tasks.mdoc — already adopted at nx.json @nx/eslint/plugin and @nx/jest/plugin; yarn nx:targets:check baseline is empty`
- `nx — https://raw.githubusercontent.com/nrwl/nx/22.7.7/astro-docs/src/content/docs/guides/Tasks%20%26%20Caching/convert-to-inferred.mdoc — infer-targets considered; no remaining @nx/* executor Declared Targets to convert`
- `nx — https://github.com/nrwl/nx/releases/tag/22.7.7 — self-hosted remote-cache zip-slip fix does not reach this repo (no nxCloud/remoteCache configured)`
- `nx — https://raw.githubusercontent.com/nrwl/nx/22.7.7/packages/webpack/index.d.ts — withNx/composePlugins carry no @deprecated marker at 22.7.7; v23 blog not cited (no Horizon)`
- `nx — https://raw.githubusercontent.com/nrwl/nx/22.7.7/astro-docs/src/content/docs/reference/releases.mdoc — 22.7.7-tagged support table lists v22 as Current; live nx.dev/docs/reference/releases (unstated page version) lists v22 as LTS; no Horizon so the live calendar is not a Baseline-matched source`
- `https://nx.dev/docs/concepts/inferred-tasks — 404 / Mental Model redirect`
- `https://nx.dev/docs/features/inferred-tasks — 404`
- `https://nx.dev/nx-api/next/documents/with-nx — 404`
