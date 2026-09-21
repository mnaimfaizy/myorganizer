/* eslint-disable import/first -- jest.mock must precede application imports */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

/**
 * Controllable mock of useCloudBackup to drive backupCounter between renders.
 * Tests update this and call rerender to exercise the effect.
 */
let mockCloudBackupState = {
  backupCounter: 0,
  connection: { status: 'not-linked' as const },
  ageLimit: 'off' as const,
  isBusy: false,
  lastError: null,
  pendingRestore: null,
  connect: jest.fn(),
  reconnect: jest.fn(),
  disconnect: jest.fn(),
  backupNow: jest.fn(),
  beginRestore: jest.fn(),
  confirmRestore: jest.fn(),
  cancelRestore: jest.fn(),
  setAgeLimit: jest.fn(),
};

/**
 * Mock hooks from ../hooks before importing CloudBackupLiveCard.
 * useCloudBackup is controllable; useLatestCloudBackup and useVaultImportDisclosure
 * return minimal stubs.
 */
jest.mock('../hooks', () => ({
  useCloudBackup: jest.fn(() => mockCloudBackupState),
  useLatestCloudBackup: jest.fn(() => ({
    status: 'loaded' as const,
    record: {
      createdAt: new Date().toISOString(),
      status: 'success' as const,
      source: 'google-drive' as const,
      event: 'export' as const,
    },
  })),
  useVaultImportDisclosure: jest.fn(() => ({
    loaded: true,
    text: 'vault text',
    error: null,
  })),
}));

/**
 * Mock @myorganizer/web-vault-ui components as trivial divs.
 */
jest.mock('@myorganizer/web-vault-ui', () => ({
  CloudBackupCard: () => (
    <div data-testid="cloud-backup-card">Cloud Backup</div>
  ),
}));

/**
 * Mock @myorganizer/web-vault functions and utilities.
 */
jest.mock('@myorganizer/web-vault', () => ({
  createVaultBackupsApi: jest.fn(() => ({
    getLatestBackup: jest.fn().mockResolvedValue({}),
  })),
  isEscapeCopyOverdue: jest.fn(() => false),
}));

/**
 * Mock ImportVaultReplaceDialog as a trivial div to avoid dialog complexity.
 */
jest.mock('./ImportVaultReplaceDialog', () => ({
  ImportVaultReplaceDialog: () => (
    <div data-testid="import-dialog">Import Dialog</div>
  ),
}));

import { CloudBackupLiveCard } from './CloudBackupLiveCard';

