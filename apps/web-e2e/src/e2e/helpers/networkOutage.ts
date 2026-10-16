import type { BrowserContext } from '@playwright/test';

/**
 * Per-context outage state. The route below reads `down` on every request, so
 * bringing the network back turns it into a pass-through without unrouting.
 */
type Outage = { down: boolean };

const outages = new WeakMap<BrowserContext, Outage>();

/**
 * Take the network down for a browser context, or bring it back. Both layers
 * are needed; do not reduce this to `context.setOffline()` alone.
 *
 * - `context.setOffline()` flips `navigator.onLine` and makes the browser fire
 *   `offline` / `online`. The offline page's recovery depends on those events.
 * - The context-level route aborts every request while down. This is what
 *   makes the outage real for the service worker.
 *
 * Why `setOffline` alone is not enough (verified on Chromium against a
 * production build): once the worker controls the page, `setOffline(true)`
 * cuts the page's own requests and the first offline navigation fails as
 * expected. But the worker's `fetch(request)` calls for navigations still reach
 * the real server, so a reload or second navigation "while offline" returns the
 * real page instead of the offline page. Dropping the route makes those
 * assertions fail for a reason that looks like a product bug, not a test bug.
 *
 * The route is registered on the first outage and kept for the rest of the
 * context; a context that never goes down never registers it, so pass-through
 * tests (API stubs) are unaffected. Bringing the network back only clears the
 * flag. Each context is closed at teardown, which removes the route.
 */
export async function setNetworkDown(
  context: BrowserContext,
  down: boolean,
): Promise<void> {
  const existing = outages.get(context);
  if (existing) {
    existing.down = down;
  } else if (down) {
    const outage: Outage = { down: true };
    outages.set(context, outage);
    await context.route('**/*', async (route) => {
      if (outage.down) {
        await route.abort('internetdisconnected');
      } else {
        await route.fallback();
      }
    });
  }
  await context.setOffline(down);
}
