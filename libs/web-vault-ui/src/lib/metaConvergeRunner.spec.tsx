/* eslint-disable import/first -- jest.mock must precede application imports */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockToast = jest.fn();
const mockConvergeVaultMeta = jest.fn();

jest.mock('@myorganizer/web-ui', () => {
  const actual = jest.requireActual('@myorganizer/web-ui');
  return {
    ...actual,
    useToast: () => ({ toast: mockToast }),
  };
});

jest.mock('@myorganizer/web-vault', () => ({
  createVaultApi: jest.fn(() => ({})),
  getHttpStatus: jest.fn(() => undefined),
  convergeVaultMeta: (options: MetaConvergeOptions) =>
    mockConvergeVaultMeta(options),
}));

jest.mock('./session', () => ({
  useOptionalVaultSession: jest.fn(),
}));

import type {
  VaultMetaChange,
  VaultMetaDecision,
} from '@myorganizer/web-vault';
import type { ServerVaultMeta } from '@myorganizer/web-vault';
import { useOptionalVaultSession } from './session';
import { VaultMetaConvergeRunner } from './metaConvergeRunner';

type MetaConvergeOptions = {
  prompt: (params: {
    change: VaultMetaChange;
    remote: ServerVaultMeta;
  }) => Promise<VaultMetaDecision> | VaultMetaDecision;
};

type MockHandle = {
  owner: string;
  loadVault: jest.Mock;
  saveVault: jest.Mock;
};

function createMockHandle(owner: string): MockHandle {
  return {
    owner,
    loadVault: jest.fn(() => ({ data: {} })),
    saveVault: jest.fn(),
  };
}

function arrangeMetaConvergeWithPrompt(decisionResult: {
  current?: VaultMetaDecision;
}) {
  mockConvergeVaultMeta.mockImplementation(
    async (options: MetaConvergeOptions) => {
      decisionResult.current = await options.prompt({
        change: 'passphrase',
        remote: {
          etag: 'e1',
          updatedAt: 't1',
          meta: {
            version: 1,
            kdf_name: 'PBKDF2',
            kdf_salt: 'salt',
            kdf_params: { hash: 'SHA-256', iterations: 310_000 },
            wrapped_mk_passphrase: { version: 1, iv: 'iv1', ciphertext: 'ct1' },
            wrapped_mk_recovery: { version: 1, iv: 'iv2', ciphertext: 'ct2' },
          },
        },
      });

      return { kind: 'noop-already-in-sync' };
    },
  );
}

function arrangeNoPromptMetaConverge() {
  mockConvergeVaultMeta.mockImplementation(async () => {
    return { kind: 'skipped-no-local-vault' };
  });
}

