/* eslint-disable import/first -- jest.mock must precede application imports */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockToast = jest.fn();
const mockReconcileVaultWithServer = jest.fn();

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
  reconcileVaultWithServer: (options: ReconcileOptions) =>
    mockReconcileVaultWithServer(options),
}));

jest.mock('./session', () => ({
  useOptionalVaultSession: jest.fn(),
}));

import type {
  VaultReconcileAsk,
  VaultReconcileDecision,
} from '@myorganizer/web-vault';
import { VaultBlobType } from '@myorganizer/app-api-client';
import { useOptionalVaultSession } from './session';
import { VaultReconcileRunner } from './reconcileRunner';
import { vaultBlobTypeLabel } from './vaultSyncMessages';

type ReconcileOptions = {
  handle: MockHandle;
  prompt: (ask: VaultReconcileAsk) => Promise<VaultReconcileDecision>;
};

type MockHandle = {
  owner: string;
  loadVault: jest.Mock;
};

function createMockHandle(owner: string): MockHandle {
  return {
    owner,
    loadVault: jest.fn(() => ({ data: {} })),
  };
}

function arrangePrompt(decisionResult: { current?: VaultReconcileDecision }) {
  mockReconcileVaultWithServer.mockImplementation(
    async (options: ReconcileOptions) => {
      const ask: VaultReconcileAsk = {
        kind: 'blob',
        type: VaultBlobType.Groceries,
        reason: 'strategy',
      };
      decisionResult.current = await options.prompt(ask);

      return {
        kind: 'reconciled',
        start: 'both',
        converged: [],
        deferred: false,
      };
    },
  );
}

function arrangeNoPromptReconcile() {
  mockReconcileVaultWithServer.mockImplementation(async () => {
    return {
      kind: 'reconciled',
      start: 'both',
      converged: [],
      deferred: false,
    };
  });
}

