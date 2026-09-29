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

/**
 * The keystore, as the Biometric Unlock policy sees it.
 *
 * Every method takes the User id, because the item is bound to one User and
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

  /**
   * Whether an item exists for this User. Deliberately does **not** raise the
   * biometric prompt: the Unlock screen asks this to decide whether to show
   * the button at all, and a prompt raised to answer that question would be a
   * prompt the User never asked for.
   */
  has(userId: string): Promise<boolean>;

  /** Store this User's Master Key behind the strong-biometric gate. */
  write(userId: string, masterKeyBase64: string): Promise<void>;

  /** Read it back, raising the platform's biometric prompt. */
  read(userId: string): Promise<BiometricKeystoreRead>;

  /** Delete it. Succeeds whether or not there was anything there. */
  remove(userId: string): Promise<void>;
}
