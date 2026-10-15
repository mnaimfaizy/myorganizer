// What the User Deletion sheets decide, with no React in it, so the node Jest
// project drives it: when the request may be sent, and what a refusal says.
import { UserDeletionBodyConfirmationEnum } from '@myorganiser/app-api-client';
import { httpStatus, isNetworkError } from './httpErrorShape';

/** What the User types to confirm, exactly as the server requires it. */
export const USER_DELETION_CONFIRMATION =
  UserDeletionBodyConfirmationEnum.Delete;

/**
 * Whether the confirm step may send the request: a password, and the
 * confirmation typed exactly — case and spacing included, as the server
 * checks it.
 */
export function canRequestUserDeletion(input: {
  password: string;
  confirmation: string;
}): boolean {
  return (
    input.password.length > 0 &&
    input.confirmation === USER_DELETION_CONFIRMATION
  );
}

/**
 * Why a deletion did not happen. In every case nothing was deleted, on the
 * server or on this device.
 *
 * - `wrong-password` — the server refused the password (403).
 * - `sync-running` — a YouTube sync is running for this User (409).
 * - `offline` — the request got no answer.
 * - `unknown` — anything else, a refusal below the Version Floor among them:
 *   Update required replaces the app for that one, so the sheet's line is
 *   never read.
 */
export type UserDeletionFailure =
  | 'wrong-password'
  | 'sync-running'
  | 'offline'
  | 'unknown';

interface UserDeletionFailureCopy {
  message: string;
  /** Under the password field, or in a notice in the sheet. */
  placement: 'password' | 'notice';
}

/** The copy for each failure. Never the raw backend text. */
export const USER_DELETION_FAILURES = {
  'wrong-password': {
    message: 'Incorrect password.',
    placement: 'password',
  },
  'sync-running': {
    message:
      'A YouTube sync is running. Try deleting your account again shortly.',
    placement: 'notice',
  },
  offline: {
    message: 'You’re offline. Your account was not deleted.',
    placement: 'notice',
  },
  unknown: {
    message: 'Your account was not deleted. Try again.',
    placement: 'notice',
  },
} as const satisfies Record<UserDeletionFailure, UserDeletionFailureCopy>;

/** Classifies what `DELETE /users/me` rejected with, by status. */
export function classifyUserDeletionError(err: unknown): UserDeletionFailure {
  if (isNetworkError(err)) return 'offline';
  const status = httpStatus(err);
  if (status === 403) return 'wrong-password';
  if (status === 409) return 'sync-running';
  return 'unknown';
}

/** The copy and placement for a refused deletion. */
export function describeUserDeletionError(
  err: unknown,
): UserDeletionFailureCopy {
  return USER_DELETION_FAILURES[classifyUserDeletionError(err)];
}
