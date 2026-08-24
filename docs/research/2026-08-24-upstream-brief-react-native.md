# Upstream Brief: react-native

- **Date:** 2026-08-24
- **Subjects:**
  - `react-native` current `~0.79.3` (installed `0.79.7`) → target `0.79.3`
  - `@react-native/metro-config` current `~0.79.3` → target `0.79.3`
  - `@react-native/babel-preset` current `~0.79.3` → target `0.79.3`
  - `@react-native-community/cli` current `~18.0.0` → target `0.79.3` line
  - `metro-config` / `metro-resolver` current `~0.82.4` (installed `metro@0.82.5`) → target `0.79.3` line
  - `react-native-mmkv` current `4.3.1` → target `0.79.3` line
  - `react-native-nitro-modules` current `0.35.0` → target `0.79.3` line
  - `react-native-keychain` current `10.0.0` → target `0.79.3` line
  - `react-native-quick-crypto` current `1.1.5` → target `0.79.3` line
  - `react-native-quick-base64` current `3.0.0` → target `0.79.3` line
  - `react-native-safe-area-context` current `5.8.0` → target `0.79.3` line
  - `react-native-screens` current `4.11.1` → target `0.79.3` line
  - `react-native-url-polyfill` current `3.0.0` → target `0.79.3` line
  - `@react-navigation/native` current `7.2.5`, `@react-navigation/native-stack` current `7.16.0` → target `0.79.3` line
  - `@testing-library/react-native` current `~13.2.0` (installed `13.2.2`) → target `0.79.3` line
  - `react-test-renderer` current `19.0.0` → target `0.79.3` line
- **Sources:** primary upstream pages only (linked on each finding)

## Findings

### react-native

#### Future-risk

