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
  reconcileVaultWithServer: (options: ReconcilePromptOptions) =>
    mockReconcileVaultWithServer(options),
}));

jest.mock('./session', () => ({
  useOptionalVaultSession: jest.fn(),
}));

import type { ReconcileDecision } from '@myorganizer/web-vault';
import { useOptionalVaultSession } from './session';
import { VaultReconcileRunner } from './reconcileRunner';

type ReconcilePromptOptions = {
  prompt: (params: { message: string }) => Promise<ReconcileDecision>;
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

function arrangePrompt(decisionResult: { current?: ReconcileDecision }) {
  mockReconcileVaultWithServer.mockImplementation(
    async (options: ReconcilePromptOptions) => {
      decisionResult.current = await options.prompt({
        message:
          'We found encrypted vault data both locally and on the server, and they differ. Choose which version to keep.',
      });

      return { kind: 'noop-already-in-sync' };
    },
  );
}

function arrangeNoPromptReconcile() {
  mockReconcileVaultWithServer.mockImplementation(async () => {
    return { kind: 'noop-already-in-sync' };
  });
}

describe('VaultReconcileRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
  });

  test('uses the app modal to keep local vault data when OK is selected', async () => {
    const decisionResult: { current?: ReconcileDecision } = {};
    const mockHandle = createMockHandle('user-a');
    const confirmSpy = jest.spyOn(window, 'confirm');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangePrompt(decisionResult);

    render(<VaultReconcileRunner />);

    expect(await screen.findByRole('dialog')).not.toBeNull();
    expect(screen.getByText('Choose vault data to keep')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'OK' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(decisionResult.current).toBe('keep-local'));
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  test('uses the app modal to keep server vault data when Cancel is selected', async () => {
    const decisionResult: { current?: ReconcileDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangePrompt(decisionResult);

    render(<VaultReconcileRunner />);

    expect(await screen.findByRole('dialog')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(decisionResult.current).toBe('keep-server'));
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
    expect(handleA.loadVault).toHaveBeenCalled();

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
    expect(handleB.loadVault).toHaveBeenCalled();
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

  test('first sync of a newly registered User carries no migration wording', async () => {
    const handle = createMockHandle('new-user');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({ handle });

    // A User who has just registered: their Local Vault exists, the server
    // holds nothing yet, so reconcile uploads it. That is a first sync, not a
    // migration, and nothing the User sees may say otherwise (issue #391).
    mockReconcileVaultWithServer.mockResolvedValue({
      kind: 'uploaded-local-to-server',
    });

    render(<VaultReconcileRunner />);

    await waitFor(() => expect(mockToast).toHaveBeenCalled());

    const shown = mockToast.mock.calls
      .map(([args]: [Record<string, unknown>]) => JSON.stringify(args))
      .join(' ')
      .toLowerCase();
    expect(shown).not.toContain('migrat');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
