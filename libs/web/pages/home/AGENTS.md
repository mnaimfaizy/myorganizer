# Home Page Agent Guide

## Scope

Root (`/`) landing page library. Includes the auth-aware redirect that sends already-authenticated users to `/dashboard`.

## Do

- Keep the landing page and the authenticated redirect gate in this library.
- Preserve the import path `@myorganizer/web-pages/home`.

## Do Not

- Do not send unauthenticated visitors to `/dashboard`.
- Do not move this redirect into the Next app wrapper.
