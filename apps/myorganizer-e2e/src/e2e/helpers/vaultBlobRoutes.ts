/**
 * Helper to derive Vault Blob Type route matchers from the generated API enum.
 *
 * This module exists to eliminate hand-enumerated blob-type alternations that have
 * drifted into inconsistency across 10+ E2E test files. When an unmocked blob type
 * request reaches the real backend, it 401s the fake token, triggers /auth/refresh
 * (also unmocked), and destroys the test session. By deriving these patterns from
 * VaultBlobType (the generated const enum), a new blob type flows through automatically.
 *
 * Use these functions to construct route-matching regexes in Playwright mock routes.
 */

import { VaultBlobType } from '@myorganizer/app-api-client';

/**
 * Constructs the alternation of blob type segments from the generated enum.
 * Returns e.g. 'addresses|groceries|mobileNumbers|subscriptions|tasks|todos'
 */
function blobTypeAlternation(): string {
  return Object.values(VaultBlobType).join('|');
}

/**
 * Route matcher for relative `/vault/blob/<type>` URLs.
 * Example: `/\/vault\/blob\/(addresses|groceries|...)\/?(\?.*)?$/`
 */
export function vaultBlobRouteRelative(): RegExp {
  return new RegExp(`/vault/blob/(${blobTypeAlternation()})/?(\\?.*)?$`);
}

/**
 * Route matcher for absolute URLs with optional API versioning.
 * Example: `/:\/\/[^/]+\/(?:api\/v\d+\/)?vault\/blob\/(addresses|groceries|...)\/?(\?.*)?$/`
 */
export function vaultBlobRouteAbsolute(): RegExp {
  return new RegExp(
    `://[^/]+/(?:api/v\\d+/)?vault/blob/(${blobTypeAlternation()})/?(\\?.*)?$`,
  );
}

/**
 * Bare extractor pattern for checking if a URL contains a vault blob request.
 * Example: `/\/vault\/blob\/(addresses|groceries|...)/`
 * Use when the full route pattern is handled separately and you only need type extraction.
 */
export function vaultBlobTypeExtractor(): RegExp {
  return new RegExp(`/vault/blob/(${blobTypeAlternation()})`);
}
