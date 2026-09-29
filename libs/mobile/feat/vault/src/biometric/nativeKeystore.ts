// The real keystore Platform Adapter: `react-native-keychain` over the iOS
// Keychain and the Android Keystore.
//
// Split from ./keystore.ts, which is the interface and the outcome vocabulary,
// so the policy and its tests can import the interface without pulling a
// native module into a Node Jest environment.
import * as Keychain from 'react-native-keychain';
import type { BiometricKeystore, BiometricKeystoreRead } from './keystore';

/**
 * One keychain service per User, so the item is bound to that User and a
 * second User signing in here reads a service that does not exist rather than
 * the first User's key (ADR 0108 decision 3). Distinct from the auth
 * refresh-token service, which is device-wide and holds no key material.
 */
function serviceFor(userId: string): string {
  return `com.myorganizer.vault.masterkey.${userId}`;
}

/** The username slot the keychain requires. Carries nothing. */
const ACCOUNT = 'master_key';

const AUTHENTICATION_PROMPT = {
  title: 'Unlock your vault',
  cancel: 'Use passphrase',
} as const;

/**
 * The write flags, and the whole of what makes this storage rather than a
 * second copy of the Master Key lying around.
 *
 * On **iOS**, where both halves of ADR 0108 decision 1 hold:
 *
 * - `BIOMETRY_CURRENT_SET` is the invalidation rule. The item dies when the
 *   device's enrolment changes, so a finger or face added afterwards does not
 *   inherit the Vault. `BIOMETRY_ANY` would.
 * - `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY` refuses to exist on a device with no
 *   passcode and never migrates to a new one, so the key cannot ride an
 *   encrypted backup onto somebody else's phone.
 *
 * On **Android**, only the first half holds, and this comment says so rather
 * than implying the pair. `AES_GCM` is the storage whose Keystore key
 * `react-native-keychain` generates with `setUserAuthenticationRequired(true)`
 * and `AUTH_BIOMETRIC_STRONG` — far better than `AES_GCM_NO_AUTH`, which
 * would store the Master Key behind no check at all. But the library never
 * calls `setInvalidatedByBiometricEnrollment`, and it passes
 * `AUTH_BIOMETRIC_STRONG or AUTH_DEVICE_CREDENTIAL` with a five-second
 * validity window, so on Android:
 *
 * - the item is **not** destroyed when the enrolment set changes — a
 *   fingerprint added later does open it;
 * - the device credential (PIN, pattern, password) authorizes the key as well
 *   as a biometric, even though `accessControl` keeps the *prompt*
 *   biometric-only — Android reads `accessControl` to choose what the prompt
 *   offers, not to constrain the key.
 *
 * Closing that gap needs the native key spec, which this library does not
 * expose, so it is a known limitation of this slice rather than something the
 * options object above can fix. It is recorded as such instead of being
 * claimed away.
 *
 * `securityLevel` is deliberately not pinned to `SECURE_HARDWARE`: it is an
 * assertion that fails the write outright on a device without a TEE, and
 * refusing the feature there is worse than a strong-biometric software key —
 * the passphrase is still the only other way in either way.
 */
const WRITE_OPTIONS: Keychain.SetOptions = {
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
  accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  storage: Keychain.STORAGE_TYPE.AES_GCM,
  authenticationPrompt: AUTHENTICATION_PROMPT,
};

/**
 * Platform error text that means the User dismissed the prompt rather than
 * failing it. Matched on text because neither platform hands React Native a
 * stable machine-readable code for this: iOS maps `errSecUserCanceled` to the
 * sentence below before it crosses the bridge, and Android's biometric prompt
 * reports a cancellation as a generic keystore access error carrying one of
 * these strings.
 */
const CANCELLED_MARKERS = [
  'user canceled',
  'user cancelled',
  'usercancel',
  'code: 13', // Android BiometricPrompt ERROR_NEGATIVE_BUTTON
  'code: 10', // Android BiometricPrompt ERROR_USER_CANCELED
  'operation was canceled',
  'authentication was cancelled',
];

/**
 * Platform error text that means the stored item can no longer be opened
 * because the device's biometric enrolment changed.
 *
 * `KeyPermanentlyInvalidatedException` is Android's name for it, and it is
 * matched here because an Android key *can* still be invalidated for reasons
 * other than enrolment — the screen lock being removed destroys every
 * auth-bound key. It is not, per the write options above, raised by an
 * enrolment change on this configuration. On iOS the invalidated item is
 * reported as missing rather than as an error, which `has` already tells
 * apart.
 */
const INVALIDATED_MARKERS = [
  'keypermanentlyinvalidated',
  'key permanently invalidated',
  'biometric enrollment',
  'key user not authenticated',
];

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  return String(error);
}

function matches(text: string, markers: readonly string[]): boolean {
  const lowered = text.toLowerCase();
  return markers.some((marker) => lowered.includes(marker));
}

/**
 * A thrown read, classified.
 *
 * The three outcomes are not equally costly to get wrong, and the default is
 * chosen accordingly: `failed` keeps the item and asks for the passphrase,
 * which is always safe, while `invalidated` deletes it. So anything this
 * cannot positively recognise is `failed` — a misread cancellation costs the
 * User one extra tap, and a misread transient error would cost them the
 * feature.
 */
function classifyReadError(error: unknown): BiometricKeystoreRead {
  const text = describe(error);
  if (matches(text, INVALIDATED_MARKERS)) return { outcome: 'invalidated' };
  if (matches(text, CANCELLED_MARKERS)) return { outcome: 'cancelled' };
  return { outcome: 'failed', error };
}

class NativeBiometricKeystore implements BiometricKeystore {
  async isSupported(): Promise<boolean> {
    try {
      return (await Keychain.getSupportedBiometryType()) !== null;
    } catch {
      // A device that cannot answer the question is not offered the feature.
      return false;
    }
  }

  async has(userId: string): Promise<boolean> {
    try {
      return await Keychain.hasGenericPassword({
        service: serviceFor(userId),
      });
    } catch {
      return false;
    }
  }

  async write(userId: string, masterKeyBase64: string): Promise<void> {
    const result = await Keychain.setGenericPassword(ACCOUNT, masterKeyBase64, {
      ...WRITE_OPTIONS,
      service: serviceFor(userId),
    });
    // `setGenericPassword` resolves `false` rather than throwing when the
    // platform refuses the item — no passcode set, no biometric enrolled. The
    // caller has to hear that as a failure, or the User is told Biometric
    // Unlock is on when nothing was stored.
    if (result === false) {
      throw new Error('The keystore refused to store the vault key.');
    }
  }

  async read(userId: string): Promise<BiometricKeystoreRead> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: serviceFor(userId),
        authenticationPrompt: AUTHENTICATION_PROMPT,
      });
      if (credentials === false) return { outcome: 'missing' };
      return { outcome: 'ok', masterKeyBase64: credentials.password };
    } catch (error) {
      return classifyReadError(error);
    }
  }

  async remove(userId: string): Promise<void> {
    await Keychain.resetGenericPassword({ service: serviceFor(userId) });
  }
}

/** The keystore this app runs against on a device. */
export const nativeBiometricKeystore: BiometricKeystore =
  new NativeBiometricKeystore();
