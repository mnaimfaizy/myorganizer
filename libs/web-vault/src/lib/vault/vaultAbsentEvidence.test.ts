/**
 * Tests for Vault Absent Evidence — what proves whether the server holds a
 * Vault for the signed-in User when this device holds none.
 *
 * Tests use mocked axios response shapes to control server responses and error
 * conditions, mirroring the patterns in vaultClaimEvidence.test.ts.
 */

import type { AxiosResponse } from 'axios';
import type { VaultApi } from '@myorganizer/app-api-client';

import { checkVaultAbsentEvidence } from './vaultAbsentEvidence';
import { VAULT_META_CHANGE_ADOPTABLE } from './vaultMetaConverge';
import { VAULT_META_CHANGE_SAME_VAULT } from './vaultClaimEvidence';

type ApiDouble = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getVaultMeta: jest.Mock<Promise<AxiosResponse<any>>, []>;
};

/**
 * Helper to create a properly typed API double matching axios response shape.
 */
function createApiDouble(): ApiDouble {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getVaultMeta: jest.fn<Promise<AxiosResponse<any>>, []>(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('checkVaultAbsentEvidence', () => {
  test('returns server-holds-vault with serverMeta when server has vault', async () => {
    const api = createApiDouble();
    const serverMeta = {
      etag: 'test-etag',
      updatedAt: '2026-01-01T00:00:00Z',
      meta: {
        version: 1,
        kdf_salt: 'test-salt',
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'test-iv',
          ciphertext: 'test-ct',
        },
        wrapped_mk_recovery: {
          version: 1,
          iv: 'test-iv-recovery',
          ciphertext: 'test-ct-recovery',
        },
      },
    };
    api.getVaultMeta.mockResolvedValue({
      data: serverMeta,
    } as AxiosResponse);

    const result = await checkVaultAbsentEvidence({ api });

    expect(result).toEqual({
      kind: 'server-holds-vault',
      serverMeta,
    });
  });

  test('returns no-server-vault when server has no vault (404)', async () => {
    const api = createApiDouble();
    api.getVaultMeta.mockRejectedValue({
      response: { status: 404 },
    });

    const result = await checkVaultAbsentEvidence({ api });

    expect(result).toEqual({ kind: 'no-server-vault' });
  });

  test('returns session-lost when server returns 401 (unauthorized)', async () => {
    const api = createApiDouble();
    api.getVaultMeta.mockRejectedValue({
      response: { status: 401 },
    });

    const result = await checkVaultAbsentEvidence({ api });

    expect(result).toEqual({ kind: 'session-lost' });
  });

  test('returns session-lost when server returns 403 (forbidden)', async () => {
    const api = createApiDouble();
    api.getVaultMeta.mockRejectedValue({
      response: { status: 403 },
    });

    const result = await checkVaultAbsentEvidence({ api });

    expect(result).toEqual({ kind: 'session-lost' });
  });

  test('returns postponed when network error with no response', async () => {
    const api = createApiDouble();
    api.getVaultMeta.mockRejectedValue(new Error('Network error'));

    const result = await checkVaultAbsentEvidence({ api });

    expect(result).toEqual({ kind: 'postponed' });
  });

  test('returns postponed when server returns 500 error', async () => {
    const api = createApiDouble();
    api.getVaultMeta.mockRejectedValue({
      response: { status: 500 },
    });

    const result = await checkVaultAbsentEvidence({ api });

    expect(result).toEqual({ kind: 'postponed' });
  });

  test('returns postponed when server returns 503 error', async () => {
    const api = createApiDouble();
    api.getVaultMeta.mockRejectedValue({
      response: { status: 503 },
    });

    const result = await checkVaultAbsentEvidence({ api });

    expect(result).toEqual({ kind: 'postponed' });
  });

  test('returns postponed when non-Error thrown value', async () => {
    const api = createApiDouble();
    api.getVaultMeta.mockRejectedValue('thrown string');

    const result = await checkVaultAbsentEvidence({ api });

    expect(result).toEqual({ kind: 'postponed' });
  });

  test('compiles and works with API having only getVaultMeta (structural proof no write)', async () => {
    const apiDouble = { getVaultMeta: jest.fn() };
    apiDouble.getVaultMeta.mockRejectedValue({
      response: { status: 404 },
    });

    const result = await checkVaultAbsentEvidence({
      api: apiDouble as Pick<VaultApi, 'getVaultMeta'>,
    });

    expect(result).toEqual({ kind: 'no-server-vault' });
  });

  describe('defence-in-depth safety claim (#628)', () => {
    test('different-vault is not adoptable: even if gate is bypassed, convergence refuses adoption', () => {
      // This test documents the defence-in-depth guarantee: if a User somehow
      // bypassed the Vault Gate and created a fresh Vault on an absent device
      // while the server held a different one, the two safety tables ensure
      // the convergence would refuse to adopt the server's wrapping over the
      // local Ciphertext.
      //
      // Acceptance criterion #628: "The safety claim is verified rather than
      // assumed: a fresh Vault classifies as a different Vault, and that
      // change is pinned non-adoptable, so a User who creates one anyway does
      // not destroy the server's."

      // Vault Meta Change identification: a different salt means different-vault
      expect(VAULT_META_CHANGE_SAME_VAULT['different-vault']).toBe(false);

      // Convergence enforcement: different-vault is not adoptable
      expect(VAULT_META_CHANGE_ADOPTABLE['different-vault']).toBe(false);

      // Together these ensure a created-vault scenario cannot silently destroy
      // the server's data: describeVaultMetaDivergence would identify
      // 'different-vault', convergeVaultMeta would refuse with
      // refused-not-adoptable, and the User would be told.
    });
  });
});
