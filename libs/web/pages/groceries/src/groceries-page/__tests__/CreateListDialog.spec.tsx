/*
  Tests for CreateListDialog component.
  - Mocks @myorganizer/web-ui Dialog, Input, Button components
  - Covers form submission, validation, error handling, and state management
*/

/** Mocking rule: place jest.mock calls before any imports */
jest.mock('@myorganizer/web-ui', () => {
  const React = require('react');

  const DialogContext = React.createContext<any>(null);

  function Dialog({ open, onOpenChange, children }: any) {
    React.useEffect(() => {
      onOpenChange?.(open);
    }, [open, onOpenChange]);

    return (
      <DialogContext.Provider value={{ onOpenChange }}>
        <div data-testid="dialog" data-open={open ? 'true' : 'false'}>
          {open && children}
        </div>
      </DialogContext.Provider>
    );
  }

  function DialogContent({ children, className }: any) {
    return (
      <div data-testid="dialog-content" className={className}>
        {children}
      </div>
    );
  }

  function DialogHeader({ children }: any) {
    return <div data-testid="dialog-header">{children}</div>;
  }

  function DialogTitle({ children }: any) {
    return <h2 data-testid="dialog-title">{children}</h2>;
  }

  function DialogDescription({ children }: any) {
    return <p data-testid="dialog-description">{children}</p>;
  }

  function DialogFooter({ children, className }: any) {
    return (
      <div data-testid="dialog-footer" className={className}>
        {children}
      </div>
    );
  }

  function Input({
    placeholder,
    value,
    onChange,
    disabled,
    maxLength,
    className,
    autoFocus,
  }: any) {
    return (
      <input
        data-testid="list-name-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        maxLength={maxLength}
        className={className}
        autoFocus={autoFocus}
      />
    );
  }

  function Button({ children, type, variant, onClick, disabled }: any) {
    const testId = type === 'submit' ? 'button-submit' : 'button-cancel';
    return (
      <button
        data-testid={testId}
        type={type}
        data-variant={variant}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    );
  }

  return {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Button,
  };
});

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CreateListDialog } from '../components/CreateListDialog';

