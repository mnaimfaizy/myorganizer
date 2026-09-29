# Keystore access control and Master Key handling for Biometric Unlock

Frozen 2026-09-29. The decision this supports is
[ADR 0108](../adr/0108-a-mobile-device-may-hold-the-master-key-behind-a-biometric-gate.md); the
policy it reviews is `libs/mobile/feat/vault/src/biometric/`. This brief does not move — the
platform facts below were read from the `react-native-keychain` 10.0.0 sources vendored in
`node_modules` at that date, and a later version may make some of them untrue.

## The question

ADR 0108 lets a mobile device hold the plaintext Master Key. Issue #912 asks for a security review
of two things before that ships: **what the keystore access control actually enforces**, and
**where the Master Key goes**.

Both questions are answered against sources rather than against documentation, because the
library's TypeScript surface describes intent and the native key spec describes behaviour, and this
review found one place they disagree.

## What the access control enforces

### iOS — both halves of decision 1 hold

`WRITE_OPTIONS` in `libs/mobile/feat/vault/src/biometric/nativeKeystore.ts` sets
`accessControl: BIOMETRY_CURRENT_SET` and `accessible: WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`. That
pair is `SecAccessControlCreateWithFlags` with the `biometryCurrentSet` flag over the
passcode-set-this-device-only protection class, which gives exactly what the decision asks for: the
item cannot exist on a device with no passcode, never migrates to another device or into a backup,
and is **destroyed by the OS when the enrolled biometric set changes**.

`has()` raises no prompt: `hasCredentialsWithSecClass` passes `kSecUseAuthenticationUIFail` and
treats `errSecInteractionNotAllowed` — which is what a biometric-protected item returns under that
flag — as "present"
(`node_modules/react-native-keychain/ios/RNKeychainManager/RNKeychainManager.m:293-308`). So
deciding whether to show the Unlock screen's biometric button never costs the User a prompt they
did not ask for.

### Android — only the first half holds

`STORAGE_TYPE.AES_GCM` selects `CipherStorageKeystoreAesGcm`, whose key is generated with
`setUserAuthenticationRequired(true)` and
`setUserAuthenticationParameters(5, AUTH_BIOMETRIC_STRONG or AUTH_DEVICE_CREDENTIAL)`
(`node_modules/react-native-keychain/android/src/main/java/com/oblador/keychain/cipherStorage/CipherStorageKeystoreAesGcm.kt:161-173`).
Two consequences the TypeScript surface does not show:

1. **The item is not invalidated by an enrolment change.**
   `setInvalidatedByBiometricEnrollment` is never called anywhere in the library's `cipherStorage`
   sources. A fingerprint enrolled after the Master Key was stored opens it. ADR 0108 decision 1's
   invalidation rule therefore holds on iOS only.
2. **The device credential authorizes the key.** `AUTH_DEVICE_CREDENTIAL` is in the allowed set, so
   a PIN, pattern, or password opens it as readily as a Class-3 biometric. `accessControl` does not
   constrain this — Android reads it only to decide what the prompt _offers_
   (`KeychainModule.kt:186-193` computes `usePasscode`/`useBiometry` for `getPromptInfo`), so the
   prompt stays biometric-only while the key underneath is not.

Neither is reachable from the options object: both need the native `KeyGenParameterSpec`, which the
library does not expose. They are recorded as limitations rather than claimed away, and
`nativeKeystore.ts`'s own comment says the same thing at the site.

`securityLevel` is deliberately **not** pinned to `SECURE_HARDWARE`. It is an assertion that fails
the write outright on a device with no TEE, and refusing the feature there is worse than a
strong-biometric software-backed key — the passphrase is the only other way in either way.

One keychain service per User (`com.myorganizer.vault.masterkey.<userId>`), so a second User signing
in on the same device queries a service that does not exist.

## Where the Master Key goes

- **Written once.** The only `keystore.write` call site is `enableBiometricUnlock`. It is never
  written to the Device Settings store, never logged, and never sent.
- **Only on a recent passphrase.** `mayEnableBiometricUnlock` requires both that the Vault was
  opened by the passphrase _and_ that it was opened within `ENROLMENT_FRESHNESS_MS` (two minutes).
  The first half alone is a fact that stays true for a whole session and so says nothing about who
  is holding the phone now; the freshness half is what makes decision 1's "an unattended unlocked
  session must not be enough" true, and what obliges the Account slice to re-ask rather than offer a
  bare switch.
- **Extractable by construction.** ADR 0108's consequence "the Master Key must be created
  extractable on mobile" needed no change: mobile never creates one — Vault creation is web-only —
  and `MobileVaultCrypto` keys are raw `Uint8Array`, not a non-extractable WebCrypto `CryptoKey`.
  Nothing was relaxed to make this work.
- **Not trusted on the way back.** `storedKeyOpensVault` must find a Vault Blob the server actually
  holds and decrypt it before the key becomes the session key. A blob the server does **not** hold
  is skipped rather than counted as a pass: a Vault replaced on the web starts empty, so reading an
  absent blob as "the key works" would install the stale key and encrypt every later write under a
  key that Vault cannot open.
- **Deleted only on evidence.** A held blob refusing the key deletes it. A transport failure and a
  Vault holding no Ciphertext at all both raise instead, and the passphrase is asked for with the
  stored key kept — the opposite reading would cost a User the feature after one offline moment.
- **Deletion is the policy's, not the screen's**, so the keystore and what the app believes about it
  cannot diverge.
- **The session ends with its User.** A change of signed-in User drops the in-memory Master Key. A
  logout also deletes the keystore item, through `AuthProvider`'s single `onLogout` choke point.
- **No error object reaches the UI.** `describeBiometricAttempt` returns fixed copy, so a platform
  error string can never carry key material onto the screen.
- **It authorizes nothing new.** `authorizesPassphraseReset` is a pinned
  `satisfies Record<VaultUnlockSecret, …>` table, and `biometric` is `false` in it. It has no
  production reader because mobile offers no passphrase reset at all; it exists so that adding one
  cannot quietly make a biometric unlock sufficient for it.

## Residual risk, accepted

ADR 0108's own Consequences section carries the headline one: the plaintext Master Key now rests on
a device under hardware-backed protection, and a device compromise that defeats the platform
biometric gate reads it. That is the accepted cost, and the reason the item is opt-in and dies with
logout.

Three smaller ones:

- The base64 of the Master Key transits the JS heap on write and on read. Unavoidable with a
  JS-side keystore API.
- The Privacy Cover is only as early as `AppState` reports. On Android `FLAG_SECURE` is stronger and
  is a native-side change this cover does not replace.
- Cancelled and invalidated reads are told apart by error text, because neither platform hands React
  Native a stable code for them across the bridge. Anything unrecognised falls to `failed`, which
  keeps the item and asks for the passphrase — the safe direction.

## Not answered here

On-device verification — Face ID on iOS, fingerprint on Android, an enrolment change disabling the
feature, and the app switcher showing the cover — needs hardware, and is the QA plan's.
