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

- iOS native builds require macOS/Xcode and are verified by the human on a Mac; the Windows dev/CI environment compiles Android (Gradle) for full native verification.
- We own native dependency wiring (babel, Metro, CocoaPods/Gradle) rather than delegating it to Expo.

### Autonomous gate for mobile slices: lint + typecheck + format (NOT Metro bundle)

The autonomous build gate for any slice touching `apps/mobile` or `libs/mobile/*` is **`lint` + the project's `typecheck` (`tsc --noEmit`) + a Prettier format check only**. It does **not** run a Metro bundle.

Rationale: the `mobile:bundle` target inferred by `@nx/react-native` is a bare `react-native bundle` invocation with no `--entry-file` / `--platform` / `--bundle-output` arguments, so it cannot succeed when run headlessly (it fails with `paths[1] undefined` or OOMs). Earlier mobile slices listed `nx run mobile:bundle` as an acceptance criterion; autonomous agents burned large amounts of time and tokens trying to satisfy an impossible command. A Metro bundle is **not** required to prove a slice is sound — `tsc` + lint catch the defects that matter at the slice level, and the real native bundle is produced by Xcode/Gradle (which invoke Metro with the correct arguments) when the human builds on their Mac.

Therefore:

- Do **not** add `nx run mobile:bundle` (or any bare `react-native bundle`) to mobile slice acceptance criteria. PRD/slice authoring (`to-prd`, `to-issues`) must use lint + typecheck + format as the mobile verification step.
- If a runnable `nx bundle`/CI bundle target is ever wanted, the inferred target must first be reconfigured with explicit `--entry-file apps/mobile/src/main.tsx --platform <ios|android> --bundle-output <path>` arguments. Until then, treat `mobile:bundle` as broken-by-design and out of the gate.
