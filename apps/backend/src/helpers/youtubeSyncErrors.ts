import { describeError } from './describeError';

/**
 * True when Google rejected the refresh grant for a YouTube Connection.
 *
 * Shared by the cron Upload Sync worker and every user-initiated Sync Run so
 * a dead grant becomes Revoked in one place rather than only when cron runs.
 */
export function isRevokedTokenError(error: unknown): boolean {
  const { message } = describeError(error);
  return (
    message.includes('invalid_grant') ||
    message.includes('Token has been expired or revoked')
  );
}
