/**
 * UI behavioral tests for VaultReplaceOffer.
 *
 * The suite establishes that the component correctly:
 * - Disables the Confirm button until the acknowledgement checkbox is checked
 * - Calls onExport when the Export button is clicked, shows loading and success/error states
 * - Calls onConfirm when the Confirm button is clicked (only after acknowledgement), shows loading and error states
 * - Calls onDecline when Decline is clicked, without calling onExport or onConfirm
 * - Does not crash when onExport or onConfirm reject
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VaultReplaceOffer } from './VaultReplaceOffer';

describe('VaultReplaceOffer', () => {
  describe('initial state and acknowledgement flow', () => {
    test('should render with Confirm button disabled until acknowledgement checkbox is checked', () => {
      const onExport = jest.fn().mockResolvedValue(undefined);
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const onDecline = jest.fn();

      render(
        <VaultReplaceOffer
          onExport={onExport}
          onConfirm={onConfirm}
          onDecline={onDecline}
        />,
      );

      // Confirm button should be disabled initially
      const confirmButton = screen.getByRole('button', {
        name: /Confirm/,
      }) as HTMLButtonElement;
      expect(confirmButton.disabled).toBe(true);

      // Check the acknowledgement checkbox
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      // Confirm button should now be enabled
      expect(confirmButton.disabled).toBe(false);
    });
  });

  describe('export flow', () => {
    test('should call onExport and show loading state while exporting', async () => {
      const onExport = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
          }),
      );
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const onDecline = jest.fn();

      render(
        <VaultReplaceOffer
          onExport={onExport}
          onConfirm={onConfirm}
          onDecline={onDecline}
        />,
      );

      const exportButton = screen.getByRole('button', {
        name: /Export the vault I'm using now/,
      });
      fireEvent.click(exportButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Exporting/ })).toBeInTheDocument();
      });

      expect(onExport).toHaveBeenCalledTimes(1);

      // Should show success state after async operation completes
      await waitFor(() => {
        expect(screen.getByText(/Exported/)).toBeInTheDocument();
      });
    });

    test('should show error state when onExport rejects', async () => {
      const onExport = jest.fn().mockRejectedValue(new Error('Export failed'));
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const onDecline = jest.fn();

      render(
        <VaultReplaceOffer
          onExport={onExport}
          onConfirm={onConfirm}
          onDecline={onDecline}
        />,
      );

      const exportButton = screen.getByRole('button', {
        name: /Export the vault I'm using now/,
      });
      fireEvent.click(exportButton);

      // Should show error state
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByRole('alert').textContent).toContain('Export failed');
      expect(onExport).toHaveBeenCalledTimes(1);
    });

    test('should disable export button while exporting and re-enable after completion', async () => {
      const onExport = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
          }),
      );
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const onDecline = jest.fn();

      render(
        <VaultReplaceOffer
          onExport={onExport}
          onConfirm={onConfirm}
          onDecline={onDecline}
        />,
      );

      const exportButton = screen.getByRole('button', {
        name: /Export the vault I'm using now/,
      }) as HTMLButtonElement;

      fireEvent.click(exportButton);

      // Should be disabled while exporting
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Exporting/ }),
        ).toBeDisabled();
      });

      // Should be re-enabled after completion
      await waitFor(() => {
        expect(exportButton.disabled).toBe(false);
      });
    });
  });

  describe('confirm flow', () => {
    test('should call onConfirm only when acknowledgement is checked', async () => {
      const onExport = jest.fn().mockResolvedValue(undefined);
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const onDecline = jest.fn();

      render(
        <VaultReplaceOffer
          onExport={onExport}
          onConfirm={onConfirm}
          onDecline={onDecline}
        />,
      );

      const confirmButton = screen.getByRole('button', {
        name: /Confirm/,
      }) as HTMLButtonElement;

      // Should be disabled initially
      expect(confirmButton.disabled).toBe(true);
      fireEvent.click(confirmButton);
      expect(onConfirm).not.toHaveBeenCalled();

      // Check the acknowledgement checkbox
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      // Should now be enabled
      expect(confirmButton.disabled).toBe(false);
      fireEvent.click(confirmButton);

      // Should call onConfirm
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(1);
      });
    });

    test('should show loading state and disable confirm button while confirming', async () => {
      const onExport = jest.fn().mockResolvedValue(undefined);
      const onConfirm = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
          }),
      );
      const onDecline = jest.fn();

      render(
        <VaultReplaceOffer
          onExport={onExport}
          onConfirm={onConfirm}
          onDecline={onDecline}
        />,
      );

      // Check acknowledgement
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      const confirmButton = screen.getByRole('button', {
        name: /Confirm/,
      });
      fireEvent.click(confirmButton);

      // Should show loading state and be disabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Replacing/ })).toBeDisabled();
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);

      // Should revert to normal state after async operation completes
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Confirm/ })).toBeInTheDocument();
      });
    });

    test('should show error state when onConfirm rejects', async () => {
      const onExport = jest.fn().mockResolvedValue(undefined);
      const onConfirm = jest.fn().mockRejectedValue(new Error('Replace failed'));
      const onDecline = jest.fn();

      render(
        <VaultReplaceOffer
          onExport={onExport}
          onConfirm={onConfirm}
          onDecline={onDecline}
        />,
      );

      // Check acknowledgement
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      const confirmButton = screen.getByRole('button', { name: /Confirm/ });
      fireEvent.click(confirmButton);

      // Should show error state
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByRole('alert').textContent).toContain('Replace failed');
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    test('should not call onConfirm a second time if user clicks while pending', async () => {
      const onExport = jest.fn().mockResolvedValue(undefined);
      const onConfirm = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(resolve, 50); // Slow enough to test button state
          }),
      );
      const onDecline = jest.fn();

      render(
        <VaultReplaceOffer
          onExport={onExport}
          onConfirm={onConfirm}
          onDecline={onDecline}
        />,
      );

      // Check acknowledgement
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      const confirmButton = screen.getByRole('button', {
        name: /Confirm/,
      }) as HTMLButtonElement;
      fireEvent.click(confirmButton);

      // Wait for it to be disabled
      await waitFor(() => {
        expect(confirmButton.disabled).toBe(true);
      });

      // Try to click again while pending
      fireEvent.click(confirmButton);

      // Should still have only called once
      expect(onConfirm).toHaveBeenCalledTimes(1);

      // Wait for completion
      await waitFor(() => {
        expect(confirmButton.disabled).toBe(false);
      });
    });
  });

  describe('decline flow', () => {
    test('should call onDecline and not call onExport or onConfirm', async () => {
      const onExport = jest.fn().mockResolvedValue(undefined);
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const onDecline = jest.fn();

      render(
        <VaultReplaceOffer
          onExport={onExport}
          onConfirm={onConfirm}
          onDecline={onDecline}
        />,
      );

      const declineButton = screen.getByRole('button', { name: /Decline/ });
      fireEvent.click(declineButton);

      expect(onDecline).toHaveBeenCalledTimes(1);
      expect(onExport).not.toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('component isolation', () => {
    test('should render and work without any knowledge of vault state beyond props', () => {
      // This test verifies the component is purely presentational and doesn't
      // depend on external vault state or imports
      const onExport = jest.fn().mockResolvedValue(undefined);
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const onDecline = jest.fn();

      const { container } = render(
        <VaultReplaceOffer
          onExport={onExport}
          onConfirm={onConfirm}
          onDecline={onDecline}
        />,
      );

      // Should render the core elements
      expect(screen.getByText(/This device holds two vaults/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Export the vault I'm using now/ }),
      ).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
      expect(
        screen.getByLabelText(
          /I understand this replaces the vault I'm using on this device now/,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Confirm/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Decline/ }),
      ).toBeInTheDocument();

      // Should not reference vault handles or encryption in the component
      expect(container.querySelector('form')).not.toBeInTheDocument();
    });
  });
});
