import { isNetworkError } from '@myorganizer/mobile/feat-vault';

/**
 * Why a Vault Blob read failed, in words, for a screen that was trying to
 * show `subject`.
 *
 * The three cases are not interchangeable and the difference is not cosmetic:
 * the network one is the User's to fix and worth retrying, the server one is
 * worth retrying and is not, and the third means the Ciphertext arrived and
 * this Master Key could not open it — which retrying cannot help. Only the
 * middle case can be told from the first by looking for a `response` on the
 * error, which is the one piece of shape-reading here and the reason this is
 * one function rather than a line in each screen.
 *
 * `subject` is the screen's own noun — "your grocery lists", "this list" — so
 * the sentence names what failed rather than saying "it".
 */
export function describeVaultLoadError(err: unknown, subject: string): string {
  if (isNetworkError(err)) {
    return 'Network error — check your connection and try again.';
  }
  if ((err as { response?: unknown })?.response) {
    return `Could not load ${subject}. Please try again.`;
  }
  return `Could not decrypt ${subject}.`;
}
