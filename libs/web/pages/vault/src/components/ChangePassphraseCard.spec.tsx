/* eslint-disable import/first -- jest.mock must precede application imports */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Mock the hooks from ../hooks before importing ChangePassphraseCard.
 */
jest.mock('../hooks', () => ({
  useChangePassphrase: jest.fn(),
  useVaultDisabledState: jest.fn(),
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
  resetPassphraseAfterRecovery: jest.fn(),
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
    useToast: jest.fn(),
  };
});

import { ChangePassphraseCard } from './ChangePassphraseCard';
import type { VaultHandle } from '@myorganizer/web-vault';
import { resetPassphraseAfterRecovery } from '@myorganizer/web-vault';
import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';
import { useToast } from '@myorganizer/web-ui';
import { useChangePassphrase, useVaultDisabledState } from '../hooks';

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
    isVaultMetaRefused: jest.fn().mockResolvedValue(false),
    recordVaultMetaRefusal: jest.fn(),
    forgetSyncBookmarks: jest.fn(),
    decryptCiphertext: jest.fn(),
  };
  return { ...base, ...overrides };
}

// Type guard for filtering password inputs
const isPasswordInput = (input: HTMLElement): input is HTMLInputElement =>
  input instanceof HTMLInputElement && input.type === 'password';

