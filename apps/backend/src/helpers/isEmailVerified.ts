export function isEmailVerified(
  user: { email_verification_timestamp?: Date | null } | null | undefined,
): boolean {
  return Boolean(user?.email_verification_timestamp);
}
