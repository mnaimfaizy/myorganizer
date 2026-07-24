import userService from '../services/UserService';

/**
 * Idempotently elevate PLATFORM_ADMIN_BOOTSTRAP_EMAIL to platform_admin when set.
 * Does not create Users — the account must already exist (e.g. via normal register).
 */
export async function bootstrapPlatformAdminFromEnv(): Promise<void> {
  const raw = process.env.PLATFORM_ADMIN_BOOTSTRAP_EMAIL;
  if (!raw || !raw.trim()) {
    return;
  }

  const email = raw.trim();
  try {
    const elevated = await userService.elevateToPlatformAdminByEmail(email);
    if (!elevated) {
      console.warn(
        `[bootstrap] PLATFORM_ADMIN_BOOTSTRAP_EMAIL=${email} did not match any User; skipping elevation.`,
      );
      return;
    }
    console.log(
      `[bootstrap] Platform Admin ready for ${elevated.email} (role=${elevated.role}).`,
    );
  } catch (err) {
    console.error('[bootstrap] Failed to elevate Platform Admin:', err);
  }
}
