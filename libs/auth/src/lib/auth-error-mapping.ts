import type { AuthError, AuthErrorCode } from './auth-session-types';

function classifyMessage(message: string): AuthErrorCode {
  const normalized = message.toLowerCase();

  if (normalized.includes('email not verified')) {
    return 'email_not_verified';
  }

  if (normalized.includes('email already registered')) {
    return 'email_already_registered';
  }

  if (normalized.includes('resent') && normalized.includes('verification')) {
    return 'verification_resent';
  }

  if (
    normalized.includes('invalid') &&
    (normalized.includes('credential') || normalized.includes('password'))
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
