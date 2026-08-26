/* eslint-disable import/first -- jest.mock must precede application imports */
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

const mockUseToast = jest.fn();
jest.mock('@myorganizer/web-ui', () => ({
  ...jest.requireActual('@myorganizer/web-ui'),
  useToast: () => mockUseToast(),
}));

// Import real VaultSecretMismatchError so instanceof checks work
import { VaultSecretMismatchError } from '@myorganizer/web-vault';
import type { VaultHandle } from '@myorganizer/web-vault';

import { VaultClaimOffer } from './vaultClaimOffer';

describe('VaultClaimOffer', () => {
  let toastFn: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    toastFn = jest.fn();
    mockUseToast.mockReturnValue({ toast: toastFn });
  });

  function createStubHandle(overrides?: Partial<VaultHandle>): VaultHandle {
    return {
      owner: 'user-1',
      isUnlocked: false,
      hasVault: jest.fn(() => true),
      vaultStatus: jest.fn(() => 'unclaimed'),
      hasUnclaimedLocalVault: jest.fn(() => true),
      loadVault: jest.fn(() => null),
      saveVault: jest.fn(),
      initialize: jest.fn(),
      claimUnclaimedLocalVault: jest.fn(),
      unlockWithPassphrase: jest.fn(),
      unlockWithRecoveryKey: jest.fn(),
      changePassphrase: jest.fn(),
      loadDecryptedData: jest.fn(),
      saveEncryptedData: jest.fn(),
      ...overrides,
    } as unknown as VaultHandle;
  }

  test('renders passphrase field and unlock button', () => {
    const handle = createStubHandle();
    const onClaimed = jest.fn();

    render(
      <VaultClaimOffer
        handle={handle}
        onClaimed={onClaimed}
        onDecline={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Encryption passphrase')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Unlock this vault/i }),
    ).toBeInTheDocument();
  });

  test('unlock button is disabled when passphrase is empty', () => {
    const handle = createStubHandle();
    const onClaimed = jest.fn();

    render(
      <VaultClaimOffer
        handle={handle}
        onClaimed={onClaimed}
        onDecline={jest.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: /Unlock this vault/i });
    expect(button).toBeDisabled();
  });

  test('unlock button is enabled when passphrase is filled', () => {
    const handle = createStubHandle();
    const onClaimed = jest.fn();

    render(
      <VaultClaimOffer
        handle={handle}
        onClaimed={onClaimed}
        onDecline={jest.fn()}
      />,
    );

    const input = screen.getByLabelText(
      'Encryption passphrase',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'mypassphrase' } });

    const button = screen.getByRole('button', { name: /Unlock this vault/i });
    expect(button).toBeEnabled();
  });

  test('successful claim calls handle.claimUnclaimedLocalVault and onClaimed', async () => {
    const masterKeyBytes = new Uint8Array([1, 2, 3, 4]);
    const handle = createStubHandle({
      claimUnclaimedLocalVault: jest.fn().mockResolvedValue({ masterKeyBytes }),
    });
    const onClaimed = jest.fn();

    render(
      <VaultClaimOffer
        handle={handle}
        onClaimed={onClaimed}
        onDecline={jest.fn()}
      />,
    );

    const input = screen.getByLabelText(
      'Encryption passphrase',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'mypassphrase' } });

    const button = screen.getByRole('button', { name: /Unlock this vault/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(handle.claimUnclaimedLocalVault).toHaveBeenCalledWith({
        passphrase: 'mypassphrase',
      });
      expect(onClaimed).toHaveBeenCalledWith({ masterKeyBytes });
    });

    expect(toastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Vault claimed',
        description: expect.stringContaining('unlocked for this session'),
      }),
    );
  });

  test('failed claim with secret mismatch does not call onClaimed and shows mismatch toast', async () => {
    const handle = createStubHandle({
      claimUnclaimedLocalVault: jest
        .fn()
        .mockRejectedValue(new VaultSecretMismatchError('passphrase')),
    });
    const onClaimed = jest.fn();

    render(
      <VaultClaimOffer
        handle={handle}
        onClaimed={onClaimed}
        onDecline={jest.fn()}
      />,
    );

    const input = screen.getByLabelText(
      'Encryption passphrase',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'wrongpassphrase' } });

    const button = screen.getByRole('button', { name: /Unlock this vault/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(onClaimed).not.toHaveBeenCalled();
    });

    expect(toastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "That passphrase didn't unlock this vault",
        description: expect.stringContaining('does not match this vault'),
      }),
    );

    // Assert no corruption/reset words in the toast message
    const toastCall = toastFn.mock.calls[0]?.[0];
    if (toastCall) {
      const toastText =
        `${toastCall.title} ${toastCall.description}`.toLowerCase();
      expect(toastText).not.toMatch(
        /corrupt|damaged|reset|wipe|delete|start over/i,
      );
    }
  });

  test('decline button is rendered when onDecline is provided', () => {
    const handle = createStubHandle();
    const onDecline = jest.fn();

    render(
      <VaultClaimOffer
        handle={handle}
        onClaimed={jest.fn()}
        onDecline={onDecline}
      />,
    );

    expect(
      screen.getByRole('button', { name: /This isn't my vault/i }),
    ).toBeInTheDocument();
  });

  test('decline button calls onDecline when clicked', () => {
    const handle = createStubHandle();
    const onDecline = jest.fn();

    render(
      <VaultClaimOffer
        handle={handle}
        onClaimed={jest.fn()}
        onDecline={onDecline}
      />,
    );

    const declineButton = screen.getByRole('button', {
      name: /This isn't my vault/i,
    });
    fireEvent.click(declineButton);

    expect(onDecline).toHaveBeenCalled();
  });

  test('decline button is not rendered when onDecline is not provided', () => {
    const handle = createStubHandle();

    render(<VaultClaimOffer handle={handle} onClaimed={jest.fn()} />);

    expect(
      screen.queryByRole('button', { name: /This isn't my vault/i }),
    ).not.toBeInTheDocument();
  });

  test('replacement warning is shown when vault is already owned', () => {
    const handle = createStubHandle({
      vaultStatus: jest.fn(() => 'owned'),
    });

    render(
      <VaultClaimOffer
        handle={handle}
        onClaimed={jest.fn()}
        onDecline={jest.fn()}
      />,
    );

    const warning = screen.getByText(/You already have a vault on this device/);
    expect(warning).toBeInTheDocument();
  });

  test('replacement warning is not shown when vault is unclaimed', () => {
    const handle = createStubHandle({
      vaultStatus: jest.fn(() => 'unclaimed'),
    });

    render(
      <VaultClaimOffer
        handle={handle}
        onClaimed={jest.fn()}
        onDecline={jest.fn()}
      />,
    );

    const warning = screen.queryByText(
      /You already have a vault on this device/,
    );
    expect(warning).not.toBeInTheDocument();
  });

  test('clicking unlock when handle is null shows sign-in toast', async () => {
    const onClaimed = jest.fn();

    render(
      <VaultClaimOffer
        handle={null}
        onClaimed={onClaimed}
        onDecline={jest.fn()}
      />,
    );

    const input = screen.getByLabelText(
      'Encryption passphrase',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'somepassphrase' } });

    const button = screen.getByRole('button', { name: /Unlock this vault/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(toastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Can't claim this vault",
          description: expect.stringContaining('Sign in'),
        }),
      );
    });

    expect(onClaimed).not.toHaveBeenCalled();
  });

  test('button disabled state is set while claim is submitting', async () => {
    let resolveClaimPromise:
      | ((value: { masterKeyBytes: Uint8Array }) => void)
      | undefined;
    const claimPromise = new Promise(
      (resolve: (value: { masterKeyBytes: Uint8Array }) => void) => {
        resolveClaimPromise = resolve;
      },
    );

    const handle = createStubHandle({
      claimUnclaimedLocalVault: jest.fn().mockReturnValue(claimPromise),
    });
    const onClaimed = jest.fn();

    render(
      <VaultClaimOffer
        handle={handle}
        onClaimed={onClaimed}
        onDecline={jest.fn()}
      />,
    );

    const input = screen.getByLabelText(
      'Encryption passphrase',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'passphrase' } });

    const button = screen.getByRole('button', { name: /Unlock this vault/i });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    // Button should be disabled while submitting
    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    // Resolve the promise
    act(() => {
      resolveClaimPromise?.({ masterKeyBytes: new Uint8Array([1, 2, 3]) });
    });

    // Button should be enabled again after completion
    await waitFor(() => {
      expect(button).toBeEnabled();
    });
  });

  describe('owned vault replacement flow', () => {
    test('checkbox is rendered when vault is already owned', () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'owned'),
      });

      render(
        <VaultClaimOffer
          handle={handle}
          onClaimed={jest.fn()}
          onDecline={jest.fn()}
        />,
      );

      expect(
        screen.getByRole('checkbox', {
          name: /Replace the vault currently saved for my account/i,
        }),
      ).toBeInTheDocument();
    });

    test('checkbox is not rendered when vault is unclaimed', () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'unclaimed'),
      });

      render(
        <VaultClaimOffer
          handle={handle}
          onClaimed={jest.fn()}
          onDecline={jest.fn()}
        />,
      );

      expect(
        screen.queryByRole('checkbox', {
          name: /Replace the vault currently saved for my account/i,
        }),
      ).not.toBeInTheDocument();
    });

    test('button is disabled when vault is owned and checkbox is unchecked, even with passphrase', () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'owned'),
      });

      render(
        <VaultClaimOffer
          handle={handle}
          onClaimed={jest.fn()}
          onDecline={jest.fn()}
        />,
      );

      const input = screen.getByLabelText(
        'Encryption passphrase',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'gate-pass-1' } });

      const button = screen.getByRole('button', {
        name: /Unlock and replace my vault/i,
      });
      expect(button).toBeDisabled();
    });

    test('button is enabled when vault is owned and checkbox is checked with passphrase', () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'owned'),
      });

      render(
        <VaultClaimOffer
          handle={handle}
          onClaimed={jest.fn()}
          onDecline={jest.fn()}
        />,
      );

      const input = screen.getByLabelText(
        'Encryption passphrase',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'gate-pass-1' } });

      const checkbox = screen.getByRole('checkbox', {
        name: /Replace the vault currently saved for my account/i,
      });
      fireEvent.click(checkbox);

      const button = screen.getByRole('button', {
        name: /Unlock and replace my vault/i,
      });
      expect(button).toBeEnabled();
    });

    test('button text is "Unlock and replace my vault" when vault is owned', () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'owned'),
      });

      render(
        <VaultClaimOffer
          handle={handle}
          onClaimed={jest.fn()}
          onDecline={jest.fn()}
        />,
      );

      expect(
        screen.getByRole('button', {
          name: /Unlock and replace my vault/i,
        }),
      ).toBeInTheDocument();
    });

    test('button text is "Unlock this vault" when vault is unclaimed', () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'unclaimed'),
      });

      render(
        <VaultClaimOffer
          handle={handle}
          onClaimed={jest.fn()}
          onDecline={jest.fn()}
        />,
      );

      expect(
        screen.getByRole('button', {
          name: /Unlock this vault/i,
        }),
      ).toBeInTheDocument();
    });
  });

  describe('error handling with fixed copy', () => {
    test('non-mismatch claim error shows fixed toast without error message', async () => {
      const handle = createStubHandle({
        claimUnclaimedLocalVault: jest
          .fn()
          .mockRejectedValue(new Error('boom')),
      });
      const onClaimed = jest.fn();

      render(
        <VaultClaimOffer
          handle={handle}
          onClaimed={onClaimed}
          onDecline={jest.fn()}
        />,
      );

      const input = screen.getByLabelText(
        'Encryption passphrase',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'gate-pass-1' } });

      const button = screen.getByRole('button', { name: /Unlock this vault/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(toastFn).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Can't claim this vault",
            description:
              'Something went wrong. Nothing on this device was changed.',
            variant: 'destructive',
          }),
        );
      });

      expect(onClaimed).not.toHaveBeenCalled();

      // Ensure the error message does not leak into the toast
      const toastCall = toastFn.mock.calls[0]?.[0];
      if (toastCall) {
        expect(toastCall.description).not.toContain('boom');
      }
    });
  });
});
