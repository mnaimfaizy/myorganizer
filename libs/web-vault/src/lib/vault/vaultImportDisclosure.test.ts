import type { VaultMetaV1 } from '@myorganizer/app-api-client';
import { classifyVaultImportCredentialOutcome } from './vaultImportDisclosure';
import { vaultIdentityOf } from './vaultMetaConverge';

function makeServerMeta(overrides: Partial<VaultMetaV1> = {}): VaultMetaV1 {
  return {
    version: 1,
    kdf_name: 'PBKDF2',
    kdf_salt: 'salt-base',
    kdf_params: { hash: 'SHA-256', iterations: 310_000 },
    wrapped_mk_passphrase: {
      version: 1,
      iv: 'iv1-base',
      ciphertext: 'ct1-base',
    },
    wrapped_mk_recovery: {
      version: 1,
      iv: 'iv2-base',
      ciphertext: 'ct2-base',
    },
    ...overrides,
  };
}

describe('classifyVaultImportCredentialOutcome', () => {
  describe('A1: unchanged — bundle meta byte-identical to local', () => {
    test('returns kind: unchanged when both metas are identical', () => {
      const local = makeServerMeta();
      const bundle = makeServerMeta();

      const result = classifyVaultImportCredentialOutcome({ local, bundle });

      expect(result).toEqual({ kind: 'unchanged' });
    });
  });

  describe('A2: wrapping-reverts passphrase — same kdf_salt, different wrapped_mk_passphrase', () => {
    test('returns wrapping-reverts with change: passphrase when passphrase wrapping differs', () => {
      const local = makeServerMeta();
      const bundle = makeServerMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'different-iv',
          ciphertext: 'different-ct',
        },
      });

      const result = classifyVaultImportCredentialOutcome({ local, bundle });

      expect(result).toEqual({
        kind: 'wrapping-reverts',
        change: 'passphrase',
      });
    });

    test('keeps same Vault Identity when wrapping-reverts for passphrase', () => {
      const local = makeServerMeta();
      const bundle = makeServerMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'different-iv',
          ciphertext: 'different-ct',
        },
      });

      const result = classifyVaultImportCredentialOutcome({ local, bundle });

      expect(result.kind).toBe('wrapping-reverts');
      if (result.kind === 'wrapping-reverts') {
        expect(vaultIdentityOf(local)).toBe(vaultIdentityOf(bundle));
      }
    });
  });

  describe('A3: wrapping-reverts recovery-key — same kdf_salt, different wrapped_mk_recovery only', () => {
    test('returns wrapping-reverts with change: recovery-key when recovery wrapping differs', () => {
      const local = makeServerMeta();
      const bundle = makeServerMeta({
        wrapped_mk_recovery: {
          version: 1,
          iv: 'different-iv',
          ciphertext: 'different-ct',
        },
      });

      const result = classifyVaultImportCredentialOutcome({ local, bundle });

      expect(result).toEqual({
        kind: 'wrapping-reverts',
        change: 'recovery-key',
      });
    });

    test('keeps same Vault Identity when wrapping-reverts for recovery-key', () => {
      const local = makeServerMeta();
      const bundle = makeServerMeta({
        wrapped_mk_recovery: {
          version: 1,
          iv: 'different-iv',
          ciphertext: 'different-ct',
        },
      });

      const result = classifyVaultImportCredentialOutcome({ local, bundle });

      expect(result.kind).toBe('wrapping-reverts');
      if (result.kind === 'wrapping-reverts') {
        expect(vaultIdentityOf(local)).toBe(vaultIdentityOf(bundle));
      }
    });
  });

  describe('A4: different-vault — different kdf_salt', () => {
    test('returns kind: different-vault when kdf_salt differs', () => {
      const local = makeServerMeta();
      const bundle = makeServerMeta({ kdf_salt: 'salt-different' });

      const result = classifyVaultImportCredentialOutcome({ local, bundle });

      expect(result).toEqual({ kind: 'different-vault' });
    });

    test('changes Vault Identity when different-vault', () => {
      const local = makeServerMeta();
      const bundle = makeServerMeta({ kdf_salt: 'salt-different' });

      const result = classifyVaultImportCredentialOutcome({ local, bundle });

      expect(result.kind).toBe('different-vault');
      expect(vaultIdentityOf(local)).not.toBe(vaultIdentityOf(bundle));
    });
  });

  describe('A5: different-vault takes precedence — different kdf_salt AND different wrappings', () => {
    test('returns different-vault (not passphrase change) when both kdf_salt and wrapped_mk_passphrase differ', () => {
      const local = makeServerMeta();
      const bundle = makeServerMeta({
        kdf_salt: 'salt-different',
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'different-iv',
          ciphertext: 'different-ct',
        },
      });

      const result = classifyVaultImportCredentialOutcome({ local, bundle });

      // This is the regression guard: salt is scanned first, so it wins
      expect(result).toEqual({ kind: 'different-vault' });
      expect(result.kind).not.toBe('wrapping-reverts');
    });

    test('regression: separately-initialized Vault is never reported as passphrase change (#578)', () => {
      const local = makeServerMeta();
      const bundle = makeServerMeta({
        kdf_salt: 'salt-entirely-different',
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'also-different',
          ciphertext: 'also-different',
        },
        wrapped_mk_recovery: {
          version: 1,
          iv: 'also-different',
          ciphertext: 'also-different',
        },
      });

      const result = classifyVaultImportCredentialOutcome({ local, bundle });

      // Must be different-vault, not wrapping-reverts/passphrase
      expect(result.kind).toBe('different-vault');
      expect(vaultIdentityOf(local)).not.toBe(vaultIdentityOf(bundle));
    });
  });

  describe('A6: KDF params iterations change — same salt, different iterations', () => {
    test('returns wrapping-reverts with change: passphrase when kdf_params.iterations differs', () => {
      const local = makeServerMeta();
      const bundle = makeServerMeta({
        kdf_params: { hash: 'SHA-256', iterations: 320_000 },
      });

      const result = classifyVaultImportCredentialOutcome({ local, bundle });

      expect(result).toEqual({
        kind: 'wrapping-reverts',
        change: 'passphrase',
      });
    });

    test('keeps same Vault Identity when KDF params change', () => {
      const local = makeServerMeta();
      const bundle = makeServerMeta({
        kdf_params: { hash: 'SHA-256', iterations: 320_000 },
      });

      const result = classifyVaultImportCredentialOutcome({ local, bundle });

      expect(result.kind).toBe('wrapping-reverts');
      if (result.kind === 'wrapping-reverts') {
        expect(vaultIdentityOf(local)).toBe(vaultIdentityOf(bundle));
      }
    });
  });

  describe('Rule level: middle row is not collapsed into third', () => {
    test.each<{
      name: string;
      bundle: VaultMetaV1;
    }>([
      {
        name: 'passphrase wrapping',
        bundle: makeServerMeta({
          wrapped_mk_passphrase: {
            version: 1,
            iv: 'x',
            ciphertext: 'x',
          },
        }),
      },
      {
        name: 'recovery-key wrapping',
        bundle: makeServerMeta({
          wrapped_mk_recovery: {
            version: 1,
            iv: 'y',
            ciphertext: 'y',
          },
        }),
      },
      {
        name: 'KDF params iterations',
        bundle: makeServerMeta({
          kdf_params: { hash: 'SHA-256', iterations: 350_000 },
        }),
      },
    ])(
      'middle outcome (wrapping-reverts) always keeps same Vault Identity: $name',
      ({ bundle }) => {
        const local = makeServerMeta();
        const result = classifyVaultImportCredentialOutcome({
          local,
          bundle,
        });

        expect(result.kind).toBe('wrapping-reverts');
        expect(vaultIdentityOf(local)).toBe(vaultIdentityOf(bundle));
      },
    );

    test.each<{
      name: string;
      bundle: VaultMetaV1;
    }>([
      {
        name: 'different salt alone',
        bundle: makeServerMeta({ kdf_salt: 'new-salt' }),
      },
      {
        name: 'different salt with passphrase wrapping',
        bundle: makeServerMeta({
          kdf_salt: 'new-salt',
          wrapped_mk_passphrase: {
            version: 1,
            iv: 'x',
            ciphertext: 'x',
          },
        }),
      },
      {
        name: 'different salt with recovery wrapping',
        bundle: makeServerMeta({
          kdf_salt: 'new-salt',
          wrapped_mk_recovery: {
            version: 1,
            iv: 'y',
            ciphertext: 'y',
          },
        }),
      },
    ])(
      'third outcome (different-vault) always changes Vault Identity: $name',
      ({ bundle }) => {
        const local = makeServerMeta();
        const result = classifyVaultImportCredentialOutcome({
          local,
          bundle,
        });

        expect(result.kind).toBe('different-vault');
        expect(vaultIdentityOf(local)).not.toBe(vaultIdentityOf(bundle));
      },
    );
  });
});
