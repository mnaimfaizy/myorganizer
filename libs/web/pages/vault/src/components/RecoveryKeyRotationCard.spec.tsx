/* eslint-disable import/first -- jest.mock must precede application imports */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Mock the hooks from ../hooks before importing RecoveryKeyRotationCard.
 */
jest.mock('../hooks', () => ({
  useRecoveryKeyRotation: jest.fn(),
}));

/**
 * Mock web-vault-ui hooks.
 */
jest.mock('@myorganizer/web-vault-ui', () => ({
  useOptionalVaultSession: jest.fn(),
}));

/**
 * Mock web-vault functions.
 */
jest.mock('@myorganizer/web-vault', () => ({
  ...jest.requireActual('@myorganizer/web-vault'),
  mintRecoveryKey: jest.fn(),
}));

/**
 * Mock web-ui components and useToast.
 */
jest.mock('@myorganizer/web-ui', () => {
  const React = require('react') as typeof import('react');
  const {
    Controller,
    FormProvider,
    useFormContext,
  } = require('react-hook-form');

  function Button({
    children,
    onClick,
    disabled,
    'data-testid': testId,
    ...props
  }: any) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        data-testid={testId}
        {...props}
      >
        {children}
      </button>
    );
  }

  function Card({ children }: any) {
    return <div data-testid="card">{children}</div>;
  }

  function CardHeader({ children }: any) {
    return <div>{children}</div>;
  }

  function CardTitle({ children }: any) {
    return <h2>{children}</h2>;
  }

  function CardDescription({ children }: any) {
    return <p>{children}</p>;
  }

  function CardContent({ children }: any) {
    return <div>{children}</div>;
  }

  function Form({ children, ...props }: any) {
    return <FormProvider {...props}>{children}</FormProvider>;
  }

  function FormField({ name, render, ...props }: any) {
    return <Controller name={name} render={render} {...props} />;
  }

  function FormItem({ children, ...props }: any) {
    return <div {...props}>{children}</div>;
  }

  function FormLabel({ children, htmlFor }: any) {
    return <label htmlFor={htmlFor}>{children}</label>;
  }

  function FormControl({ children, ...props }: any) {
    return <div {...props}>{children}</div>;
  }

  function FormDescription({ children }: any) {
    return <p data-testid="form-description">{children}</p>;
  }

  function FormMessage({ children }: any) {
    return <div data-testid="form-message">{children}</div>;
  }

  function Input({ type, disabled, id, ...props }: any) {
    return <input type={type} disabled={disabled} id={id} {...props} />;
  }

  function Label({ children, htmlFor }: any) {
    return <label htmlFor={htmlFor}>{children}</label>;
  }

  return {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormDescription,
    FormMessage,
    Input,
    Label,
    useToast: jest.fn(),
  };
});

import { RecoveryKeyRotationCard } from './RecoveryKeyRotationCard';
import type { VaultHandle } from '@myorganizer/web-vault';
import {
  mintRecoveryKey,
  type MintedRecoveryKey,
} from '@myorganizer/web-vault';
import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';
import { useToast } from '@myorganizer/web-ui';
import { useRecoveryKeyRotation } from '../hooks';

// === Mock helpers ===

function createMockHandle(overrides?: Partial<VaultHandle>): VaultHandle {
  const base: VaultHandle = {
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
    resetPassphrase: jest.fn(),
    rotateRecoveryKey: jest.fn(),
    loadDecryptedData: jest.fn(),
    saveEncryptedData: jest.fn(),
    vaultStatus: jest.fn().mockReturnValue('absent'),
    hasUnclaimedLocalVault: jest.fn().mockReturnValue(false),
    claimUnclaimedLocalVaultLocked: jest.fn(),
    loadUnclaimedVault: jest.fn().mockReturnValue(null),
    claimUnclaimedLocalVaultByRecoveryKey: jest.fn(),
    replaceOwnedLocalVaultWithUnclaimedLocked: jest.fn(),
    replaceOwnedLocalVaultWithUnclaimedByRecoveryKey: jest.fn(),
    hasUnsentChanges: jest.fn().mockResolvedValue(false),
    lastPushedEtag: jest.fn().mockReturnValue(undefined),
    recordPushSuccess: jest.fn(),
    lastAgreedVaultMetaHash: jest.fn().mockReturnValue(undefined),
    recordVaultMetaAgreement: jest.fn(),
    decryptCiphertext: jest.fn(),
  };
  return { ...base, ...overrides };
}

