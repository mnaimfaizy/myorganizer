/* eslint-disable import/first -- jest.mock must precede application imports */

import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

jest.mock('@myorganizer/web-vault-ui', () => ({
  ...jest.requireActual('@myorganizer/web-vault-ui'),
  useOptionalVaultSession: jest.fn(),
}));

import { VaultSecretMismatchError } from '@myorganizer/web-vault';
import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';
import { ClaimLocalVaultCard } from './ClaimLocalVaultCard';

describe('ClaimLocalVaultCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Rendering when unclaimed vault present
  test('renders VaultClaimOffer when session has handle with unclaimed vault', () => {
    const mockHandle = {
      owner: 'user-a',
      isUnlocked: false,
      hasUnclaimedLocalVault: jest.fn(() => true),
      claimUnclaimedLocalVault: jest.fn(),
      vaultStatus: jest.fn(() => 'unclaimed'),
    };

    const mockSetMasterKeyBytes = jest.fn();
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      setMasterKeyBytes: mockSetMasterKeyBytes,
    });

    const { container } = render(<ClaimLocalVaultCard />);

    // Component should not return null; should render something
    expect(container.firstChild).not.toBeNull();

    // The rendered content should include the Card from VaultClaimOffer
    expect(
      screen.getByText('A vault is already on this device'),
    ).toBeInTheDocument();
  });

  // Test 2: No render when unclaimed vault not present
  test('renders nothing when hasUnclaimedLocalVault() returns false', () => {
    const mockHandle = {
      owner: 'user-a',
      isUnlocked: false,
      hasUnclaimedLocalVault: jest.fn(() => false),
    };

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    const { container } = render(<ClaimLocalVaultCard />);

    // Component should render nothing (empty)
    expect(container.firstChild).toBeNull();
  });

  // Test 3: No render when no session
  test('renders nothing when session is null', () => {
    (useOptionalVaultSession as jest.Mock).mockReturnValue(null);

    const { container } = render(<ClaimLocalVaultCard />);

    // Component should render nothing (empty)
    expect(container.firstChild).toBeNull();
  });

  // Test 4: No render when handle is null
  test('renders nothing when vaultSession does not have a handle', () => {
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      setMasterKeyBytes: jest.fn(),
      handle: null,
    });

    const { container } = render(<ClaimLocalVaultCard />);

    expect(container.firstChild).toBeNull();
  });

  // Test 5: Successful claim calls setMasterKeyBytes
  test('calls setMasterKeyBytes on successful claim', async () => {
    const masterKeyBytes = new Uint8Array([1, 2, 3, 4]);
    const mockClaimUnclaimedLocalVault = jest.fn().mockResolvedValue({
      masterKeyBytes,
    });

    const mockHandle = {
      owner: 'user-a',
      isUnlocked: false,
      hasUnclaimedLocalVault: jest.fn(() => true),
      claimUnclaimedLocalVault: mockClaimUnclaimedLocalVault,
      vaultStatus: jest.fn(() => 'unclaimed'),
    };

    const mockSetMasterKeyBytes = jest.fn();
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      setMasterKeyBytes: mockSetMasterKeyBytes,
    });

    render(<ClaimLocalVaultCard />);

    // Find and fill the passphrase input
    const passphraseInput = screen.getByLabelText(
      'Encryption passphrase',
    ) as HTMLInputElement;
    fireEvent.change(passphraseInput, { target: { value: 'test-pass' } });

    // Click claim button
    const claimButton = screen.getByRole('button', {
      name: 'Unlock this vault',
    });
    fireEvent.click(claimButton);

    // Wait for async claim to complete
    await waitFor(() => {
      expect(mockSetMasterKeyBytes).toHaveBeenCalledWith(masterKeyBytes);
    });
  });

  // Test 6: No decline button rendered (unlike vault gate)
  test('does not render decline button', () => {
    const mockHandle = {
      owner: 'user-a',
      isUnlocked: false,
      hasUnclaimedLocalVault: jest.fn(() => true),
      claimUnclaimedLocalVault: jest.fn(),
      vaultStatus: jest.fn(() => 'unclaimed'),
    };

    const mockSetMasterKeyBytes = jest.fn();
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      setMasterKeyBytes: mockSetMasterKeyBytes,
    });

    render(<ClaimLocalVaultCard />);

    // The component does not pass onDecline to VaultClaimOffer,
    // so the decline button should not be present
    expect(screen.queryByText("This isn't my vault")).not.toBeInTheDocument();
  });

  // Test 7: Claim failure shows error but does not call setMasterKeyBytes
  test('does not call setMasterKeyBytes when claim fails with wrong passphrase', async () => {
    const mockClaimUnclaimedLocalVault = jest
      .fn()
      .mockRejectedValue(new VaultSecretMismatchError('passphrase'));

    const mockHandle = {
      owner: 'user-a',
      isUnlocked: false,
      hasUnclaimedLocalVault: jest.fn(() => true),
      claimUnclaimedLocalVault: mockClaimUnclaimedLocalVault,
      vaultStatus: jest.fn(() => 'unclaimed'),
    };

    const mockSetMasterKeyBytes = jest.fn();
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      setMasterKeyBytes: mockSetMasterKeyBytes,
    });

    render(<ClaimLocalVaultCard />);

    // Find and fill the passphrase input
    const passphraseInput = screen.getByLabelText(
      'Encryption passphrase',
    ) as HTMLInputElement;
    fireEvent.change(passphraseInput, { target: { value: 'wrong-pass' } });

    // Click claim button
    const claimButton = screen.getByRole('button', {
      name: 'Unlock this vault',
    });
    fireEvent.click(claimButton);

    // Wait a bit for async to complete
    await waitFor(() => {
      expect(mockClaimUnclaimedLocalVault).toHaveBeenCalled();
    });

    // setMasterKeyBytes should not be called
    expect(mockSetMasterKeyBytes).not.toHaveBeenCalled();
  });

  // Test 8: Claim button disabled when no passphrase entered
  test('disables claim button when passphrase is empty', () => {
    const mockHandle = {
      owner: 'user-a',
      isUnlocked: false,
      hasUnclaimedLocalVault: jest.fn(() => true),
      vaultStatus: jest.fn(() => 'unclaimed'),
    };

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      setMasterKeyBytes: jest.fn(),
    });

    render(<ClaimLocalVaultCard />);

    const claimButton = screen.getByRole('button', {
      name: 'Unlock this vault',
    });

    expect(claimButton).toBeDisabled();
  });

  // Test 9: Claim button enabled when passphrase entered
  test('enables claim button when passphrase is entered', () => {
    const mockHandle = {
      owner: 'user-a',
      isUnlocked: false,
      hasUnclaimedLocalVault: jest.fn(() => true),
      vaultStatus: jest.fn(() => 'unclaimed'),
    };

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      setMasterKeyBytes: jest.fn(),
    });

    render(<ClaimLocalVaultCard />);

    const passphraseInput = screen.getByLabelText(
      'Encryption passphrase',
    ) as HTMLInputElement;
    fireEvent.change(passphraseInput, { target: { value: 'test-pass' } });

    const claimButton = screen.getByRole('button', {
      name: 'Unlock this vault',
    });

    expect(claimButton).not.toBeDisabled();
  });

  // Test 10: After successful claim, confirmation card is shown instead of offer
  test('renders confirmation card after successful claim', async () => {
    const masterKeyBytes = new Uint8Array([1, 2, 3, 4]);
    const mockClaimUnclaimedLocalVault = jest.fn().mockResolvedValue({
      masterKeyBytes,
    });

    const mockHandle = {
      owner: 'user-a',
      isUnlocked: false,
      hasUnclaimedLocalVault: jest.fn(() => true),
      claimUnclaimedLocalVault: mockClaimUnclaimedLocalVault,
      vaultStatus: jest.fn(() => 'unclaimed'),
    };

    const mockSetMasterKeyBytes = jest.fn();
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      setMasterKeyBytes: mockSetMasterKeyBytes,
    });

    render(<ClaimLocalVaultCard />);

    // Initially shows the claim offer
    expect(
      screen.getByText('A vault is already on this device'),
    ).toBeInTheDocument();

    // Fill passphrase and claim
    const passphraseInput = screen.getByLabelText(
      'Encryption passphrase',
    ) as HTMLInputElement;
    fireEvent.change(passphraseInput, { target: { value: 'gate-pass-1' } });

    const claimButton = screen.getByRole('button', {
      name: 'Unlock this vault',
    });
    fireEvent.click(claimButton);

    // Wait for the claim to complete
    await waitFor(() => {
      expect(mockSetMasterKeyBytes).toHaveBeenCalledWith(masterKeyBytes);
    });

    // After claim, the confirmation card should be rendered
    await waitFor(() => {
      expect(
        screen.getByText(
          'The vault on this device is now yours and unlocked for this session.',
        ),
      ).toBeInTheDocument();
    });

    // The claim offer should no longer be rendered
    expect(
      screen.queryByText('A vault is already on this device'),
    ).not.toBeInTheDocument();
  });

  // Test 11: Presence condition is still driven by hasUnclaimedLocalVault(), confirmation card still renders
  test('presence condition is driven by hasUnclaimedLocalVault(), confirmation card still renders', async () => {
    const masterKeyBytes = new Uint8Array([1, 2, 3, 4]);
    const mockClaimUnclaimedLocalVault = jest.fn().mockResolvedValue({
      masterKeyBytes,
    });

    const mockHandle = {
      owner: 'user-a',
      isUnlocked: false,
      hasUnclaimedLocalVault: jest.fn(() => true),
      claimUnclaimedLocalVault: mockClaimUnclaimedLocalVault,
      vaultStatus: jest.fn(() => 'unclaimed'),
    };

    const mockSetMasterKeyBytes = jest.fn();
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      setMasterKeyBytes: mockSetMasterKeyBytes,
    });

    render(<ClaimLocalVaultCard />);

    // Fill passphrase and claim
    const passphraseInput = screen.getByLabelText(
      'Encryption passphrase',
    ) as HTMLInputElement;
    fireEvent.change(passphraseInput, { target: { value: 'gate-pass-1' } });

    const claimButton = screen.getByRole('button', {
      name: 'Unlock this vault',
    });
    fireEvent.click(claimButton);

    // Wait for the claim to complete
    await waitFor(() => {
      expect(mockSetMasterKeyBytes).toHaveBeenCalledWith(masterKeyBytes);
    });

    // After claim, confirmation card should still be rendered (not disappeared)
    // because hasUnclaimedLocalVault() still returns true
    await waitFor(() => {
      expect(
        screen.getByText(
          'The vault on this device is now yours and unlocked for this session.',
        ),
      ).toBeInTheDocument();
    });
  });
});
