/**
 * Why an attempt to obtain a provider token never reached the provider.
 *
 * - `popup-blocked` — the browser refused to open the prompt, typically
 *   because no user gesture was in progress.
 * - `popup-closed` — the User dismissed the prompt before answering it.
 * - `unknown` — the prompt failed for a reason the provider SDK did not name.
 */
export type CloudBackupPromptFailure =
  | 'popup-blocked'
  | 'popup-closed'
  | 'unknown';

/**
 * An attempt that never reached the provider. It observed nothing about the
 * link, so it never moves a Linked Provider to Reconnect Needed (CONTEXT.md:
 * Linked Provider). Contrast a refusal the provider itself returned, which is
 * a plain `Error` and does.
 */
export class CloudBackupPromptError extends Error {
  readonly failure: CloudBackupPromptFailure;

  constructor(failure: CloudBackupPromptFailure, message?: string) {
    super(message ?? `Cloud backup prompt failed: ${failure}`);
    this.name = 'CloudBackupPromptError';
    this.failure = failure;
  }
}

export function isCloudBackupPromptError(
  value: unknown,
): value is CloudBackupPromptError {
  return value instanceof CloudBackupPromptError;
}
