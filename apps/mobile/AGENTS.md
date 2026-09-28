# Mobile App Agent Guide

## Scope

React Native app shell. Feature screens, hooks, UI, and platform adapters live under `libs/mobile/*`. Shares the vault format and auth contract with the web client.

Root-level React Native rules (package-root imports, edge-to-edge via `react-native-safe-area-context`, `StyleSheet` over the token theme) live in the root [Agent Guide](../../AGENTS.md#react-native) and are not restated here.

## Commands

- Start Metro: `yarn nx start mobile`.
- iOS: `yarn nx run-ios mobile`.
- Android: `yarn nx run-android mobile`.
- Test: `yarn nx test mobile`.
- Lint: `yarn nx lint mobile`.
- Typecheck: `yarn nx run mobile:typecheck` — runs two programs: `tsconfig.app.json` (native, no `dom`, Platform Variants excluded) and `tsconfig.web.json` (react-native-web, `dom`, `.web` Platform Variants resolved first). See ADR 0103.

The autonomous verification gate for mobile is lint + typecheck + format. Do not use `nx run mobile:bundle` (ADR 0005).

## Do

- Keep this app thin: native wiring, root providers, and navigation entry.
- Put feature code in `libs/mobile/*`.
- Store the refresh token in the OS keychain and send it in the refresh body (ADR 0006).
- Keep vault plaintext and the Master Key on the device.
- Keep the home-screen name and the registered component name separate. The home-screen name is **MyOrganizer** (iOS `CFBundleDisplayName`, Android `app_name`, `app.json` `displayName`); the registered component name stays **Mobile** (`AppDelegate` `withModuleName`, `MainActivity.getMainComponentName`, `app.json` `name`), and renaming it breaks startup for no visible gain.
- Keep one copy of each bundled font, in `src/assets/fonts`. Android reaches it through the asset source set in `android/app/build.gradle`; iOS through `UIAppFonts` plus the Xcode Resources phase. Adding a weight means all three plus the Type Scale table — see [src/assets/fonts/README.md](src/assets/fonts/README.md).
- Run `yarn nx run mobile:pod-install` after adding a native dependency, and commit the lockfile.

## Known blocker — iOS pods

- **`ios/Podfile.lock` is behind, and iOS does not start until it is caught up.** `react-native-mmkv` was added without a `pod install` — no macOS in the sandbox that added it — so the lockfile names no MMKV pod. That is not a deferred nicety: `libs/mobile/core/src/settings/settingsStorage.ts` constructs the MMKV store on the first Device Setting read, which happens before the first frame, so an iOS build from this tree fails at launch rather than degrading. Nothing in CI compares `Podfile.lock` against `package.json`, so nothing will catch it drifting further. Run `yarn nx run mobile:pod-install` on a macOS host and commit the result before signing off any iOS acceptance criterion — including the bundled-font screenshot, which needs an app that starts.

## Do Not

- Do not put feature screens or domain logic in this app beyond the shell.
- Do not add an Operational README here; how to run mobile lives in `DEVELOPMENT.md`.
- Do not run `nx run mobile:bundle` as a slice or PR gate.
- Do not treat mobile refresh as an httpOnly cookie.
- Do not add NativeWind or `className` styling.
- Do not remove `jest.config.ts` from `tools/config/mobile-platform-exemptions.json`, and do not "fix" its `require.resolve('react-native/jest/assetFileTransformer.js')`. That is the transformer React Native ships for Jest and it has no package-root export, so the subpath is the published interface for that one line. `yarn mobile-platform:check` parses `require.resolve` like every other call form — the file passes because of the named exemption and its written reason, not because the form is ignored.
