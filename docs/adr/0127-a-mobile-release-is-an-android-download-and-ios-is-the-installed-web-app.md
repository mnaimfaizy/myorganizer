# A Mobile Release is an Android download, and iOS is served by the Installed Web App

## Status

accepted

## Context

[ADR 0114](0114-a-mobile-release-ships-in-1-0-what-it-cannot-learn-later.md) and PRD #956 were written on 2026-09-30 for a first Mobile Release to Google Play and the App Store. On 2026-10-11 the operator decided not to publish to either store.

Android installs an APK from any download. iOS does not: an `.ipa` runs only on a device Apple has signed it for, so a public download link installs for nobody. The remaining iOS routes were a sideloaded build each User re-signs every seven days, or a TestFlight public link, which needs the paid developer programme and Apple's beta review.

The repository still holds a complete iOS React Native project, and ADR 0114 and `docs/deployment/MOBILE_RELEASE_PROCESS.md` still speak of store approval. Without this record a reader would assume the iOS build is meant to ship.

## Decision

1. **A Mobile Release is a signed Android APK published on a GitHub Release**, tagged `mobile-vX.Y.Z`, with its checksum beside it. Anyone may download it. No store is involved.
2. **iOS Users are served by the Installed Web App** (CONTEXT.md): the web app, installed from the browser to the Home Screen. It is the web app under the web app's rules. It is not a Mobile App, has no version of its own, and the Version Floor never applies to it.
3. **The iOS React Native project is not a release artefact.** It stays buildable from source and keeps the `app.myorganiser` identity. Nothing about it is signed, published, or reviewed.
4. **ADR 0114's two rules stand.** The Version Floor and unknown-field preservation matter more here, not less: nothing updates a downloaded APK, so an old Mobile Release stays in use for longer than a store install would. Only ADR 0114's store wording is superseded: where it says a store approves or rolls out a Mobile Release, read that the operator publishes it and each User installs it.

## Considered Options

- **Publish to both stores**, as planned. Rejected by the operator: store accounts, fees, review, and store-specific compliance for a product that has not yet settled what the Mobile App must cover.
- **A sideloadable `.ipa` on the GitHub Release.** Rejected. Each User re-signs it with their own Apple ID every seven days, so it is public in name only.
- **A TestFlight public link for iOS.** Rejected. It is most of the store process the decision set out to avoid.

## Consequences

- **The Android release signing key is the app's permanent identity.** There is no Play App Signing behind it. Android installs an update only when the application id and the signing key both match the installed copy, so a lost key means no installed Mobile App can be updated in place. It is kept outside the repository and backed up (#972). Moving to Google Play later means enrolling this same key, or asking every User to reinstall.
- **Nothing tells a User that a newer Mobile Release exists** except the Version Floor's update screen, which links to the GitHub Release.
- **The Installed Web App needs a connection.** Its service worker holds an offline page and nothing else: no page of the dashboard, no API response, and no vault data, encrypted or not. Caching any of those is a separate design, because it decides where a vault key lives while offline; it is not an improvement to make to the worker in passing.
- **The mobile release runbook still describes the store procedure.** It is kept for reference and is not the plan. Only its Android signing step is maintained.
