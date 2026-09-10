import '@testing-library/jest-dom';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { ImportVaultReplaceDialog } from './ImportVaultReplaceDialog';
import type { VaultImportDisclosureState } from '../hooks';

function renderDialog(
  overrides: Partial<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => Promise<void>;
    onDecline: () => void;
    disclosure: VaultImportDisclosureState;
  }> = {},
) {
  const onOpenChange = jest.fn();
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  const onDecline = jest.fn();
  // Default disclosure: loaded with different-vault (the worst case)
  const disclosure: VaultImportDisclosureState = {
    status: 'loaded',
    outcome: { kind: 'different-vault' },
  };

  const props = {
    open: true,
    onOpenChange,
    onConfirm,
    onDecline,
    disclosure,
    ...overrides,
  };

  const view = render(<ImportVaultReplaceDialog {...props} />);

  return {
    ...view,
    onOpenChange: props.onOpenChange,
    onConfirm: props.onConfirm,
    onDecline: props.onDecline,
  };
}

describe('ImportVaultReplaceDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('discloses credential replacement for different-vault in title, description, and acknowledgement label', () => {
    renderDialog({
      disclosure: { status: 'loaded', outcome: { kind: 'different-vault' } },
    });

    expect(
      screen.getByRole('heading', { name: "Replace this device's vault?" }),
    ).toBeInTheDocument();

    const description = screen.getByTestId('import-vault-replace-disclosure');
    expect(description.textContent).toMatch(/passphrase/i);
    expect(description.textContent).toMatch(/Recovery Key/i);
    expect(description.textContent).toMatch(/replace/i);
    expect(description.textContent).toMatch(/different Vault/i);

    const checkboxLabel = screen.getByText(
      /I understand the passphrase and Recovery Key on this device will be replaced by the backup's values\./,
    );
    expect(checkboxLabel).toBeInTheDocument();
  });

  test('keeps Replace and import disabled until the acknowledgement checkbox is checked', () => {
    renderDialog();

    const confirmButton = screen.getByTestId('import-vault-replace-confirm');
    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveTextContent('Replace and import');

    fireEvent.click(confirmButton);
    expect(screen.getByTestId('import-vault-replace-confirm')).toBeDisabled();

    fireEvent.click(screen.getByTestId('import-vault-replace-acknowledge'));

    expect(
      screen.getByTestId('import-vault-replace-confirm'),
    ).not.toBeDisabled();
  });

  test('calls onConfirm once on success, closes via onOpenChange, and does not call onDecline', async () => {
    let resolveConfirm!: () => void;
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    const { onOpenChange, onDecline } = renderDialog({ onConfirm });

    fireEvent.click(screen.getByTestId('import-vault-replace-acknowledge'));
    fireEvent.click(screen.getByTestId('import-vault-replace-confirm'));

    await waitFor(() => {
      expect(
        screen.getByTestId('import-vault-replace-confirm'),
      ).toHaveTextContent('Importing…');
    });

    resolveConfirm();

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    expect(onDecline).not.toHaveBeenCalled();
  });

  test('shows role=alert with error message when onConfirm rejects and keeps the dialog open', async () => {
    const onConfirm = jest.fn().mockRejectedValue(new Error('boom'));
    const { onDecline } = renderDialog({ onConfirm });

    fireEvent.click(screen.getByTestId('import-vault-replace-acknowledge'));
    fireEvent.click(screen.getByTestId('import-vault-replace-confirm'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('boom');
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDecline).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('import-vault-replace-dialog'),
    ).toBeInTheDocument();
  });

  test('shows generic import failure when onConfirm rejects a non-Error value', async () => {
    const onConfirm = jest.fn().mockRejectedValue('unexpected');
    renderDialog({ onConfirm });

    fireEvent.click(screen.getByTestId('import-vault-replace-acknowledge'));
    fireEvent.click(screen.getByTestId('import-vault-replace-confirm'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to import vault',
      );
    });
  });

  test('Cancel calls onDecline and onOpenChange(false) without calling onConfirm', () => {
    const { onOpenChange, onConfirm, onDecline } = renderDialog();

    fireEvent.click(screen.getByTestId('import-vault-replace-cancel'));

    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('resets acknowledgement and error when the dialog closes and reopens', async () => {
    const onConfirm = jest.fn().mockRejectedValue(new Error('boom'));
    const { rerender } = renderDialog({ onConfirm });

    fireEvent.click(screen.getByTestId('import-vault-replace-acknowledge'));
    fireEvent.click(screen.getByTestId('import-vault-replace-confirm'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    rerender(
      <ImportVaultReplaceDialog
        open={false}
        onOpenChange={jest.fn()}
        onConfirm={onConfirm}
        onDecline={jest.fn()}
        disclosure={{ status: 'loaded', outcome: { kind: 'different-vault' } }}
      />,
    );

    rerender(
      <ImportVaultReplaceDialog
        open={true}
        onOpenChange={jest.fn()}
        onConfirm={onConfirm}
        onDecline={jest.fn()}
        disclosure={{ status: 'loaded', outcome: { kind: 'different-vault' } }}
      />,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('import-vault-replace-confirm')).toBeDisabled();
    expect(
      screen.getByTestId('import-vault-replace-acknowledge'),
    ).not.toBeChecked();
  });

  describe('C1: pending disclosure', () => {
    test('shows checking message, no acknowledgement checkbox, confirm disabled', () => {
      renderDialog({
        disclosure: { status: 'pending', outcome: null },
      });

      const disclosure = screen.getByTestId('import-vault-replace-disclosure');
      expect(disclosure.textContent).toContain(
        'Checking what this backup changes',
      );

      expect(
        screen.queryByTestId('import-vault-replace-acknowledge'),
      ).not.toBeInTheDocument();

      expect(screen.getByTestId('import-vault-replace-confirm')).toBeDisabled();
    });
  });

  describe('C2: unchanged disclosure', () => {
    test('no acknowledgement checkbox, confirm enabled, no credential change warnings', () => {
      renderDialog({
        disclosure: { status: 'loaded', outcome: { kind: 'unchanged' } },
      });

      const disclosure = screen.getByTestId('import-vault-replace-disclosure');
      // Should say nothing about credentials CHANGING (no "replace", "reverts", "stops working")
      expect(disclosure.textContent).not.toContain('replace');
      expect(disclosure.textContent).not.toContain('reverts');
      expect(disclosure.textContent).not.toContain('stops working');
      expect(disclosure.textContent).not.toContain('different Vault');
      // Should mention it's the same vault/same credentials (factually)
      expect(disclosure.textContent).toContain(
        'Nothing about opening your Vault changes',
      );

      // No checkbox
      expect(
        screen.queryByTestId('import-vault-replace-acknowledge'),
      ).not.toBeInTheDocument();

      // Confirm should be enabled (no acknowledgement needed)
      const confirmButton = screen.getByTestId('import-vault-replace-confirm');
      expect(confirmButton).not.toBeDisabled();
    });
  });

  describe('C3: wrapping-reverts passphrase', () => {
    test('names passphrase, says Recovery Key unaffected, acknowledgement gates confirm', () => {
      renderDialog({
        disclosure: {
          status: 'loaded',
          outcome: { kind: 'wrapping-reverts', change: 'passphrase' },
        },
      });

      const disclosure = screen.getByTestId('import-vault-replace-disclosure');
      expect(disclosure.textContent).toContain('passphrase');
      expect(disclosure.textContent).toContain('Recovery Key is unaffected');
      expect(disclosure.textContent).not.toContain('different Vault');

      const acknowledgement = screen.getByTestId(
        'import-vault-replace-acknowledge',
      );
      expect(acknowledgement).toBeInTheDocument();

      const confirmButton = screen.getByTestId('import-vault-replace-confirm');
      expect(confirmButton).toBeDisabled();

      fireEvent.click(acknowledgement);
      expect(confirmButton).not.toBeDisabled();
    });
  });

  describe('C4: wrapping-reverts recovery-key', () => {
    test('names Recovery Key, says passphrase unaffected, text differs from passphrase case', () => {
      renderDialog({
        disclosure: {
          status: 'loaded',
          outcome: { kind: 'wrapping-reverts', change: 'recovery-key' },
        },
      });

      const disclosure = screen.getByTestId('import-vault-replace-disclosure');
      expect(disclosure.textContent).toContain('Recovery Key');
      expect(disclosure.textContent).toContain('passphrase is unaffected');
      expect(disclosure.textContent).not.toContain('different Vault');

      const acknowledgement = screen.getByTestId(
        'import-vault-replace-acknowledge',
      );
      expect(acknowledgement).toBeInTheDocument();

      // Capture recovery-key text
      const recoveryText = disclosure.textContent;

      // Clean up and render a separate component with passphrase change for comparison
      cleanup();
      render(
        <ImportVaultReplaceDialog
          open={true}
          onOpenChange={jest.fn()}
          onConfirm={jest.fn().mockResolvedValue(undefined)}
          onDecline={jest.fn()}
          disclosure={{
            status: 'loaded',
            outcome: { kind: 'wrapping-reverts', change: 'passphrase' },
          }}
        />,
      );

      const passphraseDisclosure = screen.getByTestId(
        'import-vault-replace-disclosure',
      );
      const passphraseText = passphraseDisclosure.textContent;

      expect(recoveryText).not.toBe(passphraseText);
      expect(passphraseText).toContain('passphrase');
      expect(passphraseText).toContain('Recovery Key is unaffected');
    });
  });

  describe('C5: different-vault disclosure', () => {
    test('says different Vault, credentials replaced, device stops holding server Vault, acknowledgement gates confirm', () => {
      renderDialog({
        disclosure: { status: 'loaded', outcome: { kind: 'different-vault' } },
      });

      const disclosure = screen.getByTestId('import-vault-replace-disclosure');
      expect(disclosure.textContent).toContain('different Vault');
      expect(disclosure.textContent).toContain(
        'passphrase and Recovery Key replace',
      );
      expect(disclosure.textContent).toContain(
        'stop holding the Vault the server has',
      );

      const acknowledgement = screen.getByTestId(
        'import-vault-replace-acknowledge',
      );
      expect(acknowledgement).toBeInTheDocument();

      const confirmButton = screen.getByTestId('import-vault-replace-confirm');
      expect(confirmButton).toBeDisabled();

      fireEvent.click(acknowledgement);
      expect(confirmButton).not.toBeDisabled();
    });
  });

  describe('C6: unreadable disclosure', () => {
    test('says file could not be read, acknowledgement present and gates confirm', () => {
      renderDialog({
        disclosure: { status: 'unreadable', outcome: null },
      });

      const disclosure = screen.getByTestId('import-vault-replace-disclosure');
      expect(disclosure.textContent).toContain('could not be read');

      const acknowledgement = screen.getByTestId(
        'import-vault-replace-acknowledge',
      );
      expect(acknowledgement).toBeInTheDocument();

      const confirmButton = screen.getByTestId('import-vault-replace-confirm');
      expect(confirmButton).toBeDisabled();

      fireEvent.click(acknowledgement);
      expect(confirmButton).not.toBeDisabled();
    });
  });

  describe('C7: rerender from pending to resolved outcome — acknowledgement resets', () => {
    test('when outcome resolves after box was ticked, checkbox resets and confirm disables', () => {
      const { rerender } = renderDialog({
        disclosure: { status: 'pending', outcome: null },
      });

      // Initial state: no checkbox (pending)
      expect(
        screen.queryByTestId('import-vault-replace-acknowledge'),
      ).not.toBeInTheDocument();

      // Rerender to resolved unchanged state
      rerender(
        <ImportVaultReplaceDialog
          open={true}
          onOpenChange={jest.fn()}
          onConfirm={jest.fn().mockResolvedValue(undefined)}
          onDecline={jest.fn()}
          disclosure={{ status: 'loaded', outcome: { kind: 'unchanged' } }}
        />,
      );

      // Unchanged outcome still has no checkbox
      expect(
        screen.queryByTestId('import-vault-replace-acknowledge'),
      ).not.toBeInTheDocument();

      // Now rerender to an outcome that requires acknowledgement
      rerender(
        <ImportVaultReplaceDialog
          open={true}
          onOpenChange={jest.fn()}
          onConfirm={jest.fn().mockResolvedValue(undefined)}
          onDecline={jest.fn()}
          disclosure={{
            status: 'loaded',
            outcome: { kind: 'different-vault' },
          }}
        />,
      );

      const acknowledgement = screen.getByTestId(
        'import-vault-replace-acknowledge',
      );
      // Radix Checkbox uses data-state="unchecked" when not checked
      expect(acknowledgement).toHaveAttribute('data-state', 'unchecked');

      // Tick it
      fireEvent.click(acknowledgement);
      expect(acknowledgement).toHaveAttribute('data-state', 'checked');

      // Now rerender to another outcome with different requirements
      rerender(
        <ImportVaultReplaceDialog
          open={true}
          onOpenChange={jest.fn()}
          onConfirm={jest.fn().mockResolvedValue(undefined)}
          onDecline={jest.fn()}
          disclosure={{
            status: 'loaded',
            outcome: { kind: 'wrapping-reverts', change: 'passphrase' },
          }}
        />,
      );

      // Checkbox should be reset to unchecked
      const newAcknowledgement = screen.getByTestId(
        'import-vault-replace-acknowledge',
      );
      expect(newAcknowledgement).toHaveAttribute('data-state', 'unchecked');

      // Confirm should be disabled again
      expect(screen.getByTestId('import-vault-replace-confirm')).toBeDisabled();
    });
  });

  describe('C8: no passphrase/unlock input in any state', () => {
    test('pending state has no password input', () => {
      renderDialog({
        disclosure: { status: 'pending', outcome: null },
      });

      expect(
        screen.queryByRole('textbox', { name: /password|passphrase/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', { name: /unlock/i }),
      ).not.toBeInTheDocument();
    });

    test('unchanged state has no password input', () => {
      renderDialog({
        disclosure: { status: 'loaded', outcome: { kind: 'unchanged' } },
      });

      expect(
        screen.queryByRole('textbox', { name: /password|passphrase/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', { name: /unlock/i }),
      ).not.toBeInTheDocument();
    });

    test('different-vault state has no password input and confirm is reachable', async () => {
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      renderDialog({
        disclosure: { status: 'loaded', outcome: { kind: 'different-vault' } },
        onConfirm,
      });

      expect(
        screen.queryByRole('textbox', { name: /password|passphrase/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', { name: /unlock/i }),
      ).not.toBeInTheDocument();

      // Check that confirm becomes reachable once acknowledged
      const acknowledgement = screen.getByTestId(
        'import-vault-replace-acknowledge',
      );
      fireEvent.click(acknowledgement);

      const confirmButton = screen.getByTestId('import-vault-replace-confirm');
      expect(confirmButton).not.toBeDisabled();

      // Confirm can be clicked without errors
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
      });
    });

    test('wrapping-reverts state has no password input', () => {
      renderDialog({
        disclosure: {
          status: 'loaded',
          outcome: { kind: 'wrapping-reverts', change: 'passphrase' },
        },
      });

      expect(
        screen.queryByRole('textbox', { name: /password|passphrase/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', { name: /unlock/i }),
      ).not.toBeInTheDocument();
    });

    test('unreadable state has no password input', () => {
      renderDialog({
        disclosure: { status: 'unreadable', outcome: null },
      });

      expect(
        screen.queryByRole('textbox', { name: /password|passphrase/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', { name: /unlock/i }),
      ).not.toBeInTheDocument();
    });
  });
});