describe('VaultMetaConvergeRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
  });

  test('should display passphrase dialog with correct copy when passphrase diverged', async () => {
    const decisionResult: { current?: VaultMetaDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangeMetaConvergeWithPrompt(decisionResult);

    render(<VaultMetaConvergeRunner />);

    expect(await screen.findByRole('dialog')).not.toBeNull();
    expect(
      screen.getByText('Your passphrase was changed on another device'),
    ).not.toBeNull();
    expect(
      screen.getByText('Start using the new passphrase on this device?'),
    ).not.toBeNull();
  });

  test('should display passphrase-specific copy and hide reconcile-specific copy when passphrase diverged', async () => {
    const decisionResult: { current?: VaultMetaDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangeMetaConvergeWithPrompt(decisionResult);

    render(<VaultMetaConvergeRunner />);

    await screen.findByRole('dialog');

    // Meta converge dialog should NOT contain reconcile-specific strings
    expect(screen.queryByText('Choose vault data to keep')).toBeNull();
    expect(screen.queryByText("Keep this device's data")).toBeNull();
    expect(screen.queryByText("Keep the server's data")).toBeNull();
  });

  test('should resolve adopt-remote when "Use the new passphrase" button is clicked', async () => {
    const decisionResult: { current?: VaultMetaDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangeMetaConvergeWithPrompt(decisionResult);

    render(<VaultMetaConvergeRunner />);

    await screen.findByRole('dialog');
    fireEvent.click(
      screen.getByRole('button', { name: 'Use the new passphrase' }),
    );

    await waitFor(() => expect(decisionResult.current).toBe('adopt-remote'));
  });

  test('should resolve keep-local when "Keep my current passphrase" button is clicked', async () => {
    const decisionResult: { current?: VaultMetaDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangeMetaConvergeWithPrompt(decisionResult);

    render(<VaultMetaConvergeRunner />);

    await screen.findByRole('dialog');
    fireEvent.click(
      screen.getByRole('button', { name: 'Keep my current passphrase' }),
    );

    await waitFor(() => expect(decisionResult.current).toBe('keep-local'));
  });

  test('should resolve defer when escape is pressed and not save or toast', async () => {
    const decisionResult: { current?: VaultMetaDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    // Mock convergeVaultMeta to return noop-deferred when prompt is called with defer
    mockConvergeVaultMeta.mockImplementation(
      async (options: MetaConvergeOptions) => {
        const decision = await options.prompt({
          change: 'passphrase',
          remote: {
            etag: 'e1',
            updatedAt: 't1',
            meta: {
              version: 1,
              kdf_name: 'PBKDF2',
              kdf_salt: 'salt',
              kdf_params: { hash: 'SHA-256', iterations: 310_000 },
              wrapped_mk_passphrase: {
                version: 1,
                iv: 'iv1',
                ciphertext: 'ct1',
              },
              wrapped_mk_recovery: { version: 1, iv: 'iv2', ciphertext: 'ct2' },
            },
          },
        });

        decisionResult.current = decision;
        if (decision === 'defer') {
          return { kind: 'noop-deferred', change: 'passphrase' as const };
        }
        return { kind: 'noop-already-in-sync' };
      },
    );

    render(<VaultMetaConvergeRunner />);

    const dialog = await screen.findByRole('dialog');
    // Use Escape key to dismiss
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(decisionResult.current).toBe('defer'));

    // No saveVault call
    expect(mockHandle.saveVault).not.toHaveBeenCalled();
    // No toast
    expect(mockToast).not.toHaveBeenCalled();
    // Flag not set (will be asked again) because noop-deferred excludes the flag
    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_meta_converge_ran_v1:user-a',
      ),
    ).toBeNull();
  });

  test('should call saveVault and show success toast when adopted-remote with passphrase change', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    const nextVault = {
      version: 1,
      kdf: {
        name: 'PBKDF2' as const,
        hash: 'SHA-256' as const,
        iterations: 310_000,
        salt: 'remote-salt',
      },
      masterKeyWrappedWithPassphrase: {
        iv: 'remote-iv1',
        ciphertext: 'remote-ct1',
      },
      masterKeyWrappedWithRecoveryKey: { iv: 'iv2', ciphertext: 'ct2' },
      data: {},
    };

    mockConvergeVaultMeta.mockResolvedValue({
      kind: 'adopted-remote',
      change: 'passphrase' as const,
      nextLocalVault: nextVault,
    });

    render(<VaultMetaConvergeRunner />);

    await waitFor(() => {
      expect(mockHandle.saveVault).toHaveBeenCalledWith(nextVault);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Passphrase updated',
      }),
    );
  });

  test('should show recovery key updated toast when adopted-remote with recovery-key change', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    const nextVault = {
      version: 1,
      kdf: {
        name: 'PBKDF2' as const,
        hash: 'SHA-256' as const,
        iterations: 310_000,
        salt: 'salt',
      },
      masterKeyWrappedWithPassphrase: { iv: 'iv1', ciphertext: 'ct1' },
      masterKeyWrappedWithRecoveryKey: {
        iv: 'remote-recovery-iv',
        ciphertext: 'remote-recovery-ct',
      },
      data: {},
    };

    mockConvergeVaultMeta.mockResolvedValue({
      kind: 'adopted-remote',
      change: 'recovery-key' as const,
      nextLocalVault: nextVault,
    });

    render(<VaultMetaConvergeRunner />);

    await waitFor(() => {
      expect(mockHandle.saveVault).toHaveBeenCalledWith(nextVault);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Recovery key updated',
      }),
    );
  });

  test('should set flag when noop-declined without saving or toasting', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockConvergeVaultMeta.mockResolvedValue({
      kind: 'noop-declined',
      change: 'passphrase' as const,
    });

    render(<VaultMetaConvergeRunner />);

    await waitFor(() => {
      expect(
        window.sessionStorage.getItem(
          'myorganizer_vault_meta_converge_ran_v1:user-a',
        ),
      ).toBe('1');
    });

    expect(mockHandle.saveVault).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  test('should display recovery-key-specific copy when recovery-key diverged', async () => {
    const decisionResult: { current?: VaultMetaDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockConvergeVaultMeta.mockImplementation(
      async (options: MetaConvergeOptions) => {
        decisionResult.current = await options.prompt({
          change: 'recovery-key',
          remote: {
            etag: 'e1',
            updatedAt: 't1',
            meta: {
              version: 1,
              kdf_name: 'PBKDF2',
              kdf_salt: 'salt',
              kdf_params: { hash: 'SHA-256', iterations: 310_000 },
              wrapped_mk_passphrase: {
                version: 1,
                iv: 'iv1',
                ciphertext: 'ct1',
              },
              wrapped_mk_recovery: { version: 1, iv: 'iv2', ciphertext: 'ct2' },
            },
          },
        });

        return { kind: 'noop-already-in-sync' };
      },
    );

    render(<VaultMetaConvergeRunner />);

    await screen.findByRole('dialog');

    // Should show recovery-key title, not passphrase title
    expect(
      screen.getByText('Your recovery key was changed on another device'),
    ).not.toBeNull();
    expect(
      screen.queryByText('Your passphrase was changed on another device'),
    ).toBeNull();

    // Should show recovery-key buttons
    expect(
      screen.getByRole('button', { name: 'Use the new recovery key' }),
    ).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Keep my current recovery key' }),
    ).not.toBeNull();
  });

  test('should resolve defer when unmounted while prompt pending', async () => {
    const decisionResult: { current?: VaultMetaDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangeMetaConvergeWithPrompt(decisionResult);

    const { unmount } = render(<VaultMetaConvergeRunner />);

    await screen.findByRole('dialog');

    unmount();

    await waitFor(() => expect(decisionResult.current).toBe('defer'));
  });

  test('per-User scoping: different users in same session each trigger meta converge independently', async () => {
    // User A: render and complete meta converge
    const handleA = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleA,
    });

    arrangeNoPromptMetaConverge();

    const { unmount } = render(<VaultMetaConvergeRunner />);

    // Wait for user-a's converge to complete
    await waitFor(() => {
      expect(mockConvergeVaultMeta).toHaveBeenCalledTimes(1);
    });

    // Verify user-a's flag is set (skipped-no-local-vault DOES set the flag)
    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_meta_converge_ran_v1:user-a',
      ),
    ).toBe('1');

    // Unmount and clear mock call count, but DO NOT clear sessionStorage
    unmount();
    mockConvergeVaultMeta.mockClear();

    // User B: render with a different owner in the same session
    const handleB = createMockHandle('user-b');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleB,
    });

    arrangeNoPromptMetaConverge();

    render(<VaultMetaConvergeRunner />);

    // Wait for user-b's converge to be called (should not be skipped)
    await waitFor(() => {
      expect(mockConvergeVaultMeta).toHaveBeenCalledTimes(1);
    });

    expect(handleB.loadVault).toHaveBeenCalled();
  });

  test('skips meta converge when same owner re-renders with flag already set', async () => {
    const handleA = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleA,
    });

    mockConvergeVaultMeta.mockResolvedValue({
      kind: 'noop-declined',
      change: 'passphrase' as const,
    });

    const { rerender } = render(<VaultMetaConvergeRunner />);

    // Wait for first render to complete converge
    await waitFor(() => {
      expect(mockConvergeVaultMeta).toHaveBeenCalledTimes(1);
    });

    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_meta_converge_ran_v1:user-a',
      ),
    ).toBe('1');

    // Clear mock call count and re-render with same owner
    mockConvergeVaultMeta.mockClear();
    rerender(<VaultMetaConvergeRunner />);

    // Wait a bit, then verify converge was NOT called again
    await waitFor(
      () => {
        expect(mockConvergeVaultMeta).not.toHaveBeenCalled();
      },
      { timeout: 500 },
    );
  });
});
