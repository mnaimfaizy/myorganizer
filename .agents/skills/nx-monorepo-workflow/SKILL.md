---
name: nx-monorepo-workflow
description: 'Use when generating new Nx libraries, applications, components, or other Nx artifacts in MyOrganizer. Prefer the Nx CLI over manual file creation.'
---

# Nx Monorepo Workflow

## Use This Skill When

- Generating a new Nx library (React, TypeScript, or other)
- Generating a new Nx application (Next.js, Express/Node, Playwright, etc.)
- Adding a new page library under `libs/web/pages/<route>`
- Scaffolding components, services, or other artifacts via Nx generators
- Updating `nx.json` generator defaults or adding new Nx plugins
- Running affected commands to scope builds, tests, and lints to changed projects

## Core Rules

- **Always use the Nx CLI** (`nx generate` / `nx g`) instead of creating library or app scaffolding by hand. This ensures consistent project config, `project.json`, `tsconfig`, Jest config, and ESLint config are all wired up correctly.
- Never hand-edit generated Nx project files (e.g. `project.json`) as the primary fix — change the generator inputs or `nx.json` defaults instead.
- After generating a new library, register its path alias in `tsconfig.base.json` under `compilerOptions.paths`. Nx no longer sorts those mappings for you — a hand-added alias needs `yarn nx format:write --sort-root-tsconfig-paths`. See [references/nx-cli-runbook.md](./references/nx-cli-runbook.md#tsconfigbasejson-registration).
- Keep generated library names consistent with the naming pattern already in the repo (kebab-case, domain-prefixed where relevant).
- Do not commit scaffolding artifacts before verifying the generated project builds and lints cleanly.

## Generator Reference

`package.json` is the list of installed plugins; the table below is a hand-maintained index of the
generators this repo reaches for, and nothing asserts it. Confirm a row with `yarn nx list <plugin>`
rather than editing it from memory, and drop any plugin that leaves `package.json`.

| Plugin           | Common Generators                  |
| ---------------- | ---------------------------------- |
| `@nx/react`      | `library`, `component`, `hook`     |
| `@nx/next`       | `application`, `page`, `component` |
| `@nx/js`         | `library`                          |
| `@nx/node`       | `application`, `library`           |
| `@nx/express`    | `application`                      |
| `@nx/playwright` | `configuration`                    |
| `@nx/storybook`  | `configuration`                    |
| `@nx/workspace`  | `library`, `move`, `remove`        |

`nx.json` generator defaults already set for this repo:

```json
"generators": {
  "@nx/next": { "application": { "style": "tailwind", "linter": "eslint" } },
  "@nx/react": { "library": { "unitTestRunner": "jest" } }
}
```

## Workflow

1. Decide where the new artifact belongs:
   - Page-level UI logic → `libs/web/pages/<route>/` (React library, Jest enabled)
   - Shared UI components → `libs/web-ui/`
   - Shared logic (non-UI) → `libs/<domain>/`
   - New Next.js app → `apps/<name>/`
   - New Express/Node app → `apps/<name>/`
2. Run the appropriate generator (see [references/nx-cli-runbook.md](./references/nx-cli-runbook.md) for exact commands).
3. After generation, add the path alias to `tsconfig.base.json` if the library will be imported by other projects:
   ```json
   "@myorganizer/<lib-name>": ["libs/<path>/src/index.ts"]
   ```
4. Verify the project wires up correctly:
   - `yarn nx build <project-name>` (or `yarn nx test <project-name>` for test-only libs)
   - `yarn nx lint <project-name>`
5. If affected commands are needed (e.g. CI), use `yarn nx affected -t <target>`. To see which projects
   are affected without running anything, use `yarn nx show projects --affected`.

## Version Support

`TECH_STACK.md` records which Nx version is pinned — do not restate it here or anywhere else in this
Skill. What matters for planning is which support line that pin sits on: the 22.x line is **LTS, not
Current** (v23 became Current in June 2026), so it takes security patches and critical fixes only,
through roughly June 2027. A 22.7.x patch is therefore never a feature hop. The consequence is that the
next Nx move is a **v23 migration** rather than a patch bump; that work is tracked on #420, not planned
here. Dates and citations are frozen in
[`docs/research/2026-08-21-upstream-brief-nx.md`](../../../docs/research/2026-08-21-upstream-brief-nx.md).

## Checkpoints

- If a library was created by manually copying files instead of using `nx generate`, regenerate it with the CLI and remove the manual copy.
- If `project.json` was hand-edited to add targets that a generator would have set up, revert and re-run the generator with the correct options.
- If `tsconfig.base.json` paths are missing for a new library, add them before publishing the PR.
- If a new app or lib is missing an ESLint config or Jest config, check whether the generator was run with the correct `--linter` and `--unitTestRunner` flags.
- If Nx dropped a `README.md` under `libs/`, delete it unless it is the design-tokens Library README (ADR 0023). Husky and CI run `yarn libs:markdown:check`.

## Validation

Run the narrowest checks first:

```sh
yarn nx build <project-name>
yarn nx test <project-name>
yarn nx lint <project-name>
```

For cross-project changes, use affected commands:

```sh
yarn nx affected -t build
yarn nx affected -t test
yarn nx affected -t lint
```

## Key References

- [references/nx-cli-runbook.md](./references/nx-cli-runbook.md) — generator commands, naming conventions, and tsconfig registration
- `nx.json` — workspace-level generator defaults and plugin config
- `tsconfig.base.json` — path aliases for all importable libraries
- `AGENTS.md` — monorepo architecture rules
- `package.json` — installed Nx plugins and workspace scripts
