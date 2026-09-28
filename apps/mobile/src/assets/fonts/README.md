# Bundled app fonts

The two families the Mobile App renders in, as static cuts. Bundled rather than
loaded at runtime: a font that arrives over the network arrives after first
paint, and a phone is routinely offline.

| File                            | Family            | Weight | Type scale steps that use it |
| ------------------------------- | ----------------- | ------ | ---------------------------- |
| `PlusJakartaSans-ExtraBold.ttf` | Plus Jakarta Sans | 800    | `display`                    |
| `PlusJakartaSans-Bold.ttf`      | Plus Jakarta Sans | 700    | `title-lg`, `title`          |
| `Inter-SemiBold.ttf`            | Inter             | 600    | `label-caps`                 |
| `Inter-Regular.ttf`             | Inter             | 400    | `body`, `body-sm`, `caption` |

Only the four weights the type scale actually names are vendored. A fifth cut is
~340 KB of app binary that nothing renders.

## Why the file names are what they are

**Each file is named after its own PostScript name**, not after the family. That
is the one naming scheme both platforms resolve:

- **Android** registers a font under its _asset file name_ minus the extension,
  so `Inter-SemiBold.ttf` is reachable as `fontFamily: 'Inter-SemiBold'` and by
  nothing else. Android's `fontFamily` + `fontWeight` pairing only covers
  regular/bold/italic, which cannot express 600 or 800.
- **iOS** resolves a name that is not a family name by PostScript name, and
  these cuts carry `Inter-Regular`, `Inter-SemiBold`, `PlusJakartaSans-Bold`,
  and `PlusJakartaSans-ExtraBold`.

So `fontFamily: 'Inter-SemiBold'` is the one string that means the same thing on
both. Asking for family `Inter` at weight 600 does not: these are separate
static families, and iOS would find only Regular in `Inter`.

**And a step sets no `fontWeight`**, because the file already is the weight.
Adding one breaks both platforms in different ways: on Android, React Native
0.79 treats any weight of 700 or more as bold and looks for
`PlusJakartaSans-Bold_bold.ttf`, finds nothing, and renders Roboto; on iOS, a
weight turns the PostScript name back into a family lookup and picks the
family's closest weight instead of the named cut. Both were seen on #909.

The cuts live in one table — `CUTS` in `libs/mobile/ui/src/typeScale.ts`,
keyed by face and token weight — so a renamed file breaks in one place, and a
step re-weighted in `tokens.json` either finds its cut or fails at load.

## How they reach a build

- **iOS** — listed in `UIAppFonts` in `apps/mobile/ios/Mobile/Info.plist` and
  copied by the `Fonts` group in the Xcode project's Resources build phase.
- **Android** — `apps/mobile/android/app/build.gradle` adds `src/assets` to the
  asset source set, which puts this directory at `assets/fonts/` in the APK,
  where React Native's font manager looks. The files are not duplicated into
  `android/`.

Adding a weight means touching all three: this directory, `UIAppFonts` plus the
Xcode Resources phase, and the type scale table.

## Licence

Both families are licensed under the
[SIL Open Font License 1.1](https://openfontlicense.org/), which permits
embedding and redistribution. Each family's licence text is vendored beside the
fonts as `OFL-Inter.txt` and `OFL-PlusJakartaSans.txt`, and both are recorded in
the repository `NOTICE`.

- Inter — <https://fonts.google.com/specimen/Inter>
- Plus Jakarta Sans — <https://fonts.google.com/specimen/Plus+Jakarta+Sans>

## Refreshing

These are pinned static cuts. Google Fonts now ships both families as variable
fonts only, and a variable font is not a safe substitute here: Android loads one
default instance from the file, so every weight would render at 400. Re-resolve
static cuts (`@expo-google-fonts/inter` and `@expo-google-fonts/plus-jakarta-sans`
publish them as `.ttf`), confirm the PostScript name of each with its `name`
table, and rename the file to match it.
