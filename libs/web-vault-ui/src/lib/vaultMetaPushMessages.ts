/**
 * User-facing copy for a Vault Meta Push outcome — the same split
 * `vaultSyncMessages.ts` keeps: `@myorganizer/web-vault` decides *what
 * happened* and carries no English text, and the library that shows a User
 * owns naming it.
 *
 * It lives here rather than in the Vault page library because the Vault Gate's
 * recovery branch reports the same outcomes from the same call. Copy in a page
 * library cannot be reached from the gate, so it would have to be written
 * twice — two places that must agree about what `refused-server-moved` means,
 * with nothing making them agree.
 */
import type { VaultMetaPushOutcome } from '@myorganizer/web-vault';

type PushOutcome = VaultMetaPushOutcome;

/**
 * How loudly a passphrase change's outcome should be presented.
 *
 * There is no `error` member, and its absence is the point. The local wrapping
 * is written before the server is touched and is never rolled back, so by the
 * time any of these is reported the passphrase *has* changed on this device.
 * Presenting one as a failure would tell a User their passphrase did not
 * change when it did, and send them back to a passphrase that no longer works.
 */
export type PassphraseChangeTone = 'ok' | 'pending' | 'attention';

/**
 * Every Vault Meta Push outcome, and how loudly it reads. Guarded by
 * `satisfies` so an eighth outcome fails to compile here until somebody has
 * decided what a User is told about it — see ADR 0053. A wrapping outcome
 * nobody surfaced is the failure #589 was filed for.
 */
export const PASSPHRASE_CHANGE_TONES = {
  pushed: 'ok',
  'noop-already-in-sync': 'ok',
  unreachable: 'pending',
  'skipped-not-authenticated': 'pending',
  'refused-no-base': 'pending',
  'refused-server-moved': 'attention',
  'refused-not-pushable': 'attention',
} as const satisfies Record<PushOutcome['kind'], PassphraseChangeTone>;

export type PassphraseChangeReading = {
  tone: PassphraseChangeTone;
  /** Short state label. Always present — a passphrase change always resolved. */
  title: string;
  /** What happened, and what happens next. */
  detail: string;
};

const READINGS = {
  ok: {
    title: 'Passphrase changed',
    detail:
      'Your other devices will ask you to start using it the next time they sync.',
  },
  pending: {
    title: 'Passphrase changed on this device',
    detail:
      'It has not reached your other devices yet, and will sync on its own next time. Keep using your old passphrase on them until it does.',
  },
  attention: {
    title: 'Passphrase changed on this device',
    detail:
      'A passphrase or recovery key also changed somewhere else, so this change was not sent. You will be asked to sort that out the next time you sign in.',
  },
} as const satisfies Record<
  PassphraseChangeTone,
  Omit<PassphraseChangeReading, 'tone'>
>;

export function passphraseChangeReading(
  push: PushOutcome,
): PassphraseChangeReading {
  const tone = PASSPHRASE_CHANGE_TONES[push.kind];
  return { tone, ...READINGS[tone] };
}

/**
 * How loudly a recovery key rotation's outcome should be presented.
 *
 * No `error` tone: the local wrapping is written before the server is touched,
 * so every outcome reports what actually happened, not a failure. Reporting
 * one as an error would tell a User the rotation failed when the new key is
 * already their only way in on this device.
 *
 * Every non-pushed outcome reads as `attention`, not `pending`. For a
 * passphrase change, an unsent push is an inconvenience — the User knows both
 * strings and can wait. For a rotation it means the old key the User was trying
 * to retire is still live everywhere, and losing this device before the push
 * retries means the new key goes with it. That warrants attention.
 */
export type RecoveryKeyRotationTone = 'success' | 'attention';

/**
 * Every Vault Meta Push outcome for recovery key rotation, and how loudly it
 * reads. Guarded by `satisfies` so an eighth outcome fails to compile here
 * until somebody has decided what a User is told about it — see ADR 0053.
 */
export const RECOVERY_KEY_ROTATION_TONES = {
  pushed: 'success',
  'noop-already-in-sync': 'success',
  unreachable: 'attention',
  'skipped-not-authenticated': 'attention',
  'refused-no-base': 'attention',
  'refused-server-moved': 'attention',
  'refused-not-pushable': 'attention',
} as const satisfies Record<PushOutcome['kind'], RecoveryKeyRotationTone>;

export type RecoveryKeyRotationReading = {
  tone: RecoveryKeyRotationTone;
  /** Short state label. Always present — a rotation always resolved. */
  title: string;
  /** What the state means for this device and others. */
  detail: string;
};

const RECOVERY_KEY_ROTATION_READINGS = {
  success: {
    title: 'Recovery key updated',
    detail:
      'Your old recovery key no longer works on this device, and it can no longer open your vault on a new one. Your other devices keep accepting it until you open the app on each of them and confirm the change.',
  },
  attention: {
    title: 'Recovery key waiting to sync',
    detail:
      'Your new recovery key works on this device only. Your old one still opens your vault everywhere else, including on a device you sign in on next. This device will keep trying to send the change.',
  },
} as const satisfies Record<
  RecoveryKeyRotationTone,
  Omit<RecoveryKeyRotationReading, 'tone'>
>;

export function recoveryKeyRotationReading(
  push: PushOutcome,
): RecoveryKeyRotationReading {
  const tone = RECOVERY_KEY_ROTATION_TONES[push.kind];
  return { tone, ...RECOVERY_KEY_ROTATION_READINGS[tone] };
}
