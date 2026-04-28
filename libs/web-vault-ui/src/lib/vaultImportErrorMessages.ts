import type { VaultImportErrorCode } from '@myorganizer/vault-core';

/**
 * User-facing actionable messages for every {@link VaultImportErrorCode}.
 *
 * The map MUST be exhaustive — adding a new error code in `vault-core`
 * without updating this map is a TypeScript error.
 */
export const VAULT_IMPORT_ERROR_MESSAGES: Record<VaultImportErrorCode, string> =
  {
    'corrupt-file':
      'This file is not a valid vault export. Make sure you selected the file you downloaded from the export step and try again.',
    'schema-version-unsupported':
      'This vault export uses a format this version of MyOrganizer does not understand. Update the app and try again.',
    'schema-version-downgrade':
      'This vault export was created by a newer version of MyOrganizer. Update the app to import it.',
    oversize:
      'This vault export is larger than the 10 MB limit. Reduce the size of your vault or contact support if this is unexpected.',
    'unknown-blob-type':
      'This vault export contains data this version of MyOrganizer does not recognize. Update the app and try again.',
    'decrypt-failed':
      'Could not decrypt this vault export. Check that you entered the correct passphrase or recovery key.',
    'replay-detected':
      'This vault export has already been imported recently. If you intended to import it again, please re-export from the source device first.',
    'empty-envelope':
      'This vault export does not contain any vault data to import.',
    'network-failed':
      'Network error while contacting the server. Check your connection and try again.',
  };

/**
 * Look up an actionable user-facing message for a {@link VaultImportErrorCode}.
 * Falls back to a generic message for unknown codes (defensive for future
 * additions in vault-core that have not yet been mapped).
 */
export function getVaultImportErrorMessage(
  code: VaultImportErrorCode | string,
): string {
  if (Object.prototype.hasOwnProperty.call(VAULT_IMPORT_ERROR_MESSAGES, code)) {
    return VAULT_IMPORT_ERROR_MESSAGES[code as VaultImportErrorCode];
  }
  return 'Something went wrong while importing this vault export. Please try again.';
}