- **Claim:** React Native is removing deep imports from the `react-native` package, and this repo has no instruction forbidding them and no opt-in to the replacement Strict TypeScript API.
- **Source:** [React Native 0.79 release notes](https://reactnative.dev/blog/2025/04/08/react-native-0.79) — "In our next release, we will be deprecating deep imports, as part of better defining React Native's public JavaScript API"; [React Native 0.80 release notes](https://reactnative.dev/blog/2025/06/12/react-native-0.80) — "we are formally deprecating deep imports from React Native … and are introducing warnings via ESLint and the JS console", "we aim to remove deep imports from React Native's API in a future release"
- **Local evidence:** `apps/mobile/jest.config.ts:20` resolves `react-native/jest/assetFileTransformer.js`. No file in `instruction_globs`, nor any nested mobile `AGENTS.md`, tells an agent to import only from the `react-native` root. `@react-native/eslint-config` is not installed, so the 0.80 lint warning will never fire here. No `tsconfig` opts into the Strict TypeScript API.
- **Disposition:** plan

- **Claim:** Android already enforces edge-to-edge for this app, and no repo-owned instruction says so; React Native's own `edgeToEdgeEnabled` opt-in does not exist at 0.79.
- **Source:** [Handling Android 15's edge-to-edge enforcement on React Native (react-native-community/discussions-and-proposals #827)](https://github.com/react-native-community/discussions-and-proposals/discussions/827) — "Android 15 will now enforce edge-to-edge when you opt-in to targetSdk 35"; the `edgeToEdgeEnabled` Gradle property is a 0.81 addition, not available at 0.79
- **Local evidence:** `apps/mobile/android/build.gradle:6` sets `targetSdkVersion = 35`. `libs/mobile/ui/src/components/ScreenContainer.tsx` correctly uses `SafeAreaView` from `react-native-safe-area-context`, but `libs/mobile/screens/src/RootNavigator.tsx` renders `LoadingScreen` as a bare `View`, so that screen paints under the system bars. No instruction file mentions safe areas or edge-to-edge.
- **Disposition:** plan (the instruction gap); the `LoadingScreen` fix is follow-on

#### Mismatch

- **Claim:** TypeScript in this repo resolves modules differently from the way Metro resolves them at React Native 0.79, so `tsc` can bind a different file than the bundler ships.
- **Source:** [`@react-native/typescript-config` on the 0.79-stable branch](https://raw.githubusercontent.com/facebook/react-native/0.79-stable/packages/typescript-config/tsconfig.json) — `"moduleResolution": "bundler"`, `"customConditions": ["react-native"]`, `"resolvePackageJsonImports": false`, `"target": "esnext"`, `"strict": true`, `"isolatedModules": true`; [React Native 0.79 release notes](https://reactnative.dev/blog/2025/04/08/react-native-0.79) — package `"exports"`/`"imports"` resolution "promoted to stable and enabled by default"
- **Local evidence:** `tsconfig.base.json:7` sets `"moduleResolution": "node"` and `tsconfig.base.json:11` sets `"target": "es2015"`; `apps/mobile/tsconfig.json` repeats `"moduleResolution": "node"` and sets no `customConditions`, no `strict`, no `isolatedModules`. Evaluating `getDefaultConfig()` from the installed `@react-native/metro-config` against `apps/mobile` reports `unstable_enablePackageExports: true` and `unstable_conditionNames: ["react-native"]` on `metro@0.82.5`. `apps/mobile/tsconfig.json` uses `"jsx": "react-native"` while `libs/mobile/ui/tsconfig.json` uses `"jsx": "react-jsx"`, and only the latter sets `"strict": true`.
- **Disposition:** plan

- **Claim:** Mobile TypeScript includes the `dom` lib, which makes browser globals typecheck inside React Native code and removes the compiler's ability to enforce the repo's own device-only vault rule.
- **Source:** [`@react-native/typescript-config` on the 0.79-stable branch](https://raw.githubusercontent.com/facebook/react-native/0.79-stable/packages/typescript-config/tsconfig.json) — the `lib` array lists only `es2019`–`es2022` entries and does not include `dom`
- **Local evidence:** `tsconfig.base.json:13` sets `"lib": ["es2021", "dom"]` and `apps/mobile/tsconfig.json` sets `"lib": ["dom", "esnext"]`. `libs/mobile/feat/vault/AGENTS.md` states "Do not import browser WebCrypto or `localStorage` helpers from `@myorganizer/web-vault`" — with `dom` in `lib`, `localStorage`, `window`, and `crypto.subtle` all typecheck in mobile libraries, so that rule is enforced by review only.
- **Disposition:** plan

#### Missed improvement

- **Claim:** No repo-owned instruction file teaches React Native at all, even though the repo ships a React Native app and six mobile libraries; the mobile rules that do exist are unreachable from the audit's own instruction set.
- **Source:** [React Native 0.79 release notes](https://reactnative.dev/blog/2025/04/08/react-native-0.79) and [0.80 release notes](https://reactnative.dev/blog/2025/06/12/react-native-0.80) together define a moving public API (deep imports, Strict TypeScript API, JSC extraction to `@react-native-community/javascriptcore`) that an agent writing mobile code needs to be told about
- **Local evidence:** grepping `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `DEVELOPMENT.md`, `.github/copilot-instructions.md`, and `docs/ui/GUIDELINES.md` for `react.native|mobile|metro|hermes|nativewind|turbomodule|fabric` returns zero hits. The real mobile rules live in `apps/mobile/AGENTS.md`, `libs/mobile/AGENTS.md`, `libs/mobile/ui/AGENTS.md`, `libs/mobile/feat/auth/AGENTS.md`, and `libs/mobile/feat/vault/AGENTS.md`, none of which are matched by `instruction_globs` in `upstream-brief.config.yml`.
- **Disposition:** plan

### @testing-library/react-native + react-test-renderer

#### Mismatch

- **Claim:** The mobile test toolchain is pinned to the React 18 line while the repo runs React 19, and it depends on a renderer React itself has deprecated.
- **Source:** [RNTL migration to v14](https://github.com/callstack/react-native-testing-library/blob/main/website/docs/14.x/docs/start/migration-v14.mdx) — "React 19.0.0+ and React Native 0.78+ are now required", "Switched from deprecated React Test Renderer to Test Renderer", "If you need to support React 18, please continue using RNTL v13.x"; [react.dev — react-test-renderer deprecation](https://react.dev/warnings/react-test-renderer) — "react-test-renderer is deprecated … will remain available on NPM but will not be maintained and may break with new React features or changes to React's internals", recommending `@testing-library/react-native` for React Native
- **Local evidence:** `package.json` pins `react` `19.2.3`, `@testing-library/react-native` `~13.2.0` (installed `13.2.2`), and `react-test-renderer` `19.0.0`. `TECH_STACK.md:249` documents `react-test-renderer` as the "Test renderer for React Native/Jest tests". There are zero `*.test.ts(x)` or `*.spec.ts(x)` files under `apps/mobile/` or `libs/mobile/`, `apps/mobile/jest.config.ts` sets `passWithNoTests: true`, `apps/mobile/src/test-setup.ts` is empty, and `apps/mobile/AGENTS.md` states "The autonomous verification gate for mobile is lint + typecheck + format" — so the mismatch is currently latent and will surface the first time anyone writes a mobile test.
- **Disposition:** plan (what `TECH_STACK.md` and the test-workflow instructions claim); the package move to RNTL v14 is follow-on

### react-native-quick-crypto

#### Mismatch

- **Claim:** Mobile vault crypto imports a package the repo never declares, relying on hoisting of a transitive dependency of `react-native-quick-crypto`.
- **Source:** `react-native-quick-crypto@1.1.5` declares `@craftzdog/react-native-buffer` in its own `dependencies` (`^6.1.2`), not as a peer dependency and not as a re-export; [React Native CLI autolinking docs](https://github.com/react-native-community/cli/blob/main/docs/autolinking.md) — "Dependencies are only linked if they are listed in the package.json of the mobile workspace, where 'react-native' dependency is defined"
- **Local evidence:** `libs/mobile/feat/vault/src/crypto.ts` imports `Buffer` from `@craftzdog/react-native-buffer`; the package appears in neither the root `package.json` nor `libs/mobile/feat/vault`. It resolves today only because Yarn hoists `react-native-quick-crypto`'s copy (`6.1.2`) to the root.
- **Disposition:** follow-on

### apps/mobile/package.json

#### Mismatch

- **Claim:** The mobile workspace manifest pins a React Native library to a version the repo does not install and omits two libraries the app imports.
- **Source:** [React Native CLI autolinking docs](https://github.com/react-native-community/cli/blob/main/docs/autolinking.md) — "Dependencies are only linked if they are listed in the package.json of the mobile workspace, where 'react-native' dependency is defined"
- **Local evidence:** `apps/mobile/package.json` declares `"react-native-quick-crypto": "0.7.17"` while the root `package.json` and `TECH_STACK.md:114` pin `1.1.5` (installed `1.1.5`), a major-version gap across the 0.7 → 1.x API break. The same manifest omits `react-native-url-polyfill`, which `apps/mobile/src/main.tsx` imports, and both `@react-navigation/*` packages, which `libs/mobile/screens/src/RootNavigator.tsx` imports. Autolinking currently reads the root manifest (where `react-native` is declared), so this is drift rather than a live break.
- **Disposition:** follow-on

### react-native-mmkv, react-native-nitro-modules, react-native-safe-area-context, react-native-screens, react-native-url-polyfill, @react-native-community/cli, metro

_No findings._ Checked and aligned with the 0.79 line:

- `libs/mobile/feat/vault/src/storage.ts` uses the v4 `createMMKV({ id })` factory (verified against the installed `react-native-mmkv@4.3.1` type surface, which exports `createMMKV`, not the v3 `new MMKV()`), and holds a single module-scope instance, matching the [react-native-mmkv guidance](https://github.com/mrousavy/react-native-mmkv) to "re-use this instance throughout your entire app". `react-native-nitro-modules` is present as v4 requires.
- `ScreenContainer` consumes insets via `SafeAreaView` from `react-native-safe-area-context`, which its [usage docs](https://appandflow.github.io/react-native-safe-area-context/usage) call "the preferred way to consume insets … better performance by applying insets natively and avoids flickers".
- `react-native-url-polyfill` is still warranted: React Native's built-in `URL`/`URLSearchParams` remain non-spec-compliant ([facebook/react-native#30188](https://github.com/facebook/react-native/pull/30188)), and `apps/mobile/src/main.tsx` installs it via the `/auto` entry before any app code runs.
- `newArchEnabled=true` and `hermesEnabled=true` in `apps/mobile/android/gradle.properties`, and `compileSdk`/`targetSdk` 35 with `ndkVersion 27.1.12297006`, match the 0.79 Android template.
- `@react-native-community/cli` `~18.0.0` is the 0.79 line; `react-native@0.79.7` itself depends on `@react-native/community-cli-plugin@0.79.7` and `metro-runtime@^0.82.0`, consistent with the pinned `metro-config`/`metro-resolver` `~0.82.4`.
- `apps/mobile/metro.config.js` layers only `cacheVersion`, the SVG transformer, and `sourceExts` additions on top of `getDefaultConfig()`; it does not set `unstable_enablePackageExports: false`, so it keeps the 0.79 stable-package-exports default the release notes describe.

## Proposed plan

Repo-owned instructions and hygiene/test scripts only. No package bumps, no application-code edits.

- Widen `instruction_globs` in `upstream-brief.config.yml` to include `apps/*/AGENTS.md` and `libs/**/AGENTS.md`, and add `apps/mobile/**` and `libs/mobile/**` to `source_globs`. Every mobile rule this repo owns lives in nested Agent Guides that the current globs cannot see, and the mobile tree is invisible to `source_globs` sampling. Without this, a future run of this same skill will keep reporting "no mobile instructions exist".
- Add a React Native section to `AGENTS.md` — the root guide already carries a "Next.js: ALWAYS read docs before coding" block and nothing equivalent for the app it also ships. It should start saying: import only from the `react-native` root, never from a subpath; React Native 0.79 targets `targetSdk 35`, so Android enforces edge-to-edge and every screen root must come from `react-native-safe-area-context`; mobile styling is `StyleSheet.create` over the token theme, never inline style objects and never a browser API.
- Add a mobile file-type row to the tiered-quality-gate matrix in `AGENTS.md` and `.claude/checklist.md` Step 0. `apps/mobile/**` and `libs/mobile/**` currently fall through to no skill, which is why React Native work has no specialist hop while `libs/web-ui/` has one.
- Update `apps/mobile/AGENTS.md` and `libs/mobile/AGENTS.md` to state the deep-import rule and the edge-to-edge constraint at the point of use, and to name `useSafeAreaInsets` as the escape hatch when `SafeAreaView` cannot be used.
- Change what `TECH_STACK.md` says about the mobile test toolchain: record that `@testing-library/react-native` `13.x` is the React 18 line, that this repo runs React 19, and that `react-test-renderer` is deprecated upstream — so the next person to write a mobile test reads the constraint instead of discovering it. Do not bump the packages in this change.
- Add a mobile lane to `.agents/skills/unit-test-delegation-workflow/SKILL.md`, or state explicitly that mobile has none. Today the skill routes all `*.test.ts` work through a Jest/web assumption while `apps/mobile/AGENTS.md` declares the mobile gate to be "lint + typecheck + format", and nothing reconciles the two.
- Extend `tools/scripts/check-test-hygiene.mjs` (or add a sibling checker wired into `yarn gates:run`) to fail on a `react-native/…` subpath import outside `metro.config.js`, so the deep-import rule is a gate and not a paragraph. Register it per the Meta-Gate rule in `AGENTS.md`.

## Follow-on

Application-code findings and third-party-skill contradictions. The human may file a separate issue after grilling.

- Align the mobile TypeScript configuration with `@react-native/typescript-config` at 0.79 — `moduleResolution: "bundler"`, `customConditions: ["react-native"]`, `strict`, `isolatedModules`, and dropping `dom` from `lib` for mobile projects. This touches `tsconfig.base.json`, which is shared with the web and backend projects, so it needs its own scoping decision. — code
- Fix `apps/mobile/package.json`: `react-native-quick-crypto` pinned at `0.7.17` against an installed `1.1.5`, and missing `react-native-url-polyfill` and `@react-navigation/*`. — code
- Declare `@craftzdog/react-native-buffer` explicitly, or stop importing it directly in `libs/mobile/feat/vault/src/crypto.ts`. — code
- Give `LoadingScreen` in `libs/mobile/screens/src/RootNavigator.tsx` a safe-area root and move its inline style object into `StyleSheet.create`, per ADR 0008 and the edge-to-edge finding. — code
- Move the mobile test toolchain to `@testing-library/react-native` v14 and drop `react-test-renderer`, once someone decides whether mobile gets a test gate at all. — code
- No third-party skill contradicts upstream React Native guidance; the only installed skill mentioning React Native is `modern-web-guidance`, and only in passkey documents unrelated to the 0.79 API. — vendor-skill

## Failed hops

- `react-native-keychain` — the v10 documentation site (`oblador.github.io/react-native-keychain/docs/intro`) returned 404 and the GitHub landing page served no API content, so no primary page for v10 could be cited. `libs/mobile/feat/auth/src/storage/keychain.ts` uses `setGenericPassword`/`getGenericPassword`/`resetGenericPassword` with `service` and `ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY`, which type-checks against the installed `10.0.0`, but this run could not confirm it against upstream v10 docs.
- `@react-navigation` v7 — the getting-started page 404'd and the v6→v7 upgrade guide did not address whether `SafeAreaProvider` remains required at the root or whether the navigator `id` prop changed, both of which `libs/mobile/screens/src/RootNavigator.tsx` relies on (`id="RootStack"`). Recorded as unverified rather than as a finding.
