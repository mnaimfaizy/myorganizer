# Storybook and Chromatic Setup

This project uses [Storybook](https://storybook.js.org/) for developing and showcasing UI components in isolation, and [Chromatic](https://www.chromatic.com/) for visual testing and review.

## Local Development

### Running Storybook

To start the Storybook development server:

```bash
yarn storybook
```

This will start Storybook on `http://localhost:4400` (default port may vary).

Alternatively, you can use the Nx command directly:

```bash
npx nx storybook web-ui
```

### Building Storybook

To build a static version of Storybook:

```bash
yarn build-storybook
```

The static files will be generated in `libs/web-ui/storybook-static/`.

## Writing Stories

> **Authoring patterns live in [`docs/ui/STORYBOOK-PATTERNS.md`](../ui/STORYBOOK-PATTERNS.md)** — compound-component wrappers, controlled primitives, Radix portals, `play` functions, required coverage, accessibility, and the anti-pattern table. This file covers setup and commands only.

Stories are located alongside components in the `libs/web-ui/src/lib/components/` directory.

### AI Delegation Workflow

When using AI agents for Storybook tasks, route requests through the Storybook delegation workflow instead of editing stories inline in the main agent context.

- Skill: `.agents/skills/storybook-delegation-workflow/SKILL.md`
- Copilot sub-agent: `.github/agents/storybook-curator.agent.md`
- Claude sub-agent: `.claude/agents/storybook-curator.md`
- Gemini sub-agent: `.gemini/agents/storybook-curator.md`

The sub-agent must analyze requirement quality before file edits, request clarification when requirements are incomplete, and may challenge weak requirements to keep UX/accessibility quality high.

### Example Story Structure

Create a file with the `.stories.tsx` extension next to your component:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { YourComponent } from './YourComponent';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
  title: 'Components/YourComponent',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof YourComponent>;

export const Default: Story = {
  args: {
    // component props
  },
};
```

See `libs/web-ui/src/lib/components/Button/Button.stories.tsx` for a complete example of a single component with variants, and `Dialog/Dialog.stories.tsx` for a compound component. Note that the shape above only works for single components — a compound component needs the wrapper pattern (`STORYBOOK-PATTERNS.md` §4).

## Chromatic Integration

Chromatic **publishes** Storybook from CI; visual review is Chromatic’s GitHub status **UI Tests** (pending until Accept/Deny). It is not a local visual-test runner: the CLI always uploads Storybook to Chromatic cloud. Policy: [ADR 0027](../adr/0027-chromatic-ci-visual-tests.md). Quota math and GitHub sign-in: [docs/research/2026-08-18-chromatic-free-tier-ci.md](../research/2026-08-18-chromatic-free-tier-ci.md).

CI calls `yarn chromatic` with repository secret `CHROMATIC_PROJECT_TOKEN`. Config lives in `chromatic.config.json` (TurboSnap `onlyChanged`, Storybook at `libs/web-ui/.storybook`, Tailwind listed as `externals`). `yarn build-storybook` passes `--skip-nx-cache` because Chromatic builds into `os.tmpdir()` and Nx refuses to cache outputs outside the workspace. Do **not** run `yarn chromatic` on a laptop unless you are debugging an upload.

### HITL: first Chromatic project

Follow Chromatic’s own [Quickstart](https://www.chromatic.com/docs/quickstart/) (CLI + cloud, not the Visual Tests Storybook addon). Do this **before** merging the Chromatic job to `main`. Until `CHROMATIC_PROJECT_TOKEN` exists, that job fails CI (intentional).

**Official 1 — Sign up and create a project.** Open [chromatic.com/start](https://www.chromatic.com/start) and sign in with **GitHub** (GitLab, Bitbucket, or email also work). Create a project. Chromatic shows a project token on the setup screen as:

```bash
npx chromatic --project-token <your-project-token>
```

Copy the token. You can also find it later under the project’s **Manage** page. Do **not** install `@chromatic-com/storybook` (Visual Tests addon) — this repo uses the CLI in CI.

**Official 2 — Install.** Already done (`chromatic` is in `package.json`; script is `"chromatic": "chromatic"`). If the CLI offers to write the token into `package.json`, decline. The token belongs in a GitHub secret.

**Official 3 — First build (baselines).** Chromatic’s docs run `yarn chromatic --project-token <your-project-token>`. That uploads Storybook and captures the first snapshots. Either:

- Put the token in GitHub now (step below) and let the next `CI` run be that first build, or
- Run the official command once locally, then still add the same token as the GitHub secret.

**Official 4–6 — Review and merge.** Unreviewed diffs appear in Chromatic. **Accept** turns Chromatic’s **UI Tests** GitHub check green (baseline updates, no recapture). **Deny** turns it red. Do **not** re-run the Actions publish job after Accept — that recaptures snapshots. Pushes to `main` and `release/**` auto-accept in our CI.

**Official 7 — require “UI Tests”.** Chromatic’s quickstart tells you to require the GitHub **UI Tests** check. **Do that.** It is the pending → green/red review gate. The Actions job **Publish to Chromatic** only uploads; it passes on unreviewed diffs (`--exit-zero-on-changes`) so a re-run is not needed. Quota pause (CLI exit `11`) still greens the publish job; if **UI Tests** stays pending that month, temporarily drop it from required checks.

**This repo, after the token exists**

1. GitHub → **Settings → Secrets and variables → Actions → New repository secret**. Name: `CHROMATIC_PROJECT_TOKEN`. Not an Environment secret.
2. GitHub → **Settings → Branches** (or Rulesets) → add required status check **UI Tests** (Chromatic’s check, not the Actions publish job).
3. Stay on **Free**. Chrome only; do not enable extra browsers or Chromatic accessibility tests; do not add `parameters.chromatic` viewports/modes.
4. Chromatic **Billing**: usage alert around **4,000** billed snapshots. At the 5k cap, the publish job **warns and stays green** (CLI exit `11`).
5. TurboSnap is already in `chromatic.config.json`. Chromatic only applies it after **ten successful CI builds**.

### Running Chromatic locally (debug only)

```bash
CHROMATIC_PROJECT_TOKEN=… yarn chromatic
```

This still **uploads** a cloud build. It does not replace the CI check and burns snapshot quota. Prefer `yarn storybook` while authoring.

## Project Structure

```
libs/web-ui/
├── .storybook/
│   ├── main.ts              # Storybook configuration
│   ├── preview.ts           # Global decorators and parameters
│   └── preview-styles.css   # Global styles (Tailwind CSS)
├── src/
│   └── lib/
│       └── components/
│           └── Button/
│               ├── Button.tsx
│               └── Button.stories.tsx
├── tailwind.config.js       # Tailwind configuration
└── postcss.config.js        # PostCSS configuration
```

## Available Storybook Addons

The following addons are pre-configured:

- **@storybook/addon-essentials**: Essential addons including:
  - Controls: Dynamic component prop editing
  - Actions: UI feedback for component events
  - Docs: Auto-generated documentation
  - Viewport: Responsive design testing
  - Backgrounds: Background color testing
  - Toolbars: Custom toolbar buttons
  - Measure & Outline: Layout debugging

- **@storybook/addon-interactions**: Testing user interactions

## Next Steps

1. Add stories for any new UI Primitive or Vault UI Component (see [STORYBOOK-PATTERNS.md](../ui/STORYBOOK-PATTERNS.md)).
2. Keep Chromatic on the free plan: Chrome only, no extra modes, TurboSnap after the first ten CI builds.

## Useful Commands

| Command                          | Description                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `yarn storybook`                 | Start Storybook dev server                                                                         |
| `yarn build-storybook`           | Build static Storybook (Vite stats JSON; skips Nx cache so Chromatic’s temp output-dir is allowed) |
| `yarn chromatic`                 | CI / debug upload to Chromatic (needs token)                                                       |
| `npx nx test-storybook web-ui`   | Run interaction tests                                                                              |
| `npx nx static-storybook web-ui` | Serve built Storybook                                                                              |

## Troubleshooting

### Styles not loading

Make sure Tailwind CSS is configured properly:

- Check `libs/web-ui/tailwind.config.js` includes Storybook paths
- Verify `libs/web-ui/.storybook/preview-styles.css` is imported in `preview.ts`

### Chromatic CI fails with “Cache output is outside the workspace”

Chromatic runs `yarn build-storybook --output-dir=/tmp/chromatic-…`. The Nx Storybook target caches `{options.output-dir}`, and Nx errors when that path is outside the repo. Keep `--skip-nx-cache` on the `build-storybook` script.

### Actions job red after Accept in Chromatic

Do **not** re-run **Publish to Chromatic**. Chromatic’s **UI Tests** check is the review gate: pending until Accept (green) or Deny (red). Re-running recaptures snapshots. The publish job must use `--exit-zero-on-changes`.

### Component not rendering

- Ensure the component is exported from `libs/web-ui/src/index.ts`
- Check that the story file follows the `*.stories.tsx` naming convention
- Verify the story file is in the `libs/web-ui/src/lib/` directory

## Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Chromatic Documentation](https://www.chromatic.com/docs/)
- [Nx Storybook Plugin](https://nx.dev/recipes/storybook)
