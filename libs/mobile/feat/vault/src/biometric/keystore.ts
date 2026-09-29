// The keystore Platform Adapter behind Biometric Unlock (ADR 0108 decision 7):
// one interface for reading, writing, and deleting this User's Master Key in
// the iOS Keychain or the Android Keystore, and for learning whether the
// device offers a strong biometric at all.
//
// Everything above this file — when to offer, when to fall back, when to
// delete, what a biometric unlock authorizes — is a pure policy over this
// interface and lives in ./biometricPolicy.ts, so those rules are tested
// against a fake rather than on a device. This file holds the half that can
// only be checked on one: the access-control flags and the mapping from a
// platform error to an outcome the policy can act on.

/** How a keystore read ended. */
export type BiometricKeystoreRead =
  /** The biometric check passed and this is what was stored. */
  | { outcome: 'ok'; masterKeyBase64: string }
  /** The User dismissed the prompt. The item is untouched and still usable. */
  | { outcome: 'cancelled' }
  /** Nothing is stored for this User on this device. */
  | { outcome: 'missing' }
  /**
   * The item is there but can no longer be opened — the device's biometric
   * enrolment changed, which is exactly what `BIOMETRY_CURRENT_SET` and the
   * Android Keystore's strong-biometric key are configured to make happen.
   * The item is dead and the policy deletes it.
   */
  | { outcome: 'invalidated' }
  /** Anything else. Falls back to the passphrase and keeps the item. */
  | { outcome: 'failed'; error: unknown };

/** How a keystore write ended. */
export type BiometricKeystoreWrite =
  /** The biometric check passed and the item is stored. */
  | 'written'
  /** The User dismissed the biometric check. Nothing is stored. */
  | 'cancelled';

/**
 * Which biometric the device gates the item on, as copy names it: "Unlock
 * with Face ID" on an iPhone with Face ID, "Unlock with fingerprint" on an
 * Android phone with a sensor. `biometrics` is the fallback for a device that
 * says it has a strong biometric without saying which.
 */
export type BiometricMethod =
  | 'face-id'
  | 'touch-id'
  | 'fingerprint'
  | 'biometrics';

/**
 * The keystore, as the Biometric Unlock policy sees it.
 *
 * Every read, write, and delete takes the User id, because the item is bound to one User and
 * another User signing in on the same device must never reach it (ADR 0108
 * decision 3). There is no "current user" on this interface to get wrong.
 */
export interface BiometricKeystore {
  /**
   * Whether this device can gate an item on a strong biometric right now —
   * hardware present and something enrolled. A device that answers `false`
   * is never offered Biometric Unlock.
   */
  isSupported(): Promise<boolean>;

  /** Which biometric the prompt will ask for. Asked once per User session. */
  method(): Promise<BiometricMethod>;

  /**
   * Whether an item exists for this User. Deliberately does **not** raise the
   * biometric prompt: the Unlock screen asks this to decide whether to show
   * the button at all, and a prompt raised to answer that question would be a
   * prompt the User never asked for.
   */
  has(userId: string): Promise<boolean>;

  /**
   * Store this User's Master Key behind the strong-biometric gate, raising
   * the biometric check as part of the write — turning Biometric Unlock on
   * asks for the passphrase, *then* the biometric (#908), and a write the User
   * cancels stores nothing. Throws when the platform refuses the item.
   */
  write(
    userId: string,
    masterKeyBase64: string,
  ): Promise<BiometricKeystoreWrite>;

  /** Read it back, raising the platform's biometric prompt. */
  read(userId: string): Promise<BiometricKeystoreRead>;

  /** Delete it. Succeeds whether or not there was anything there. */
  remove(userId: string): Promise<void>;
}