describe('CloudBackupLiveCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock state to defaults for each test
    mockCloudBackupState = {
      backupCounter: 0,
      connection: { status: 'not-linked' as const },
      ageLimit: 'off' as const,
      isBusy: false,
      lastError: null,
      pendingRestore: null,
      connect: jest.fn(),
      reconnect: jest.fn(),
      disconnect: jest.fn(),
      backupNow: jest.fn(),
      beginRestore: jest.fn(),
      confirmRestore: jest.fn(),
      cancelRestore: jest.fn(),
      setAgeLimit: jest.fn(),
    };
  });

  describe('onEscapeCopyMade callback behavior', () => {
    test('A1: does NOT call onEscapeCopyMade on initial mount when backupCounter is 0', () => {
      const mockOnEscapeCopyMade = jest.fn();

      render(
        <CloudBackupLiveCard
          provider={{ connect: jest.fn() } as any}
          handle={{ loadVault: jest.fn() } as any}
          onEscapeCopyMade={mockOnEscapeCopyMade}
        />,
      );

      expect(mockOnEscapeCopyMade).not.toHaveBeenCalled();
    });

    test('A2: does NOT call onEscapeCopyMade when backupCounter is unchanged across re-renders', () => {
      const mockOnEscapeCopyMade = jest.fn();
      mockCloudBackupState.backupCounter = 0;

      const { rerender } = render(
        <CloudBackupLiveCard
          provider={{ connect: jest.fn() } as any}
          handle={{ loadVault: jest.fn() } as any}
          onEscapeCopyMade={mockOnEscapeCopyMade}
        />,
      );

      expect(mockOnEscapeCopyMade).not.toHaveBeenCalled();

      // Re-render without changing backupCounter
      rerender(
        <CloudBackupLiveCard
          provider={{ connect: jest.fn() } as any}
          handle={{ loadVault: jest.fn() } as any}
          onEscapeCopyMade={mockOnEscapeCopyMade}
        />,
      );

      expect(mockOnEscapeCopyMade).not.toHaveBeenCalled();
    });

    test('A3: calls onEscapeCopyMade exactly once when backupCounter increments from 0 to 1', () => {
      const mockOnEscapeCopyMade = jest.fn();
      mockCloudBackupState.backupCounter = 0;

      const { rerender } = render(
        <CloudBackupLiveCard
          provider={{ connect: jest.fn() } as any}
          handle={{ loadVault: jest.fn() } as any}
          onEscapeCopyMade={mockOnEscapeCopyMade}
        />,
      );

      expect(mockOnEscapeCopyMade).not.toHaveBeenCalled();

      // Increment backupCounter
      mockCloudBackupState.backupCounter = 1;
      rerender(
        <CloudBackupLiveCard
          provider={{ connect: jest.fn() } as any}
          handle={{ loadVault: jest.fn() } as any}
          onEscapeCopyMade={mockOnEscapeCopyMade}
        />,
      );

      expect(mockOnEscapeCopyMade).toHaveBeenCalledTimes(1);
    });

    test('A4: calls onEscapeCopyMade again on a subsequent increment (1 to 2)', () => {
      const mockOnEscapeCopyMade = jest.fn();
      mockCloudBackupState.backupCounter = 0;

      const { rerender } = render(
        <CloudBackupLiveCard
          provider={{ connect: jest.fn() } as any}
          handle={{ loadVault: jest.fn() } as any}
          onEscapeCopyMade={mockOnEscapeCopyMade}
        />,
      );

      // First increment
      mockCloudBackupState.backupCounter = 1;
      rerender(
        <CloudBackupLiveCard
          provider={{ connect: jest.fn() } as any}
          handle={{ loadVault: jest.fn() } as any}
          onEscapeCopyMade={mockOnEscapeCopyMade}
        />,
      );
      expect(mockOnEscapeCopyMade).toHaveBeenCalledTimes(1);

      // Second increment
      mockCloudBackupState.backupCounter = 2;
      rerender(
        <CloudBackupLiveCard
          provider={{ connect: jest.fn() } as any}
          handle={{ loadVault: jest.fn() } as any}
          onEscapeCopyMade={mockOnEscapeCopyMade}
        />,
      );
      expect(mockOnEscapeCopyMade).toHaveBeenCalledTimes(2);
    });

    test('A5: does NOT fire callback on remount with non-zero backupCounter (fresh ref prevents replay)', () => {
      const mockOnEscapeCopyMade = jest.fn();
      mockCloudBackupState.backupCounter = 0;

      const { unmount } = render(
        <CloudBackupLiveCard
          provider={{ connect: jest.fn() } as any}
          handle={{ loadVault: jest.fn() } as any}
          onEscapeCopyMade={mockOnEscapeCopyMade}
        />,
      );

      unmount();

      // Remount with backupCounter already at 3
      mockCloudBackupState.backupCounter = 3;
      render(
        <CloudBackupLiveCard
          provider={{ connect: jest.fn() } as any}
          handle={{ loadVault: jest.fn() } as any}
          onEscapeCopyMade={mockOnEscapeCopyMade}
        />,
      );

      // The callback should not have been called by the new mount
      // (because the fresh ref initializes to 3, so the comparison 3 > 3 is false)
      expect(mockOnEscapeCopyMade).not.toHaveBeenCalled();
    });

    test('A6: renders without error when onEscapeCopyMade is omitted and backupCounter increments', () => {
      mockCloudBackupState.backupCounter = 0;

      const { rerender } = render(
        <CloudBackupLiveCard
          provider={{ connect: jest.fn() } as any}
          handle={{ loadVault: jest.fn() } as any}
        />,
      );

      expect(() => {
        mockCloudBackupState.backupCounter = 1;
        rerender(
          <CloudBackupLiveCard
            provider={{ connect: jest.fn() } as any}
            handle={{ loadVault: jest.fn() } as any}
          />,
        );
      }).not.toThrow();
    });
  });

  describe('component rendering', () => {
    test('B1: renders CloudBackupCard component', () => {
      render(
        <CloudBackupLiveCard
          provider={{ connect: jest.fn() } as any}
          handle={{ loadVault: jest.fn() } as any}
        />,
      );

      expect(screen.getByTestId('cloud-backup-card')).toBeInTheDocument();
    });

    test('B2: renders ImportVaultReplaceDialog component', () => {
      render(
        <CloudBackupLiveCard
          provider={{ connect: jest.fn() } as any}
          handle={{ loadVault: jest.fn() } as any}
        />,
      );

      expect(screen.getByTestId('import-dialog')).toBeInTheDocument();
    });
  });
});
