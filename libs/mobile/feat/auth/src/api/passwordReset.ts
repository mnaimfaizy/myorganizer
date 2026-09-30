import { createAuthApi } from './client';

/**
 * Requests a password reset for the account's login credential — distinct
 * from a Vault passphrase, which this never touches. The backend replies
 * with the same message whether or not the email is registered, and this
 * passes that message straight through: never distinguishing "no such
 * account" is the server's job, and duplicating the check here would only
 * give it a second way to disagree with itself.
 *
 * Reaches the server directly through the mobile Axios client rather than
 * through `@myorganizer/auth`'s `requestPasswordReset` — that module's
 * default transport is bound to the browser session storage adapter
 * (ADR 0103), which mobile cannot import.
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ message: string }> {
  const authApi = createAuthApi();
  const response = await authApi.resetPassword({
    resetPasswordByEmailBody: { email },
  });
  return response.data;
}
