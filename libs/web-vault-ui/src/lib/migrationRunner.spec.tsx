/* eslint-disable import/first -- jest.mock must precede application imports */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockToast = jest.fn();
const mockMigrateVaultPhase1ToPhase2 = jest.fn();

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
  migrateVaultPhase1ToPhase2: (options: MigrationPromptOptions) =>
    mockMigrateVaultPhase1ToPhase2(options),
}));

jest.mock('./session', () => ({
  useOptionalVaultSession: jest.fn(),
}));

import type { MigrationDecision } from '@myorganizer/web-vault';
import { useOptionalVaultSession } from './session';
import { VaultMigrationRunner } from './migrationRunner';

type MigrationPromptOptions = {
  prompt: (params: { message: string }) => Promise<MigrationDecision>;
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

function arrangePrompt(decisionResult: { current?: MigrationDecision }) {
  mockMigrateVaultPhase1ToPhase2.mockImplementation(
    async (options: MigrationPromptOptions) => {
      decisionResult.current = await options.prompt({
        message:
          'We found encrypted vault data both locally and on the server, and they differ. Choose which version to keep.',
      });

      return { kind: 'noop-already-in-sync' };
    },
  );
}

function arrangeNoPromptMigration() {
  mockMigrateVaultPhase1ToPhase2.mockImplementation(async () => {
    return { kind: 'noop-already-in-sync' };
  });
}

describe('VaultMigrationRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
  });

  test('uses the app modal to keep local vault data when OK is selected', async () => {
    const decisionResult: { current?: MigrationDecision } = {};
    const mockHandle = createMockHandle('user-a');
    const confirmSpy = jest.spyOn(window, 'confirm');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangePrompt(decisionResult);

    render(<VaultMigrationRunner />);

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
    const decisionResult: { current?: MigrationDecision } = {};
    const mockHandle = createMockHandle('user-a');

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    arrangePrompt(decisionResult);

    render(<VaultMigrationRunner />);

    expect(await screen.findByRole('dialog')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(decisionResult.current).toBe('keep-server'));
  });

  test('per-User scoping: different users in same session each trigger reconcile independently', async () => {
    // User A: render and complete migration
    const handleA = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleA,
    });

    arrangeNoPromptMigration();

    const { unmount } = render(<VaultMigrationRunner />);

    // Wait for user-a's migration to complete
    await waitFor(() => {
      expect(mockMigrateVaultPhase1ToPhase2).toHaveBeenCalledTimes(1);
    });

    // Verify user-a's flag is set
    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_migration_ran_v1:user-a',
      ),
    ).toBe('1');
    expect(handleA.loadVault).toHaveBeenCalled();

    // Unmount and clear mock call count, but DO NOT clear sessionStorage
    unmount();
    mockMigrateVaultPhase1ToPhase2.mockClear();

    // User B: render with a different owner in the same session
    const handleB = createMockHandle('user-b');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleB,
    });

    arrangeNoPromptMigration();

    render(<VaultMigrationRunner />);

    // Wait for user-b's migration to be called (should not be skipped)
    await waitFor(() => {
      expect(mockMigrateVaultPhase1ToPhase2).toHaveBeenCalledTimes(1);
    });

    // Verify user-b's flag is now set (and user-a's is still set)
    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_migration_ran_v1:user-a',
      ),
    ).toBe('1');
    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_migration_ran_v1:user-b',
      ),
    ).toBe('1');
    expect(handleB.loadVault).toHaveBeenCalled();
  });

  test('skips migration when same owner re-renders with flag already set', async () => {
    const handleA = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleA,
    });

    arrangeNoPromptMigration();

    const { rerender } = render(<VaultMigrationRunner />);

    // Wait for first render to complete migration
    await waitFor(() => {
      expect(mockMigrateVaultPhase1ToPhase2).toHaveBeenCalledTimes(1);
    });

    expect(
      window.sessionStorage.getItem(
        'myorganizer_vault_migration_ran_v1:user-a',
      ),
    ).toBe('1');

    mockMigrateVaultPhase1ToPhase2.mockClear();

    // Re-render with same owner
    rerender(<VaultMigrationRunner />);

    // Migration should not be called again
    await waitFor(() => {
      expect(mockMigrateVaultPhase1ToPhase2).not.toHaveBeenCalled();
    });
  });
});