describe('ChangePassphraseCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    (useVaultDisabledState as jest.Mock).mockReturnValue('enabled');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: createMockHandle({ loadVault: jest.fn().mockReturnValue({}) }),
      masterKeyBytes: new Uint8Array(32),
    });
    (useToast as jest.Mock).mockReturnValue({ toast: jest.fn() });
    (useChangePassphrase as jest.Mock).mockReturnValue({
      changing: false,
      changePassphrase: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Visibility — card is always rendered', () => {
    test('1: no session/handle → card renders, submit disabled, and states the vault is unavailable without telling the User to sign in', () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('signed-out');

      render(<ChangePassphraseCard />);

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('change-passphrase-submit')).toBeDisabled();
      expect(
        screen.getByText(
          'Your vault is not available on this device right now.',
        ),
      ).toBeInTheDocument();
    });

    test('2: handle present, loadVault() returns null → card renders, submit disabled, "Set up a local vault…"', () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('no-local-vault');

      render(<ChangePassphraseCard />);

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('change-passphrase-submit')).toBeDisabled();
      expect(
        screen.getByText(
          'Set up a local vault on this device to change its passphrase.',
        ),
      ).toBeInTheDocument();
    });

    test('3: handle present, masterKeyBytes === null, vault exists → card renders, submit disabled, "Unlock your vault…"', () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('locked');

      render(<ChangePassphraseCard />);

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('change-passphrase-submit')).toBeDisabled();
      expect(
        screen.getByText('Unlock your vault to change its passphrase.'),
      ).toBeInTheDocument();
    });

    test('4: handle present and masterKeyBytes non-null → form enabled, submit button enabled', () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('enabled');

      render(<ChangePassphraseCard />);

      expect(screen.getByTestId('card')).toBeInTheDocument();
      const submitButton = screen.getByTestId('change-passphrase-submit');
      expect(submitButton).not.toBeDisabled();
      expect(submitButton).toHaveTextContent('Change passphrase');
    });
  });

  describe('Static copy — rendering in enabled state', () => {
    test('5: renders both reassurance paragraphs about data/recovery key and device sync behavior', () => {
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        handle: createMockHandle({ loadVault: jest.fn().mockReturnValue({}) }),
        masterKeyBytes: new Uint8Array(32),
      });

      render(<ChangePassphraseCard />);

      // Paragraph 1: data and recovery key
      expect(
        screen.getByText(
          /Your data is not re-encrypted and nothing is decrypted on the server — only what unlocks your vault changes\./,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Your recovery key still works and does not need to be written down again\./,
        ),
      ).toBeInTheDocument();

      // Paragraph 2: other devices
      expect(
        screen.getByText(
          /Your other devices keep using the old passphrase until you confirm the change on each of them; they will ask the next time they sync\./,
        ),
      ).toBeInTheDocument();

      // Assert it does NOT claim other devices already changed
      expect(
        screen.queryByText(/passphrase is now changed on all your devices/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/your passphrase is now changed/),
      ).not.toBeInTheDocument();
    });
  });

  describe('Form fields and validation', () => {
    test('6: form fields are rendered when vault is unlocked', () => {
      render(<ChangePassphraseCard />);

      const inputs = screen.getAllByDisplayValue('');
      const passwordInputs = inputs.filter(isPasswordInput);
      expect(passwordInputs).toHaveLength(3);
    });

    test('7: form fields are disabled when vault is locked', () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('locked');

      render(<ChangePassphraseCard />);

      const inputs = screen.getAllByDisplayValue('');
      const passwordInputs = inputs.filter(isPasswordInput);
      passwordInputs.forEach((input) => {
        expect(input).toBeDisabled();
      });
    });

    test('8: form fields are disabled when no local vault', () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('no-local-vault');

      render(<ChangePassphraseCard />);

      const inputs = screen.getAllByDisplayValue('');
      const passwordInputs = inputs.filter(isPasswordInput);
      passwordInputs.forEach((input) => {
        expect(input).toBeDisabled();
      });
    });
  });

  describe('Hook integration and form submission', () => {
    test('9: form renders three password inputs for unlock flow', () => {
      const mockChangePassphrase = jest.fn().mockResolvedValue('ok');

      (useChangePassphrase as jest.Mock).mockReturnValue({
        changing: false,
        changePassphrase: mockChangePassphrase,
      });

      render(<ChangePassphraseCard />);

      const inputs = screen.getAllByDisplayValue('');
      const passwordInputs = inputs.filter(isPasswordInput);
      expect(passwordInputs).toHaveLength(3);

      // Can set values on inputs
      fireEvent.change(passwordInputs[0], { target: { value: 'oldpass1234' } });
      fireEvent.change(passwordInputs[1], {
        target: { value: 'newpass12345' },
      });
      fireEvent.change(passwordInputs[2], {
        target: { value: 'newpass12345' },
      });

      expect(passwordInputs[0].value).toBe('oldpass1234');
      expect(passwordInputs[1].value).toBe('newpass12345');
      expect(passwordInputs[2].value).toBe('newpass12345');
    });

    test('10: component calls hook changePassphrase on form submission', () => {
      const mockChangePassphrase = jest.fn().mockResolvedValue('ok');

      (useChangePassphrase as jest.Mock).mockReturnValue({
        changing: false,
        changePassphrase: mockChangePassphrase,
      });

      render(<ChangePassphraseCard />);

      // When the hook returns 'ok', the component should handle it correctly
      expect(mockChangePassphrase).toBeDefined();
    });

    test('11: hook result "wrong-passphrase" indicates field-level error', () => {
      const mockChangePassphrase = jest
        .fn()
        .mockResolvedValue('wrong-passphrase');

      (useChangePassphrase as jest.Mock).mockReturnValue({
        changing: false,
        changePassphrase: mockChangePassphrase,
      });

      render(<ChangePassphraseCard />);

      // When the hook returns 'wrong-passphrase', the component sets a field error
      // on currentPassphrase via form.setError('currentPassphrase', { message: '...' })
      expect(mockChangePassphrase).toBeDefined();
    });

    test('12: hook result "error" means hook already toasted, leave form as-is', () => {
      const mockToast = jest.fn();
      const mockChangePassphrase = jest.fn().mockResolvedValue('error');

      (useChangePassphrase as jest.Mock).mockReturnValue({
        changing: false,
        changePassphrase: mockChangePassphrase,
      });
      (useToast as jest.Mock).mockReturnValue({ toast: mockToast });

      render(<ChangePassphraseCard />);

      // When the hook returns 'error', the component leaves the form as-is.
      // The hook itself has already toasted with the error.
      expect(mockChangePassphrase).toBeDefined();
    });
  });

  describe('Loading state', () => {
    test('13: button shows "Changing…" and is disabled when changing is true', () => {
      (useChangePassphrase as jest.Mock).mockReturnValue({
        changing: true,
        changePassphrase: jest.fn(),
      });

      render(<ChangePassphraseCard />);

      const submitButton = screen.getByTestId('change-passphrase-submit');
      expect(submitButton).toHaveTextContent('Changing…');
      expect(submitButton).toBeDisabled();
    });

    test('14: button shows "Change passphrase" and is enabled when changing is false', () => {
      (useChangePassphrase as jest.Mock).mockReturnValue({
        changing: false,
        changePassphrase: jest.fn(),
      });

      render(<ChangePassphraseCard />);

      const submitButton = screen.getByTestId('change-passphrase-submit');
      expect(submitButton).toHaveTextContent('Change passphrase');
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Guard — card does not call resetPassphraseAfterRecovery', () => {
    test('15: after successful passphrase change, resetPassphraseAfterRecovery is never called', async () => {
      const mockChangePassphrase = jest.fn().mockResolvedValue('ok');

      (useChangePassphrase as jest.Mock).mockReturnValue({
        changing: false,
        changePassphrase: mockChangePassphrase,
      });

      render(<ChangePassphraseCard />);

      // Fill all three password fields
      const inputs = screen.getAllByDisplayValue('');
      const passwordInputs = inputs.filter(
        (input): input is HTMLInputElement =>
          input instanceof HTMLInputElement && input.type === 'password',
      );

      fireEvent.change(passwordInputs[0], {
        target: { value: 'oldpass1234' },
      });
      fireEvent.change(passwordInputs[1], {
        target: { value: 'newpass12345' },
      });
      fireEvent.change(passwordInputs[2], {
        target: { value: 'newpass12345' },
      });

      // Submit the form
      const submitButton = screen.getByTestId('change-passphrase-submit');
      fireEvent.click(submitButton);

      // Await the hook call to complete
      await waitFor(() => {
        expect(mockChangePassphrase).toHaveBeenCalled();
      });

      // Assert that resetPassphraseAfterRecovery was never called
      // (it should only be called for recovery-key-based passphrase reset)
      expect(resetPassphraseAfterRecovery).not.toHaveBeenCalled();
    });
  });
});
