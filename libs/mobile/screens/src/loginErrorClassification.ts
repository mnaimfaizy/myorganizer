import {
  toAuthErrorFromMessage,
  type AuthErrorCode,
} from '@myorganizer/auth/portable';
import { extractServerMessage, isNetworkError } from './httpErrorShape';

/** What each classified login failure reads as. Never the raw backend text. */
export const LOGIN_ERROR_MESSAGES: Partial<Record<AuthErrorCode, string>> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_verified: 'Verify your email before signing in.',
  account_disabled: 'This account has been disabled. Contact support for help.',
};
export const DEFAULT_LOGIN_ERROR_MESSAGE = 'Sign in failed. Please try again.';
export const LOGIN_NETWORK_ERROR_MESSAGE =
  'Network error — check your connection and try again.';

/**
 * Maps a thrown login error to user-facing copy, by classifying the
 * backend's own message rather than its HTTP status — a wrong password and a
 * Disabled User both answer 401, and only the message tells them apart.
 */
export function describeLoginError(err: unknown): string {
  if (isNetworkError(err)) return LOGIN_NETWORK_ERROR_MESSAGE;

  const serverMessage = extractServerMessage(err);
  if (serverMessage == null) return DEFAULT_LOGIN_ERROR_MESSAGE;

  const { code } = toAuthErrorFromMessage(serverMessage);
  return LOGIN_ERROR_MESSAGES[code] ?? DEFAULT_LOGIN_ERROR_MESSAGE;
}
