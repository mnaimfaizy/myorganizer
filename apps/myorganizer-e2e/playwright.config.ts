import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

/** Opt out of the production build for fast local iteration (ADR 0050). */
const useDevServer = Boolean(process.env['E2E_DEV_SERVER']);

/**
 * The two modes listen on different ports, so that reusing a server can only
 * ever reuse one started for the mode asking.
 *
 * Sharing 4200 meant the dev loop would happily adopt a leftover production
 * server — or the one behind `yarn start:myorganizer` — and report a pass in
 * seconds without ever compiling the working tree. Distinguishing them by
 * inspecting the running server would be a heuristic against Next.js
 * internals; a port is a fact.
 *
 * A side effect worth having: `E2E_DEV_SERVER=1` no longer collides with a dev
 * server being used for manual work on 4200.
 */
const port = useDevServer ? 4201 : 4200;

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || `http://localhost:${port}`;

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src/e2e' }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /**
   * Serve the production build by default — locally as well as in CI.
   *
   * A dev-server suite is structurally blind to anything that only appears in
   * a shipped bundle, and switching only under CI would mean local green stops
   * meaning CI green. That divergence is real: `waitForLoadState('networkidle')`
   * hangs against a production build where it settles against dev. See
   * ADR 0050.
   *
   * Set `E2E_DEV_SERVER=1` for the fast local edit-run loop, accepting that it
   * no longer matches what CI runs.
   *
   * The production branch builds before it serves. `serve:production` runs
   * `next start` against whatever `dist/` already holds and never rebuilds it,
   * so without this the suite happily tests a stale bundle — a build three days
   * older than the branch under test read as "the feature does not exist",
   * costing an afternoon of misdiagnosis. Nx caches the build, so this is a
   * no-op when nothing changed, and CI (which builds in its own step) hits that
   * cache rather than paying twice. The dev branch is excluded deliberately: it
   * compiles on demand, so building there would be pure waste.
   */
  webServer: {
    command: useDevServer
      ? `corepack yarn nx run myorganizer:serve:development --port=${port}`
      : `corepack yarn nx run myorganizer:build:production && corepack yarn nx run myorganizer:serve:production --port=${port}`,
    url: baseURL,
    /**
     * Reuse is a dev-loop convenience, never a production-run one.
     *
     * Playwright skips `command` entirely when something already answers on
     * `url` — including the build above. Whatever is on the port gets tested
     * instead, and a `yarn start:myorganizer` dev server left running answers
     * exactly like the production build would, so a run that reports itself as
     * production silently is not one. That is the stale-bundle failure again,
     * one layer up: the suite tests something other than what it claims, and
     * says nothing.
     *
     * So the production path always starts its own server. If the port is
     * taken, Playwright fails with "already used, make sure that nothing is
     * running on the port" — stop that server and re-run. A refusal to start is
     * a worse afternoon than a stale pass only until the first stale pass.
     *
     * The dev branch keeps reuse, because there the running server is the
     * point — and it is now safe, because the port above guarantees the only
     * thing it can adopt is a dev server a previous dev run started.
     */
    reuseExistingServer: useDevServer && !process.env.CI,
    cwd: workspaceRoot,
    // A production build from cold costs far more than a dev boot.
    timeout: (useDevServer ? 120 : 300) * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
