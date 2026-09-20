/* eslint-disable import/first -- jest.mock must precede application imports */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * The export the page drives. Declared here rather than inside the factory so
 * a test can decide, per case, whether the export succeeded — which is the
 * whole question the co-locate prompt turns on. The `mock` prefix is what lets
 * `jest.mock`'s hoisting reach it.
 */
const mockExportVaultNow = jest.fn<Promise<boolean>, []>();

// Mock useVaultDisabledState at its module path so the real useVaultOperationAvailability
// (which imports it from the same file) will use the mock when it calls useVaultDisabledState().
jest.mock('../hooks/useVaultDisabledState.ts', () => ({
  useVaultDisabledState: jest.fn(),
}));

jest.mock('../hooks', () => {
  const actual = jest.requireActual('../hooks');
  return {
    ...actual,
    useGoogleIdentityScript: jest.fn(() => 'loading'),
    useLatestCloudBackup: () => ({ status: 'empty', record: null }),
    useExportVault: () => ({
      exporting: false,
      exportVaultNow: mockExportVaultNow,
    }),
    useChangePassphrase: () => ({
      changing: false,
      changePassphrase: jest.fn(),
    }),
    useRecoveryKeyRotation: () => ({
      rotating: false,
      rotateRecoveryKey: jest.fn(),
    }),
    useVaultUnlock: () => ({ unlocking: false, unlock: jest.fn() }),
    useCloudBackup: () => ({
      status: 'idle',
      backup: jest.fn(),
      clear: jest.fn(),
    }),
  };
});

jest.mock('@myorganizer/web-vault-ui', () => {
  const actual = jest.requireActual('@myorganizer/web-vault-ui');
  return {
    ...actual,
    useOptionalVaultSession: () => ({
      masterKeyBytes: null,
      setMasterKeyBytes: jest.fn(),
      lock: jest.fn(),
      handle: {
        owner: 'test-owner',
        hasOwnedVault: () => true,
        hasVault: () => true,
        hasUnclaimedLocalVault: () => false,
        loadVault: () => null,
        removeVault: jest.fn(),
      },
    }),
    // Stub useServerReachability to avoid real network probes. Even though
    // no current test mounts RecoveryKeyMintedSection (which uses it), the stub
    // prevents a future author from accidentally triggering real jsdom probes
    // when they add a test that drives a successful key rotation.
    useServerReachability: () => ({
      reachability: 'reachable',
      recheck: jest.fn(),
    }),
  };
});

jest.mock('./CloudBackupLiveCard', () => ({
  // Carries the callback through so the Drive path can be driven from a test.
  // The real card fires it on a `backupCounter` increment; what this page owes
  // is to raise the prompt when it does, and that is what this stands in for.
  CloudBackupLiveCard: ({
    onEscapeCopyMade,
  }: {
    onEscapeCopyMade?: () => void;
  }) => (
    <div data-testid="cloud-backup-live-card">
      Encrypted cloud backup
      <button
        type="button"
        data-testid="stub-drive-backup-succeeded"
        onClick={() => onEscapeCopyMade?.()}
      >
        backup succeeded
      </button>
    </div>
  ),
}));

import { VaultPageClient } from './VaultPageClient';
import { useGoogleIdentityScript } from '../hooks';
import { useVaultDisabledState } from '../hooks/useVaultDisabledState';

