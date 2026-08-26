import { Page, Route } from '@playwright/test';

/**
 * Register an API stub that never intercepts document navigations.
 *
 * Several stub patterns are deliberately origin-agnostic — `/\/vault\/?$/`,
 * `/\/admin\/users\/?$/` — so they match the backend wherever it is served
 * from. That also makes them match the app's own routes: navigating to
 * `/dashboard/vault` or `/admin/users` produced a document request that the
 * stub fulfilled with the API's JSON body, so the page under test never
 * rendered and every selector on it timed out (issue #506).
 *
 * API stubs only ever need to answer fetch/XHR, so document requests are
 * handed back to Next.js untouched.
 */
export async function routeApi(
  page: Page,
  url: Parameters<Page['route']>[0],
  handler: (route: Route) => Promise<void> | void,
): Promise<void> {
  await page.route(url, async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fallback();
      return;
    }

    await handler(route);
  });
}