describe('RecoveryKeyRotationCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: createMockHandle({ loadVault: jest.fn().mockReturnValue({}) }),
      masterKeyBytes: new Uint8Array(32),
    });
    (useToast as jest.Mock).mockReturnValue({ toast: jest.fn() });
    (useRecoveryKeyRotation as jest.Mock).mockReturnValue({
      rotating: false,
      rotateRecoveryKey: jest.fn(),
    });
    (mintRecoveryKey as jest.Mock).mockReturnValue(
      'MOCKED-RECOVERY-KEY-VALUE' as unknown as MintedRecoveryKey,
    );

    // Stub navigator.clipboard for copy tests
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn() },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Visibility — disabled-state ladder', () => {
    test('1: no session/handle → card renders, mint button disabled, shows "Your vault is not available on this device right now."', () => {
      (useOptionalVaultSession as jest.Mock).mockReturnValue(null);

      render(<RecoveryKeyRotationCard />);

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('recovery-key-rotation-mint')).toBeDisabled();
      expect(
        screen.getByText(
          'Your vault is not available on this device right now.',
        ),
      ).toBeInTheDocument();
    });

    test('2: handle present, loadVault() returns null → mint button disabled, shows "Set up a local vault…"', () => {
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: createMockHandle({
          loadVault: jest.fn().mockReturnValue(null),
        }),
        masterKeyBytes: new Uint8Array(32),
      });

      render(<RecoveryKeyRotationCard />);

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('recovery-key-rotation-mint')).toBeDisabled();
      expect(
        screen.getByText(
          'Set up a local vault on this device to rotate its recovery key.',
        ),
      ).toBeInTheDocument();
    });

    test('3: handle present, masterKeyBytes === null (locked), vault exists → mint button disabled, shows "Unlock your vault…"', () => {
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: createMockHandle({ loadVault: jest.fn().mockReturnValue({}) }),
        masterKeyBytes: null,
      });

      render(<RecoveryKeyRotationCard />);

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('recovery-key-rotation-mint')).toBeDisabled();
      expect(
        screen.getByText('Unlock your vault to rotate its recovery key.'),
      ).toBeInTheDocument();
    });

    test('4: handle and masterKeyBytes present, passphrase field empty → mint button disabled independently (empty passphrase gates it)', () => {
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: createMockHandle({ loadVault: jest.fn().mockReturnValue({}) }),
        masterKeyBytes: new Uint8Array(32),
      });

      render(<RecoveryKeyRotationCard />);

      expect(screen.getByTestId('card')).toBeInTheDocument();
      const mintButton = screen.getByTestId('recovery-key-rotation-mint');
      expect(mintButton).toBeDisabled();
      // Assert no ladder message is shown (already unlocked)
      expect(
        screen.queryByText('Your vault is not available'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Set up a local vault'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('Unlock your vault')).not.toBeInTheDocument();
    });
  });

  describe('Static copy — rendering in enabled state', () => {
    test('5: renders reassurance paragraph and paragraph mentioning Export encrypted vault', () => {
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: createMockHandle({ loadVault: jest.fn().mockReturnValue({}) }),
        masterKeyBytes: new Uint8Array(32),
      });

      render(<RecoveryKeyRotationCard />);

      // Paragraph 1: minting does not write anything
      expect(
        screen.getByText(
          /Generating a new recovery key does not change anything by itself — nothing is written until you confirm you have it\./,
        ),
      ).toBeInTheDocument();

      // Paragraph 2: Export saved before rotating still opens with old key
      expect(
        screen.getByText(
          /A Vault Export you saved before rotating still opens with your old recovery key — see "Export encrypted vault" below\./,
        ),
      ).toBeInTheDocument();
    });
  });

  describe('Point of no return — minting', () => {
    test('6: fill passphrase, click mint, minted key displays, rotateRecoveryKey never called', async () => {
      const mockRotateRecoveryKey = jest.fn();
      (useRecoveryKeyRotation as jest.Mock).mockReturnValue({
        rotating: false,
        rotateRecoveryKey: mockRotateRecoveryKey,
      });

      render(<RecoveryKeyRotationCard />);

      // Fill the passphrase field (should be a password field)
      const allInputs = screen.getAllByDisplayValue('');
      const passphraseInput = allInputs.find(
        (input): input is HTMLInputElement =>
          input instanceof HTMLInputElement && input.type === 'password',
      );

      fireEvent.change(passphraseInput!, { target: { value: 'testpass1234' } });

      // Click mint button
      const mintButton = screen.getByTestId('recovery-key-rotation-mint');
      fireEvent.click(mintButton);

      // Wait for the key display to appear
      await waitFor(() => {
        expect(
          screen.getByTestId('recovery-key-rotation-key'),
        ).toBeInTheDocument();
      });

      // Assert the minted key is displayed
      const keyDisplay = screen.getByTestId(
        'recovery-key-rotation-key',
      ) as HTMLInputElement;
      expect(keyDisplay.value).toBe('MOCKED-RECOVERY-KEY-VALUE');

      // Assert rotateRecoveryKey was never called just from minting
      expect(mockRotateRecoveryKey).not.toHaveBeenCalled();
    });
  });

  describe('Paste-back gate', () => {
    test('7: after minting, submit disabled with empty confirm field', async () => {
      render(<RecoveryKeyRotationCard />);

      // Fill and submit passphrase to mint
      const allInputs = screen.getAllByDisplayValue('');
      const passphraseInput = allInputs.find(
        (input): input is HTMLInputElement =>
          input instanceof HTMLInputElement && input.type === 'password',
      );

      fireEvent.change(passphraseInput!, { target: { value: 'testpass1234' } });
      const mintButton = screen.getByTestId('recovery-key-rotation-mint');
      fireEvent.click(mintButton);

      // Wait for key display and confirm field
      await waitFor(() => {
        expect(
          screen.getByTestId('recovery-key-rotation-confirm'),
        ).toBeInTheDocument();
      });

      // Assert submit button is disabled with empty confirm field
      const submitButton = screen.getByTestId('recovery-key-rotation-submit');
      expect(submitButton).toBeDisabled();
    });

    test('8: after minting, submit disabled with wrong/partial value in confirm field', async () => {
      render(<RecoveryKeyRotationCard />);

      // Fill and submit passphrase to mint
      const allInputs = screen.getAllByDisplayValue('');
      const passphraseInput = allInputs.find(
        (input): input is HTMLInputElement =>
          input instanceof HTMLInputElement && input.type === 'password',
      );

      fireEvent.change(passphraseInput!, { target: { value: 'testpass1234' } });
      const mintButton = screen.getByTestId('recovery-key-rotation-mint');
      fireEvent.click(mintButton);

      // Wait for confirm field
      await waitFor(() => {
        expect(
          screen.getByTestId('recovery-key-rotation-confirm'),
        ).toBeInTheDocument();
      });

      // Type wrong value in confirm field
      const confirmInput = screen.getByTestId(
        'recovery-key-rotation-confirm',
      ) as HTMLInputElement;
      fireEvent.change(confirmInput, { target: { value: 'wrong-value' } });

      // Assert submit is still disabled
      const submitButton = screen.getByTestId('recovery-key-rotation-submit');
      expect(submitButton).toBeDisabled();
    });

    test('9: after minting, submit enabled only when confirm matches minted key exactly', async () => {
      render(<RecoveryKeyRotationCard />);

      // Fill and submit passphrase to mint
      const allInputs = screen.getAllByDisplayValue('');
      const passphraseInput = allInputs.find(
        (input): input is HTMLInputElement =>
          input instanceof HTMLInputElement && input.type === 'password',
      );

      fireEvent.change(passphraseInput!, { target: { value: 'testpass1234' } });
      const mintButton = screen.getByTestId('recovery-key-rotation-mint');
      fireEvent.click(mintButton);

      // Wait for confirm field
      await waitFor(() => {
        expect(
          screen.getByTestId('recovery-key-rotation-confirm'),
        ).toBeInTheDocument();
      });

      // Type correct value in confirm field
      const confirmInput = screen.getByTestId(
        'recovery-key-rotation-confirm',
      ) as HTMLInputElement;
      fireEvent.change(confirmInput, {
        target: { value: 'MOCKED-RECOVERY-KEY-VALUE' },
      });

      // Assert submit is now enabled
      const submitButton = screen.getByTestId('recovery-key-rotation-submit');
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Abandonment', () => {
    test('10: after minting, click cancel, key display and confirm field no longer shown, rotateRecoveryKey never called', async () => {
      const mockRotateRecoveryKey = jest.fn();
      (useRecoveryKeyRotation as jest.Mock).mockReturnValue({
        rotating: false,
        rotateRecoveryKey: mockRotateRecoveryKey,
      });

      render(<RecoveryKeyRotationCard />);

      // Fill and submit passphrase to mint
      const allInputs = screen.getAllByDisplayValue('');
      const passphraseInput = allInputs.find(
        (input): input is HTMLInputElement =>
          input instanceof HTMLInputElement && input.type === 'password',
      );

      fireEvent.change(passphraseInput!, { target: { value: 'testpass1234' } });
      const mintButton = screen.getByTestId('recovery-key-rotation-mint');
      fireEvent.click(mintButton);

      // Wait for key display
      await waitFor(() => {
        expect(
          screen.getByTestId('recovery-key-rotation-key'),
        ).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByTestId('recovery-key-rotation-cancel');
      fireEvent.click(cancelButton);

      // Assert key display and confirm field are no longer shown
      expect(
        screen.queryByTestId('recovery-key-rotation-key'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('recovery-key-rotation-confirm'),
      ).not.toBeInTheDocument();

      // Assert rotateRecoveryKey was never called
      expect(mockRotateRecoveryKey).not.toHaveBeenCalled();
    });
  });

  describe('Commit — success', () => {
    test('11: mint, fill confirm, submit success → rotateRecoveryKey called with correct params, state reset', async () => {
      const mockRotateRecoveryKey = jest.fn().mockResolvedValue('ok');
      (useRecoveryKeyRotation as jest.Mock).mockReturnValue({
        rotating: false,
        rotateRecoveryKey: mockRotateRecoveryKey,
      });

      render(<RecoveryKeyRotationCard />);

      // Fill and mint
      const allInputs = screen.getAllByDisplayValue('');
      const passphraseInput = allInputs.find(
        (input): input is HTMLInputElement =>
          input instanceof HTMLInputElement && input.type === 'password',
      );

      fireEvent.change(passphraseInput!, { target: { value: 'testpass1234' } });
      const mintButton = screen.getByTestId('recovery-key-rotation-mint');
      fireEvent.click(mintButton);

      // Wait for confirm field
      await waitFor(() => {
        expect(
          screen.getByTestId('recovery-key-rotation-confirm'),
        ).toBeInTheDocument();
      });

      // Fill confirm field and submit
      const confirmInput = screen.getByTestId(
        'recovery-key-rotation-confirm',
      ) as HTMLInputElement;
      fireEvent.change(confirmInput, {
        target: { value: 'MOCKED-RECOVERY-KEY-VALUE' },
      });

      const submitButton = screen.getByTestId('recovery-key-rotation-submit');
      fireEvent.click(submitButton);

      // Wait for the hook to be called
      await waitFor(() => {
        expect(mockRotateRecoveryKey).toHaveBeenCalledWith({
          currentPassphrase: 'testpass1234',
          recoveryKey: 'MOCKED-RECOVERY-KEY-VALUE',
        });
      });

      // Assert the reveal UI is cleared after success
      await waitFor(() => {
        expect(
          screen.queryByTestId('recovery-key-rotation-key'),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Commit — wrong passphrase', () => {
    test('12: rotateRecoveryKey returns "wrong-passphrase" → field error shown, key/confirm still visible', async () => {
      const mockRotateRecoveryKey = jest
        .fn()
        .mockResolvedValue('wrong-passphrase');
      (useRecoveryKeyRotation as jest.Mock).mockReturnValue({
        rotating: false,
        rotateRecoveryKey: mockRotateRecoveryKey,
      });

      render(<RecoveryKeyRotationCard />);

      // Fill and mint
      const allInputs = screen.getAllByDisplayValue('');
      const passphraseInput = allInputs.find(
        (input): input is HTMLInputElement =>
          input instanceof HTMLInputElement && input.type === 'password',
      );

      fireEvent.change(passphraseInput!, {
        target: { value: 'wrongpass1234' },
      });
      const mintButton = screen.getByTestId('recovery-key-rotation-mint');
      fireEvent.click(mintButton);

      // Wait for confirm field
      await waitFor(() => {
        expect(
          screen.getByTestId('recovery-key-rotation-confirm'),
        ).toBeInTheDocument();
      });

      // Fill confirm and submit
      const confirmInput = screen.getByTestId(
        'recovery-key-rotation-confirm',
      ) as HTMLInputElement;
      fireEvent.change(confirmInput, {
        target: { value: 'MOCKED-RECOVERY-KEY-VALUE' },
      });

      const submitButton = screen.getByTestId('recovery-key-rotation-submit');
      fireEvent.click(submitButton);

      // Wait for the hook to be called
      await waitFor(() => {
        expect(mockRotateRecoveryKey).toHaveBeenCalled();
      });

      // Assert key display and confirm field are still shown (nothing was written)
      expect(
        screen.getByTestId('recovery-key-rotation-key'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('recovery-key-rotation-confirm'),
      ).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    test('13: rotating true → submit button shows "Rotating…" and is disabled', async () => {
      (useRecoveryKeyRotation as jest.Mock).mockReturnValue({
        rotating: true,
        rotateRecoveryKey: jest.fn(),
      });

      render(<RecoveryKeyRotationCard />);

      // Mint first so the submit button appears
      const allInputs = screen.getAllByDisplayValue('');
      const passphraseInput = allInputs.find(
        (input): input is HTMLInputElement =>
          input instanceof HTMLInputElement && input.type === 'password',
      );

      fireEvent.change(passphraseInput!, { target: { value: 'testpass1234' } });
      const mintButton = screen.getByTestId('recovery-key-rotation-mint');
      fireEvent.click(mintButton);

      // Wait for submit button to appear
      await waitFor(() => {
        expect(
          screen.getByTestId('recovery-key-rotation-submit'),
        ).toBeInTheDocument();
      });

      const submitButton = screen.getByTestId('recovery-key-rotation-submit');
      expect(submitButton).toHaveTextContent('Rotating…');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Copy button', () => {
    test('14: after minting, click copy → navigator.clipboard.writeText called with minted key', async () => {
      render(<RecoveryKeyRotationCard />);

      // Fill and mint
      const allInputs = screen.getAllByDisplayValue('');
      const passphraseInput = allInputs.find(
        (input): input is HTMLInputElement =>
          input instanceof HTMLInputElement && input.type === 'password',
      );

      fireEvent.change(passphraseInput!, { target: { value: 'testpass1234' } });
      const mintButton = screen.getByTestId('recovery-key-rotation-mint');
      fireEvent.click(mintButton);

      // Wait for copy button
      await waitFor(() => {
        expect(
          screen.getByTestId('recovery-key-rotation-copy'),
        ).toBeInTheDocument();
      });

      // Click copy button
      const copyButton = screen.getByTestId('recovery-key-rotation-copy');
      fireEvent.click(copyButton);

      // Assert clipboard.writeText was called with the minted key
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          'MOCKED-RECOVERY-KEY-VALUE',
        );
      });
    });
  });
});
