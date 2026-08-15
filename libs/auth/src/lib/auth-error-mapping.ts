import type { AuthError, AuthErrorCode } from './auth-session-types';

function classifyMessage(message: string): AuthErrorCode {
  const normalized = message.toLowerCase();

  if (normalized.includes('email not verified')) {
    return 'email_not_verified';
  }

  // Ordering is load-bearing. The backend's resend message — "Email already
  // registered but isn't verified yet. We've resent the verification email." —
  // satisfies both of these, and the generic one used to be tested first, so
  // `verification_resent` was unreachable. The specific case wins: telling the
  // user their email was resent is more actionable than telling them the
  // address is taken.
  if (normalized.includes('resent') && normalized.includes('verification')) {
    return 'verification_resent';
  }

  if (normalized.includes('email already registered')) {
    return 'email_already_registered';
  }

  // The backend rejects a bad password with 'Incorrect email or password!'
  // (apps/backend/src/utils/passport.ts). Matching only on the word 'invalid'
  // meant that message — the most common login failure there is — fell through
  // to 'unknown', leaving `invalid_credentials` unreachable in practice.
  if (
    normalized.includes('incorrect email or password') ||
    (normalized.includes('invalid') &&
      (normalized.includes('credential') || normalized.includes('password')))
  ) {
    return 'invalid_credentials';
  }

  if (normalized.includes('network')) {
    return 'network_error';
  }

  return 'unknown';
}

export function toAuthError(err: unknown): AuthError {
  const message = err instanceof Error ? err.message : 'Unexpected error.';
  return {
    code: classifyMessage(message),
    message,
  };
}

export function toAuthErrorFromMessage(message: string): AuthError {
  return {
    code: classifyMessage(message),
    message,
  };
}
