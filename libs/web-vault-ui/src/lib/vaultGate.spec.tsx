/* eslint-disable import/first -- jest.mock must precede application imports */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockUseToast = jest.fn();
jest.mock('@myorganizer/web-ui', () => ({
  ...jest.requireActual('@myorganizer/web-ui'),
  useToast: () => mockUseToast(),
}));

const mockUseOptionalVaultSession = jest.fn();
jest.mock('./session', () => ({
  useOptionalVaultSession: () => mockUseOptionalVaultSession(),
}));

// Import real VaultSecretMismatchError so instanceof checks work
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { VaultSecretMismatchError } from '@myorganizer/web-vault';
import type { VaultHandle } from '@myorganizer/web-vault';

import { VaultGate } from './vaultGate';

describe('VaultGate', () => {
  let toastFn: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    toastFn = jest.fn();
    mockUseToast.mockReturnValue({ toast: toastFn });
    mockUseOptionalVaultSession.mockReturnValue(null);
  });

  function createStubHandle(overrides?: Partial<VaultHandle>): VaultHandle {
    return {
      owner: 'user-1',
      isUnlocked: false,
      hasVault: jest.fn(() => true),
      vaultStatus: jest.fn(() => 'absent'),
      hasUnclaimedLocalVault: jest.fn(() => true),
      loadVault: jest.fn(() => null),
      saveVault: jest.fn(),
      initialize: jest.fn(),
      claimUnclaimedLocalVault: jest.fn(),
      unlockWithPassphrase: jest.fn(),
      unlockWithRecoveryKey: jest.fn(),
      changePassphrase: jest.fn(),
      resetPassphrase: jest.fn(),
      loadDecryptedData: jest.fn(),
      saveEncryptedData: jest.fn(),
      ...overrides,
    } as unknown as VaultHandle;
  }

  describe('three-state resolution', () => {
    test('renders unlock panel when vaultStatus is "owned"', () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'owned'),
      });
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
        handle,
      });

      render(<VaultGate title="Test">{() => <div>children</div>}</VaultGate>);

      expect(screen.getByText(/Test: Unlock/)).toBeInTheDocument();
      expect(
        screen.queryByText(/Test: Set encryption passphrase/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/A vault is already on this device/),
      ).not.toBeInTheDocument();
    });

    test('renders create panel when vaultStatus is "absent"', () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'absent'),
      });
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
        handle,
      });

      render(<VaultGate title="Test">{() => <div>children</div>}</VaultGate>);

      expect(
        screen.getByText(/Test: Set encryption passphrase/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Test: Unlock/)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/A vault is already on this device/),
      ).not.toBeInTheDocument();
    });

    test('renders claim offer when vaultStatus is "unclaimed"', () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'unclaimed'),
      });
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
        handle,
      });

      render(<VaultGate title="Test">{() => <div>children</div>}</VaultGate>);

      expect(
        screen.getByText(/A vault is already on this device/),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/Test: Set encryption passphrase/),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/Test: Unlock/)).not.toBeInTheDocument();
    });

    test('renders create panel when vaultStatus is "owner-mismatch"', () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'owner-mismatch'),
      });
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
        handle,
      });

      render(<VaultGate title="Test">{() => <div>children</div>}</VaultGate>);

      expect(
        screen.getByText(/Test: Set encryption passphrase/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Test: Unlock/)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/A vault is already on this device/),
      ).not.toBeInTheDocument();
    });

    test('renders children when masterKeyBytes is present', () => {
      const masterKeyBytes = new Uint8Array([1, 2, 3, 4]);
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'absent'),
      });
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
        handle,
      });

      render(
        <VaultGate title="Test">
          {(ctx) => <div>unlocked-{ctx.handle ? 'yes' : 'no'}</div>}
        </VaultGate>,
      );

      expect(screen.getByText(/unlocked-yes/)).toBeInTheDocument();
      expect(
        screen.queryByText(/Test: Set encryption passphrase/),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/Test: Unlock/)).not.toBeInTheDocument();
    });
  });

  describe('escape path from unclaimed', () => {
    test('clicking "This isn\'t my vault" renders create panel and does not call handle methods', () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'unclaimed'),
      });
      const setMasterKeyBytes = jest.fn();
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes: null,
        setMasterKeyBytes,
        lock: jest.fn(),
        handle,
      });

      render(
        <VaultGate title="MyVault">{() => <div>children</div>}</VaultGate>,
      );

      // Initially shows claim offer
      expect(
        screen.getByText(/A vault is already on this device/),
      ).toBeInTheDocument();

      // Click the decline button
      const declineButton = screen.getByRole('button', {
        name: /This isn't my vault/i,
      });
      fireEvent.click(declineButton);

      // Now shows create panel
      expect(
        screen.getByText(/MyVault: Set encryption passphrase/),
      ).toBeInTheDocument();

      // Verify no handle methods were called
      expect(handle.claimUnclaimedLocalVault).not.toHaveBeenCalled();
      expect(handle.initialize).not.toHaveBeenCalled();
      expect(handle.unlockWithPassphrase).not.toHaveBeenCalled();
      expect(handle.saveVault).not.toHaveBeenCalled();
    });

    test('from create panel, filling and submitting passphrase calls initialize and shows recovery key', async () => {
      const recoveryKey = 'test-recovery-key-123';
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'unclaimed'),
        initialize: jest.fn().mockResolvedValue({ recoveryKey }),
      });
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
        handle,
      });

      render(
        <VaultGate title="MyVault">{() => <div>children</div>}</VaultGate>,
      );

      // Decline the offer
      const declineButton = screen.getByRole('button', {
        name: /This isn't my vault/i,
      });
      fireEvent.click(declineButton);

      // Fill both passphrase fields with same value
      const passphraseInput = screen.getByLabelText(
        'Encryption passphrase',
      ) as HTMLInputElement;
      const confirmInput = screen.getByLabelText(
        'Confirm passphrase',
      ) as HTMLInputElement;

      fireEvent.change(passphraseInput, { target: { value: 'gate-pass-1' } });
      fireEvent.change(confirmInput, { target: { value: 'gate-pass-1' } });

      // Click create button
      const createButton = screen.getByRole('button', {
        name: /Create encrypted vault/i,
      });
      fireEvent.click(createButton);

      // Verify initialize was called with the passphrase
      await waitFor(() => {
        expect(handle.initialize).toHaveBeenCalledWith({
          passphrase: 'gate-pass-1',
        });
      });

      // Verify recovery key is displayed
      await waitFor(() => {
        expect(screen.getByDisplayValue(recoveryKey)).toBeInTheDocument();
      });
    });
  });

  describe('claim flow', () => {
    test('successful claim calls setMasterKeyBytes and renders children', async () => {
      const masterKeyBytes = new Uint8Array([4, 5, 6, 7]);
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'unclaimed'),
        claimUnclaimedLocalVault: jest
          .fn()
          .mockResolvedValue({ masterKeyBytes }),
      });
      const setMasterKeyBytes = jest.fn();

      // Initially return null masterKeyBytes
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes: null,
        setMasterKeyBytes,
        lock: jest.fn(),
        handle,
      });

      const { rerender } = render(
        <VaultGate title="MyVault">
          {() => <div>vault-unlocked</div>}
        </VaultGate>,
      );

      // Initially shows claim offer
      expect(
        screen.getByText(/A vault is already on this device/),
      ).toBeInTheDocument();

      // Fill passphrase and claim
      const passphraseInput = screen.getByLabelText(
        'Encryption passphrase',
      ) as HTMLInputElement;
      fireEvent.change(passphraseInput, { target: { value: 'gate-pass-1' } });

      const unlockButton = screen.getByRole('button', {
        name: /Unlock this vault/i,
      });
      fireEvent.click(unlockButton);

      // Verify setMasterKeyBytes was called with the correct value
      await waitFor(() => {
        expect(setMasterKeyBytes).toHaveBeenCalledWith(masterKeyBytes);
      });

      // Update the mock to return masterKeyBytes on next render
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes,
        setMasterKeyBytes,
        lock: jest.fn(),
        handle,
      });

      // Rerender with the updated mock
      rerender(
        <VaultGate title="MyVault">
          {() => <div>vault-unlocked</div>}
        </VaultGate>,
      );

      // Now the children should be rendered
      await waitFor(() => {
        expect(screen.getByText(/vault-unlocked/)).toBeInTheDocument();
        expect(
          screen.queryByText(/A vault is already on this device/),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('failure copy and error handling', () => {
    test('unlock with wrong passphrase shows secret mismatch toast without corruption language', async () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'owned'),
        unlockWithPassphrase: jest
          .fn()
          .mockRejectedValue(new VaultSecretMismatchError('passphrase')),
      });
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
        handle,
      });

      render(
        <VaultGate title="MyVault">{() => <div>children</div>}</VaultGate>,
      );

      // Fill passphrase and try to unlock
      const passphraseInput = screen.getByLabelText(
        'Encryption passphrase',
      ) as HTMLInputElement;
      fireEvent.change(passphraseInput, { target: { value: 'gate-pass-1' } });

      const unlockButton = screen.getByRole('button', { name: /Unlock/ });
      fireEvent.click(unlockButton);

      // Verify error toast is shown
      await waitFor(() => {
        expect(toastFn).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "That passphrase didn't unlock this vault",
            description: expect.stringContaining('does not match this vault'),
            variant: 'destructive',
          }),
        );
      });

      // Verify no corruption language in toast message
      const toastCall = toastFn.mock.calls.find(
        (call) => call[0].title === "That passphrase didn't unlock this vault",
      );
      if (toastCall) {
        const toastText =
          `${toastCall[0].title} ${toastCall[0].description}`.toLowerCase();
        expect(toastText).not.toMatch(
          /corrupt|damaged|reset|wipe|delete|start over/i,
        );
      }
    });

    test('recovery with wrong recovery key shows secret mismatch toast without corruption language', async () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'owned'),
        unlockWithRecoveryKey: jest
          .fn()
          .mockRejectedValue(new VaultSecretMismatchError('recovery-key')),
      });
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
        handle,
      });

      render(
        <VaultGate title="MyVault">{() => <div>children</div>}</VaultGate>,
      );

      // Click "Forgot passphrase" to switch to recovery
      const forgotButton = screen.getByRole('button', {
        name: /Forgot passphrase/i,
      });
      fireEvent.click(forgotButton);

      // Fill recovery key and try to recover
      const recoveryInput = screen.getByLabelText(
        'Recovery key',
      ) as HTMLInputElement;
      fireEvent.change(recoveryInput, { target: { value: 'gate-recover-1' } });

      const recoverButton = screen.getByRole('button', {
        name: /Unlock with recovery key/i,
      });
      fireEvent.click(recoverButton);

      // Verify error toast is shown
      await waitFor(() => {
        expect(toastFn).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "That recovery key didn't unlock this vault",
            description: expect.stringContaining('does not match this vault'),
            variant: 'destructive',
          }),
        );
      });

      // Verify no corruption language in toast message
      const toastCall = toastFn.mock.calls.find(
        (call) =>
          call[0].title === "That recovery key didn't unlock this vault",
      );
      if (toastCall) {
        const toastText =
          `${toastCall[0].title} ${toastCall[0].description}`.toLowerCase();
        expect(toastText).not.toMatch(
          /corrupt|damaged|reset|wipe|delete|start over/i,
        );
      }
    });

    test('non-mismatch unlock error shows fixed toast without error message', async () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'owned'),
        unlockWithPassphrase: jest.fn().mockRejectedValue(new Error('boom')),
      });
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
        handle,
      });

      render(
        <VaultGate title="MyVault">{() => <div>children</div>}</VaultGate>,
      );

      const passphraseInput = screen.getByLabelText(
        'Encryption passphrase',
      ) as HTMLInputElement;
      fireEvent.change(passphraseInput, { target: { value: 'gate-pass-1' } });

      const unlockButton = screen.getByRole('button', { name: /Unlock/ });
      fireEvent.click(unlockButton);

      await waitFor(() => {
        expect(toastFn).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Unlock failed',
            description:
              'Something went wrong. Nothing on this device was changed.',
            variant: 'destructive',
          }),
        );
      });

      // Ensure error message does not leak
      const toastCall = toastFn.mock.calls.find(
        (call) => call[0].title === 'Unlock failed',
      );
      if (toastCall) {
        expect(toastCall[0].description).not.toContain('boom');
      }
    });

    test('non-mismatch recovery error shows fixed toast without error message', async () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'owned'),
        unlockWithRecoveryKey: jest.fn().mockRejectedValue(new Error('boom')),
      });
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
        handle,
      });

      render(
        <VaultGate title="MyVault">{() => <div>children</div>}</VaultGate>,
      );

      const forgotButton = screen.getByRole('button', {
        name: /Forgot passphrase/i,
      });
      fireEvent.click(forgotButton);

      const recoveryInput = screen.getByLabelText(
        'Recovery key',
      ) as HTMLInputElement;
      fireEvent.change(recoveryInput, { target: { value: 'gate-recover-1' } });

      const recoverButton = screen.getByRole('button', {
        name: /Unlock with recovery key/i,
      });
      fireEvent.click(recoverButton);

      await waitFor(() => {
        expect(toastFn).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Recovery failed',
            description:
              'Something went wrong. Nothing on this device was changed.',
            variant: 'destructive',
          }),
        );
      });

      // Ensure error message does not leak
      const toastCall = toastFn.mock.calls.find(
        (call) => call[0].title === 'Recovery failed',
      );
      if (toastCall) {
        expect(toastCall[0].description).not.toContain('boom');
      }
    });
  });

  describe('claim completion and re-offer prevention', () => {
    test('after successful claim, re-rendering with masterKeyBytes: null shows unlock panel not claim offer', async () => {
      const masterKeyBytes = new Uint8Array([4, 5, 6, 7]);
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'unclaimed'),
        claimUnclaimedLocalVault: jest
          .fn()
          .mockResolvedValue({ masterKeyBytes }),
      });
      const setMasterKeyBytes = jest.fn();

      // Initially return null masterKeyBytes
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes: null,
        setMasterKeyBytes,
        lock: jest.fn(),
        handle,
      });

      const { rerender } = render(
        <VaultGate title="MyVault">
          {() => <div>vault-unlocked</div>}
        </VaultGate>,
      );

      // Initially shows claim offer
      expect(
        screen.getByText(/A vault is already on this device/),
      ).toBeInTheDocument();

      // Fill passphrase and claim
      const passphraseInput = screen.getByLabelText(
        'Encryption passphrase',
      ) as HTMLInputElement;
      fireEvent.change(passphraseInput, { target: { value: 'gate-pass-1' } });

      const unlockButton = screen.getByRole('button', {
        name: /Unlock this vault/i,
      });
      fireEvent.click(unlockButton);

      // Verify setMasterKeyBytes was called with the correct value
      await waitFor(() => {
        expect(setMasterKeyBytes).toHaveBeenCalledWith(masterKeyBytes);
      });

      // Update the mock to still return null masterKeyBytes (simulating a lock without unmount)
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes: null,
        setMasterKeyBytes,
        lock: jest.fn(),
        handle,
      });

      // Rerender with the updated mock
      rerender(
        <VaultGate title="MyVault">
          {() => <div>vault-unlocked</div>}
        </VaultGate>,
      );

      // Should now show unlock panel (because vaultStatus is 'owned' after setVaultStatus('owned') was called),
      // not the claim offer again
      await waitFor(() => {
        expect(screen.getByText(/MyVault: Unlock/)).toBeInTheDocument();
        expect(
          screen.queryByText(/A vault is already on this device/),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('handle identity change recovery', () => {
    test('when handle changes from null to a handle with vaultStatus "owned", shows unlock panel not create panel', () => {
      const handle = createStubHandle({
        vaultStatus: jest.fn(() => 'owned'),
      });

      // Initially render with no session (handle is null)
      mockUseOptionalVaultSession.mockReturnValue(null);

      const { rerender } = render(
        <VaultGate title="MyVault">{() => <div>children</div>}</VaultGate>,
      );

      // Initially shows create panel because handle is null, so vaultStatus defaults to 'absent'
      expect(
        screen.getByText(/MyVault: Set encryption passphrase/),
      ).toBeInTheDocument();

      // Rerender with handle now available whose vaultStatus is 'owned'
      mockUseOptionalVaultSession.mockReturnValue({
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
        handle,
      });

      rerender(
        <VaultGate title="MyVault">{() => <div>children</div>}</VaultGate>,
      );

      // Must show unlock panel after handle change
      expect(screen.getByText(/MyVault: Unlock/)).toBeInTheDocument();

      // Must NOT show create panel — this is the whole point of the fix
      expect(
        screen.queryByText(/MyVault: Set encryption passphrase/),
      ).not.toBeInTheDocument();
    });
  });

  describe('Guard — the recovery branch uses the recovery-authorized entry point', () => {
    /**
     * Asserted against the source text rather than by driving the control,
     * because the control cannot be driven: the recovery panel stops rendering
     * at the moment its button would become enabled (#593). A test that faked
     * a path to it would assert something the product cannot do.
     *
     * What it protects: `changePassphraseWithCurrent` verifies the current
     * passphrase, and `resetPassphraseAfterRecovery` does not, because a User
     * here has just proved they do not know it. Reaching for the first from
     * this branch would demand a secret the flow exists to work without;
     * reaching for the second from an unlocked-session surface would skip the
     * authorization entirely. Each belongs to exactly one caller.
     */
    test('vaultGate.tsx does not reference changePassphraseWithCurrent', () => {
      const source = readFileSync(join(__dirname, 'vaultGate.tsx'), 'utf8');

      expect(source).toContain('resetPassphraseAfterRecovery');
      expect(source).not.toContain('changePassphraseWithCurrent');
    });
  });
});
