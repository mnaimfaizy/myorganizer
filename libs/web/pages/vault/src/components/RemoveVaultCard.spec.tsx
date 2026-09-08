/* eslint-disable import/first -- jest.mock must precede application imports */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Mock the hooks from ../hooks before importing RemoveVaultCard.
 */
jest.mock('../hooks', () => ({
  useLatestCloudBackup: jest.fn(),
  useExportVault: jest.fn(),
  useVaultDisabledState: jest.fn(),
}));

/**
 * Mock web-vault-ui hooks.
 */
jest.mock('@myorganizer/web-vault-ui', () => ({
  useOptionalVaultSession: jest.fn(),
}));

/**
 * Mock web-ui components and useToast.
 */
jest.mock('@myorganizer/web-ui', () => {
  return {
    Button: ({ children, onClick, disabled, ...props }: any) => (
      <button onClick={onClick} disabled={disabled} {...props}>
        {children}
      </button>
    ),
    Card: ({ children }: any) => <div data-testid="card">{children}</div>,
    CardHeader: ({ children }: any) => <div>{children}</div>,
    CardTitle: ({ children }: any) => <h2>{children}</h2>,
    CardDescription: ({ children }: any) => <p>{children}</p>,
    CardContent: ({ children }: any) => <div>{children}</div>,
    ConfirmDeleteDialog: ({
      open,
      onOpenChange,
      title,
      description,
      onConfirm,
      children,
    }: any) => {
      if (!open) return null;
      return (
        <div data-testid="confirm-delete-dialog" role="dialog">
          <h2>{title}</h2>
          <p data-testid="delete-description">{description}</p>
          {children && <div data-testid="dialog-children">{children}</div>}
          <button
            data-testid="delete-cancel-btn"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button data-testid="delete-confirm-btn" onClick={() => onConfirm()}>
            Delete
          </button>
        </div>
      );
    },
    useToast: jest.fn(),
  };
});

import { RemoveVaultCard } from './RemoveVaultCard';
import type { VaultHandle } from '@myorganizer/web-vault';
import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';
import { useToast } from '@myorganizer/web-ui';
import {
  useLatestCloudBackup,
  useExportVault,
  useVaultDisabledState,
} from '../hooks';

// === Mock helpers ===

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

