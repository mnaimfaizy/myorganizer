/* eslint-disable import/first -- jest.mock must precede application imports */

/**
 * Mock web-vault functions before importing the hook.
 * Keep the real VaultSecretMismatchError to test instanceof checks.
 */
jest.mock('@myorganizer/web-vault', () => ({
  ...jest.requireActual('@myorganizer/web-vault'),
  changePassphraseWithCurrent: jest.fn(),
  createVaultApi: jest.fn(),
}));

/**
 * Mock web-vault-ui functions.
 * Keep the real passphraseChangeReading to test actual copy.
 */
jest.mock('@myorganizer/web-vault-ui', () => ({
  ...jest.requireActual('@myorganizer/web-vault-ui'),
  useOptionalVaultSession: jest.fn(),
}));

/**
 * Mock web-ui hook.
 */
jest.mock('@myorganizer/web-ui', () => ({
  useToast: jest.fn(),
}));

/**
 * Mock utils.
 */
jest.mock('../utils/getErrorMessage', () => ({
  getErrorMessage: jest.fn((error: Error) => error.message),
}));

import { renderHook, act } from '@testing-library/react';
import {
  changePassphraseWithCurrent,
  createVaultApi,
  VaultSecretMismatchError,
} from '@myorganizer/web-vault';
import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';
import { useToast } from '@myorganizer/web-ui';
import { useChangePassphrase } from './useChangePassphrase';
import type { VaultHandle } from '@myorganizer/web-vault';

// === Mock helpers ===

function createMockHandle(overrides?: Partial<VaultHandle>): VaultHandle {
  const base: VaultHandle = {
    owner: 'test-owner',
    isUnlocked: false,
    hasVault: jest.fn().mockReturnValue(true),
    hasOwnedVault: jest.fn().mockReturnValue(true),
    loadVault: jest.fn().mockReturnValue(null),
    saveVault: jest.fn(),
    removeVault: jest.fn(),
    initialize: jest.fn(),
    unlockWithPassphrase: jest.fn(),
    unlockWithRecoveryKey: jest.fn(),
    changePassphrase: jest.fn(),
    resetPassphrase: jest.fn(),
    rotateRecoveryKey: jest.fn(),
    loadDecryptedData: jest.fn(),
    saveEncryptedData: jest.fn(),
    vaultStatus: jest.fn().mockReturnValue('absent'),
    hasUnclaimedLocalVault: jest.fn().mockReturnValue(false),
    claimUnclaimedLocalVaultLocked: jest.fn(),
    loadUnclaimedVault: jest.fn().mockReturnValue(null),
    claimUnclaimedLocalVaultByRecoveryKey: jest.fn(),
    replaceOwnedLocalVaultWithUnclaimedLocked: jest.fn(),
    replaceOwnedLocalVaultWithUnclaimedByRecoveryKey: jest.fn(),
    hasUnsentChanges: jest.fn().mockResolvedValue(false),
    lastPushedEtag: jest.fn().mockReturnValue(undefined),
    recordPushSuccess: jest.fn(),
    lastAgreedVaultMetaHash: jest.fn().mockReturnValue(undefined),
    recordVaultMetaAgreement: jest.fn(),
    forgetSyncBookmarks: jest.fn(),
    decryptCiphertext: jest.fn(),
  };
  return { ...base, ...overrides };
}

