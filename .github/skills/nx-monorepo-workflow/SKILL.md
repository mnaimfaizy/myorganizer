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
- After generating a new library, register its path alias in `tsconfig.base.json` under `compilerOptions.paths`.
- Keep generated library names consistent with the naming pattern already in the repo (kebab-case, domain-prefixed where relevant).
- Do not commit scaffolding artifacts before verifying the generated project builds and lints cleanly.

## Generator Reference

The repo uses **Nx 22** with the following plugins installed:

| Plugin | Common Generators |
|---|---|
| `@nx/react` | `library`, `component`, `hook` |
| `@nx/next` | `application`, `page`, `component` |
| `@nx/js` | `library` |
| `@nx/node` | `application`, `library` |
| `@nx/express` | `application` |
| `@nx/nest` | `application`, `library` |
| `@nx/playwright` | `configuration` |
| `@nx/storybook` | `configuration` |
| `@nx/workspace` | `library`, `move`, `remove` |

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
5. If affected commands are needed (e.g. CI), use `yarn nx affected --target=<target>`.

## Checkpoints

- If a library was created by manually copying files instead of using `nx generate`, regenerate it with the CLI and remove the manual copy.
- If `project.json` was hand-edited to add targets that a generator would have set up, revert and re-run the generator with the correct options.
- If `tsconfig.base.json` paths are missing for a new library, add them before publishing the PR.
- If a new app or lib is missing an ESLint config or Jest config, check whether the generator was run with the correct `--linter` and `--unitTestRunner` flags.

## Validation

Run the narrowest checks first:

```sh
yarn nx build <project-name>
yarn nx test <project-name>
yarn nx lint <project-name>
```

For cross-project changes, use affected commands:

```sh
yarn nx affected --target=build
yarn nx affected --target=test
yarn nx affected --target=lint
```

## Key References

- [references/nx-cli-runbook.md](./references/nx-cli-runbook.md) — generator commands, naming conventions, and tsconfig registration
- `nx.json` — workspace-level generator defaults and plugin config
- `tsconfig.base.json` — path aliases for all importable libraries
- `AGENTS.md` — monorepo architecture rules
- `package.json` — installed Nx plugins and workspace scripts
