import {
  VAULT_OPERATIONS,
  VAULT_OPERATION_POLICY,
  VAULT_SIGNED_OUT_COPY,
  type VaultOperation,
  vaultOperationAvailability,
} from './vaultOperationPolicy';

describe('vaultOperationPolicy', () => {
  describe('Policy table completeness (A7)', () => {
    test('every VaultOperation has an entry in VAULT_OPERATION_POLICY', () => {
      Object.values(VAULT_OPERATIONS).forEach((operation) => {
        expect(VAULT_OPERATION_POLICY[operation]).toBeDefined();
      });
    });
  });

  describe('Signed-out state (A2)', () => {
    test.each(Object.values(VAULT_OPERATIONS))(
      '%s: signed-out blocks with VAULT_SIGNED_OUT_COPY',
      (operation: VaultOperation) => {
        const result = vaultOperationAvailability(operation, 'signed-out');
        expect(result.allowed).toBe(false);
        expect(result.unavailableReason).toBe(VAULT_SIGNED_OUT_COPY);
      },
    );
  });

  describe('No-local-vault state (A3)', () => {
    test.each(Object.values(VAULT_OPERATIONS))(
      '%s: no-local-vault blocks with operation-specific whenNoLocalVault reason',
      (operation: VaultOperation) => {
        const result = vaultOperationAvailability(operation, 'no-local-vault');
        expect(result.allowed).toBe(false);
        expect(result.unavailableReason).toBe(
          VAULT_OPERATION_POLICY[operation].whenNoLocalVault,
        );
        expect(result.unavailableReason).toBeTruthy();
      },
    );
  });

  describe('Locked state (A4, A5, A6)', () => {
    test.each(Object.values(VAULT_OPERATIONS))(
      '%s: locked availability matches needsMasterKey (A6 — derived, not chosen per card)',
      (operation: VaultOperation) => {
        const result = vaultOperationAvailability(operation, 'locked');
        const rule = VAULT_OPERATION_POLICY[operation];
        const expectedAllowed = !rule.needsMasterKey;

        expect(result.allowed).toBe(expectedAllowed);
        if (expectedAllowed) {
          expect(result.unavailableReason).toBeNull();
        } else {
          expect(result.unavailableReason).toBe(rule.whenLocked);
        }
      },
    );

    test('PassphraseChange: locked blocks with whenLocked sentence (A4)', () => {
      const result = vaultOperationAvailability(
        VAULT_OPERATIONS.PassphraseChange,
        'locked',
      );
      expect(result.allowed).toBe(false);
      expect(result.unavailableReason).toBe(
        'Unlock your vault to change its passphrase.',
      );
    });

    test('RecoveryKeyRotation: locked blocks with whenLocked sentence (A4)', () => {
      const result = vaultOperationAvailability(
        VAULT_OPERATIONS.RecoveryKeyRotation,
        'locked',
      );
      expect(result.allowed).toBe(false);
      expect(result.unavailableReason).toBe(
        'Unlock your vault to rotate its recovery key.',
      );
    });

    test('CloudBackup: locked allows (A5 — ADR 0068, does not need Master Key)', () => {
      const result = vaultOperationAvailability(
        VAULT_OPERATIONS.CloudBackup,
        'locked',
      );
      expect(result.allowed).toBe(true);
      expect(result.unavailableReason).toBeNull();
    });

    test('Export: locked allows (A5 — ADR 0068, does not need Master Key)', () => {
      const result = vaultOperationAvailability(
        VAULT_OPERATIONS.Export,
        'locked',
      );
      expect(result.allowed).toBe(true);
      expect(result.unavailableReason).toBeNull();
    });

    test('Removal: locked allows (A5 — ADR 0068, does not need Master Key)', () => {
      const result = vaultOperationAvailability(
        VAULT_OPERATIONS.Removal,
        'locked',
      );
      expect(result.allowed).toBe(true);
      expect(result.unavailableReason).toBeNull();
    });

    test('Import: locked allows (A5 — ADR 0068, does not need Master Key, #625 regression guard)', () => {
      const result = vaultOperationAvailability(
        VAULT_OPERATIONS.Import,
        'locked',
      );
      expect(result.allowed).toBe(true);
      expect(result.unavailableReason).toBeNull();
    });
  });

  describe('Enabled state (A1)', () => {
    test.each(Object.values(VAULT_OPERATIONS))(
      '%s: enabled allows with no reason',
      (operation: VaultOperation) => {
        const result = vaultOperationAvailability(operation, 'enabled');
        expect(result.allowed).toBe(true);
        expect(result.unavailableReason).toBeNull();
      },
    );
  });

  describe('Copy strings (A8)', () => {
    test('PassphraseChange locked copy: "Unlock your vault to change its passphrase."', () => {
      const rule = VAULT_OPERATION_POLICY[VAULT_OPERATIONS.PassphraseChange];
      expect(rule.needsMasterKey).toBe(true);
      expect(rule.whenLocked).toBe(
        'Unlock your vault to change its passphrase.',
      );
    });

    test('PassphraseChange no-local-vault copy: "Set up a local vault on this device to change its passphrase."', () => {
      const rule = VAULT_OPERATION_POLICY[VAULT_OPERATIONS.PassphraseChange];
      expect(rule.whenNoLocalVault).toBe(
        'Set up a local vault on this device to change its passphrase.',
      );
    });

    test('RecoveryKeyRotation locked copy: "Unlock your vault to rotate its recovery key."', () => {
      const rule = VAULT_OPERATION_POLICY[VAULT_OPERATIONS.RecoveryKeyRotation];
      expect(rule.needsMasterKey).toBe(true);
      expect(rule.whenLocked).toBe(
        'Unlock your vault to rotate its recovery key.',
      );
    });

    test('RecoveryKeyRotation no-local-vault copy: "Set up a local vault on this device to rotate its recovery key."', () => {
      const rule = VAULT_OPERATION_POLICY[VAULT_OPERATIONS.RecoveryKeyRotation];
      expect(rule.whenNoLocalVault).toBe(
        'Set up a local vault on this device to rotate its recovery key.',
      );
    });
  });
});
