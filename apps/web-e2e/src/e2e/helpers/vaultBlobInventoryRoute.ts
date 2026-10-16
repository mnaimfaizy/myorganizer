/**
 * The mock `GET /vault/blobs` — the Vault Blob Inventory every vault spec now
 * has to answer.
 *
 * A Vault Pull Pass reads the inventory first and asks about a Vault Blob Type
 * only when the inventory says its Ciphertext differs from this device's Sync
 * Bookmark ([ADR 0087](../../../../../docs/adr/0087-a-vault-pull-pass-asks-the-vault-blob-inventory-and-absence-deletes-nothing.md)).
 * There is no fallback: a pass that cannot read the inventory reads nothing at
 * all. So a spec that mocks the per-blob routes and not this one has no
 * working pull pass, and an unmocked request escapes to the real backend,
 * where it 401s the fake token and takes the test session with it — the same
 * failure `vaultBlobRoutes.ts` exists to prevent one endpoint over.
 *
 * The inventory is derived from whatever Ciphertext the spec's own in-memory
 * server already holds rather than configured beside it, because an inventory
 * that can disagree with the blobs it lists is a fixture that can lie: a type
 * the spec pushed would stay unlisted, the pass would never ask about it, and
 * the spec would fail somewhere that says nothing about why.
 */
import { Page, Request } from '@playwright/test';

import { routeApi } from './apiStub';

/**
 * What the mock server holds for one User, in the shape every vault spec
 * already keeps it: Ciphertext, ETag and update time, each keyed by Vault Blob
 * Type.
 *
 * Deliberately indexed by `string` rather than by `VaultBlobType`: that is how
 * the specs declare their state, and the inventory reports the types that are
 * there rather than checking a list against the enum.
 */
export type VaultBlobInventoryState = {
  blobs: Record<string, unknown>;
  etags: Record<string, string | undefined>;
  updatedAt: Record<string, string | undefined>;
};

/**
 * Route matcher for the relative `/vault/blobs` URL.
 *
 * Exported for specs that track request patterns to verify ADR 0087 compliance.
 */
export function vaultBlobInventoryRouteRelative(): RegExp {
  return /\/vault\/blobs\/?(\?.*)?$/;
}

/**
 * Route matcher for absolute URLs with optional API versioning — the form the
 * specs that anchor their stubs to the API host use.
 */
export function vaultBlobInventoryRouteAbsolute(): RegExp {
  return /:\/\/[^/]+\/(?:api\/v\d+\/)?vault\/blobs\/?(\?.*)?$/;
}

/** One Vault Blob Type as the inventory names it. */
type VaultBlobInventoryEntry = {
  type: string;
  etag: string;
  updatedAt: string;
};

/**
 * The body `GET /vault/blobs` answers with, derived from what the mock holds.
 *
 * A type with no Ciphertext is left out, which is what makes absence mean
 * "nothing to pull" here exactly as it does on the server. The ETag is built
 * from the members' so it moves when, and only when, one of them does — the
 * property the real endpoint gets from hashing them.
 */
function vaultBlobInventoryBody(state: VaultBlobInventoryState): {
  etag: string;
  blobs: VaultBlobInventoryEntry[];
} {
  const blobs = Object.keys(state.blobs)
    .filter((type) => Boolean(state.blobs[type]))
    .sort()
    .map((type) => ({
      type,
      etag: state.etags[type] ?? '',
      updatedAt: state.updatedAt[type] ?? new Date(0).toISOString(),
    }));

  const members = blobs
    .map((entry) => `${entry.type}=${entry.etag}`)
    .join('|')
    // An ETag value carries no double quotes of its own, and the per-blob
    // ETags these are built from are written `W/"…"`.
    .replace(/"/g, '');

  return { etag: `W/"inventory:${members}"`, blobs };
}

/**
 * Register the Vault Blob Inventory stub for one page.
 *
 * `state` is read per request rather than captured once, so the inventory
 * reflects every push the spec has made by the time a pass asks. It returns
 * `null` for a request carrying no usable Session, which is answered 401 the
 * way the per-blob stub answers one.
 */
export async function routeVaultBlobInventory(
  page: Page,
  options: {
    /** Defaults to the relative matcher; pass the absolute one to anchor it. */
    url?: RegExp;
    /** The CORS headers to answer with, read per request like `state`. */
    headers: () => Record<string, string>;
    state: (request: Request) => VaultBlobInventoryState | null;
  },
): Promise<void> {
  await routeApi(
    page,
    options.url ?? vaultBlobInventoryRouteRelative(),
    async (route) => {
      const request = route.request();
      const headers = allowConditionalRead(options.headers());

      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }

      if (request.method() !== 'GET') {
        await route.fulfill({ status: 405, headers });
        return;
      }

      const state = options.state(request);
      if (!state) {
        await route.fulfill({
          status: 401,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid token format' }),
        });
        return;
      }

      const body = vaultBlobInventoryBody(state);

      if (request.headers()['if-none-match'] === body.etag) {
        // WebKit's Playwright route layer cannot fulfill with redirect-class statuses
        // (304, 301, etc.). When the ETag matches, answer 304 on Chromium and Firefox,
        // but 200 with the same body on WebKit. The client treats an unchanged 200
        // inventory the same as a 304 because every inventory etag equals its Sync
        // Bookmark, so zero per-type reads follow in both cases.
        const browserName = page.context().browser()?.browserType().name();
        if (browserName === 'webkit') {
          await route.fulfill({
            status: 200,
            headers,
            contentType: 'application/json',
            body: JSON.stringify(body),
          });
        } else {
          await route.fulfill({ status: 304, headers });
        }
        return;
      }

      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    },
  );
}

/**
 * Add `if-none-match` to whatever CORS headers the spec supplied.
 *
 * The specs allow `if-match` — a push condition — and nothing lists the read
 * condition, because until now no stub answered one: the per-blob stub ignores
 * `If-None-Match` and always returns the blob. The inventory read is
 * conditional by design, and the app and the API are different origins in
 * these runs, so a preflight that does not name the header fails the request
 * this stub exists to answer.
 */
function allowConditionalRead(
  headers: Record<string, string>,
): Record<string, string> {
  const allowed = headers['access-control-allow-headers'];
  if (!allowed || allowed.includes('if-none-match')) return headers;
  return {
    ...headers,
    'access-control-allow-headers': `${allowed},if-none-match`,
  };
}

/**
 * Register the inventory stub over a spec's in-memory per-blob store — the
 * shape every single-User vault spec has: CORS headers built from the page's
 * own origin, and the three per-type maps the per-blob stub already writes.
 *
 * Reads the maps per request, so every push the spec's per-blob stub records
 * is in the next inventory.
 */
export function routeVaultBlobInventoryOverStore(
  page: Page,
  store: {
    /** Defaults to the relative matcher, as {@link routeVaultBlobInventory}. */
    url?: RegExp;
    /** The spec's CORS headers for a given origin. */
    cors: (origin: string) => Record<string, string>;
    blobs: VaultBlobInventoryState['blobs'];
    etags: VaultBlobInventoryState['etags'];
    updatedAt: VaultBlobInventoryState['updatedAt'];
  },
): Promise<void> {
  return routeVaultBlobInventory(page, {
    url: store.url,
    headers: () =>
      store.cors(new URL(page.url() || 'http://localhost:3000').origin),
    state: () => ({
      blobs: store.blobs,
      etags: store.etags,
      updatedAt: store.updatedAt,
    }),
  });
}
