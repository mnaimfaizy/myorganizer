# Approved Third-Party Skills

Third-party skills approved for use in MyOrganizer. They add fast-moving framework knowledge the repo should not duplicate.

**Tiers below name the install scope, not how strongly a skill is recommended.** Scope is the property that decides whether a skill can be routed to: a project-scope skill is in every clone and may be referenced by name, while a personal-scope skill exists only on machines whose owner installed it. See [ADR 0030](../../docs/adr/0030-upstream-owned-skills-are-project-scope.md).

Exact package and skill names were verified with `npx skills find` on April 26, 2026. `GoogleChrome/modern-web-guidance@modern-web-guidance` was verified against upstream documentation and a disposable install on August 15, 2026; see the [evaluation](../../docs/internal/modern-web-guidance-evaluation.md). The `mattpocock/skills` entries were verified by a sandbox install on August 19, 2026.

## Project Scope — Upstream-Owned, committed

Installed into `.agents/skills/` and committed. These are **Upstream-Owned Skills** (`CONTEXT.md`): never hand-edit them, and refresh them only through the CLI. `skills-lock.json` is the registry — `check-skill-map.mjs` reads it to decide which directories are ours.

- `GoogleChrome/modern-web-guidance@modern-web-guidance`
- `mattpocock/skills@codebase-design`
- `mattpocock/skills@diagnosing-bugs`
- `mattpocock/skills@domain-modeling`
- `mattpocock/skills@handoff`
- `mattpocock/skills@prototype`

Repo-native skills may route to these by name and may link into them by relative path; the check asserts those links still resolve after an update.

```sh
npx skills add GoogleChrome/modern-web-guidance --skill modern-web-guidance -y
npx skills add mattpocock/skills --skill codebase-design diagnosing-bugs domain-modeling handoff prototype -y
```

Refresh them, review the diff, and commit it:

```sh
npx skills update -p
```

## Personal Scope — recommended, not committed

Install with `-g` on your own machine. They are **not** in a fresh clone and **not** in CI, so no repo skill may depend on one: reference them as on-ramps a human chooses, never as a required hop in a chain, and never by relative path.

- Next.js: `vercel-labs/next-skills@next-best-practices`, `vercel-labs/next-skills@next-cache-components`
- React and frontend composition: `vercel-labs/agent-skills@vercel-react-best-practices`, `vercel-labs/agent-skills@vercel-composition-patterns`
- Frontend design: `anthropics/skills@frontend-design`, `vercel-labs/agent-skills@web-design-guidelines`
- Node.js and Express-style backend patterns: `wshobson/agents@nodejs-backend-patterns`
- Tailwind CSS: `wshobson/agents@tailwind-design-system`
- Playwright: `currents-dev/playwright-best-practices-skill@playwright-best-practices`
- GitHub Actions: `xixu-me/skills@github-actions-docs`

```sh
npx skills add vercel-labs/next-skills --skill next-best-practices next-cache-components -g -y
npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices vercel-composition-patterns web-design-guidelines -g -y
npx skills add anthropics/skills --skill frontend-design -g -y
npx skills add wshobson/agents --skill nodejs-backend-patterns tailwind-design-system -g -y
npx skills add currents-dev/playwright-best-practices-skill --skill playwright-best-practices -g -y
npx skills add xixu-me/skills --skill github-actions-docs -g -y
```

## Personal Scope — situational

Same rules as above; install only when the work calls for it.

- `mattpocock/skills@wayfinder`
  - When an effort is too foggy to write a PRD goal sentence for. The seam is that sentence: `/wayfinder` while you cannot write it, `/to-prd` once you can ([ADR 0029](../../docs/adr/0029-wayfinder-is-an-approved-external-not-a-repo-skill.md)).
- `shadcn/ui@shadcn`
  - Only when actively editing shadcn-style components.
- `obra/superpowers@systematic-debugging`
  - Only when the work is debugging-heavy and the extra workflow surface earns its context.

```sh
npx skills add mattpocock/skills --skill wayfinder -g -y
npx skills add shadcn/ui --skill shadcn -g -y
npx skills add obra/superpowers --skill systematic-debugging -g -y
```

## Deliberate Exclusions

- Generic duplicate packs with weaker fit or lower-signal descriptions are excluded.
- `verification-before-completion` is excluded because the publisher choice was not as clear as the approved entries and this repo already encodes strong verification guidance locally.
- `typescript-advanced-types` is excluded because it is useful but not central to this codebase's day-to-day work compared with the approved framework-specific skills.
