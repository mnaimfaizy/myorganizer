import { Page } from '@playwright/test';

/**
 * True when Playwright aborted `page.goto` because a concurrent client-side
 * navigation interrupted it. This is the only class `gotoStable` retries.
 *
 * Engine-internal failures such as `WebKit encountered an internal error` are
 * not this class: they rethrow immediately so nightly `--fail-on-flaky-tests`
 * still sees them (issue #703, ADR 0090).
 */
export function isInterruptedNavigationError(message: string): boolean {
  return (
    message.includes('Navigation to') &&
    message.includes('is interrupted by another navigation')
  );
}

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
      if (isInterruptedNavigationError(message) && attempt < maxAttempts) {
        // The interrupting navigation is the thing to wait on: once it has a
        // document, the retry has a stable page to load into. `networkidle`
        // plus a sleep waited on neither (issue #524).
        await page.waitForLoadState('domcontentloaded');
        continue;
      }
      throw e;
    }
  }
}
