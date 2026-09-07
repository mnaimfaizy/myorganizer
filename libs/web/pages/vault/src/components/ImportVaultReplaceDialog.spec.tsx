import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ImportVaultReplaceDialog } from './ImportVaultReplaceDialog';

function renderDialog(
  overrides: Partial<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => Promise<void>;
    onDecline: () => void;
  }> = {},
) {
  const onOpenChange = jest.fn();
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  const onDecline = jest.fn();

  const props = {
    open: true,
    onOpenChange,
    onConfirm,
    onDecline,
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

  test('discloses passphrase and Recovery Key replacement in title, description, and acknowledgement label', () => {
    renderDialog();

    expect(
      screen.getByRole('heading', { name: "Replace this device's vault?" }),
    ).toBeInTheDocument();

    const description = screen.getByText(/Importing this backup replaces/i);
    expect(description.textContent).toMatch(/passphrase/i);
    expect(description.textContent).toMatch(/Recovery Key/i);
    expect(description.textContent).toMatch(/replaced/i);
    expect(description.textContent).toContain(
      "The passphrase and Recovery Key will be replaced by the backup's values",
    );

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
      />,
    );

    rerender(
      <ImportVaultReplaceDialog
        open={true}
        onOpenChange={jest.fn()}
        onConfirm={onConfirm}
        onDecline={jest.fn()}
      />,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('import-vault-replace-confirm')).toBeDisabled();
    expect(
      screen.getByTestId('import-vault-replace-acknowledge'),
    ).not.toBeChecked();
  });
});