describe('CreateListDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ============================================
     Test Helpers
     ============================================ */

  function makeValidName(length = 10): string {
    return 'a'.repeat(Math.min(length, 100));
  }

  function makeInvalidName(maxOverflow = 1): string {
    return 'a'.repeat(100 + maxOverflow);
  }

  /* ============================================
     Happy Path - Form Submission
     ============================================ */

  it('should render dialog with title, description, input field, and buttons', () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('dialog-title')).toHaveTextContent(
      'Create New List',
    );
    expect(screen.getByTestId('dialog-description')).toHaveTextContent(
      'Give your list a name to get started',
    );
    expect(screen.getByTestId('list-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('button-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('button-submit')).toBeInTheDocument();
  });

  it('should focus input field when dialog opens', () => {
    const { rerender } = render(
      <CreateListDialog
        isOpen={false}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    rerender(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    expect(input).toHaveFocus();
  });

  it('should disable submit button when name is empty', () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const submitButton = screen.getByTestId('button-submit');
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when name has content', () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'My List' } });

    const submitButton = screen.getByTestId('button-submit');
    expect(submitButton).not.toBeDisabled();
  });

  it('should update character counter as user types', () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText('0 / 100 characters')).toBeInTheDocument();

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Shopping' } });

    expect(screen.getByText('8 / 100 characters')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: makeValidName(50) } });
    expect(screen.getByText('50 / 100 characters')).toBeInTheDocument();
  });

  it('should call onSubmit with trimmed name and reset form on success', async () => {
    mockOnSubmit.mockResolvedValue(undefined);

    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  My Shopping List  ' } });

    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith('My Shopping List');
    });

    expect(input.value).toBe('');
    expect(screen.getByText('0 / 100 characters')).toBeInTheDocument();
    expect(
      screen.queryByText(/list name|failed to create/i),
    ).not.toBeInTheDocument();
  });

  it('should submit with unicode and special characters', async () => {
    mockOnSubmit.mockResolvedValue(undefined);

    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    const unicodeName = '📚 Café & 书店 @2026';
    fireEvent.change(input, { target: { value: unicodeName } });

    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(unicodeName);
    });
  });

  it('should show "Creating..." text on submit button during submission', async () => {
    mockOnSubmit.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'My List' } });

    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    const submitButton = screen.getByTestId('button-submit');
    expect(submitButton).toHaveTextContent('Creating...');

    await waitFor(() => {
      expect(submitButton).toHaveTextContent('Create List');
    });
  });

  it('should disable input and buttons during submission', async () => {
    mockOnSubmit.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 50)),
    );

    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'My List' } });

    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    const submitButton = screen.getByTestId('button-submit');
    const cancelButton = screen.getByTestId('button-cancel');

    expect(input).toBeDisabled();
    expect(submitButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();

    await waitFor(() => {
      expect(input).not.toBeDisabled();
      expect(cancelButton).not.toBeDisabled();
    });
  });

  /* ============================================
     Validation & Errors
     ============================================ */

  it('should display validation error for empty name', async () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('List name is required')).toBeInTheDocument();
    });
  });

  it('should display validation error for whitespace-only name', async () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });

    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('List name is required')).toBeInTheDocument();
    });
  });

  it('should display validation error for name exceeding 100 characters', async () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: makeInvalidName(5) } });

    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText('List name must be 100 characters or less'),
      ).toBeInTheDocument();
    });
  });

  it('should clear validation error when user starts typing', async () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('List name is required')).toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: 'N' } });

    expect(screen.queryByText('List name is required')).not.toBeInTheDocument();
  });

  it('should display error when onSubmit promise rejects', async () => {
    mockOnSubmit.mockRejectedValue(new Error('Network error'));

    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'My List' } });

    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Failed to create list')).toBeInTheDocument();
    });
  });

  it('should keep submit button disabled when validation error exists', async () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });

    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('List name is required')).toBeInTheDocument();
    });

    const submitButton = screen.getByTestId('button-submit');
    expect(submitButton).toBeDisabled();
  });

  it('should accept exactly 100 character name as valid', async () => {
    mockOnSubmit.mockResolvedValue(undefined);

    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    const exactName = makeValidName(100);
    fireEvent.change(input, { target: { value: exactName } });

    expect(screen.getByText('100 / 100 characters')).toBeInTheDocument();

    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(exactName);
    });
  });

  /* ============================================
     State Management & Interactions
     ============================================ */

  it('should close dialog and call onClose when Cancel button is clicked', () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const cancelButton = screen.getByTestId('button-cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should reset form state when dialog is closed via onOpenChange', () => {
    const { rerender } = render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'My List' } });

    expect(input.value).toBe('My List');

    rerender(
      <CreateListDialog
        isOpen={false}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(mockOnClose).toHaveBeenCalled();

    rerender(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const reopenedInput = screen.getByTestId(
      'list-name-input',
    ) as HTMLInputElement;
    expect(reopenedInput.value).toBe('');
  });

  it('should disable input and buttons when isLoading=true', () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={true}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    const submitButton = screen.getByTestId('button-submit');
    const cancelButton = screen.getByTestId('button-cancel');

    expect(input).toBeDisabled();
    expect(submitButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it('should show "Creating..." button text when isLoading=true', () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={true}
      />,
    );

    const submitButton = screen.getByTestId('button-submit');
    expect(submitButton).toHaveTextContent('Creating...');
  });

  it('should trim leading and trailing spaces before submission', async () => {
    mockOnSubmit.mockResolvedValue(undefined);

    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   Groceries   ' } });

    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith('Groceries');
    });
  });

  it('should enforce maxLength=100 on input field', () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    expect(input).toHaveAttribute('maxLength', '100');
  });

  it('should not call onSubmit when Cancel button is clicked', () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const input = screen.getByTestId('list-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'My List' } });

    const cancelButton = screen.getByTestId('button-cancel');
    fireEvent.click(cancelButton);

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should not display error message initially', () => {
    render(
      <CreateListDialog
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.queryByText(/list name|failed/i)).not.toBeInTheDocument();
  });
});
