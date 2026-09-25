/**
 * What makes a passphrase acceptable, in one place.
 *
 * The rule is not new — it was restated inline at every site that collected a
 * passphrase, which is four sites once the Vault page can change one and
 * rotate a Recovery Key. Four places that must agree about what a valid
 * passphrase is, with nothing making them agree, is the shape [ADR 0053]
 * exists to stop; this module is what they agree through.
 *
 * Length is the only requirement. Composition rules are deliberately absent: a
 * passphrase's strength is its length, and a rule stricter here than the one a
 * Vault was created under would reject the passphrase that Vault already has.
 */
import { z } from 'zod';

/**
 * The shortest passphrase a Vault will accept.
 *
 * Kept as a named export because the copy that tells a User about it should
 * read the number rather than repeat it — a threshold that moves must not
 * leave a screen still promising the old one.
 */
export const MIN_PASSPHRASE_LENGTH = 10;

export const passphraseSchema = z
  .string()
  .min(
    MIN_PASSPHRASE_LENGTH,
    `Use at least ${MIN_PASSPHRASE_LENGTH} characters.`,
  );

/**
 * The current passphrase, as a User is asked to re-enter it to authorize a
 * change to the wrapping this device holds.
 *
 * Presence is the only rule, and deliberately so. This field is not choosing a
 * passphrase, it is producing one that already exists — so `passphraseSchema`
 * would be the wrong check here: a Vault created before the threshold moved
 * has a passphrase shorter than the current minimum, and holding this field to
 * that minimum would lock its owner out of the very screen that could fix it.
 * What decides the answer is the unwrap in `rotateRecoveryKey` /
 * `changePassphrase`, not this schema; the check exists only so the User is
 * told about an empty field before a round trip.
 *
 * A named export rather than a line repeated per form: the passphrase change
 * and the Recovery Key Rotation both collect it, and this file is where the
 * two agree about it.
 */
export const currentPassphraseSchema = z
  .string()
  .min(1, 'Enter your current passphrase.');

/**
 * A new passphrase and its confirmation, for a Vault being created or
 * recovered — where there is no current passphrase to differ from.
 */
export const newPassphraseSchema = z
  .object({
    newPassphrase: passphraseSchema,
    newPassphraseConfirm: z.string(),
  })
  .refine((value) => value.newPassphrase === value.newPassphraseConfirm, {
    message: 'Both passphrases must match.',
    path: ['newPassphraseConfirm'],
  });

/**
 * A passphrase change made from an unlocked session, where the current
 * passphrase is known and must be given.
 *
 * The `newPassphrase !== currentPassphrase` rule is not tidiness. Rewrapping
 * the Master Key with the same passphrase still produces different wrapped
 * bytes, so it is a genuinely different Vault Meta: it would be pushed, every
 * other device would read it as a passphrase Vault Meta Change, and each would
 * ask the User about a change that did not happen.
 */
export const changePassphraseSchema = z
  .object({
    currentPassphrase: currentPassphraseSchema,
    newPassphrase: passphraseSchema,
    newPassphraseConfirm: z.string(),
  })
  .refine((value) => value.newPassphrase === value.newPassphraseConfirm, {
    message: 'Both passphrases must match.',
    path: ['newPassphraseConfirm'],
  })
  .refine((value) => value.newPassphrase !== value.currentPassphrase, {
    message: 'Choose a passphrase different from your current one.',
    path: ['newPassphrase'],
  });

export type ChangePassphraseInput = z.infer<typeof changePassphraseSchema>;
