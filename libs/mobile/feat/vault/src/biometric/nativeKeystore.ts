// The real keystore Platform Adapter: `react-native-keychain` over the iOS
// Keychain, and this app's own `RNBiometricKeystore` module over the Android
// Keystore.
//
// Split from ./keystore.ts, which is the interface and the outcome vocabulary,
// so the policy and its tests can import the interface without pulling a
// native module into a Node Jest environment.
import { NativeModules, Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import type {
  BiometricKeystore,
  BiometricKeystoreRead,
  BiometricKeystoreWrite,
  BiometricMethod,
} from './keystore';

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
 * The iOS write flags, and the whole of what makes this storage rather than a
 * second copy of the Master Key lying around (ADR 0108 decision 1):
 *
 * - `BIOMETRY_CURRENT_SET` is the invalidation rule. The item dies when the
 *   device's enrolment changes, so a finger or face added afterwards does not
 *   inherit the Vault. `BIOMETRY_ANY` would.
 * - `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY` refuses to exist on a device with no
 *   passcode and never migrates to a new one, so the key cannot ride an
 *   encrypted backup onto somebody else's phone.
 *
 * Android does not use this library: its Keystore key is generated with a
 * five-second validity window that also accepts the device credential and is
 * never invalidated by an enrolment change, and it exposes no way to change
 * that. `RNBiometricKeystore` (apps/mobile/android, `biometrickeystore`) owns
 * the key spec there instead.
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
 * On iOS the invalidated item is reported as missing rather than as an error,
 * which `has` already tells apart. The Android markers stay for the one case
 * this adapter runs there — a build without `RNBiometricKeystore` — where a
 * `KeyPermanentlyInvalidatedException` still means the key is gone.
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

/** What iOS calls the biometric this item is gated on. */
function iosMethod(type: Keychain.BIOMETRY_TYPE | null): BiometricMethod {
  if (type === Keychain.BIOMETRY_TYPE.FACE_ID) return 'face-id';
  if (type === Keychain.BIOMETRY_TYPE.TOUCH_ID) return 'touch-id';
  return 'biometrics';
}

class KeychainBiometricKeystore implements BiometricKeystore {
  async isSupported(): Promise<boolean> {
    try {
      return (await Keychain.getSupportedBiometryType()) !== null;
    } catch {
      // A device that cannot answer the question is not offered the feature.
      return false;
    }
  }

  async method(): Promise<BiometricMethod> {
    try {
      return iosMethod(await Keychain.getSupportedBiometryType());
    } catch {
      return 'biometrics';
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

  async write(
    userId: string,
    masterKeyBase64: string,
  ): Promise<BiometricKeystoreWrite> {
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

    // A Keychain write raises no prompt, so the biometric check is a read
    // straight back. Anything short of the same key coming out removes the
    // item: turning Biometric Unlock on is not done until Face ID has been
    // passed once.
    const check = await this.read(userId);
    if (check.outcome === 'ok' && check.masterKeyBase64 === masterKeyBase64) {
      return 'written';
    }
    await this.remove(userId);
    if (check.outcome === 'cancelled') return 'cancelled';
    throw check.outcome === 'failed'
      ? check.error
      : new Error('The stored vault key could not be read back.');
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

/** The Android module's surface. See RNBiometricKeystoreModule.kt. */
interface RNBiometricKeystoreModule {
  isSupported(): Promise<boolean>;
  method(): Promise<'fingerprint' | 'biometrics'>;
  has(userId: string): Promise<boolean>;
  write(
    userId: string,
    value: string,
    title: string,
    cancel: string,
  ): Promise<null>;
  read(userId: string, title: string, cancel: string): Promise<string>;
  remove(userId: string): Promise<null>;
}

/** The rejection codes RNBiometricKeystoreModule settles with. */
function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * The Android keystore: a per-User AES key that needs a strong biometric for
 * every use and dies when the enrolment changes, so here — unlike through
 * `react-native-keychain` — a fingerprint enrolled later does not open the
 * Vault, and neither does the device PIN.
 */
class AndroidBiometricKeystore implements BiometricKeystore {
  constructor(private readonly native: RNBiometricKeystoreModule) {}

  async isSupported(): Promise<boolean> {
    try {
      return await this.native.isSupported();
    } catch {
      return false;
    }
  }

  async method(): Promise<BiometricMethod> {
    try {
      return await this.native.method();
    } catch {
      return 'biometrics';
    }
  }

  async has(userId: string): Promise<boolean> {
    try {
      return await this.native.has(userId);
    } catch {
      return false;
    }
  }

  async write(
    userId: string,
    masterKeyBase64: string,
  ): Promise<BiometricKeystoreWrite> {
    try {
      await this.native.write(
        userId,
        masterKeyBase64,
        AUTHENTICATION_PROMPT.title,
        AUTHENTICATION_PROMPT.cancel,
      );
      return 'written';
    } catch (error) {
      if (codeOf(error) === 'E_CANCELLED') return 'cancelled';
      throw error;
    }
  }

  async read(userId: string): Promise<BiometricKeystoreRead> {
    try {
      const masterKeyBase64 = await this.native.read(
        userId,
        AUTHENTICATION_PROMPT.title,
        AUTHENTICATION_PROMPT.cancel,
      );
      return { outcome: 'ok', masterKeyBase64 };
    } catch (error) {
      switch (codeOf(error)) {
        case 'E_CANCELLED':
          return { outcome: 'cancelled' };
        case 'E_INVALIDATED':
          return { outcome: 'invalidated' };
        case 'E_MISSING':
          return { outcome: 'missing' };
        default:
          return { outcome: 'failed', error };
      }
    }
  }

  async remove(userId: string): Promise<void> {
    await this.native.remove(userId);
  }
}

const androidModule = (
  NativeModules as { RNBiometricKeystore?: RNBiometricKeystoreModule }
).RNBiometricKeystore;

/** The keystore this app runs against on a device. */
export const nativeBiometricKeystore: BiometricKeystore =
  Platform.OS === 'android' && androidModule != null
    ? new AndroidBiometricKeystore(androidModule)
    : new KeychainBiometricKeystore();
