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
  'Could not load your vault. Please try again.';

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
  if (secret === 'recovery-key') {
    return 'That recovery key does not unlock this vault.';
  }
  return 'Incorrect passphrase. Please try again.';
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

/** Displays the raw key in groups of four, matching how the web shows it. */
export function formatRecoveryKeyForDisplay(raw: string): string {
  return raw.replace(/(.{4})/g, '$1 ').trimEnd();
}
