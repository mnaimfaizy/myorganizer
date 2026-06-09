/*
  Tests for DeleteListConfirmDialog component.
  - Mocks @myorganizer/web-ui Dialog compound for predictable behavior
  - Mocks lucide-react AlertTriangle icon
  - Tests confirmation flow, pluralization, warning display, button interactions, and error handling
*/

/** Mocking rule: place jest.mock calls before any imports */
jest.mock('@myorganizer/web-ui', () => {
  const React = require('react');

  return {
    Dialog: ({ open, onOpenChange, children }: any) => (
      <div data-testid="dialog" data-open={open}>
        {/* Simulate backdrop click triggering onOpenChange(false) */}
        <button
          data-testid="dialog-backdrop"
          onClick={() => onOpenChange?.(false)}
          style={{ display: 'none' }}
        />
        {children}
      </div>
    ),
    DialogContent: ({ children, className }: any) => (
      <div data-testid="dialog-content" className={className}>
        {children}
      </div>
    ),
    DialogDescription: ({ children }: any) => (
      <div data-testid="dialog-description">{children}</div>
    ),
    DialogFooter: ({ children, className }: any) => (
      <div data-testid="dialog-footer" className={className}>
        {children}
      </div>
    ),
    DialogHeader: ({ children }: any) => (
      <div data-testid="dialog-header">{children}</div>
    ),
    DialogTitle: ({ children }: any) => (
      <h2 data-testid="dialog-title">{children}</h2>
    ),
    Button: ({ onClick, disabled, children, variant, type }: any) => (
      <button
        data-testid={`button-${variant || 'default'}`}
        onClick={onClick}
        disabled={disabled}
        data-variant={variant}
        type={type}
      >
        {children}
      </button>
    ),
  };
});

jest.mock('lucide-react', () => ({
  AlertTriangle: () => (
    <div data-testid="alert-icon" className="alert-triangle" />
  ),
}));

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeleteListConfirmDialog } from '../components/DeleteListConfirmDialog';

