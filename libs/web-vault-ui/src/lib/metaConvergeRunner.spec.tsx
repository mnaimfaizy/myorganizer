/* eslint-disable import/first -- jest.mock must precede application imports */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockToast = jest.fn();
const mockSettleVaultMeta = jest.fn();

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
  settleVaultMeta: (options: SettleVaultMetaOptions) =>
    mockSettleVaultMeta(options),
}));

jest.mock('./session', () => ({
  useOptionalVaultSession: jest.fn(),
}));

import type {
  VaultMetaChange,
  VaultMetaDecision,
  VaultHandle,
} from '@myorganizer/web-vault';
import { useOptionalVaultSession } from './session';
import { VaultMetaConvergeRunner } from './metaConvergeRunner';

type SettleVaultMetaOptions = {
  api: unknown;
  handle: VaultHandle;
  prompt: (params: {
    change: VaultMetaChange;
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
  mockSettleVaultMeta.mockImplementation(
    async (options: SettleVaultMetaOptions) => {
      decisionResult.current = await options.prompt({
        change: 'passphrase',
      });

      return {
        kind: 'converged' as const,
        result: { kind: 'noop-already-in-sync' as const },
      };
    },
  );
}

function arrangeNoPromptMetaConverge() {
  mockSettleVaultMeta.mockImplementation(async () => {
    return { kind: 'skipped-no-local-vault' as const };
  });
}

describe('VaultMetaConvergeRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    mockSettleVaultMeta.mockClear();
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

    // Mock settleVaultMeta to return noop-deferred when prompt is called with defer
    mockSettleVaultMeta.mockImplementation(
      async (options: SettleVaultMetaOptions) => {
        const decision = await options.prompt({
          change: 'passphrase',
        });

        decisionResult.current = decision;
        if (decision === 'defer') {
          return {
            kind: 'converged' as const,
            result: {
              kind: 'noop-deferred' as const,
              change: 'passphrase' as const,
            },
          };
        }
        return {
          kind: 'converged' as const,
          result: { kind: 'noop-already-in-sync' as const },
        };
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

    mockSettleVaultMeta.mockResolvedValue({
      kind: 'converged' as const,
      result: {
        kind: 'adopted-remote' as const,
        change: 'passphrase' as const,
        nextLocalVault: nextVault,
      },
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

    mockSettleVaultMeta.mockResolvedValue({
      kind: 'converged' as const,
      result: {
        kind: 'adopted-remote' as const,
        change: 'recovery-key' as const,
        nextLocalVault: nextVault,
      },
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

    mockSettleVaultMeta.mockResolvedValue({
      kind: 'converged' as const,
      result: {
        kind: 'noop-declined' as const,
        change: 'passphrase' as const,
      },
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

  test('passphrase dialog still renders adopt button', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangeMetaConvergeWithPrompt({});

    render(<VaultMetaConvergeRunner />);

    await screen.findByRole('dialog');

    // Adopt button should be present for passphrase
    expect(
      screen.getByRole('button', { name: 'Use the new passphrase' }),
    ).not.toBeNull();
  });

  test('recovery-key dialog still renders adopt button', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockSettleVaultMeta.mockImplementation(
      async (options: SettleVaultMetaOptions) => {
        await options.prompt({
          change: 'recovery-key',
        });

        return {
          kind: 'converged' as const,
          result: { kind: 'noop-already-in-sync' as const },
        };
      },
    );

    render(<VaultMetaConvergeRunner />);

    await screen.findByRole('dialog');

    // Adopt button should be present for recovery-key
    expect(
      screen.getByRole('button', { name: 'Use the new recovery key' }),
    ).not.toBeNull();
  });

  test('should display recovery-key-specific copy when recovery-key diverged', async () => {
    const decisionResult: { current?: VaultMetaDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockSettleVaultMeta.mockImplementation(
      async (options: SettleVaultMetaOptions) => {
        decisionResult.current = await options.prompt({
          change: 'recovery-key',
        });

        return {
          kind: 'converged' as const,
          result: { kind: 'noop-already-in-sync' as const },
        };
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

  test('should display different-vault dialog with correct copy and no adopt button', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockSettleVaultMeta.mockImplementation(
      async (options: SettleVaultMetaOptions) => {
        await options.prompt({
          change: 'different-vault',
        });

        return {
          kind: 'converged' as const,
          result: { kind: 'noop-already-in-sync' as const },
        };
      },
    );

    render(<VaultMetaConvergeRunner />);

    await screen.findByRole('dialog');

    expect(
      screen.getByText('This device holds a different vault'),
    ).not.toBeNull();
    expect(
      screen.getByText(
        'The vault on the server was created separately from the one on this device.',
      ),
    ).not.toBeNull();

    // Crucially: no "use the new" button should be present (no adopt button for different-vault)
    expect(screen.queryByRole('button', { name: /use the new/i })).toBeNull();
  });

  test('different-vault dialog resolves defer when dismissed', async () => {
    const decisionResult: { current?: VaultMetaDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockSettleVaultMeta.mockImplementation(
      async (options: SettleVaultMetaOptions) => {
        const decision = await options.prompt({
          change: 'different-vault',
        });

        decisionResult.current = decision;
        if (decision === 'defer') {
          return {
            kind: 'converged' as const,
            result: {
              kind: 'noop-deferred' as const,
              change: 'different-vault' as const,
            },
          };
        }
        return {
          kind: 'converged' as const,
          result: { kind: 'noop-already-in-sync' as const },
        };
      },
    );

    render(<VaultMetaConvergeRunner />);

    await screen.findByRole('dialog');
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(decisionResult.current).toBe('defer'));

    // No saveVault call
    expect(mockHandle.saveVault).not.toHaveBeenCalled();
    // No toast
    expect(mockToast).not.toHaveBeenCalled();
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
      expect(mockSettleVaultMeta).toHaveBeenCalledTimes(1);
    });

    // Verify user-a's flag is set (skipped-no-local-vault DOES set the flag)
    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_meta_converge_ran_v1:user-a',
      ),
    ).toBe('1');

    // Unmount and clear mock call count, but DO NOT clear sessionStorage
    unmount();
    mockSettleVaultMeta.mockClear();

    // User B: render with a different owner in the same session
    const handleB = createMockHandle('user-b');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleB,
    });

    arrangeNoPromptMetaConverge();

    render(<VaultMetaConvergeRunner />);

    // Wait for user-b's converge to be called (should not be skipped because they are a different user)
    await waitFor(() => {
      expect(mockSettleVaultMeta).toHaveBeenCalledTimes(1);
    });
  });

  test('skips meta converge when same owner re-renders with flag already set', async () => {
    const handleA = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleA,
    });

    mockSettleVaultMeta.mockResolvedValue({
      kind: 'converged' as const,
      result: {
        kind: 'noop-declined' as const,
        change: 'passphrase' as const,
      },
    });

    const { rerender } = render(<VaultMetaConvergeRunner />);

    // Wait for first render to complete converge
    await waitFor(() => {
      expect(mockSettleVaultMeta).toHaveBeenCalledTimes(1);
    });

    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_meta_converge_ran_v1:user-a',
      ),
    ).toBe('1');

    // Clear mock call count and re-render with same owner
    mockSettleVaultMeta.mockClear();
    rerender(<VaultMetaConvergeRunner />);

    // Wait a bit, then verify converge was NOT called again
    await waitFor(
      () => {
        expect(mockSettleVaultMeta).not.toHaveBeenCalled();
      },
      { timeout: 500 },
    );
  });

  test('when settleVaultMeta resolves pushed-local-wrapping, no dialog is rendered and toast is not called', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockSettleVaultMeta.mockResolvedValue({
      kind: 'pushed-local-wrapping' as const,
    });

    render(<VaultMetaConvergeRunner />);

    // Verify no dialog is rendered
    await waitFor(() => {
      const dialog = screen.queryByRole('dialog');
      expect(dialog).toBeNull();
    });

    // Verify toast was not called
    expect(mockToast).not.toHaveBeenCalled();
  });

  test('when settleVaultMeta resolves pushed-local-wrapping, session flag is set and second render does not call settleVaultMeta again', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockSettleVaultMeta.mockResolvedValue({
      kind: 'pushed-local-wrapping' as const,
    });

    const { rerender } = render(<VaultMetaConvergeRunner />);

    // Wait for first render to complete
    await waitFor(() => {
      expect(mockSettleVaultMeta).toHaveBeenCalledTimes(1);
    });

    // Verify session flag is set
    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_meta_converge_ran_v1:user-a',
      ),
    ).toBe('1');

    // Clear mock call count and re-render with same owner
    mockSettleVaultMeta.mockClear();
    rerender(<VaultMetaConvergeRunner />);

    // Wait a bit, then verify settleVaultMeta was NOT called again
    await waitFor(
      () => {
        expect(mockSettleVaultMeta).not.toHaveBeenCalled();
      },
      { timeout: 500 },
    );
  });
});
