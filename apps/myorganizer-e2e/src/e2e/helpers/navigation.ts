import { Page } from '@playwright/test';

/**
 * Navigate to `url`, retrying when Playwright aborts the navigation because a
 * concurrent client-side navigation interrupted it. Any other error rethrows
 * immediately. Extracted from 7 duplicate copies (issue #292).
 */
export async function gotoStable(
  page: Page,
  url: string,
  options?: Parameters<Page['goto']>[1],
): Promise<void> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await page.goto(url, options);
      return;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (
        message.includes('Navigation to') &&
        message.includes('is interrupted by another navigation') &&
        attempt < maxAttempts
      ) {
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(250);
        continue;
      }
      throw e;
    }
  }
}
