import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { VaultPageClient } from './VaultPageClient';

jest.mock('../hooks', () => ({
  useGoogleIdentityScript: () => 'loading',
}));

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

  test('renders cloud backup unavailable, export, and import cards when no client ID is configured', () => {
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

    // Import vault card
    expect(screen.getByText('Import encrypted vault')).toBeInTheDocument();

    // Verify cross-source last-backup summary card is NOT rendered
    // (it belongs on the account page, not the vault page)
    expect(screen.queryByTestId('last-backup-card')).not.toBeInTheDocument();
  });
});
