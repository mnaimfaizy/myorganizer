---
status: accepted
---

# Mobile app is bare React Native via @nx/react-native (not Expo)

The MyOrganizer mobile client (`apps/mobile`) is built as a bare React Native app integrated through the `@nx/react-native` plugin, with native `ios/` and `android/` projects committed and compiled directly (Gradle / Xcode).

## Considered Options

- **Expo (managed) + Metro bundle** — fastest CI (Node only, no native SDKs), but the managed runtime constrains native modules. The vault requires `react-native-quick-crypto` (JSI) and we want unrestricted control over native crypto and secure storage.
- **Expo prebuild** — generates native dirs but still anchors the project to the Expo toolchain and config plugins.
- **Bare React Native + @nx/react-native** — chosen. Full control over native build and modules, native dirs are first-class, and it sits naturally in the existing Nx monorepo alongside the Next.js and Express apps.

## Consequences

- iOS native builds require macOS/Xcode and are verified by the human on a Mac; the Windows dev/CI environment can compile Android (Gradle) and always runs the Metro bundle + `tsc` as the autonomous build gate.
- We own native dependency wiring (babel, Metro, CocoaPods/Gradle) rather than delegating it to Expo.
