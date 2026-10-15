# Download Page Agent Guide

## Scope

The public `/download` page: the one stable address for the newest Mobile Release (Android APK) and the iPhone and iPad Home Screen steps. Signed out, outside `/dashboard`.

## Do

- Build every link from `CURRENT_MOBILE_RELEASE` through `mobileReleaseLinks()` in `src/lib/mobileRelease.ts`.
- Keep the page reachable without a session. No auth hooks.
- Preserve the import path `@myorganizer/web-pages/download`.
- Publish a new Mobile Release with `yarn mobile:release:publish`; it rewrites the `CURRENT_MOBILE_RELEASE` line, and the page moves with it.

## Do Not

- Do not hard-code a version or a GitHub URL in a component.
- Do not edit the `CURRENT_MOBILE_RELEASE` line by hand; the publish command finds it by its name.
- Do not describe iOS as an app download. iOS Users are served by the Installed Web App.
