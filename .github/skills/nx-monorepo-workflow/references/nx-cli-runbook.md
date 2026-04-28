# Nx CLI Runbook

## Generating a React Library

Used for frontend page libraries, shared UI, or utility libs with React.

```sh
yarn nx generate @nx/react:library \
  --name=<lib-name> \
  --directory=libs/<path> \
  --importPath=@myorganizer/<lib-name> \
  --unitTestRunner=jest \
  --bundler=none \
  --no-interactive
```

**Page library example** (`libs/web/pages/my-route`):

```sh
yarn nx generate @nx/react:library \
  --name=my-route \
  --directory=libs/web/pages/my-route \
  --importPath=@myorganizer/web-pages/my-route \
  --unitTestRunner=jest \
  --bundler=none \
  --no-interactive
```

After generation, add to `tsconfig.base.json`:

```json
"@myorganizer/web-pages/my-route": ["libs/web/pages/my-route/src/index.ts"]
```

---

## Generating a TypeScript Library (non-React)

For shared logic, utilities, or backend-facing code without React.

```sh
yarn nx generate @nx/js:library \
  --name=<lib-name> \
  --directory=libs/<path> \
  --importPath=@myorganizer/<lib-name> \
  --unitTestRunner=jest \
  --bundler=tsc \
  --no-interactive
```

---

## Generating a Next.js Application

```sh
yarn nx generate @nx/next:application \
  --name=<app-name> \
  --directory=apps/<app-name> \
  --style=tailwind \
  --linter=eslint \
  --no-interactive
```

---

## Generating an Express Application

```sh
yarn nx generate @nx/express:application \
  --name=<app-name> \
  --directory=apps/<app-name> \
  --linter=eslint \
  --unitTestRunner=jest \
  --no-interactive
```

---

## Generating a Node Library

```sh
yarn nx generate @nx/node:library \
  --name=<lib-name> \
  --directory=libs/<path> \
  --importPath=@myorganizer/<lib-name> \
  --unitTestRunner=jest \
  --no-interactive
```

---

## Generating a React Component

Inside an existing React library or app:

```sh
yarn nx generate @nx/react:component \
  --name=<ComponentName> \
  --project=<project-name> \
  --no-interactive
```

---

## Generating a Next.js Page

Inside an existing Next.js app:

```sh
yarn nx generate @nx/next:page \
  --name=<page-name> \
  --project=<app-name> \
  --no-interactive
```

---

## Moving a Project

Rename or relocate a library or app without losing git history:

```sh
yarn nx generate @nx/workspace:move \
  --projectName=<old-name> \
  --destination=<new/path> \
  --no-interactive
```

---

## Removing a Project

```sh
yarn nx generate @nx/workspace:remove \
  --projectName=<project-name> \
  --no-interactive
```

---

## Adding Storybook to an Existing Library

```sh
yarn nx generate @nx/storybook:configuration \
  --project=<project-name> \
  --no-interactive
```

---

## Dry-Run Before Generating

Always use `--dry-run` first to preview what files will be created or modified:

```sh
yarn nx generate @nx/react:library \
  --name=my-route \
  --directory=libs/web/pages/my-route \
  --importPath=@myorganizer/web-pages/my-route \
  --unitTestRunner=jest \
  --bundler=none \
  --dry-run
```

---

## Affected Commands

Run tasks only on projects affected by recent changes:

```sh
yarn nx affected --target=build
yarn nx affected --target=test
yarn nx affected --target=lint

# With base/head refs (useful in CI):
yarn nx affected --target=build --base=main --head=HEAD
```

---

## Viewing the Dependency Graph

```sh
yarn nx dep-graph
# or to open in the browser:
yarn nx graph
```

---

## Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| Library project name | kebab-case | `web-pages-todos` |
| Library directory | `libs/<domain>/<name>` | `libs/web/pages/todos` |
| Import path alias | `@myorganizer/<scope>` | `@myorganizer/web-pages/todos` |
| App project name | kebab-case | `myorganizer`, `backend` |
| App directory | `apps/<name>` | `apps/myorganizer` |
| Component name | PascalCase | `TodoList` |

---

## tsconfig.base.json Registration

Every library intended to be imported by other projects must have a path alias registered:

```json
{
  "compilerOptions": {
    "paths": {
      "@myorganizer/<scope>": ["libs/<path>/src/index.ts"]
    }
  }
}
```

Ensure `libs/<path>/src/index.ts` exports all public API surface from the library.

---

## Repo References

- `nx.json` — generator defaults and plugin declarations
- `tsconfig.base.json` — all registered path aliases
- `AGENTS.md` — monorepo architecture rules
- `package.json` — installed `@nx/*` plugins (all at version 22)
