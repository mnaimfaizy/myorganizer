/* eslint-disable import/first -- jest.mock must precede application imports */
import '@testing-library/jest-dom';

jest.mock('../hooks', () => ({
  useVaultDisabledState: jest.fn(),
}));

jest.mock('@myorganizer/web-vault-ui', () => ({
  useOptionalVaultSession: jest.fn(),
  getVaultImportErrorMessage: jest.fn(
    (code: string) => `Import error: ${code}`,
  ),
}));

jest.mock('@myorganizer/web-vault', () => ({
  ...jest.requireActual('@myorganizer/web-vault'),
  importVault: jest.fn(),
  isVaultImportError: jest.fn(),
  createDefaultReplayTracker: jest.fn(() => ({})),
  createDefaultAuditReporter: jest.fn(() => ({})),
}));

jest.mock('@myorganizer/web-ui', () => {
  const actual = jest.requireActual('@myorganizer/web-ui');
  return {
    ...actual,
    useToast: jest.fn(),
  };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { VaultHandle } from '@myorganizer/web-vault';
import {
  importVault,
  isVaultImportError,
  type ImportVaultResult,
} from '@myorganizer/web-vault';
import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';
import { useToast } from '@myorganizer/web-ui';
import { useVaultDisabledState } from '../hooks';

import { ImportVaultCard } from './ImportVaultCard';

function createMockHandle(overrides?: Partial<VaultHandle>): VaultHandle {
  return {
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
    loadDecryptedData: jest.fn(),
    saveEncryptedData: jest.fn(),
    ...overrides,
  } as unknown as VaultHandle;
}

const VAULT_FILE_CONTENT = '{"schemaVersion":1}';

function createVaultFile(): File {
  const file = new File([VAULT_FILE_CONTENT], 'vault.json', {
    type: 'application/json',
  });

  Object.defineProperty(file, 'text', {
    value: () => Promise.resolve(VAULT_FILE_CONTENT),
    configurable: true,
  });

  return file;
}

function selectVaultFile(file: File = createVaultFile()) {
  const fileInput = screen.getByTestId('import-vault-file');
  fireEvent.change(fileInput, { target: { files: [file] } });
}

describe('ImportVaultCard', () => {
  let mockToast: jest.Mock;
  let confirmSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockToast = jest.fn();
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
    (useVaultDisabledState as jest.Mock).mockReturnValue('enabled');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: createMockHandle(),
    });
    jest.mocked(importVault).mockResolvedValue({} as ImportVaultResult);
    jest.mocked(isVaultImportError).mockReturnValue(false);

    confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  test('imports immediately when no local vault exists and never opens the replace dialog', async () => {
    render(<ImportVaultCard />);
    selectVaultFile();

    fireEvent.click(screen.getByTestId('import-vault-button'));

    await waitFor(() => {
      expect(importVault).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.queryByTestId('import-vault-replace-dialog'),
    ).not.toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Import complete' }),
    );
  });

  test('opens replace dialog with credential disclosure when a local vault already exists', async () => {
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: createMockHandle({
        loadVault: jest.fn().mockReturnValue({}),
      }),
    });

    render(<ImportVaultCard />);
    selectVaultFile();

    fireEvent.click(screen.getByTestId('import-vault-button'));

    await waitFor(() => {
      expect(
        screen.getByTestId('import-vault-replace-dialog'),
      ).toBeInTheDocument();
    });

    const dialogText = screen.getByTestId(
      'import-vault-replace-dialog',
    ).textContent;
    expect(dialogText).toMatch(/passphrase/i);
    expect(dialogText).toMatch(/Recovery Key/i);
    expect(dialogText).toMatch(/replaced/i);

    expect(importVault).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  test('runs import after acknowledgement and shows Import complete without Import canceled toast', async () => {
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: createMockHandle({
        loadVault: jest.fn().mockReturnValue({}),
      }),
    });

    render(<ImportVaultCard />);
    selectVaultFile();
    fireEvent.click(screen.getByTestId('import-vault-button'));

    await waitFor(() => {
      expect(
        screen.getByTestId('import-vault-replace-dialog'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('import-vault-replace-acknowledge'));
    fireEvent.click(screen.getByTestId('import-vault-replace-confirm'));

    await waitFor(() => {
      expect(importVault).toHaveBeenCalledTimes(1);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Import complete' }),
    );
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Import canceled' }),
    );
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  test('shows Import failed toast and dialog alert when confirmed import rejects', async () => {
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: createMockHandle({
        loadVault: jest.fn().mockReturnValue({}),
      }),
    });
    jest
      .mocked(importVault)
      .mockRejectedValue(new Error('Storage write failed'));

    render(<ImportVaultCard />);
    selectVaultFile();
    fireEvent.click(screen.getByTestId('import-vault-button'));

    await waitFor(() => {
      expect(
        screen.getByTestId('import-vault-replace-dialog'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('import-vault-replace-acknowledge'));
    fireEvent.click(screen.getByTestId('import-vault-replace-confirm'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Import failed',
          variant: 'destructive',
        }),
      );
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Storage write failed');
    expect(
      screen.getByTestId('import-vault-replace-dialog'),
    ).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  test('Cancel toasts Import canceled and does not call importVault', async () => {
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: createMockHandle({
        loadVault: jest.fn().mockReturnValue({}),
      }),
    });

    render(<ImportVaultCard />);
    selectVaultFile();
    fireEvent.click(screen.getByTestId('import-vault-button'));

    await waitFor(() => {
      expect(
        screen.getByTestId('import-vault-replace-dialog'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('import-vault-replace-cancel'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Import canceled',
          description: 'Your local vault was not changed.',
        }),
      );
    });

    expect(importVault).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  test('keeps Import disabled without a selected file so importVault and the dialog never run', () => {
    render(<ImportVaultCard />);

    const importButton = screen.getByTestId('import-vault-button');
    expect(importButton).toBeDisabled();

    fireEvent.click(importButton);

    expect(mockToast).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId('import-vault-replace-dialog'),
    ).not.toBeInTheDocument();
    expect(importVault).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  test('CardDescription states unlock uses backup passphrase or Recovery Key', () => {
    render(<ImportVaultCard />);

    expect(
      screen.getByText(
        /After import, unlock with the backup's passphrase or Recovery Key\./,
      ),
    ).toBeInTheDocument();
  });

  describe('Vault disabled state handling', () => {
    test('C1: signed-out state disables file input and button, shows unavailability reason', () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('signed-out');

      render(<ImportVaultCard />);

      expect(screen.getByTestId('import-vault-file')).toBeDisabled();
      expect(screen.getByTestId('import-vault-button')).toBeDisabled();
      expect(
        screen.getByTestId('import-vault-unavailable'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Your vault is not available on this device right now.',
        ),
      ).toBeInTheDocument();
    });

    test('C2: no-local-vault state disables file input and button, shows correct unavailability reason', () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('no-local-vault');

      render(<ImportVaultCard />);

      expect(screen.getByTestId('import-vault-file')).toBeDisabled();
      expect(screen.getByTestId('import-vault-button')).toBeDisabled();
      expect(
        screen.getByTestId('import-vault-unavailable'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Set up a local vault on this device before importing a backup into it.',
        ),
      ).toBeInTheDocument();
    });

    test('C3: locked state enables file input and button (import does not need Master Key per ADR 0068 / #625 regression guard)', async () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('locked');

      render(<ImportVaultCard />);

      expect(screen.getByTestId('import-vault-file')).not.toBeDisabled();
      expect(
        screen.queryByTestId('import-vault-unavailable'),
      ).not.toBeInTheDocument();

      // File input and button should be functional in locked state
      selectVaultFile();
      expect(screen.getByTestId('import-vault-button')).not.toBeDisabled();
    });

    test('C4: enabled state enables file input and button', () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('enabled');

      render(<ImportVaultCard />);

      expect(screen.getByTestId('import-vault-file')).not.toBeDisabled();
      expect(
        screen.queryByTestId('import-vault-unavailable'),
      ).not.toBeInTheDocument();
    });
  });
});
