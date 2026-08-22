import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

describe('ConfirmDeleteDialog', () => {
  it('renders title and description', () => {
    const onOpenChange = jest.fn();
    const onConfirm = jest.fn();

    render(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete this item?"
        description="This action cannot be undone."
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('Delete this item?')).toBeInTheDocument();
    expect(
      screen.getByText('This action cannot be undone.'),
    ).toBeInTheDocument();
  });

  it('invokes onConfirm when confirm button is clicked', async () => {
    const onOpenChange = jest.fn();
    const onConfirm = jest.fn();

    render(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete?"
        description="Are you sure?"
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onConfirm when cancel button is clicked', async () => {
    const onOpenChange = jest.fn();
    const onConfirm = jest.fn();

    render(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete?"
        description="Are you sure?"
        onConfirm={onConfirm}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables confirm button while onConfirm promise is pending', async () => {
    const onOpenChange = jest.fn();
    const resolvers: { resolve?: () => void } = {};
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvers.resolve = resolve;
        }),
    );

    render(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete?"
        description="Are you sure?"
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: /delete/i });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    // Button should be disabled while pending
    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
    });

    // Button should show pending state with ellipsis
    expect(confirmButton).toHaveTextContent('Delete…');

    // Resolve the promise
    if (resolvers.resolve) {
      resolvers.resolve();
    }

    // Button should be re-enabled after promise resolves
    await waitFor(() => {
      expect(confirmButton).not.toBeDisabled();
    });

    // Text should return to normal
    expect(confirmButton).toHaveTextContent('Delete');
  });

  it('disables cancel button while onConfirm promise is pending', async () => {
    const onOpenChange = jest.fn();
    const resolvers: { resolve?: () => void } = {};
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvers.resolve = resolve;
        }),
    );

    render(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete?"
        description="Are you sure?"
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: /delete/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    expect(cancelButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    // Cancel button should be disabled while pending
    await waitFor(() => {
      expect(cancelButton).toBeDisabled();
    });

    if (resolvers.resolve) {
      resolvers.resolve();
    }

    // Cancel button should be re-enabled after promise resolves
    await waitFor(() => {
      expect(cancelButton).not.toBeDisabled();
    });
  });

  it('hides close button while onConfirm promise is pending', async () => {
    const onOpenChange = jest.fn();
    const resolvers: { resolve?: () => void } = {};
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvers.resolve = resolve;
        }),
    );

    render(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete?"
        description="Are you sure?"
        onConfirm={onConfirm}
      />,
    );

    // Close button should be visible initially
    let closeButton = screen.queryByRole('button', { name: /close/i });
    expect(closeButton).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      // Close button should be hidden while pending
      closeButton = screen.queryByRole('button', { name: /close/i });
      expect(closeButton).not.toBeInTheDocument();
    });

    if (resolvers.resolve) {
      resolvers.resolve();
    }

    await waitFor(() => {
      // Close button should reappear after promise resolves
      closeButton = screen.queryByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });
  });

  it('prevents dialog dismissal via Escape while pending', async () => {
    const onOpenChange = jest.fn();
    const resolvers: { resolve?: () => void } = {};
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvers.resolve = resolve;
        }),
    );

    render(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete?"
        description="Are you sure?"
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
    });

    // Find the dialog content element (the DialogContent/DialogPrimitive.Content)
    const dialogContent = screen
      .getByText('Delete?')
      .closest('[role="dialog"]');
    expect(dialogContent).toBeInTheDocument();

    // Send Escape key while pending
    if (dialogContent) {
      fireEvent.keyDown(dialogContent, { key: 'Escape', code: 'Escape' });
    }

    // onOpenChange should not be called (dialog should not dismiss)
    expect(onOpenChange).not.toHaveBeenCalled();

    if (resolvers.resolve) {
      resolvers.resolve();
    }

    // Verify that the dialog is still open (onOpenChange was not called)
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('allows dialog dismissal via Escape when not pending', async () => {
    const onOpenChange = jest.fn();
    const onConfirm = jest.fn();

    render(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete?"
        description="Are you sure?"
        onConfirm={onConfirm}
      />,
    );

    const dialogContent = screen
      .getByText('Delete?')
      .closest('[role="dialog"]');
    expect(dialogContent).toBeInTheDocument();

    // Send Escape key while not pending
    if (dialogContent) {
      fireEvent.keyDown(dialogContent, { key: 'Escape', code: 'Escape' });
    }

    // onOpenChange should be called with false
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('handles async onConfirm that completes successfully', async () => {
    const onOpenChange = jest.fn();
    const onConfirm = jest.fn(() => Promise.resolve());

    render(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete?"
        description="Are you sure?"
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(confirmButton).not.toBeDisabled();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
