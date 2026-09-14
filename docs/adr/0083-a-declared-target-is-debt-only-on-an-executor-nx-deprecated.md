# A Declared Target is debt only on an executor Nx deprecated, and the rest moves on Nx 22

## Status

proposed

Supersedes decision 3 of [ADR 0082](0082-nx-targets-are-inferred-and-a-declared-target-is-migration-debt.md)
and sharpens its decision 1. Decision 2 (the ratchet) stands.

## Context

ADR 0082 made Inferred Targets the target state and called every Declared Target on an `@nx/*`
executor migration debt. Its decision 3 deferred the Playwright targets and the four build/serve
targets to the v23 hop, on the ground that their options needed study tied to the deprecated
`withNx` and `composePlugins` helpers, and doing it on Nx 22 risked doing it twice.

That study was done for #766 on 2026-09-14, against the installed Nx 22.7.7 and Next.js 16.3.4 and
the [Nx 23 release post](https://nx.dev/blog/nx-23-release). Three findings remove the ground for
waiting and one finds the definition of debt too wide:

- **Nothing in `withNx` survives the move.** Next.js 16 builds with Turbopack by default, so
  `withNx`'s webpack hooks never run, and no tracked library has a CSS module or an SVG they would
  serve anyway. What was left was relocating `distDir` to `dist/apps/myorganizer/.next`, which the
  bundled Next.js docs forbid: `distDir` "should not leave your project directory".
- **The v23 replacement already works on 22.** `NxAppWebpackPlugin` is the class the Nx 23 post
  names in place of `composePlugins`/`withNx`. At 22.7.7 it accepts every option the backend's
  `@nx/webpack:webpack` target carried and generates `package.json` without an executor.
  Migrating to it now is the v23 shape, not work the hop redoes.
- **Nx's conversion generators cannot do this repo's migration.** `convert-to-inferred` for
  Playwright and Next.js registered duplicate plugins in `nx.json`, could not move `outputPath`,
  and kept `withNx`. The work is hand-written whichever Nx version it lands on.
- **Not every `@nx/*` executor is going away.** The Nx 23 post deprecates per-tool executors that an
  inferred plugin replaces. `@nx/js:node`, which serves a built Node app with rebuild-and-restart,
  is not on that list, and Nx 22.7.7's own `@nx/node` application generator still emits it for
  `serve` next to an inferred webpack build. The webpack plugin's inferred `serve` is
  `webpack-cli serve`, a browser dev server, so nothing inferred replaces it. Under ADR 0082's
  wording the backend's `serve` could never leave the ratchet baseline.

## Decision

1. **Debt is a Declared Target on an `@nx/*` executor that Nx has deprecated in favour of an
   inferred plugin.** An `@nx/*` executor Nx still ships as its own answer is not debt. The ratchet
   records such an executor in a `notDebt` list, keyed by executor, each entry with a written
   `reason` and the `source` showing Nx has not deprecated it. An entry covering no target fails the
   check as stale, and an executor cannot sit in both lists. `@nx/js:node` is the only entry.
2. **The remaining debt is removed on Nx 22, not with the v23 hop.** The Playwright targets and the
   web app's build and server become Inferred Targets, the backend's build becomes an Inferred
   Target configured by `NxAppWebpackPlugin`, and `withNx` and `composePlugins` leave both config
   files. The ratchet baseline ends empty.
3. **Plugin target names win over the executor-era names.** The web app's targets are the Next.js
   plugin's `build`, `dev`, and `start`, with no `production` or `development` configurations;
   callers of `serve`, `serve:production`, and `build:production` move. Keeping the old names would
   need configuration overrides in `project.json` that exist only to preserve a spelling.

## Considered Options

- **Keep decision 3 and wait for v23.** Rejected. The study it waited for found nothing tied to the
  hop, and Nx's generators would not do the work at 23 either.
- **Replace `@nx/js:node` with `nx:run-commands`** (`webpack-cli build --watch` beside
  `node --watch`). Rejected. It rebuilds by hand a dev loop Nx still ships, to satisfy a definition
  of debt that turned out to be too wide.
- **Carve `@nx/js:node` out inside the checker.** Rejected in favour of the listed, reasoned,
  stale-checked entry: an exemption buried in code is the silent kind the gates here refuse.

## Consequences

- The web app's build output moves from `dist/apps/myorganizer/.next` to `apps/myorganizer/.next`,
  and every consumer moves with it: `vercel.json` and the Vercel settings sync (which PATCHes the
  live staging project from `vercel.json` on each staging deploy), the web packaging script,
  `tsconfig.json`, and the docs that name the path.
- The e2e suite's production web server runs `myorganizer:start`, which depends on `build`, so
  ADR 0050's "build before serving" is enforced by the task graph instead of a `&&` in
  `playwright.config.ts`. The inferred `e2e` target is cacheable by default; it is overridden to
  `cache: false`, because a replayed pass would hide the rot the nightly lane exists to find.
- Two executor behaviours had to be restated by hand, because the plugin form defaults differently
  and neither shows up in `project.json`. The Nx task loads the root `.env`, whose
  `NODE_ENV=development` breaks `next build`'s prerender, so the web app's `build` override sets
  `NODE_ENV=production` on the task. `NxAppWebpackPlugin` minifies whenever `NODE_ENV` is
  production, so the backend config sets `optimization: false`. The backend config also keeps its
  explicit `TsconfigPathsPlugin`: the app plugin's own path wiring does not resolve workspace
  libraries for this node target. With those three, the backend bundle matches the executor's apart
  from webpack's CommonJS export trailer.
- When Nx deprecates `@nx/js:node`, its `notDebt` entry is wrong and must move to the baseline.
  Nothing detects that automatically; the entry's `source` is where to look.
