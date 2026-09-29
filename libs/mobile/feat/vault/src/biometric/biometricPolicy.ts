// The Biometric Unlock policy: when to offer it, what enabling it requires,
// how an unlock attempt ends, and when the stored key is deleted.
//
// Pure over the keystore Platform Adapter (ADR 0108 decision 7) and over one
// caller-supplied check, so every rule below is exercised against a fake
// keystore in a plain Node Jest environment rather than on a device. Nothing
// here reaches the network, the keychain, or `react-native-quick-crypto`, and
// nothing here holds state: the in-memory Master Key belongs to the Vault
// session, and this module only ever hands one back.
import { base64ToBytes, bytesToBase64 } from '../bytes';
import type { VaultUnlockSecret } from '../unlock';
import type { BiometricKeystore } from './keystore';

/** Where Biometric Unlock stands for one User on this device. */
export type BiometricUnlockState =
  /** The device has no strong biometric this app can gate on. */
  | 'unsupported'
  /** Available, and this User has not turned it on here. */
  | 'off'
  /** This User has a Master Key stored on this device. */
  | 'on';

/** How turning Biometric Unlock on ended. */
export type BiometricEnrolment =
  | { outcome: 'enabled' }
  /** The User dismissed the biometric check. Nothing was stored. */
  | { outcome: 'cancelled' }
  /**
   * Refused before anything was written.
   *
   * - `not-passphrase` — the Vault was opened by a Recovery Key or by
   *   Biometric Unlock itself, neither of which may mint a new way in.
   * - `stale-passphrase` — the passphrase was produced too long ago to stand
   *   for the User being here now. The way forward is to ask for it again.
   * - `unsupported` — the device has no strong biometric to gate the item.
   */
  | {
      outcome: 'refused';
      reason: 'not-passphrase' | 'stale-passphrase' | 'unsupported';
    }
  /** The keystore would not take it. Nothing was stored. */
  | { outcome: 'failed'; error: unknown };

/** How a Biometric Unlock attempt ended. */
export type BiometricUnlockAttempt =
  /** The check passed and the stored key opens this Vault. */
  | { outcome: 'unlocked'; masterKey: Uint8Array }
  /**
   * The User dismissed the prompt. The stored key is untouched, the Unlock
   * screen waits, and the passphrase and the Recovery Key are still there
   * (ADR 0108 decision 2).
   */
  | { outcome: 'cancelled' }
  /**
   * Biometric Unlock is gone for this User on this device, and the stored item
   * with it. `invalidated` is the device's enrolment having changed;
   * `stale` is a key that no longer opens this Vault (ADR 0108 decision 5);
   * `missing` is there having been nothing stored, which deletes nothing.
   */
  | { outcome: 'unavailable'; reason: 'invalidated' | 'stale' | 'missing' }
  /**
   * The attempt failed for a reason that says nothing about the stored key —
   * a transport failure while checking it, an unrecognised platform error.
   * The item is kept and the passphrase is asked for.
   */
  | { outcome: 'failed'; error: unknown };

/**
 * How long a passphrase unlock stands for the User being present.
 *
 * Two minutes, and the number is doing one job: separating "the User just
 * typed their passphrase and is looking at the offer" from "this session was
 * opened by a passphrase at some point today". Long enough that reading the
 * offer, and a slow biometric prompt behind it, both fit; short enough that a
 * phone left unlocked on a desk is outside it.
 */
export const ENROLMENT_FRESHNESS_MS = 2 * 60_000;

/**
 * What a caller offers as its authority to turn Biometric Unlock on: which
 * secret opened the Vault, and when.
 */
export interface EnrolmentAuthorization {
  /** Which secret produced the current Vault Unlock. */
  secret: VaultUnlockSecret;
  /** When that unlock completed, as `Date.now()`, or `null` while locked. */
  unlockedAt: number | null;
  /** Now, as `Date.now()`. */
  now: number;
}

/**
 * Whether this authority may turn Biometric Unlock on.
 *
 * Two rules, and they are the two halves of ADR 0108 decision 1:
 *
 * - **Only a passphrase unlock may.** A biometric check alone proves that some
 *   face or finger enrolled on the device is present, not that its holder
 *   knows the passphrase, and a Recovery Key unlock is the one a User makes
 *   when they have lost the passphrase. Neither is grounds for minting a third
 *   way in.
 * - **And it must be recent.** Which secret opened a session is a fact that
 *   stays true for the whole life of that session, so on its own it says
 *   nothing about who is holding the phone now — and "an unattended unlocked
 *   session must not be enough for that" is the decision's own words. That is
 *   what makes turning it on from Account a fresh passphrase prompt rather
 *   than a switch: Account re-unlocks, which mints a new confirmation, and
 *   this refuses until it does.
 *
 * A `now` before `unlockedAt` — the device clock moved under the session —
 * refuses. Unlike the Auto-Lock decision, which locks when it cannot tell, the
 * safe direction here is to withhold: the cost of refusing is a passphrase
 * prompt, and the cost of allowing is a new way into the Vault.
 */
