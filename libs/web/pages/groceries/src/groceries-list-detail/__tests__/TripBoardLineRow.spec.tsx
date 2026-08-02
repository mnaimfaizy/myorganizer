/** Mocking rule: place jest.mock calls before any imports. */
const mockDropdownSelectEvent = {
  preventDefault: jest.fn(),
};

jest.mock('@myorganizer/web-ui', () => {
  const React = require('react') as typeof import('react');

  const MenuContext = React.createContext<{
    isOpen: boolean;
    toggle: (next?: boolean) => void;
  } | null>(null);

  function DropdownMenu({ open, onOpenChange, children }: any) {
    const [isOpen, setIsOpen] = React.useState(Boolean(open));

    React.useEffect(() => setIsOpen(Boolean(open)), [open]);

    const toggle = React.useCallback(
      (next?: boolean) => {
        const n = typeof next === 'boolean' ? next : !isOpen;
        setIsOpen(n);
        onOpenChange?.(n);
      },
      [isOpen, onOpenChange],
    );

    return (
      <MenuContext.Provider value={{ isOpen, toggle }}>
        <div>{children}</div>
      </MenuContext.Provider>
    );
  }

  function DropdownMenuTrigger({ onClick, children, ...rest }: any) {
    const ctx = React.useContext(MenuContext);
    return (
      <button
        type="button"
        onClick={(e) => {
          onClick?.(e);
          ctx?.toggle?.();
        }}
        {...rest}
      >
        {children}
      </button>
    );
  }

  function DropdownMenuContent({ children }: any) {
    const ctx = React.useContext(MenuContext);
    if (!ctx?.isOpen) return null;
    return <div data-testid="dropdown-content">{children}</div>;
  }

  function DropdownMenuItem({ onClick, onSelect, children, ...rest }: any) {
    return (
      <button
        type="button"
        onClick={(e) => {
          if (onSelect) {
            mockDropdownSelectEvent.preventDefault.mockClear();
            onSelect({
              preventDefault: (...args: unknown[]) =>
                mockDropdownSelectEvent.preventDefault(...args),
            });
          }
          onClick?.(e);
        }}
        {...rest}
      >
        {children}
      </button>
    );
  }

  function DropdownMenuSeparator() {
    return <hr data-testid="dropdown-separator" />;
  }

  function Checkbox({ checked, onCheckedChange, disabled, ...rest }: any) {
    return (
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onCheckedChange?.(!checked)}
        disabled={disabled}
        {...rest}
      />
    );
  }

  return {
    Checkbox,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  };
});

jest.mock('lucide-react', () => ({
  AlertTriangle: () => <span data-testid="alert-icon" />,
  Edit2: () => <span data-testid="edit-icon" />,
  FileText: () => <span data-testid="file-text-icon" />,
  Link2: () => <span data-testid="link-icon" />,
  MoreVertical: () => <span data-testid="more-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
}));

import type { CatalogItem, ListLine } from '@myorganizer/core';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TripBoardLineRow } from '../components/TripBoardLineRow';

const DATE = '2026-01-01T00:00:00.000Z';

function makeCatalogItem(id: string, name: string): CatalogItem {
  return {
    id,
    name,
    category: 'produce',
    createdAt: DATE,
    updatedAt: DATE,
  };
}

function makeLine(id: string, catalogItemId: string): ListLine {
  return {
    id,
    catalogItemId,
    checked: false,
    createdAt: DATE,
    updatedAt: DATE,
  };
}

describe('TripBoardLineRow', () => {
  const catalogItem = makeCatalogItem('c1', 'Milk');
  const line = makeLine('ln1', 'c1');

  beforeEach(() => {
    jest.clearAllMocks();
    mockDropdownSelectEvent.preventDefault.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('invokes Edit List Line from the visible pencil control', () => {
    const onEditListLine = jest.fn();

    render(
      <TripBoardLineRow
        line={line}
        catalogItem={catalogItem}
        onToggleChecked={jest.fn()}
        onDeleteLine={jest.fn()}
        onDeleteFromCatalog={jest.fn()}
        onEditListLine={onEditListLine}
        onEditCatalogItem={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Edit List Line for Milk' }),
    );

    expect(onEditListLine).toHaveBeenCalledWith('ln1');
  });

  it('invokes Edit Catalog Item from the More menu', () => {
    const onEditCatalogItem = jest.fn();

    render(
      <TripBoardLineRow
        line={line}
        catalogItem={catalogItem}
        onToggleChecked={jest.fn()}
        onDeleteLine={jest.fn()}
        onDeleteFromCatalog={jest.fn()}
        onEditListLine={jest.fn()}
        onEditCatalogItem={onEditCatalogItem}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'More actions for Milk' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Catalog Item' }));

    expect(onEditCatalogItem).toHaveBeenCalledWith('c1');
  });

  it('invokes Delete from Catalog from the More menu', () => {
    const onDeleteFromCatalog = jest.fn();

    render(
      <TripBoardLineRow
        line={line}
        catalogItem={catalogItem}
        onToggleChecked={jest.fn()}
        onDeleteLine={jest.fn()}
        onDeleteFromCatalog={onDeleteFromCatalog}
        onEditListLine={jest.fn()}
        onEditCatalogItem={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'More actions for Milk' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete from Catalog' }),
    );

    expect(onDeleteFromCatalog).toHaveBeenCalledWith('c1');
  });

  it('requires a second select to confirm Remove from list while keeping the menu open', () => {
    const onDeleteLine = jest.fn();

    render(
      <TripBoardLineRow
        line={line}
        catalogItem={catalogItem}
        onToggleChecked={jest.fn()}
        onDeleteLine={onDeleteLine}
        onDeleteFromCatalog={jest.fn()}
        onEditListLine={jest.fn()}
        onEditCatalogItem={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'More actions for Milk' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove from list' }));

    expect(onDeleteLine).not.toHaveBeenCalled();
    expect(mockDropdownSelectEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Confirm remove line' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove from list' }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm remove line' }),
    );

    expect(onDeleteLine).toHaveBeenCalledTimes(1);
    expect(onDeleteLine).toHaveBeenCalledWith('ln1');
  });

  it('resets armed remove confirm after 3 seconds without deleting', () => {
    jest.useFakeTimers();
    const onDeleteLine = jest.fn();

    render(
      <TripBoardLineRow
        line={line}
        catalogItem={catalogItem}
        onToggleChecked={jest.fn()}
        onDeleteLine={onDeleteLine}
        onDeleteFromCatalog={jest.fn()}
        onEditListLine={jest.fn()}
        onEditCatalogItem={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'More actions for Milk' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove from list' }));

    expect(
      screen.getByRole('button', { name: 'Confirm remove line' }),
    ).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(onDeleteLine).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Remove from list' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Confirm remove line' }),
    ).not.toBeInTheDocument();
  });

  it('clears the confirm timer on unmount so it cannot fire afterward', () => {
    jest.useFakeTimers();
    const onDeleteLine = jest.fn();

    const { unmount } = render(
      <TripBoardLineRow
        line={line}
        catalogItem={catalogItem}
        onToggleChecked={jest.fn()}
        onDeleteLine={onDeleteLine}
        onDeleteFromCatalog={jest.fn()}
        onEditListLine={jest.fn()}
        onEditCatalogItem={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'More actions for Milk' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove from list' }));

    unmount();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(onDeleteLine).not.toHaveBeenCalled();
  });
});
