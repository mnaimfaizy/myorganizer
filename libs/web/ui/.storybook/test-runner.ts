import type { TestRunnerConfig } from '@storybook/test-runner';
import { getStoryContext } from '@storybook/test-runner';

import {
  resolveViewportPageSize,
  type ViewportParameter,
} from './viewport-page-size';

/**
 * The test-runner loads every story into a Playwright page whose viewport it
 * never changes, so `parameters.viewport` has no effect on a play function.
 * Resizing in `preVisit` — before the story renders — lets width-sensitive
 * hooks read the right width on their first effect.
 */
const config: TestRunnerConfig = {
  async preVisit(page, context) {
    const storyContext = await getStoryContext(page, context);
    const viewport = storyContext.parameters?.['viewport'] as
      | ViewportParameter
      | undefined;

    await page.setViewportSize(resolveViewportPageSize(viewport));
  },
};

export default config;
