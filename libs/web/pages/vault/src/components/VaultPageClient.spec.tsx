/* eslint-disable import/first -- jest.mock must precede application imports */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

jest.mock('../hooks', () => ({
  useGoogleIdentityScript: () => 'loading',
  useLatestCloudBackup: () => ({ status: 'empty', record: null }),
  useExportVault: () => ({ exporting: false, exportVaultNow: jest.fn() }),
  useChangePassphrase: () => ({ changing: false, changePassphrase: jest.fn() }),
  useRecoveryKeyRotation: () => ({
    rotating: false,
    rotateRecoveryKey: jest.fn(),
  }),
}));

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
  };
});

import { VaultPageClient } from './VaultPageClient';

describe('VaultPageClient', () => {
  const ORIGINAL_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
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

  test('positions the removal card directly below export, per the removal-control spec', () => {
    render(<VaultPageClient />);

    const exportHeading = screen.getByText('Export encrypted vault');
    const removeButton = screen.getByTestId('remove-vault-button');
    const importHeading = screen.getByText('Import encrypted vault');

    expect(
      exportHeading.compareDocumentPosition(removeButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      removeButton.compareDocumentPosition(importHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