describe('VaultReconcileRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
  });

  test('renders dialog with proper copy for blob-type strategy ask', async () => {
    const decisionResult: { current?: VaultReconcileDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangePrompt(decisionResult);

    render(<VaultReconcileRunner />);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).not.toBeNull();

    // The dialog names the Vault Blob Type, in the User-facing wording the
    // pinned label table gives it — read off the table, not spelled again.
    const label = vaultBlobTypeLabel(VaultBlobType.Groceries);
    expect(screen.getAllByText(new RegExp(label, 'i')).length).toBeGreaterThan(
      0,
    );

    // Should show buttons for both choices
    expect(
      screen.getByRole('button', { name: "Keep this device's data" }),
    ).not.toBeNull();
    expect(
      screen.getByRole('button', { name: "Keep the server's data" }),
    ).not.toBeNull();
  });

  test('clicking keep-local button sends keep-local decision', async () => {
    const decisionResult: { current?: VaultReconcileDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangePrompt(decisionResult);

    render(<VaultReconcileRunner />);

    expect(await screen.findByRole('dialog')).not.toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: "Keep this device's data" }),
    );

    await waitFor(() => expect(decisionResult.current).toBe('keep-local'));
  });

  test('clicking keep-remote button sends keep-remote decision', async () => {
    const decisionResult: { current?: VaultReconcileDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangePrompt(decisionResult);

    render(<VaultReconcileRunner />);

    expect(await screen.findByRole('dialog')).not.toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: "Keep the server's data" }),
    );

    await waitFor(() => expect(decisionResult.current).toBe('keep-remote'));
  });

  test('renders whole-vault ask when kind is vault', async () => {
    const decisionResult: { current?: VaultReconcileDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockReconcileVaultWithServer.mockImplementation(
      async (options: ReconcileOptions) => {
        const ask: VaultReconcileAsk = { kind: 'vault' };
        decisionResult.current = await options.prompt(ask);
        return {
          kind: 'reconciled',
          start: 'both',
          converged: [],
          deferred: false,
        };
      },
    );

    render(<VaultReconcileRunner />);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).not.toBeNull();

    // Should show whole-vault specific copy
    expect(
      screen.getByText(/this vault is not the one on the server/i),
    ).not.toBeNull();
  });

  test('per-User scoping: different users in same session each trigger reconcile independently', async () => {
    // User A: render and complete reconcile
    const handleA = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleA,
    });

    arrangeNoPromptReconcile();

    const { unmount } = render(<VaultReconcileRunner />);

    // Wait for user-a's reconcile to complete
    await waitFor(() => {
      expect(mockReconcileVaultWithServer).toHaveBeenCalledTimes(1);
    });

    // Verify user-a's flag is set
    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_reconcile_ran_v1:user-a',
      ),
    ).toBe('1');
    // The runner hands convergence the handle itself; it no longer reads the
    // Local Vault on its own.
    expect(mockReconcileVaultWithServer).toHaveBeenCalledWith(
      expect.objectContaining({ handle: handleA }),
    );

    // Unmount and clear mock call count, but DO NOT clear sessionStorage
    unmount();
    mockReconcileVaultWithServer.mockClear();

    // User B: render with a different owner in the same session
    const handleB = createMockHandle('user-b');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleB,
    });

    arrangeNoPromptReconcile();

    render(<VaultReconcileRunner />);

    // Wait for user-b's reconcile to be called (should not be skipped)
    await waitFor(() => {
      expect(mockReconcileVaultWithServer).toHaveBeenCalledTimes(1);
    });

    // Verify user-b's flag is now set (and user-a's is still set)
    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_reconcile_ran_v1:user-a',
      ),
    ).toBe('1');
    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_reconcile_ran_v1:user-b',
      ),
    ).toBe('1');
    expect(mockReconcileVaultWithServer).toHaveBeenCalledWith(
      expect.objectContaining({ handle: handleB }),
    );
  });

  test('skips reconcile when same owner re-renders with flag already set', async () => {
    const handleA = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleA,
    });

    arrangeNoPromptReconcile();

    const { rerender } = render(<VaultReconcileRunner />);

    // Wait for first render to complete reconcile
    await waitFor(() => {
      expect(mockReconcileVaultWithServer).toHaveBeenCalledTimes(1);
    });

    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_reconcile_ran_v1:user-a',
      ),
    ).toBe('1');

    mockReconcileVaultWithServer.mockClear();

    // Re-render with same owner
    rerender(<VaultReconcileRunner />);

    // Reconcile should not be called again
    await waitFor(() => {
      expect(mockReconcileVaultWithServer).not.toHaveBeenCalled();
    });
  });

  test('dismissing conflict dialog resolves prompt with defer, not keep-server (ADR 0033)', async () => {
    const decisionResult: { current?: VaultReconcileDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangePrompt(decisionResult);

    render(<VaultReconcileRunner />);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).not.toBeNull();

    // Simulate Escape key dismissal
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(decisionResult.current).toBe('defer'));
  });

  test('when reconcile defers conflict, session flag is not set', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    // Reconcile result has deferred: true
    mockReconcileVaultWithServer.mockResolvedValue({
      kind: 'reconciled',
      start: 'both',
      converged: [],
      deferred: true,
    });

    render(<VaultReconcileRunner />);

    await waitFor(() => {
      expect(mockReconcileVaultWithServer).toHaveBeenCalled();
    });

    // Session flag should NOT be set after deferred result
    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_reconcile_ran_v1:user-a',
      ),
    ).toBeNull();
  });

  test('unmounting while prompt is pending resolves with defer and writes nothing', async () => {
    const decisionResult: { current?: VaultReconcileDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangePrompt(decisionResult);

    const { unmount } = render(<VaultReconcileRunner />);

    // Wait for dialog to appear
    await screen.findByRole('dialog');

    // Unmount while prompt is pending
    unmount();

    // The cleanup function should resolve with 'defer'
    await waitFor(() => expect(decisionResult.current).toBe('defer'));

    // Session flag should NOT be set since unmount resolves with defer
    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_reconcile_ran_v1:user-a',
      ),
    ).toBeNull();
  });

  test('sets session flag when reconcile succeeds with changes', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockReconcileVaultWithServer.mockResolvedValue({
      kind: 'reconciled',
      start: 'both',
      converged: [
        {
          type: VaultBlobType.Tasks,
          outcome: { kind: 'sent', etag: 'e1' },
        },
      ],
      deferred: false,
    });

    render(<VaultReconcileRunner />);

    await waitFor(() => {
      expect(mockReconcileVaultWithServer).toHaveBeenCalled();
    });

    // Session flag should be set
    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_reconcile_ran_v1:user-a',
      ),
    ).toBe('1');
  });

  test('does not set session flag on skipped-not-authenticated', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockReconcileVaultWithServer.mockResolvedValue({
      kind: 'skipped-not-authenticated',
    });

    render(<VaultReconcileRunner />);

    await waitFor(() => {
      expect(mockReconcileVaultWithServer).toHaveBeenCalled();
    });

    // Session flag should NOT be set for skipped result
    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_reconcile_ran_v1:user-a',
      ),
    ).toBeNull();
  });

  test('shows toast for downloaded-server-wrapping', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockReconcileVaultWithServer.mockResolvedValue({
      kind: 'reconciled',
      start: 'downloaded-server-wrapping',
      converged: [],
      deferred: false,
    });

    render(<VaultReconcileRunner />);

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));

    const [toastArgs] = mockToast.mock.calls[0] as [Record<string, unknown>];
    expect(toastArgs.title).toBe('Vault synced');
    expect(toastArgs.description).toBe(
      'Downloaded your server vault to this device.',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('shows toast for uploaded-local-wrapping', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockReconcileVaultWithServer.mockResolvedValue({
      kind: 'reconciled',
      start: 'uploaded-local-wrapping',
      converged: [],
      deferred: false,
    });

    render(<VaultReconcileRunner />);

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));

    const [toastArgs] = mockToast.mock.calls[0] as [Record<string, unknown>];
    expect(toastArgs.title).toBe('Vault synced');
    expect(toastArgs.description).toBe(
      'Your encrypted vault is now backed up to the server.',
    );
    // A newly registered User's first sync is an ordinary first sync, never a
    // migration — CONTEXT.md lists "vault migration" under _Avoid_ for Vault
    // Reconcile, and this User has nothing to migrate from.
    expect(JSON.stringify(toastArgs).toLowerCase()).not.toContain('migrat');
  });

  test('shows error toast on reconcile failure', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockReconcileVaultWithServer.mockRejectedValue(new Error('Network error'));

    render(<VaultReconcileRunner />);

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));

    const [toastArgs] = mockToast.mock.calls[0] as [Record<string, unknown>];
    expect(toastArgs.variant).toBe('destructive');
  });
});
