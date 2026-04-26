# Approved Project-Scope External Skills

These are the exact third-party skills approved for project-scope install in MyOrganizer. They complement the repo-native skills in this directory and are meant to add fast-moving framework knowledge the repo should not duplicate.

Exact package and skill names below were verified with `npx skills find` on April 26, 2026.

## Default Install Set

- Next.js:
  - `vercel-labs/next-skills@next-best-practices`
  - `vercel-labs/next-skills@next-cache-components`
- React and frontend composition:
  - `vercel-labs/agent-skills@vercel-react-best-practices`
  - `vercel-labs/agent-skills@vercel-composition-patterns`
- Frontend design:
  - `anthropics/skills@frontend-design`
  - `vercel-labs/agent-skills@web-design-guidelines`
- Node.js and Express-style backend patterns:
  - `wshobson/agents@nodejs-backend-patterns`
- Tailwind CSS:
  - `wshobson/agents@tailwind-design-system`
- Playwright:
  - `currents-dev/playwright-best-practices-skill@playwright-best-practices`
- GitHub Actions:
  - `xixu-me/skills@github-actions-docs`

## Optional Add-Ons

- `shadcn/ui@shadcn`
  - Add only if the task is actively editing shadcn-style components.
- `obra/superpowers@systematic-debugging`
  - Add only when the work is debugging-heavy and the extra workflow help is worth the additional skill surface.

## Install Commands

Install the default set:

```sh
npx skills add vercel-labs/next-skills --skill next-best-practices next-cache-components -y
npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices vercel-composition-patterns web-design-guidelines -y
npx skills add anthropics/skills --skill frontend-design -y
npx skills add wshobson/agents --skill nodejs-backend-patterns tailwind-design-system -y
npx skills add currents-dev/playwright-best-practices-skill --skill playwright-best-practices -y
npx skills add xixu-me/skills --skill github-actions-docs -y
```

Install optional add-ons only when justified:

```sh
npx skills add shadcn/ui --skill shadcn -y
npx skills add obra/superpowers --skill systematic-debugging -y
```

Update project-level installs periodically:

```sh
npx skills update -p
```

## Deliberate Exclusions

- Generic duplicate packs with weaker fit or lower-signal descriptions are excluded.
- `verification-before-completion` is not in the default set because the publisher choice was not as clear as the other approved entries and this repo already encodes strong verification guidance locally.
- `typescript-advanced-types` is not in the default set because it is useful but not central to the day-to-day workflow of this codebase compared with the approved framework-specific skills above.
