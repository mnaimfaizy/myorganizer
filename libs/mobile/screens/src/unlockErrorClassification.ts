import { httpStatus, isNetworkError } from './httpErrorShape';

export type UnlockSecretMode = 'passphrase' | 'recovery-key';

export type UnlockFailure =
  | 'no-vault'
  | 'network'
  | 'server-error'
  | 'wrong-secret';

export const UNLOCK_NETWORK_ERROR_MESSAGE =
  'Network error — check your connection and try again.';
export const UNLOCK_SERVER_ERROR_MESSAGE =
  'Your Vault couldn’t be loaded. Try again.';

/**
 * The Unlock screen's own offline line (Entry · Unlock · Offline), shown both
 * while the device reports no connection and when an attempt fails for want
 * of one. It says why rather than only that: nothing of the Vault is kept on
 * the phone (ADR 0107), so there is nothing to unlock without the server.
 */
export const UNLOCK_OFFLINE_MESSAGE =
  'Unlocking needs a connection. Your Vault isn’t stored on this phone.';

const WRONG_PASSPHRASE_LINE = 'That passphrase didn’t unlock your Vault.';
const WRONG_RECOVERY_KEY_LINE =
  'That Recovery Key didn’t unlock your Vault. Check each group.';

/**
 * What each typed secret's wrong-secret line says (Entry · Unlock · Wrong and
 * Recovery · Wrong), pinned to the secret set (ADR 0053). The Recovery Key's
 * asks the User to check each group, because one mistyped group is the likely
 * cause of a 44-character key failing.
 */
const WRONG_SECRET_MESSAGES = {
  passphrase: WRONG_PASSPHRASE_LINE,
  'recovery-key': WRONG_RECOVERY_KEY_LINE,
} as const satisfies Record<UnlockSecretMode, string>;

/**
 * Classifies an unlock failure by transport shape, not by message: a 404
 * means there is no vault yet, any other server response is a load failure,
 * a transport error with none is offline, and anything else is the AES-GCM
 * auth-tag failure of a wrong secret.
 */
export function classifyUnlockFailure(err: unknown): UnlockFailure {
  const status = httpStatus(err);
  if (status === 404) return 'no-vault';
  if (status != null) return 'server-error';
  if (isNetworkError(err)) return 'network';
  return 'wrong-secret';
}

export function describeWrongSecret(secret: UnlockSecretMode): string {
  // The fallback covers a caller outside the type system (a test passing an
  // arbitrary string); every typed caller hits the table.
  return WRONG_SECRET_MESSAGES[secret] ?? WRONG_SECRET_MESSAGES.passphrase;
}

export function describeUnlockFailure(
  failure: UnlockFailure,
  secret: UnlockSecretMode,
): string {
  switch (failure) {
    case 'network':
      return UNLOCK_NETWORK_ERROR_MESSAGE;
    case 'server-error':
      return UNLOCK_SERVER_ERROR_MESSAGE;
    case 'wrong-secret':
      return describeWrongSecret(secret);
    case 'no-vault':
      return '';
  }
}

/** Strips whitespace so a pasted key — grouped or not — decodes the same way. */
export function stripRecoveryKeyWhitespace(value: string): string {
  return value.replace(/\s+/g, '');
}

/**
 * Displays the raw key in groups of four (Entry · Recovery sheets). The web
 * shows and copies it as one unbroken string, so the grouping is display only
 * — `stripRecoveryKeyWhitespace` takes it back out before decoding.
 */
export function formatRecoveryKeyForDisplay(raw: string): string {
  return raw.replace(/(.{4})/g, '$1 ').trimEnd();
}