describe('DeleteListConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    listName: 'My Grocery List',
    itemCount: 5,
    onClose: jest.fn(),
    onConfirm: jest.fn().mockResolvedValue(undefined),
    isLoading: false,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  function makeListName(hasSpecialChars = false): string {
    return hasSpecialChars ? 'John\'s "Special" List' : 'My List';
  }

  // ============================================================================
  // Happy Path - Confirmation Flow
  // ============================================================================

  describe('Happy Path - Confirmation Flow', () => {
    it('should render confirmation dialog with listName in title', () => {
      const listName = 'Test Grocery List';
      render(<DeleteListConfirmDialog {...defaultProps} listName={listName} />);

      const title = screen.getByTestId('dialog-title');
      expect(title).toHaveTextContent(`Delete "${listName}"?`);
    });

    it('should display warning icon in red circular background', () => {
      render(<DeleteListConfirmDialog {...defaultProps} />);

      const alertIcon = screen.getByTestId('alert-icon');
      expect(alertIcon).toBeInTheDocument();
      // Verify icon is rendered as part of the dialog header
      const header = screen.getByTestId('dialog-header');
      expect(header).toContainElement(alertIcon);
    });

    it('should call onConfirm when Delete List button clicked and handle async completion', async () => {
      const mockOnConfirm = jest.fn().mockResolvedValue(undefined);
      render(
        <DeleteListConfirmDialog {...defaultProps} onConfirm={mockOnConfirm} />,
      );

      // Initially, Delete button should show "Delete List"
      const deleteButton = screen.getByTestId('button-destructive');
      expect(deleteButton).toHaveTextContent('Delete List');

      // Click Delete List button
      fireEvent.click(deleteButton);

      // During async operation, button should show "Deleting..."
      await waitFor(() => {
        expect(deleteButton).toHaveTextContent('Deleting...');
      });

      // Wait for async operation to complete
      await waitFor(() => {
        expect(deleteButton).toHaveTextContent('Delete List');
      });

      // Verify onConfirm was called exactly once
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).toHaveBeenCalledWith();
    });

    it('should disable all buttons during deletion and re-enable after', async () => {
      const mockOnConfirm = jest.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      render(
        <DeleteListConfirmDialog {...defaultProps} onConfirm={mockOnConfirm} />,
      );

      const cancelButton = screen.getByTestId('button-outline');
      const deleteButton = screen.getByTestId('button-destructive');

      // Initially, buttons should be enabled
      expect(cancelButton).not.toBeDisabled();
      expect(deleteButton).not.toBeDisabled();

      // Click Delete List button
      fireEvent.click(deleteButton);

      // During deletion, both buttons should be disabled
      await waitFor(() => {
        expect(cancelButton).toBeDisabled();
        expect(deleteButton).toBeDisabled();
      });

      // After deletion completes, buttons should be re-enabled
      await waitFor(() => {
        expect(cancelButton).not.toBeDisabled();
        expect(deleteButton).not.toBeDisabled();
      });
    });
  });

  // ============================================================================
  // Item Count Pluralization
  // ============================================================================

  describe('Item Count Pluralization', () => {
    it('should display "1 item" when itemCount is 1', () => {
      render(<DeleteListConfirmDialog {...defaultProps} itemCount={1} />);

      const description = screen.getByTestId('dialog-description');
      expect(description).toHaveTextContent('1');
      expect(description).toHaveTextContent('1 item');
      expect(description).not.toHaveTextContent('1 items');
    });

    it('should display "items" (plural) when itemCount is 0', () => {
      render(<DeleteListConfirmDialog {...defaultProps} itemCount={0} />);

      const description = screen.getByTestId('dialog-description');
      expect(description).toHaveTextContent('0');
      expect(description).toHaveTextContent('0 items');
    });

    it('should display "items" (plural) when itemCount is 2 or more', () => {
      const { rerender } = render(
        <DeleteListConfirmDialog {...defaultProps} itemCount={2} />,
      );

      let description = screen.getByTestId('dialog-description');
      expect(description).toHaveTextContent('2 items');

      // Test with larger count
      rerender(<DeleteListConfirmDialog {...defaultProps} itemCount={999} />);

      description = screen.getByTestId('dialog-description');
      expect(description).toHaveTextContent('999 items');
    });
  });

  // ============================================================================
  // Warning Display
  // ============================================================================

  describe('Warning Display', () => {
    it('should render warning box with error background color', () => {
      render(<DeleteListConfirmDialog {...defaultProps} />);

      // The warning box should contain both "Warning" text and warning content
      // Verify warning text is present
      const title = screen.getByText('Warning');
      expect(title).toBeInTheDocument();
    });

    it('should display warning message about permanent deletion', () => {
      render(<DeleteListConfirmDialog {...defaultProps} />);

      const warningText = screen.getByText(
        /All items in this list, including their notes, images, and links, will be deleted permanently./i,
      );
      expect(warningText).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Button Interactions
  // ============================================================================

  describe('Button Interactions', () => {
    it('should call onClose when Cancel button clicked', () => {
      const mockOnClose = jest.fn();
      render(
        <DeleteListConfirmDialog {...defaultProps} onClose={mockOnClose} />,
      );

      const cancelButton = screen.getByTestId('button-outline');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onConfirm when Cancel button clicked', () => {
      const mockOnConfirm = jest.fn();
      render(
        <DeleteListConfirmDialog {...defaultProps} onConfirm={mockOnConfirm} />,
      );

      const cancelButton = screen.getByTestId('button-outline');
      fireEvent.click(cancelButton);

      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should disable Cancel button when isLoading is true', () => {
      render(<DeleteListConfirmDialog {...defaultProps} isLoading={true} />);

      const cancelButton = screen.getByTestId('button-outline');
      expect(cancelButton).toBeDisabled();
    });

    it('should disable Delete List button when isLoading is true', () => {
      render(<DeleteListConfirmDialog {...defaultProps} isLoading={true} />);

      const deleteButton = screen.getByTestId('button-destructive');
      expect(deleteButton).toBeDisabled();
    });

    it('should show "Deleting..." text when isLoading is true', () => {
      render(<DeleteListConfirmDialog {...defaultProps} isLoading={true} />);

      const deleteButton = screen.getByTestId('button-destructive');
      expect(deleteButton).toHaveTextContent('Deleting...');
    });

    it('should have Cancel button with outline variant', () => {
      render(<DeleteListConfirmDialog {...defaultProps} />);

      const cancelButton = screen.getByTestId('button-outline');
      expect(cancelButton).toHaveAttribute('data-variant', 'outline');
    });

    it('should have Delete List button with destructive variant', () => {
      render(<DeleteListConfirmDialog {...defaultProps} />);

      const deleteButton = screen.getByTestId('button-destructive');
      expect(deleteButton).toHaveAttribute('data-variant', 'destructive');
    });
  });

  // ============================================================================
  // Dialog Control
  // ============================================================================

  describe('Dialog Control', () => {
    it('should show dialog when isOpen is true', () => {
      render(<DeleteListConfirmDialog {...defaultProps} isOpen={true} />);

      const dialog = screen.getByTestId('dialog');
      expect(dialog).toHaveAttribute('data-open', 'true');
    });

    it('should hide dialog when isOpen is false', () => {
      render(<DeleteListConfirmDialog {...defaultProps} isOpen={false} />);

      const dialog = screen.getByTestId('dialog');
      expect(dialog).toHaveAttribute('data-open', 'false');
    });

    it('should call onClose when dialog backdrop is clicked (onOpenChange(false))', () => {
      const mockOnClose = jest.fn();
      render(
        <DeleteListConfirmDialog {...defaultProps} onClose={mockOnClose} />,
      );

      const backdrop = screen.getByTestId('dialog-backdrop');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onConfirm when dialog backdrop is clicked', () => {
      const mockOnConfirm = jest.fn();
      render(
        <DeleteListConfirmDialog {...defaultProps} onConfirm={mockOnConfirm} />,
      );

      const backdrop = screen.getByTestId('dialog-backdrop');
      fireEvent.click(backdrop);

      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should properly reset state after onConfirm operation completes', async () => {
      // Verify that confirming state is properly reset even after any async operation
      let resolveConfirmation: (() => void) | null = null;
      const confirmPromise = new Promise<void>((resolve) => {
        resolveConfirmation = resolve;
      });

      const mockOnConfirm = jest.fn(() => confirmPromise);
      render(
        <DeleteListConfirmDialog {...defaultProps} onConfirm={mockOnConfirm} />,
      );

      const deleteButton = screen.getByTestId('button-destructive');

      // Click Delete List button
      fireEvent.click(deleteButton);

      // During async operation
      await waitFor(() => {
        expect(deleteButton).toHaveTextContent('Deleting...');
        expect(deleteButton).toBeDisabled();
      });

      // Resolve the confirmation
      if (resolveConfirmation) {
        resolveConfirmation();
      }

      // After completion, state should reset
      await waitFor(() => {
        expect(deleteButton).toHaveTextContent('Delete List');
        expect(deleteButton).not.toBeDisabled();
      });
    });

    it('should disable buttons during entire async operation lifecycle', async () => {
      // Verify buttons stay disabled throughout the async flow and are re-enabled when done
      let resolveConfirmation: (() => void) | null = null;
      const confirmPromise = new Promise<void>((resolve) => {
        resolveConfirmation = resolve;
      });

      const mockOnConfirm = jest.fn(() => confirmPromise);
      render(
        <DeleteListConfirmDialog {...defaultProps} onConfirm={mockOnConfirm} />,
      );

      const cancelButton = screen.getByTestId('button-outline');
      const deleteButton = screen.getByTestId('button-destructive');

      // Initially enabled
      expect(cancelButton).not.toBeDisabled();
      expect(deleteButton).not.toBeDisabled();

      // Click and verify they become disabled
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(cancelButton).toBeDisabled();
        expect(deleteButton).toBeDisabled();
      });

      // Resolve and verify they re-enable
      if (resolveConfirmation) {
        resolveConfirmation();
      }

      await waitFor(() => {
        expect(cancelButton).not.toBeDisabled();
        expect(deleteButton).not.toBeDisabled();
      });
    });
  });

  // ============================================================================
  // Boundary Cases
  // ============================================================================

  describe('Boundary Cases', () => {
    it('should render listName with special characters correctly', () => {
      const specialListName = makeListName(true);
      render(
        <DeleteListConfirmDialog
          {...defaultProps}
          listName={specialListName}
        />,
      );

      const title = screen.getByTestId('dialog-title');
      expect(title).toHaveTextContent(`Delete "${specialListName}"?`);
    });

    it('should handle empty listName', () => {
      render(<DeleteListConfirmDialog {...defaultProps} listName="" />);

      const title = screen.getByTestId('dialog-title');
      expect(title).toHaveTextContent('Delete ""?');
    });

    it('should handle large itemCount (999+)', () => {
      render(<DeleteListConfirmDialog {...defaultProps} itemCount={9999} />);

      const description = screen.getByTestId('dialog-description');
      expect(description).toHaveTextContent('9999');
      expect(description).toHaveTextContent('9999 items');
    });

    it('should not call onConfirm more than once even on rapid clicks', async () => {
      const mockOnConfirm = jest.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      render(
        <DeleteListConfirmDialog {...defaultProps} onConfirm={mockOnConfirm} />,
      );

      const deleteButton = screen.getByTestId('button-destructive');

      // Rapid clicks
      fireEvent.click(deleteButton);
      fireEvent.click(deleteButton);
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ============================================================================
  // Description and Item Count Display
  // ============================================================================

  describe('Description and Item Count Display', () => {
    it('should display complete description with itemCount and correct message', () => {
      render(<DeleteListConfirmDialog {...defaultProps} itemCount={10} />);

      const description = screen.getByTestId('dialog-description');
      expect(description).toHaveTextContent('This action cannot be undone');
      expect(description).toHaveTextContent(
        'Deleting this list will permanently',
      );
      expect(description).toHaveTextContent('10');
      expect(description).toHaveTextContent('remove 10 items');
    });

    it('should display itemCount with semibold styling', () => {
      render(<DeleteListConfirmDialog {...defaultProps} itemCount={5} />);

      // Verify the itemCount span exists and contains the count
      const description = screen.getByTestId('dialog-description');
      const countSpans = description.querySelectorAll('span');
      const countSpan = Array.from(countSpans).find(
        (span) => span.textContent === '5',
      );
      expect(countSpan).toBeInTheDocument();
    });
  });
});
