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

  test('uses the app modal to keep local vault data when "Keep this device\'s data" is selected', async () => {
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
    expect(
      screen.getByRole('button', { name: "Keep this device's data" }),
    ).not.toBeNull();
    expect(
      screen.getByRole('button', { name: "Keep the server's data" }),
    ).not.toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: "Keep this device's data" }),
    );

    await waitFor(() => expect(decisionResult.current).toBe('keep-local'));
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  test('uses the app modal to keep server vault data when "Keep the server\'s data" is selected', async () => {
    const decisionResult: { current?: ReconcileDecision } = {};
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

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));

    const [toastArgs] = mockToast.mock.calls[0] as [Record<string, unknown>];
    expect(toastArgs.title).toBe('Vault synced');
    expect(toastArgs.description).toBe(
      'Your encrypted vault is now backed up to the server.',
    );
    expect(JSON.stringify(toastArgs).toLowerCase()).not.toContain('migrat');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('dismissing conflict dialog resolves prompt with defer, not keep-server (ADR 0033)', async () => {
    const decisionResult: { current?: ReconcileDecision } = {};
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

    // Reconcile result is noop-conflict-deferred
    mockReconcileVaultWithServer.mockResolvedValue({
      kind: 'noop-conflict-deferred',
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

  test('when reconcile defers conflict, saveVault is never called', async () => {
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    mockReconcileVaultWithServer.mockResolvedValue({
      kind: 'noop-conflict-deferred',
    });

    render(<VaultReconcileRunner />);

    await waitFor(() => {
      expect(mockReconcileVaultWithServer).toHaveBeenCalled();
    });

    expect(mockHandle.saveVault).not.toHaveBeenCalled();
  });

  test('unmounting while prompt is pending resolves with defer and writes nothing', async () => {
    const decisionResult: { current?: ReconcileDecision } = {};
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
});