describe('VaultPageClient', () => {
  const ORIGINAL_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    (useGoogleIdentityScript as jest.Mock).mockReturnValue('loading');
    (useVaultDisabledState as jest.Mock).mockReturnValue('locked');
    mockExportVaultNow.mockResolvedValue(true);
  });

  afterEach(() => {
    if (ORIGINAL_CLIENT_ID === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = ORIGINAL_CLIENT_ID;
    }
  });

  test('renders cloud backup unavailable, removal, export, and import cards when no client ID is configured', () => {
    render(<VaultPageClient />);

    // Recovery key rotation card
    expect(screen.getByText('Rotate recovery key')).toBeInTheDocument();

    // Cloud backup card (unavailable because clientId is empty)
    expect(screen.getByText('Encrypted cloud backup')).toBeInTheDocument();

    // Verify the specific reason text for missing clientId
    expect(
      screen.getByText(
        'Cloud backup is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google Drive backup.',
      ),
    ).toBeInTheDocument();

    // Export vault card
    expect(screen.getByText('Export encrypted vault')).toBeInTheDocument();

    // Removal vault card
    expect(screen.getByTestId('remove-vault-button')).toBeInTheDocument();

    // Import vault card
    expect(screen.getByText('Import encrypted vault')).toBeInTheDocument();

    // Verify cross-source last-backup summary card is NOT rendered
    // (it belongs on the account page, not the vault page)
    expect(screen.queryByTestId('last-backup-card')).not.toBeInTheDocument();
  });

  test('positions the escape copy reader card and removal card in the correct order below export', () => {
    render(<VaultPageClient />);

    const exportHeading = screen.getByText('Export encrypted vault');
    const escapeCopyHeading = screen.getByText(
      'Open your Escape Copy without us',
    );
    const removeButton = screen.getByTestId('remove-vault-button');
    const importHeading = screen.getByText('Import encrypted vault');

    // Assert the order: Export → EscapeCopyReaderCard → RemoveVaultCard → ImportVaultCard
    expect(
      exportHeading.compareDocumentPosition(escapeCopyHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      escapeCopyHeading.compareDocumentPosition(removeButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      removeButton.compareDocumentPosition(importHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test('renders VaultUnlockCard when vault is locked', () => {
    render(<VaultPageClient />);

    // Assert unlock card is present when vault is in locked state
    expect(screen.getByText('Unlock your vault')).toBeInTheDocument();
    expect(screen.getByTestId('vault-unlock-submit')).toBeInTheDocument();
  });

  test('hides VaultUnlockCard when vault is unlocked', () => {
    // Override the default mock for this test to return 'enabled'
    const mockUseVaultDisabledState = require('../hooks')
      .useVaultDisabledState as jest.Mock;
    mockUseVaultDisabledState.mockReturnValue('enabled');

    render(<VaultPageClient />);

    // Assert unlock card is not present when vault is enabled
    expect(screen.queryByText('Unlock your vault')).not.toBeInTheDocument();
    expect(screen.queryByTestId('vault-unlock-submit')).not.toBeInTheDocument();

    // Reset the mock for other tests
    mockUseVaultDisabledState.mockReturnValue('locked');
  });

  test('positions VaultUnlockCard before ChangePassphraseCard', () => {
    render(<VaultPageClient />);

    const unlockTitle = screen.getByText('Unlock your vault');
    // "Change passphrase" appears twice (heading and button), so get the first one
    const changePassphraseTitles = screen.getAllByText('Change passphrase');
    const changePassphraseTitle = changePassphraseTitles[0];

    // Assert VaultUnlockCard comes before ChangePassphraseCard in the DOM
    expect(
      unlockTitle.compareDocumentPosition(changePassphraseTitle) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  describe('Cloud backup unavailability policy (ADR 0068)', () => {
    test('E1: no-local-vault state shows vault policy reason, not config reason', () => {
      // Policy takes precedence: with no Local Vault, how Google Drive is configured
      // is not the reason the card is unavailable.
      (useVaultDisabledState as jest.Mock).mockReturnValue('no-local-vault');

      render(<VaultPageClient />);

      // Should show the policy reason from vaultOperationAvailability
      expect(
        screen.getByText('There is no vault on this device to back up.'),
      ).toBeInTheDocument();

      // Should NOT show the config reason
      expect(
        screen.queryByText(
          /Cloud backup is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID/,
        ),
      ).not.toBeInTheDocument();
    });

    test('E2: signed-out state shows vault policy reason, not config reason', () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('signed-out');

      render(<VaultPageClient />);

      // Should show the policy reason (signed-out copy) in multiple cards that show
      // VaultUnavailableNotice: RemoveVaultCard, ExportVaultCard, ChangePassphraseCard,
      // RecoveryKeyRotationCard, ImportVaultCard, and CloudBackupUnavailableCard.
      // Exact count ensures that if a new card were added without proper integration
      // or if an existing card stopped showing the notice, the test catches it.
      const signedOutMessages = screen.getAllByText(
        'Your vault is not available on this device right now.',
      );
      expect(signedOutMessages.length).toBe(6);

      // Should NOT show the old "Sign in to enable cloud backup" string
      expect(
        screen.queryByText(/Sign in to enable cloud backup/),
      ).not.toBeInTheDocument();

      // Should NOT show the config reason
      expect(
        screen.queryByText(
          /Cloud backup is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID/,
        ),
      ).not.toBeInTheDocument();
    });

    test('E3: locked state allows cloud backup (does not need Master Key per ADR 0068), renders live card when clientId is set', () => {
      // A locked Vault does not block cloud backup: it touches Ciphertext only,
      // not plaintext, so unlock is not a plaintext-access boundary for it.
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client-id';
      (useVaultDisabledState as jest.Mock).mockReturnValue('locked');
      mockExportVaultNow.mockResolvedValue(true);
      (useGoogleIdentityScript as jest.Mock).mockReturnValue('ready');

      render(<VaultPageClient />);

      // Should NOT show a policy reason (locked state does not block backup)
      expect(
        screen.queryByText(
          /There is no vault on this device to back up|Your vault is not available/,
        ),
      ).not.toBeInTheDocument();

      // Should NOT show the "Cloud backup is not configured" reason
      expect(
        screen.queryByText(
          /Cloud backup is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID/,
        ),
      ).not.toBeInTheDocument();

      // Should render the live cloud backup card (CloudBackupLiveCard renders a heading
      // "Encrypted cloud backup" and the provider/handle are present)
      expect(screen.getByText('Encrypted cloud backup')).toBeInTheDocument();
    });

    test('E4: enabled state allows cloud backup, renders live card when clientId is set', () => {
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client-id';
      (useVaultDisabledState as jest.Mock).mockReturnValue('enabled');
      (useGoogleIdentityScript as jest.Mock).mockReturnValue('ready');

      render(<VaultPageClient />);

      // Should NOT show any policy reason (enabled state allows everything)
      expect(
        screen.queryByText(
          /There is no vault on this device to back up|Your vault is not available/,
        ),
      ).not.toBeInTheDocument();

      // Should NOT show the config reason
      expect(
        screen.queryByText(
          /Cloud backup is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID/,
        ),
      ).not.toBeInTheDocument();

      // Should render the live cloud backup card
      expect(screen.getByText('Encrypted cloud backup')).toBeInTheDocument();
    });
  });

  describe('Escape Copy reader card', () => {
    test('renders the escape copy reader card', () => {
      render(<VaultPageClient />);

      expect(
        screen.getByText('Open your Escape Copy without us'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('escape-copy-reader-download-link'),
      ).toBeInTheDocument();
    });

    test('does not show the "just made" callout on initial render', () => {
      render(<VaultPageClient />);

      expect(
        screen.queryByTestId('escape-copy-reader-just-made'),
      ).not.toBeInTheDocument();
    });

    test('raises the callout once a local export has actually succeeded', async () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('enabled');
      mockExportVaultNow.mockResolvedValue(true);
      render(<VaultPageClient />);

      fireEvent.click(screen.getByTestId('export-vault-button'));

      await waitFor(() =>
        expect(
          screen.getByTestId('escape-copy-reader-just-made'),
        ).toBeInTheDocument(),
      );
    });

    test('leaves the callout down when the export failed', async () => {
      // The prompt says "you just made an Escape Copy". Raising it when no
      // copy was made tells the User a file exists that does not.
      (useVaultDisabledState as jest.Mock).mockReturnValue('enabled');
      mockExportVaultNow.mockResolvedValue(false);
      render(<VaultPageClient />);

      fireEvent.click(screen.getByTestId('export-vault-button'));

      await waitFor(() => expect(mockExportVaultNow).toHaveBeenCalled());
      expect(
        screen.queryByTestId('escape-copy-reader-just-made'),
      ).not.toBeInTheDocument();
    });

    test('raises the callout when a Drive Escape Copy succeeds', async () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('enabled');
      (useGoogleIdentityScript as jest.Mock).mockReturnValue('ready');
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client-id';
      render(<VaultPageClient />);

      fireEvent.click(screen.getByTestId('stub-drive-backup-succeeded'));

      await waitFor(() =>
        expect(
          screen.getByTestId('escape-copy-reader-just-made'),
        ).toBeInTheDocument(),
      );
    });

    test('keeps the callout up afterwards, because the reminder outlives the moment', async () => {
      // Sticky on purpose: a User who leaves to go find the downloaded file
      // and comes back is exactly the User the reminder is for.
      (useVaultDisabledState as jest.Mock).mockReturnValue('enabled');
      mockExportVaultNow.mockResolvedValue(true);
      render(<VaultPageClient />);

      fireEvent.click(screen.getByTestId('export-vault-button'));
      await waitFor(() =>
        expect(
          screen.getByTestId('escape-copy-reader-just-made'),
        ).toBeInTheDocument(),
      );

      mockExportVaultNow.mockResolvedValue(false);
      fireEvent.click(screen.getByTestId('export-vault-button'));

      await waitFor(() => expect(mockExportVaultNow).toHaveBeenCalledTimes(2));
      expect(
        screen.getByTestId('escape-copy-reader-just-made'),
      ).toBeInTheDocument();
    });
  });
});
