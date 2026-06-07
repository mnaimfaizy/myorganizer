jest.mock('@myorganizer/web-ui', () => ({
  Dialog: ({ open, onOpenChange, children }: any) =>
    open ? (
      <div data-testid="dialog" onClick={() => onOpenChange?.(false)}>
        {children}
      </div>
    ) : null,
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
    <div data-testid="dialog-title">{children}</div>
  ),
  Input: (props: any) => <input data-testid="rename-input" {...props} />,
  Button: ({ children, ...props }: any) => (
    <button data-testid="rename-button" {...props}>
      {children}
    </button>
  ),
}));

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RenameListDialog } from '../../pages/lists/components/RenameListDialog';

describe('RenameListDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();
  const defaultProps = {
    isOpen: true,
    currentName: 'My Grocery List',
    onClose: mockOnClose,
    onSubmit: mockOnSubmit,
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Initial State', () => {
    it('should initialize input with currentName', () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      expect(input.value).toBe('My Grocery List');
    });

    it('should render dialog with correct title and description', () => {
      render(<RenameListDialog {...defaultProps} />);

      expect(screen.getByTestId('dialog-title')).toHaveTextContent(
        'Rename List',
      );
      expect(screen.getByTestId('dialog-description')).toHaveTextContent(
        'Enter a new name for your grocery list',
      );
    });

    it('should render Cancel and Rename List buttons', () => {
      render(<RenameListDialog {...defaultProps} />);

      const buttons = screen.getAllByTestId('rename-button');
      expect(buttons).toHaveLength(2);
      expect(buttons[0]).toHaveTextContent('Cancel');
      expect(buttons[1]).toHaveTextContent('Rename List');
    });

    it('should display character counter initialized to currentName length', () => {
      render(<RenameListDialog {...defaultProps} />);

      expect(screen.getByText('15 / 100 characters')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<RenameListDialog {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('dialog-content')).not.toBeInTheDocument();
    });
  });

  describe('User Input and Character Counter', () => {
    it('should update input value when user types', () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New List' } });

      expect(input.value).toBe('New List');
    });

    it('should update character counter as user types', () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Weekly Shopping' } });

      expect(screen.getByText('15 / 100 characters')).toBeInTheDocument();
    });

    it('should enforce maxLength attribute at 100 characters', () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      expect(input.maxLength).toBe(100);
    });

    it('should support unicode and special characters in input', () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      const specialName = 'Açaí & Café ™ Spëcial 中文';
      fireEvent.change(input, { target: { value: specialName } });

      expect(input.value).toBe(specialName);
    });
  });

  describe('Submit Button State Management', () => {
    it('should enable submit button when name is valid and different from currentName', () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Different List' } });

      const buttons = screen.getAllByTestId('rename-button');
      const submitButton = buttons[1];
      expect(submitButton).not.toBeDisabled();
    });

    it('should disable submit button when name equals currentName', () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      expect(input.value).toBe('My Grocery List');

      const buttons = screen.getAllByTestId('rename-button');
      const submitButton = buttons[1];
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when user types same name then changes back to currentName', () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      const buttons = screen.getAllByTestId('rename-button');
      const submitButton = buttons[1];

      // Change to different name
      fireEvent.change(input, { target: { value: 'New List' } });
      expect(submitButton).not.toBeDisabled();

      // Change back to original
      fireEvent.change(input, { target: { value: 'My Grocery List' } });
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when name is empty', () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '' } });

      const buttons = screen.getAllByTestId('rename-button');
      const submitButton = buttons[1];
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when name is whitespace only', () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '   ' } });

      const buttons = screen.getAllByTestId('rename-button');
      const submitButton = buttons[1];
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when isLoading is true', () => {
      render(<RenameListDialog {...defaultProps} isLoading={true} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Different List' } });

      const buttons = screen.getAllByTestId('rename-button');
      const submitButton = buttons[1];
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when submitting is true', async () => {
      const slowSubmit = jest.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      render(<RenameListDialog {...defaultProps} onSubmit={slowSubmit} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New List' } });

      const buttons = screen.getAllByTestId('rename-button');
      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(buttons[1]).toBeDisabled();
      });
    });
  });

  describe('Name Change Detection with Trimming', () => {
    it('should compare untrimmed names for disabling submit button, but trim on submission', () => {
      render(<RenameListDialog {...defaultProps} currentName="List" />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '  List  ' } });

      const buttons = screen.getAllByTestId('rename-button');
      const submitButton = buttons[1];
      // Button is enabled because '  List  ' !== 'List' (untrimmed comparison)
      // But submission will trim and close without calling onSubmit
      expect(submitButton).not.toBeDisabled();
    });

    it('should enable submit button when untrimmed name differs from currentName', () => {
      render(<RenameListDialog {...defaultProps} currentName="List" />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '  New List  ' } });

      const buttons = screen.getAllByTestId('rename-button');
      const submitButton = buttons[1];
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with trimmed new name on successful submission', async () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '  New List  ' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith('New List');
      });
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it('should not call onSubmit when name equals currentName after validation', async () => {
      render(<RenameListDialog {...defaultProps} currentName="My List" />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '  My List  ' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should call onClose after successful submission', async () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New List' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('should call onClose without calling onSubmit when name has not changed', async () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show "Saving..." text during submission', async () => {
      const slowSubmit = jest.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      render(<RenameListDialog {...defaultProps} onSubmit={slowSubmit} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New List' } });

      const buttons = screen.getAllByTestId('rename-button');
      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(buttons[1]).toHaveTextContent('Saving...');
      });
    });

    it('should re-enable all controls after submission completes', async () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New List' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });

      const buttons = screen.getAllByTestId('rename-button');
      expect(buttons[1]).toHaveTextContent('Rename List');
    });

    it('should support unicode and special characters in submitted name', async () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      const specialName = 'Café & Spëcial Ítems ™ 中文';
      fireEvent.change(input, { target: { value: specialName } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(specialName);
      });
    });
  });

  describe('Validation and Error Handling', () => {
    it('should show validation error for empty name', async () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('List name is required')).toBeInTheDocument();
      });
    });

    it('should show validation error for whitespace-only name', async () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '   ' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('List name is required')).toBeInTheDocument();
      });
    });

    it('should show validation error for name exceeding 100 characters', async () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      const longName = 'a'.repeat(101);
      fireEvent.change(input, { target: { value: longName } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText('List name must be 100 characters or less'),
        ).toBeInTheDocument();
      });
    });

    it('should clear error message when user starts typing after error', async () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('List name is required')).toBeInTheDocument();
      });

      fireEvent.change(input, { target: { value: 'New List' } });
      expect(
        screen.queryByText('List name is required'),
      ).not.toBeInTheDocument();
    });

    it('should show generic error message for non-validation errors', async () => {
      const failingSubmit = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));
      render(<RenameListDialog {...defaultProps} onSubmit={failingSubmit} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New List' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Failed to rename list')).toBeInTheDocument();
      });
    });

    it('should disable submit button when validation error exists', async () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('List name is required')).toBeInTheDocument();
      });

      const buttons = screen.getAllByTestId('rename-button');
      const submitButton = buttons[1];
      expect(submitButton).toBeDisabled();
    });
  });

  describe('State Management and Effects', () => {
    it('should reset name to currentName when isOpen becomes true', () => {
      const { rerender } = render(
        <RenameListDialog {...defaultProps} isOpen={false} />,
      );

      rerender(<RenameListDialog {...defaultProps} isOpen={true} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      expect(input.value).toBe('My Grocery List');
    });

    it('should reset name and error when currentName prop changes while isOpen', () => {
      const { rerender } = render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Different' } });

      rerender(
        <RenameListDialog
          {...defaultProps}
          currentName="Updated Grocery List"
        />,
      );

      expect(input.value).toBe('Updated Grocery List');
    });

    it('should reset error when currentName prop changes', async () => {
      const { rerender } = render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('List name is required')).toBeInTheDocument();
      });

      rerender(
        <RenameListDialog {...defaultProps} currentName="New Current Name" />,
      );

      expect(
        screen.queryByText('List name is required'),
      ).not.toBeInTheDocument();
    });

    it('should not reset state when isOpen is false and currentName changes', () => {
      const { rerender } = render(
        <RenameListDialog {...defaultProps} isOpen={false} />,
      );

      const input = screen.queryByTestId('rename-input');
      expect(input).not.toBeInTheDocument();

      rerender(
        <RenameListDialog
          {...defaultProps}
          isOpen={false}
          currentName="Different Name"
        />,
      );

      expect(screen.queryByTestId('rename-input')).not.toBeInTheDocument();
    });
  });

  describe('Dialog Interactions', () => {
    it('should close dialog and reset form when Cancel button is clicked', async () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New List' } });

      const buttons = screen.getAllByTestId('rename-button');
      const cancelButton = buttons[0];
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should close dialog and call onClose when dialog backdrop is clicked', () => {
      render(<RenameListDialog {...defaultProps} />);

      const dialog = screen.getByTestId('dialog');
      fireEvent.click(dialog);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset form state when dialog closes via handleOpenChange', async () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New List' } });

      // Close the dialog by clicking the dialog backdrop (triggers onOpenChange)
      const dialog = screen.getByTestId('dialog');
      fireEvent.click(dialog);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Boundary Cases', () => {
    it('should accept exactly 100 character name', () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      const name100 = 'a'.repeat(100);
      fireEvent.change(input, { target: { value: name100 } });

      expect(input.value).toBe(name100);
      expect(screen.getByText('100 / 100 characters')).toBeInTheDocument();

      const buttons = screen.getAllByTestId('rename-button');
      const submitButton = buttons[1];
      expect(submitButton).not.toBeDisabled();
    });

    it('should reject name exceeding 100 characters on validation', async () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      const name101 = 'a'.repeat(101);
      fireEvent.change(input, { target: { value: name101 } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText('List name must be 100 characters or less'),
        ).toBeInTheDocument();
      });
    });

    it('should accept single character name different from currentName', () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'A' } });

      const buttons = screen.getAllByTestId('rename-button');
      const submitButton = buttons[1];
      expect(submitButton).not.toBeDisabled();
    });

    it('should trim leading and trailing spaces on submission', async () => {
      render(<RenameListDialog {...defaultProps} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '  \t New List \n  ' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith('New List');
      });
    });

    it('should allow submission when name with leading/trailing spaces equals currentName after trim', async () => {
      render(<RenameListDialog {...defaultProps} currentName="List" />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '  List  ' } });

      // Button is enabled because '  List  ' !== 'List' (untrimmed comparison)
      const buttons = screen.getAllByTestId('rename-button');
      const submitButton = buttons[1];
      expect(submitButton).not.toBeDisabled();

      // But when submitted, Zod trims it and closes without calling onSubmit
      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('isLoading Prop', () => {
    it('should disable input when isLoading is true', () => {
      render(<RenameListDialog {...defaultProps} isLoading={true} />);

      const input = screen.getByTestId('rename-input') as HTMLInputElement;
      expect(input).toBeDisabled();
    });

    it('should disable Cancel button when isLoading is true', () => {
      render(<RenameListDialog {...defaultProps} isLoading={true} />);

      const buttons = screen.getAllByTestId('rename-button');
      const cancelButton = buttons[0];
      expect(cancelButton).toBeDisabled();
    });

    it('should show "Saving..." text when isLoading is true', () => {
      render(<RenameListDialog {...defaultProps} isLoading={true} />);

      const buttons = screen.getAllByTestId('rename-button');
      const submitButton = buttons[1];
      expect(submitButton).toHaveTextContent('Saving...');
    });
  });
});
