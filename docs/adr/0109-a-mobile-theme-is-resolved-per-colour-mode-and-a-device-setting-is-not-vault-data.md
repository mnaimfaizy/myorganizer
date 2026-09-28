# A mobile theme is resolved per colour mode, and a Device Setting is not vault data

## Status

accepted. Supersedes the Decision clause of [ADR 0008](0008-mobile-styling-stylesheet-theme.md) that names a single module-level `theme`; ADR 0008 otherwise stands — `StyleSheet` over a token-derived theme, and no NativeWind, are unchanged.

## Context

ADR 0008 decided that `libs/mobile/ui` "exposes a `theme` (colours, spacing, radii, fonts) and a `useTheme()` hook, derived from the same `design-tokens` source the web app uses". It was built that way, and two properties of that shape turned out to decide something the ADR did not discuss.

- **The theme read Brand Primitives.** `colorPrimary`, `colorCard`, `colorBorder`, `colorMuted`. A Brand Primitive has exactly one value; the pair of values a colour mode needs lives one tier up, in the Semantic Roles under `mode.light` / `mode.dark`. A theme assembled from primitives can therefore only ever be light, whatever a provider is later wrapped around it. It was not a missing feature — it was a tier mistake, and it was invisible because light mode is what anyone developing it saw.
- **The theme was a module-level constant, and `useTheme()` returned it.** `ScreenContainer` went further and read it inside a `StyleSheet.create` block evaluated at import. A value captured at import time cannot change when the device changes, so the hook's own comment — that a provider could arrive later "without changing any call sites" — was true of the hook and false of the constant beside it.
- **The theme exposed `fonts.display` and `fonts.body`**, each the first family of a CSS font stack: `Plus Jakarta Sans`, `Inter`. Those are web family names. Neither platform resolves a 600 or an 800 weight through a family name (Android maps only regular/bold/italic onto a family; the static cuts are separate families on iOS), so once real font files were bundled, a family name without a weight was the wrong unit entirely.

Separately, resolving a colour mode needs somewhere to keep the User's choice, and so does reopening the app on the tab it was last on. Neither is vault data, and treating them as vault data would be actively wrong: the vault is end-to-end encrypted, synced, and reconciled across devices, and a preference about _this phone_ has no business being any of those. Two devices disagreeing about appearance is the correct outcome.

## Decision

1. **The mobile theme is a projection of the Semantic Roles, once per colour mode.** `libs/design-tokens` emits `generated/roles.ts` alongside `roles.css` — `roleLight` and `roleDark`, from the same tokens as the CSS. `libs/mobile/ui/src/theme.ts` exposes `lightTheme`, `darkTheme`, and `themeForMode(mode)`. `roleDark` is declared `satisfies Record<keyof typeof roleLight, string>`, so a role present in one mode and absent from the other fails the build rather than rendering as `undefined` on one device.

2. **`useTheme()` reads a context and throws outside a provider.** `ThemeProvider` takes the appearance setting as a prop, resolves it against `useColorScheme()`, and hands down the matching theme; an OS mode change re-themes in place. There is no module-level `theme` export any more, and no component reads a colour inside a `StyleSheet.create` block. Throwing rather than defaulting to light is deliberate: a silent light fallback shows every dark-mode User a light app and reads as a design bug instead of the wiring mistake it is.

3. **Text size comes from a Type Scale step, used whole.** The seven named steps live in `tokens.json` under `type`, each carrying size, line height, weight, and letter-spacing. `libs/mobile/ui/src/typeScale.ts` converts them to React Native numbers — letter-spacing from em to points against the step's own size — and pairs each step with the bundled font _cut_ that has its weight, by PostScript name. `theme.fonts` is gone, because a family name is not a unit either platform can act on.

4. **A Device Setting is per-device, plaintext, and outside the vault.** `libs/mobile/core` holds the appearance choice (System / Light / Dark, default System) and the last used tab in MMKV, read synchronously. Synchronously matters: both are needed before the first frame, and an asynchronous read means either a flash of the wrong theme or a splash screen held open to hide one. Nothing here is encrypted, pushed, or reconciled, and that is the decision rather than an omission — see **Device Setting** in [`CONTEXT.md`](../../CONTEXT.md).

5. **The last used tab is stored as an opaque string, not as a tab type.** The navigator owns the tab vocabulary and validates what it reads back. A tab name that was valid when it was written must not crash the app that reads it after a tab is renamed or removed.

## Considered Options

- **Keep the single `theme` and add a dark variant beside it.** Rejected: the problem is which tier the values come from, not how many constants there are. Two primitive-derived constants would still need a hand-maintained light/dark pairing per colour, which is the job the role tier already does once, for the web too.
- **Put appearance in the vault so it follows the User across devices.** Rejected: a preference about one device's screen is not something the other device should be told, it would make an unencrypted-by-nature value into ciphertext to move it, and it would give a conflict resolver something to resolve that has no correct resolution.
- **`AsyncStorage` instead of MMKV.** Rejected on the synchronous read. Its async API pushes the colour-mode decision past the first frame, which is the one thing this setting exists to get right.
- **Expose only the roles mobile screens use today.** Rejected: the filter would be a hand-maintained list of role names, which is the fan-out ADR 0053 exists to prevent. The theme projects the whole role set and costs nothing to carry the unused ones.

## Consequences

- Every mobile component reads `useTheme()`, and `App.tsx` must wrap the tree in `ThemeProvider`. Forgetting it throws at the first component rather than rendering light.
- The `ThemedText` variants are now the Type Scale step names; `heading` and `label` are gone. The `ThemedButton` `secondary` variant is `brand`, matching the role it reads.
- Web colour is unchanged except for the destructive red, which both platforms share. Five Semantic Roles were added (error text, focus, control edge, raised surface, scrim) and the web Tailwind config names none of them yet; a role with no utility is a legitimate state, and `yarn tailwind:classes:check` still covers the direction that matters — a class that resolves to nothing.
- `scrim` is the one colour in the token tree carrying alpha, so the role generator emits `H S% L% / A` and the TS platform uses `color/css` rather than `color/hex`, which drops alpha silently.
- A pure-logic mobile test became possible and exists: `libs/mobile/ui/src/theme.test.ts` asserts the role parity, the appearance resolution, and the Type Scale conversion without importing React Native. Rendering a mobile component is still blocked — see the Mobile Test Toolchain Note in [`TECH_STACK.md`](../../TECH_STACK.md).
- ADR 0008's Decision clause naming a single `theme` is superseded. Its choice of `StyleSheet` over a token-derived theme, and its rejection of NativeWind, are untouched.