export function mayEnableBiometricUnlock({
  secret,
  unlockedAt,
  now,
}: EnrolmentAuthorization): boolean {
  if (secret !== 'passphrase') return false;
  if (unlockedAt === null) return false;
  const age = now - unlockedAt;
  return age >= 0 && age <= ENROLMENT_FRESHNESS_MS;
}

/**
 * Where Biometric Unlock stands for this User, without raising a prompt.
 *
 * Asked by the Unlock screen to decide whether to show the button, and by the
 * offer to decide whether there is anything to offer. The User id is what
 * makes the answer per User: a second User signing in on this device is `off`
 * however many keys the first one stored (ADR 0108 decision 3).
 */
export async function readBiometricUnlockState(
  keystore: BiometricKeystore,
  userId: string,
): Promise<BiometricUnlockState> {
  if (!(await keystore.isSupported())) return 'unsupported';
  return (await keystore.has(userId)) ? 'on' : 'off';
}

/**
 * Turn Biometric Unlock on for this User, writing the Master Key to the
 * keystore behind the strong-biometric gate.
 *
 * This is the **one** write of the Master Key anywhere on the device (ADR
 * 0108 decision 1). It is refused outright unless the authority offered is a
 * recent passphrase unlock, and refused when the device has no biometric to
 * gate it with — in every case before anything is stored.
 */
export async function enableBiometricUnlock(params: {
  keystore: BiometricKeystore;
  userId: string;
  masterKey: Uint8Array;
  authorization: EnrolmentAuthorization;
}): Promise<BiometricEnrolment> {
  if (params.authorization.secret !== 'passphrase') {
    return { outcome: 'refused', reason: 'not-passphrase' };
  }
  if (!mayEnableBiometricUnlock(params.authorization)) {
    return { outcome: 'refused', reason: 'stale-passphrase' };
  }
  if (!(await params.keystore.isSupported())) {
    return { outcome: 'refused', reason: 'unsupported' };
  }

  try {
    const written = await params.keystore.write(
      params.userId,
      bytesToBase64(params.masterKey),
    );
    return written === 'written'
      ? { outcome: 'enabled' }
      : { outcome: 'cancelled' };
  } catch (error) {
    return { outcome: 'failed', error };
  }
}

/**
 * Turn Biometric Unlock off for this User on this device.
 *
 * The one call behind every way it ends: a logout, an invalidated or stale
 * key, and — once that screen exists — the Account switch. It is idempotent,
 * because two of those three reach it without knowing whether there is
 * anything there.
 */
export async function disableBiometricUnlock(
  keystore: BiometricKeystore,
  userId: string,
): Promise<void> {
  await keystore.remove(userId);
}

/**
 * Whether a Master Key read out of the keystore still opens this User's Vault.
 *
 * Supplied by the caller because answering it needs the server's Ciphertext,
 * which this module deliberately cannot reach. Its contract is what makes
 * deletion safe: resolve `false` **only** on positive evidence the key is
 * wrong — a decryption that failed — and *throw* when the question could not
 * be answered at all, which a transport failure is. A `false` returned in
 * place of "could not tell" deletes a key that was never broken, and one
 * offline moment would cost the User the feature.
 */
export type StoredMasterKeyCheck = (masterKey: Uint8Array) => Promise<boolean>;

/**
 * Attempt a Biometric Unlock for this User: raise the platform prompt, read
 * the Master Key back, and confirm it still opens the Vault before handing it
 * over.
 *
 * Every ending that means the stored key is gone deletes it here rather than
 * leaving that to the screen, so the keystore and what the app believes about
 * it cannot disagree. A cancellation and an unrecognised failure delete
 * nothing: neither is evidence about the key.
 *
 * No key derivation happens on this path at any point. That is the feature —
 * the Master Key is read, not derived — and it is why a Biometric Unlock
 * shows no deriving state.
 */
export async function unlockWithBiometrics(params: {
  keystore: BiometricKeystore;
  userId: string;
  stillOpensVault: StoredMasterKeyCheck;
}): Promise<BiometricUnlockAttempt> {
  const { keystore, userId } = params;
  const read = await keystore.read(userId);

  switch (read.outcome) {
    case 'cancelled':
      return { outcome: 'cancelled' };

    case 'missing':
      return { outcome: 'unavailable', reason: 'missing' };

    case 'invalidated':
      await disableBiometricUnlock(keystore, userId);
      return { outcome: 'unavailable', reason: 'invalidated' };

    case 'failed':
      return { outcome: 'failed', error: read.error };

    case 'ok': {
      const masterKey = base64ToBytes(read.masterKeyBase64);
      let opens: boolean;
      try {
        opens = await params.stillOpensVault(masterKey);
      } catch (error) {
        // The check could not be made, so nothing was learnt about the key.
        // Keep it and ask for the passphrase.
        return { outcome: 'failed', error };
      }

      if (!opens) {
        await disableBiometricUnlock(keystore, userId);
        return { outcome: 'unavailable', reason: 'stale' };
      }

      return { outcome: 'unlocked', masterKey };
    }
  }
}
