# Nx targets are inferred, and a Declared Target is migration debt

## Status

proposed

## Context

Nx v23 deprecates executor-based targets in favour of Inferred Targets, naming Jest, Playwright,
Webpack, Storybook, Next.js, and ESLint, with removal in v24
([Nx 23 Release](https://nx.dev/blog/nx-23-release)). The repo runs Nx 22.7.7, which is LTS and
receives security and critical fixes only until roughly June 2027.

The repo points the other way. `project.json` files carry 52 Declared Targets on `@nx/*` executors
that v24 removes: 26 `@nx/eslint:lint`, 19 `@nx/jest:jest`, 3 `@nx/playwright:playwright`, and one
each of `@nx/webpack:webpack` and `@nx/js:node` (backend) and `@nx/next:build` and
`@nx/next:server` (myorganizer). The 10 `nx:run-commands` targets and the
`@driimus/nx-plugin-openapi` generator are not affected.

Two facts make this a live problem rather than a v24 problem. First, `nx.json` already registers
`@nx/eslint/plugin` and `@nx/jest/plugin` under the target names `lint` and `test`, so every
project already has an Inferred Target that its Declared Target silently overrides: each target is
defined twice. Second, the pile grows by copying, not generating. `libs/email-shell` (added
2026-08-20) was scaffolded by the generator and declares no `lint` or `test` target.
`libs/web/pages/vault` (added four days later) declares both, copied from its sibling page
libraries. The generators already emit the target state; the siblings do not.

The Nx Skill's rule against hand-editing `project.json` was read as contradicting the 52 targets.
It is a rule about scaffolding and fixes — generate a project, fix generator inputs rather than the
generated file — and says nothing about target shape. It needed a scope, not a reversal.

## Decision

1. **Inferred Targets are the target state.** A Declared Target on an `@nx/*` executor is migration
   debt to be removed before v24, not a pattern to follow. `project.json` keeps tags,
   `nx:run-commands` targets, and option overrides a tool's own config file cannot express.

2. **Growth stops first, by a ratchet, not by prose.** A checker holds a baseline of today's
   Declared Targets on `@nx/*` executors and fails on any target not in it and on any stale entry,
   so the list can only shrink. Prose already failed: the vault library copied the pattern while
   the Skill rule existed.

3. **Order of work: Jest and ESLint on Nx 22; Playwright and build/serve with the v23 hop.**
   - Jest and ESLint inference is already active at 22.7.7 and does not change at the hop, so
     removing those 45 overrides need not wait.
   - Playwright and the four build/serve targets carry non-default options (backend webpack's
     `externalDependencies`, `generatePackageJson`, and `compiler`; the Next.js production and
     development configurations) that no plugin reproduces by deletion. Each needs study, and that
     study is tied to the deprecated `withNx` and `composePlugins` helpers in `next.config.js` and
     `webpack.config.js`, which v24 also removes. Doing it on 22 risks doing it again at the hop.

## Considered Options

- **Executors as a documented deliberate exception.** Rejected. v24 removes them on a published
  schedule, so the exception defers a cost with a date and keeps every `lint` and `test` defined
  twice until then.
- **A permanent split: Jest and ESLint inferred, build/serve declared.** Rejected as an end state.
  It names an exception v24 abolishes. It survives only as the order of work in decision 3.

## Consequences

- Removing an ESLint override is not a pure deletion. The inferred target runs `eslint .` from the
  project root (`node_modules/@nx/eslint/src/plugins/plugin.js`), while 25 Declared Targets narrow
  it with `lintFilePatterns` — `libs/core` lints only `src/**/*.ts`. Gate Coverage widens to config
  files and specs, and may surface failures that were never reached. That widening is a gain, and
  it lands as its own slice so new failures read as its consequence rather than as noise.
- Removing a Jest override is not a pure deletion either. 15 projects set `passWithNoTests: true` on
  the executor; the inferred target runs bare `jest`, so the option moves into that project's
  `jest.config.ts` or a project with no tests starts failing.
- Target names stay stable. CI, Husky, and root scripts invoke `lint`, `test`, `build`, and `serve`
  by name, and `check-nx-project-tags.mjs` reads only `tags`, so nothing downstream observes which
  kind of target answers.
- The next Nx work item is the v23 hop, and it carries the Playwright and build/serve group of
  decision 3 rather than a separate migration.