describe('RemoveVaultCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    (useVaultDisabledState as jest.Mock).mockReturnValue('enabled');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: createMockHandle({ hasOwnedVault: () => true }),
    });
    (useToast as jest.Mock).mockReturnValue({ toast: jest.fn() });
    (useLatestCloudBackup as jest.Mock).mockReturnValue({
      status: 'empty',
      record: null,
    });
    (useExportVault as jest.Mock).mockReturnValue({
      exporting: false,
      exportVaultNow: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('1: signed-out state renders card, disables button, shows unavailability message', () => {
    (useVaultDisabledState as jest.Mock).mockReturnValue('signed-out');

    render(<RemoveVaultCard />);

    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTestId('remove-vault-button')).toBeDisabled();
    expect(screen.getByTestId('remove-vault-unavailable')).toBeInTheDocument();
    expect(
      screen.getByText('Your vault is not available on this device right now.'),
    ).toBeInTheDocument();
  });

  test('2: no-local-vault state renders card, disables button, shows correct unavailability message', () => {
    (useVaultDisabledState as jest.Mock).mockReturnValue('no-local-vault');

    render(<RemoveVaultCard />);

    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTestId('remove-vault-button')).toBeDisabled();
    expect(screen.getByTestId('remove-vault-unavailable')).toBeInTheDocument();
    expect(
      screen.getByText('There is no vault on this device to remove.'),
    ).toBeInTheDocument();
  });

  test('3: locked state renders card, enables button, no unavailability message (removal does not need Master Key per ADR 0068)', () => {
    (useVaultDisabledState as jest.Mock).mockReturnValue('locked');

    render(<RemoveVaultCard />);

    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTestId('remove-vault-button')).not.toBeDisabled();
    expect(
      screen.queryByTestId('remove-vault-unavailable'),
    ).not.toBeInTheDocument();
  });

  test('4: enabled state renders card, enables button', () => {
    (useVaultDisabledState as jest.Mock).mockReturnValue('enabled');

    render(<RemoveVaultCard />);

    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTestId('remove-vault-button')).not.toBeDisabled();
  });

  test('D5: signed-out state + attempted click does not open confirmation dialog', async () => {
    (useVaultDisabledState as jest.Mock).mockReturnValue('signed-out');

    render(<RemoveVaultCard />);

    const button = screen.getByTestId('remove-vault-button');
    expect(button).toBeDisabled();

    // Try to click anyway
    fireEvent.click(button);

    // Dialog should not open
    expect(
      screen.queryByTestId('confirm-delete-dialog'),
    ).not.toBeInTheDocument();
  });

  test('5: clicking the "Remove local vault" button opens the confirmation dialog', async () => {
    render(<RemoveVaultCard />);

    const button = screen.getByTestId('remove-vault-button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
    });
  });

  test('6: description — never-backed-up case shows "never been backed up" and export button', async () => {
    (useLatestCloudBackup as jest.Mock).mockReturnValue({
      status: 'empty',
      record: null,
    });

    render(<RemoveVaultCard />);

    const button = screen.getByTestId('remove-vault-button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
    });

    const description = screen.getByTestId('delete-description');
    expect(description.textContent).toContain('never been backed up');

    expect(
      screen.getByTestId('remove-vault-export-first-button'),
    ).toBeInTheDocument();
  });

  test('7: description — backed-up-before case shows backup date and no export button', async () => {
    (useLatestCloudBackup as jest.Mock).mockReturnValue({
      status: 'loaded',
      record: {
        createdAt: '2026-01-15T10:00:00.000Z',
        id: 'backup-1',
        event: 'backup',
        source: 'google-drive',
        status: 'success',
        schemaVersion: 1,
        sizeBytes: 100,
      },
    });

    render(<RemoveVaultCard />);

    const button = screen.getByTestId('remove-vault-button');
    fireEvent.click(button);

    await waitFor(() => {
      const description = screen.getByTestId('delete-description');
      expect(description.textContent).toContain('last backed up on');
      expect(description.textContent).toContain('unaffected');

      expect(
        screen.queryByTestId('remove-vault-export-first-button'),
      ).not.toBeInTheDocument();
    });
  });

  test('8: description — loading state shows "Checking whether this Vault has ever been backed up…"', async () => {
    (useLatestCloudBackup as jest.Mock).mockReturnValue({
      status: 'loading',
      record: null,
    });

    render(<RemoveVaultCard />);

    const button = screen.getByTestId('remove-vault-button');
    fireEvent.click(button);

    await waitFor(() => {
      const description = screen.getByTestId('delete-description');
      expect(description.textContent).toContain(
        'Checking whether this Vault has ever been backed up',
      );
    });
  });

  test('9: description — error state shows "could not be confirmed"', async () => {
    (useLatestCloudBackup as jest.Mock).mockReturnValue({
      status: 'error',
      record: null,
      error: new Error('Network failed'),
    });

    render(<RemoveVaultCard />);

    const button = screen.getByTestId('remove-vault-button');
    fireEvent.click(button);

    await waitFor(() => {
      const description = screen.getByTestId('delete-description');
      expect(description.textContent).toContain('could not be confirmed');
    });
  });

  test('10: clicking export button calls exportVaultNow and does NOT close dialog', async () => {
    const mockExportVaultNow = jest.fn();
    (useLatestCloudBackup as jest.Mock).mockReturnValue({
      status: 'empty',
      record: null,
    });
    (useExportVault as jest.Mock).mockReturnValue({
      exporting: false,
      exportVaultNow: mockExportVaultNow,
    });

    render(<RemoveVaultCard />);

    const removeButton = screen.getByTestId('remove-vault-button');
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('remove-vault-export-first-button');
    fireEvent.click(exportButton);

    await waitFor(
      () => {
        expect(mockExportVaultNow).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );

    // Dialog should still be open
    expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
  });

  test('11: clicking confirm calls handle.removeVault() and shows success toast', async () => {
    const mockRemoveVault = jest.fn();
    const mockToast = jest.fn();
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: createMockHandle({ removeVault: mockRemoveVault }),
    });
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });

    render(<RemoveVaultCard />);

    const removeButton = screen.getByTestId('remove-vault-button');
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByTestId('delete-confirm-btn');

    // Verify confirm can be clicked without errors (window.location.reload() is called and suppressed above)
    expect(() => {
      fireEvent.click(confirmButton);
    }).not.toThrow();

    await waitFor(
      () => {
        expect(mockRemoveVault).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Vault removed',
        description: 'This Vault was removed from this device.',
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  test('12: if handle.removeVault() throws, shows error toast and does NOT reload', async () => {
    const mockRemoveVault = jest.fn().mockImplementation(() => {
      throw new Error('Storage access denied');
    });
    const mockToast = jest.fn();

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: createMockHandle({ removeVault: mockRemoveVault }),
    });
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });

    render(<RemoveVaultCard />);

    const removeButton = screen.getByTestId('remove-vault-button');
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByTestId('delete-confirm-btn');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockRemoveVault).toHaveBeenCalled();
    });

    // Check error toast
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Removal failed',
        variant: 'destructive',
      }),
    );

    // Dialog should still be open (no reload)
    expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
  });

  test('13: clicking cancel button closes the dialog without calling removeVault()', async () => {
    const mockRemoveVault = jest.fn();

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: createMockHandle({ removeVault: mockRemoveVault }),
    });

    render(<RemoveVaultCard />);

    const removeButton = screen.getByTestId('remove-vault-button');
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
    });

    const cancelButton = screen.getByTestId('delete-cancel-btn');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(
        screen.queryByTestId('confirm-delete-dialog'),
      ).not.toBeInTheDocument();
    });

    expect(mockRemoveVault).not.toHaveBeenCalled();
  });
});
