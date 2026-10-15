/*
 * MyOrganiser service worker (ADR 0127, PRD #1114).
 *
 * Its only job is to show the offline page when a navigation fails. It holds
 * the offline page and the static files that page needs to render, and nothing
 * else: no page of the app, no framework data response, no API response, and
 * nothing belonging to a User. Caching any of those is a separate design, not
 * an improvement to make here in passing.
 *
 * Hand-written, with no library and no build step. The framework's static
 * files carry a content hash in their names, so they cannot be listed here;
 * the worker reads them out of the offline page's own HTML.
 *
 * This file does not change between deployments, so a browser does not install
 * it again after one. The worker therefore stores the offline page again after
 * the first navigation that succeeds each time it starts, which is how a new
 * deployment's offline page replaces the old one.
 */

/* eslint-disable no-restricted-globals -- `self` is a service worker's global scope */

const OFFLINE_URL = '/offline';
const STATIC_PREFIX = '/_next/static/';

// Bump the suffix when the worker's behaviour changes. The offline page's own
// content needs no bump: see the note on deployments above.
const CACHE_PREFIX = 'myorganiser-offline-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;

// Same-origin static files named anywhere in the offline page's HTML: its
// stylesheet and script tags, and the chunk paths in its inline payload.
const STATIC_URL_PATTERN = /\/_next\/static\/[^"'\\\s<>)]+/g;

async function storeOfflinePage() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(new Request(OFFLINE_URL, { cache: 'reload' }));
  // A redirected response cannot answer a navigation, so it is not stored.
  if (!response.ok || response.redirected) {
    throw new Error(`Offline page responded ${response.status}`);
  }

  const html = await response.clone().text();
  const assets = [...new Set(html.match(STATIC_URL_PATTERN) ?? [])];

  await cache.addAll(
    assets.map((url) => new Request(url, { cache: 'reload' })),
  );
  await cache.put(OFFLINE_URL, response);

  // Only after the new set is stored, drop any file the offline page no
  // longer names, so a failed attempt leaves the previous set intact.
  const wanted = new Set(
    [OFFLINE_URL, ...assets].map((url) => new URL(url, self.location).href),
  );
  const stored = await cache.keys();
  await Promise.all(
    stored
      .filter((entry) => !wanted.has(entry.url))
      .map((entry) => cache.delete(entry)),
  );
}

self.addEventListener('install', (event) => {
  // Take over without waiting for open tabs to close. That is safe only
  // because this worker serves no application code.
  self.skipWaiting();
  event.waitUntil(storeOfflinePage());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

async function fromStore(key) {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(key);
}

// Always the network first, so an online browser gets exactly what it would
// get without a worker. The store answers only when the network fails or no
// longer has the file (a stored offline page from before a deployment names
// files the new deployment does not serve), and it holds only the offline
// page's files, so nothing else is ever served from it.
async function networkThenStoredStaticFile(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      return response;
    }
    return (await fromStore(request.url)) ?? response;
  } catch {
    return (await fromStore(request.url)) ?? Response.error();
  }
}

// Once per worker start: see the note on deployments at the top of the file.
let storedSinceStart = false;

async function navigate(event) {
  let response;
  try {
    response = await fetch(event.request);
  } catch {
    return (await fromStore(OFFLINE_URL)) ?? Response.error();
  }

  if (!storedSinceStart) {
    storedSinceStart = true;
    // A failure here keeps the previous set; the next start tries again.
    event.waitUntil(storeOfflinePage().catch(() => undefined));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.mode === 'navigate') {
    event.respondWith(navigate(event));
    return;
  }

  const url = new URL(request.url);
  if (
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    url.pathname.startsWith(STATIC_PREFIX)
  ) {
    event.respondWith(networkThenStoredStaticFile(request));
    return;
  }

  // Everything else is left to the browser: no respondWith, so the worker
  // never answers a request to the API or any other origin.
});