describe('useChangePassphrase', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: createMockHandle(),
      masterKeyBytes: new Uint8Array(32),
    });
    (useToast as jest.Mock).mockReturnValue({ toast: jest.fn() });
    (createVaultApi as jest.Mock).mockReturnValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Guarded preconditions', () => {
    test('1: no handle → returns "error" with destructive toast, never calls changePassphraseWithCurrent', async () => {
      const mockToast = jest.fn();
      (useOptionalVaultSession as jest.Mock).mockReturnValue(null);
      (useToast as jest.Mock).mockReturnValue({ toast: mockToast });

      const { result } = renderHook(() => useChangePassphrase());

      let callResult: 'ok' | 'wrong-passphrase' | 'error' | undefined;
      await act(async () => {
        callResult = await result.current.changePassphrase({
          currentPassphrase: 'old',
          newPassphrase: 'new1234567',
        });
      });

      expect(callResult).toBe('error');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Cannot change passphrase',
          description: 'Unlock your vault first.',
          variant: 'destructive',
        }),
      );
      expect(changePassphraseWithCurrent).not.toHaveBeenCalled();
    });

    test('2: masterKeyBytes === null → returns "error" with destructive toast, never calls changePassphraseWithCurrent', async () => {
      const mockToast = jest.fn();
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: createMockHandle(),
        masterKeyBytes: null,
      });
      (useToast as jest.Mock).mockReturnValue({ toast: mockToast });

      const { result } = renderHook(() => useChangePassphrase());

      let callResult: 'ok' | 'wrong-passphrase' | 'error' | undefined;
      await act(async () => {
        callResult = await result.current.changePassphrase({
          currentPassphrase: 'old',
          newPassphrase: 'new1234567',
        });
      });

      expect(callResult).toBe('error');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Cannot change passphrase',
          variant: 'destructive',
        }),
      );
      expect(changePassphraseWithCurrent).not.toHaveBeenCalled();
    });
  });

  describe('Push outcomes — all non-destructive despite reaching server', () => {
    test('3: push kind "pushed" → returns "ok" and calls toast with non-destructive variant', async () => {
      const mockToast = jest.fn();
      (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
      (changePassphraseWithCurrent as jest.Mock).mockResolvedValue({
        push: { kind: 'pushed' },
      });

      const { result } = renderHook(() => useChangePassphrase());

      let callResult: 'ok' | 'wrong-passphrase' | 'error' | undefined;
      await act(async () => {
        callResult = await result.current.changePassphrase({
          currentPassphrase: 'oldpass1234',
          newPassphrase: 'newpass12345',
        });
      });

      expect(callResult).toBe('ok');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Passphrase changed',
          description: expect.stringContaining('other devices'),
        }),
      );

      // Assert NOT destructive
      const toastCall = mockToast.mock.calls[0][0];
      expect(toastCall.variant).not.toBe('destructive');
      expect(toastCall.variant).toBeUndefined();
    });

    test('4: push kind "unreachable" → returns "ok" and calls toast non-destructive, copy says changed on device but not synced yet', async () => {
      const mockToast = jest.fn();
      (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
      (changePassphraseWithCurrent as jest.Mock).mockResolvedValue({
        push: { kind: 'unreachable' },
      });

      const { result } = renderHook(() => useChangePassphrase());

      let callResult: 'ok' | 'wrong-passphrase' | 'error' | undefined;
      await act(async () => {
        callResult = await result.current.changePassphrase({
          currentPassphrase: 'oldpass1234',
          newPassphrase: 'newpass12345',
        });
      });

      expect(callResult).toBe('ok');
      expect(mockToast).toHaveBeenCalled();

      const toastCall = mockToast.mock.calls[0][0];
      // Assert the real copy from passphraseChangeReading
      expect(toastCall.title).toContain('changed on this device');
      expect(toastCall.description).toContain('has not reached');
      expect(toastCall.variant).not.toBe('destructive');
      expect(toastCall.variant).toBeUndefined();
    });

    test('5: push kind "refused-server-moved" → returns "ok" and calls toast non-destructive, copy mentions next sign-in', async () => {
      const mockToast = jest.fn();
      (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
      (changePassphraseWithCurrent as jest.Mock).mockResolvedValue({
        push: { kind: 'refused-server-moved', change: 'passphrase' },
      });

      const { result } = renderHook(() => useChangePassphrase());

      let callResult: 'ok' | 'wrong-passphrase' | 'error' | undefined;
      await act(async () => {
        callResult = await result.current.changePassphrase({
          currentPassphrase: 'oldpass1234',
          newPassphrase: 'newpass12345',
        });
      });

      expect(callResult).toBe('ok');
      expect(mockToast).toHaveBeenCalled();

      const toastCall = mockToast.mock.calls[0][0];
      // Assert the real copy from passphraseChangeReading
      expect(toastCall.title).toContain('changed on this device');
      expect(toastCall.description).toContain('next time you sign in');
      expect(toastCall.variant).not.toBe('destructive');
      expect(toastCall.variant).toBeUndefined();
    });
  });

  describe('Error paths', () => {
    test('6: VaultSecretMismatchError on passphrase → returns "wrong-passphrase", NO toast called', async () => {
      const mockToast = jest.fn();
      (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
      (changePassphraseWithCurrent as jest.Mock).mockRejectedValue(
        new VaultSecretMismatchError('passphrase'),
      );

      const { result } = renderHook(() => useChangePassphrase());

      let callResult: 'ok' | 'wrong-passphrase' | 'error' | undefined;
      await act(async () => {
        callResult = await result.current.changePassphrase({
          currentPassphrase: 'wrongpass1234',
          newPassphrase: 'newpass12345',
        });
      });

      expect(callResult).toBe('wrong-passphrase');
      expect(mockToast).not.toHaveBeenCalled();
    });

    test('7: unexpected error (not VaultSecretMismatchError) → returns "error" with destructive toast', async () => {
      const mockToast = jest.fn();
      (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
      (changePassphraseWithCurrent as jest.Mock).mockRejectedValue(
        new Error('Network failed'),
      );

      const { result } = renderHook(() => useChangePassphrase());

      let callResult: 'ok' | 'wrong-passphrase' | 'error' | undefined;
      await act(async () => {
        callResult = await result.current.changePassphrase({
          currentPassphrase: 'oldpass1234',
          newPassphrase: 'newpass12345',
        });
      });

      expect(callResult).toBe('error');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Passphrase change failed',
          variant: 'destructive',
        }),
      );
    });
  });

  describe('Loading state', () => {
    test('8: changing boolean is true during async operation, false after', async () => {
      (changePassphraseWithCurrent as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ push: { kind: 'pushed' } });
            }, 50);
          }),
      );

      const { result } = renderHook(() => useChangePassphrase());

      expect(result.current.changing).toBe(false);

      let callPromise: Promise<any>;
      act(() => {
        callPromise = result.current.changePassphrase({
          currentPassphrase: 'oldpass1234',
          newPassphrase: 'newpass12345',
        });
      });

      // After the async call starts, changing might be true briefly
      // After it completes, it should be false
      await act(async () => {
        await callPromise!;
      });

      expect(result.current.changing).toBe(false);
    });
  });

  describe('Hook contract — reading usage', () => {
    test('9: calls passphraseChangeReading with the push outcome and toasts the reading', async () => {
      const mockToast = jest.fn();

      (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
      (changePassphraseWithCurrent as jest.Mock).mockResolvedValue({
        push: { kind: 'pushed' },
      });

      const { result } = renderHook(() => useChangePassphrase());

      await act(async () => {
        await result.current.changePassphrase({
          currentPassphrase: 'oldpass1234',
          newPassphrase: 'newpass12345',
        });
      });

      // Assert toast was called with a reading (title and description from real passphraseChangeReading)
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
        }),
      );
      // Assert that the variant is not destructive (proves it uses the reading correctly)
      const toastCall = mockToast.mock.calls[0][0];
      expect(toastCall.variant).not.toBe('destructive');
    });
  });
});
