import {
  toAuthErrorFromMessage,
  type AuthErrorCode,
} from '@myorganizer/auth/portable';
import { extractServerMessage, isNetworkError } from './httpErrorShape';

/** Every way a sign-in can fail, as the Sign in screen tells them apart. */
export type LoginFailure =
  | 'wrong-credentials'
  | 'unverified'
  | 'disabled'
  | 'offline'
  | 'unknown';

/**
 * Where a failure is shown (Entry · Sign in sheets).
 *
 * - `password` — under the password field, on its red edge: the one failure
 *   that is about what was typed.
 * - `notice` — a line above Sign in, for a failure that retyping won't fix.
 */
export type LoginFailurePlacement = 'password' | 'notice';

/**
 * How loud a `notice` is. The sheets draw the unverified and offline lines
 * with the amber mark and the disabled one with the red; the line itself is
 * body text in every case.
 */
export type LoginFailureMark = 'warning' | 'error';

export interface LoginFailureCopy {
  message: string;
  placement: LoginFailurePlacement;
  mark: LoginFailureMark;
}

/**
 * What each failure reads as and where it goes, pinned to the failure set so
 * a new failure cannot be added without a sentence and a place (ADR 0053).
 * Never the raw backend text.
 */
export const LOGIN_FAILURES = {
  'wrong-credentials': {
    message: 'That email and password don’t match. Check both and try again.',
    placement: 'password',
    mark: 'error',
  },
  unverified: {
    message: 'Verify your email from the link we sent, then sign in.',
    placement: 'notice',
    mark: 'warning',
  },
  disabled: {
    message: 'This account has been disabled, so it can’t sign in.',
    placement: 'notice',
    mark: 'error',
  },
  offline: {
    message: 'You’re offline. Connect to the internet to sign in.',
    placement: 'notice',
    mark: 'warning',
  },
  // Not drawn: the sheets show the four failures above, and anything else
  // reaching Sign in is the server misbehaving rather than the User.
  unknown: {
    message: 'Sign in didn’t work. Try again.',
    placement: 'notice',
    mark: 'error',
  },
} as const satisfies Record<LoginFailure, LoginFailureCopy>;

/**
 * The backend's own classified codes that Sign in explains. Any other code —
 * one that cannot answer a login, like `email_already_registered` — reads as
 * `unknown` rather than borrowing a sentence meant for something else.
 */
const FAILURE_BY_AUTH_CODE: Partial<Record<AuthErrorCode, LoginFailure>> = {
  invalid_credentials: 'wrong-credentials',
  email_not_verified: 'unverified',
  account_disabled: 'disabled',
};

/**
 * Classifies a thrown login error by the backend's own message rather than
 * its HTTP status — a wrong password and a Disabled User both answer 401, and
 * only the message tells them apart.
 */
export function classifyLoginError(err: unknown): LoginFailure {
  if (isNetworkError(err)) return 'offline';

  const serverMessage = extractServerMessage(err);
  if (serverMessage == null) return 'unknown';

  const { code } = toAuthErrorFromMessage(serverMessage);
  return FAILURE_BY_AUTH_CODE[code] ?? 'unknown';
}

/** The copy and placement for a thrown login error. */
export function describeLoginError(err: unknown): LoginFailureCopy {
  return LOGIN_FAILURES[classifyLoginError(err)];
}
