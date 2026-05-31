import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { MigrationDecision } from '@myorganizer/web-vault';

import { VaultMigrationRunner } from './migrationRunner';

const mockToast = jest.fn();
const mockMigrateVaultPhase1ToPhase2 = jest.fn();
const mockSaveVault = jest.fn();

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
  loadVault: jest.fn(() => ({ data: {} })),
  migrateVaultPhase1ToPhase2: (options: MigrationPromptOptions) =>
    mockMigrateVaultPhase1ToPhase2(options),
  saveVault: (vault: unknown) => mockSaveVault(vault),
}));

type MigrationPromptOptions = {
  prompt: (params: { message: string }) => Promise<MigrationDecision>;
};

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

describe('VaultMigrationRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
  });

  test('uses the app modal to keep local vault data when OK is selected', async () => {
    const decisionResult: { current?: MigrationDecision } = {};
    const confirmSpy = jest.spyOn(window, 'confirm');
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
    arrangePrompt(decisionResult);

    render(<VaultMigrationRunner />);

    expect(await screen.findByRole('dialog')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(decisionResult.current).toBe('keep-server'));
  });
});
