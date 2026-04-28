import { VAULT_IMPORT_ERROR_CODES } from '@myorganizer/vault-core';

import {
  VAULT_IMPORT_ERROR_MESSAGES,
  getVaultImportErrorMessage,
} from './vaultImportErrorMessages';

describe('vaultImportErrorMessages', () => {
  test('every VaultImportErrorCode has a message', () => {
    for (const code of VAULT_IMPORT_ERROR_CODES) {
      expect(VAULT_IMPORT_ERROR_MESSAGES[code]).toEqual(expect.any(String));
      expect(VAULT_IMPORT_ERROR_MESSAGES[code].length).toBeGreaterThan(10);
    }
  });

  test('getVaultImportErrorMessage returns mapped message for known code', () => {
    expect(getVaultImportErrorMessage('replay-detected')).toMatch(
      /already been imported/i,
    );
  });

  test('getVaultImportErrorMessage falls back for unknown code', () => {
    expect(getVaultImportErrorMessage('something-new' as never)).toMatch(
      /something went wrong/i,
    );
  });
});
