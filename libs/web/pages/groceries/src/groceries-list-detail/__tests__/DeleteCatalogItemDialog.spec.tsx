/*
  Tests for DeleteCatalogItemDialog component.
  - Mocks @myorganizer/web-ui Dialog compound for predictable behavior
  - Mocks lucide-react AlertTriangle icon
  - Covers null-guard rendering, pluralized affected-list-count copy,
    typed-confirmation gating (including trim behavior), confirm/loading
    flow, and cancel-resets-input behavior
*/

/** Mocking rule: place jest.mock calls before any imports */
jest.mock('@myorganizer/web-ui', () => {
  const React = require('react');

  function Dialog({ open, onOpenChange, children }: any) {
    if (!open) return null;
    return (
      <div data-testid="dialog-root">
        <div
          data-testid="dialog-backdrop"
          onClick={() => onOpenChange?.(false)}
        />
        {children}
      </div>
    );
  }

  const DialogContent = ({ children, className }: any) => (
    <div className={className}>{children}</div>
  );
  const DialogHeader = ({ children }: any) => <div>{children}</div>;
  const DialogTitle = ({ children }: any) => <h2>{children}</h2>;
  const DialogDescription = ({ children }: any) => <p>{children}</p>;
  const DialogFooter = ({ children }: any) => <div>{children}</div>;

  function Button({ children, onClick, disabled, type, variant }: any) {
    return (
      <button
        type={type}
        data-variant={variant}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    );
  }

  function Input(props: any) {
    const { className, ...rest } = props;
    return <input className={className} {...rest} />;
  }

  function Label({ children, htmlFor, className }: any) {
    return (
      <label htmlFor={htmlFor} className={className}>
        {children}
      </label>
    );
  }

  return {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    Button,
    Input,
    Label,
  };
});

jest.mock('lucide-react', () => ({
  AlertTriangle: () => <div data-testid="alert-icon" />,
}));

import type { CatalogItem } from '@myorganizer/core';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeleteCatalogItemDialog } from '../components/DeleteCatalogItemDialog';

describe('DeleteCatalogItemDialog', () => {
  function makeCatalogItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
    return {
      id: 'cat-1',
      name: 'Milk',
      category: 'dairy',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  const defaultProps = {
    isOpen: true,
    catalogItem: makeCatalogItem(),
    affectedListCount: 0,
    onClose: jest.fn(),
    onConfirm: jest.fn().mockResolvedValue(undefined),
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when catalogItem is null even if isOpen is true', () => {
    render(<DeleteCatalogItemDialog {...defaultProps} catalogItem={null} />);

    expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
  });

  it('shows the Catalog Item name in the title and the confirmation label', () => {
    render(<DeleteCatalogItemDialog {...defaultProps} />);

    expect(screen.getByText('Delete "Milk" from Catalog?')).toBeInTheDocument();
    expect(screen.getByText('Type "Milk" to confirm')).toBeInTheDocument();
  });

  it('shows "isn\'t currently on any other Grocery List" when affectedListCount is 0', () => {
    render(<DeleteCatalogItemDialog {...defaultProps} affectedListCount={0} />);

    expect(
      screen.getByText(/It isn't currently on any other Grocery List\./),
    ).toBeInTheDocument();
  });

  it('shows singular copy when affectedListCount is 1', () => {
    render(<DeleteCatalogItemDialog {...defaultProps} affectedListCount={1} />);

    expect(
      screen.getByText(/This will also remove it from 1 other Grocery List\./),
    ).toBeInTheDocument();
  });

  it('shows plural copy when affectedListCount is greater than 1', () => {
    render(<DeleteCatalogItemDialog {...defaultProps} affectedListCount={3} />);

    expect(
      screen.getByText(/This will also remove it from 3 other Grocery Lists\./),
    ).toBeInTheDocument();
  });

  it('keeps the destructive button disabled until the typed input exactly matches the name', () => {
    render(<DeleteCatalogItemDialog {...defaultProps} />);

    const input = screen.getByLabelText('Type "Milk" to confirm');
    const deleteButton = screen.getByText('Delete From Catalog');

    // No input
    expect(deleteButton).toBeDisabled();

    // Wrong/partial text
    fireEvent.change(input, { target: { value: 'Mil' } });
    expect(deleteButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'milk' } });
    expect(deleteButton).toBeDisabled();

    // Exact match
    fireEvent.change(input, { target: { value: 'Milk' } });
    expect(deleteButton).not.toBeDisabled();
  });

  it('enables the destructive button when the typed input matches after trimming surrounding whitespace', () => {
    render(<DeleteCatalogItemDialog {...defaultProps} />);

    const input = screen.getByLabelText('Type "Milk" to confirm');
    const deleteButton = screen.getByText('Delete From Catalog');

    fireEvent.change(input, { target: { value: '  Milk  ' } });
    expect(deleteButton).not.toBeDisabled();
  });

  it('calls onConfirm and shows the loading label while confirming, disabling the button', async () => {
    let resolveConfirm: (() => void) | null = null;
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    render(<DeleteCatalogItemDialog {...defaultProps} onConfirm={onConfirm} />);

    const input = screen.getByLabelText('Type "Milk" to confirm');
    fireEvent.change(input, { target: { value: 'Milk' } });

    const deleteButton = screen.getByText('Delete From Catalog');
    fireEvent.click(deleteButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText('Deleting...')).toBeInTheDocument();
      expect(screen.getByText('Deleting...')).toBeDisabled();
    });

    resolveConfirm!();

    await waitFor(() => {
      expect(screen.getByText('Delete From Catalog')).toBeInTheDocument();
    });
  });

  it('calls onClose when Cancel is clicked and clears the input on re-open', () => {
    const onClose = jest.fn();
    const { rerender } = render(
      <DeleteCatalogItemDialog {...defaultProps} onClose={onClose} />,
    );

    const input = screen.getByLabelText(
      'Type "Milk" to confirm',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Milk' } });
    expect(input.value).toBe('Milk');

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Close then re-open to verify the input was reset
    rerender(
      <DeleteCatalogItemDialog
        {...defaultProps}
        onClose={onClose}
        isOpen={false}
      />,
    );
    rerender(
      <DeleteCatalogItemDialog
        {...defaultProps}
        onClose={onClose}
        isOpen={true}
      />,
    );

    const reopenedInput = screen.getByLabelText(
      'Type "Milk" to confirm',
    ) as HTMLInputElement;
    expect(reopenedInput.value).toBe('');
  });
});
