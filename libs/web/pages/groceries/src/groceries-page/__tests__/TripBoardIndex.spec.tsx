/** Mocking rule: place jest.mock calls before any imports. */
const mockToast = jest.fn();

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
        <div data-testid="dropdown">{children}</div>
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

  function DropdownMenuItem({ onClick, children }: any) {
    return (
      <button type="button" data-testid="dropdown-item" onClick={onClick}>
        {children}
      </button>
    );
  }

  function Dialog({ open, onOpenChange, children }: any) {
    if (!open) return null;
    return (
      <div data-testid="dialog-root" role="dialog">
        {children}
        <button
          type="button"
          data-testid="dialog-backdrop"
          onClick={() => onOpenChange?.(false)}
        >
          Close backdrop
        </button>
      </div>
    );
  }

  const DialogContent = ({ children }: any) => <div>{children}</div>;

  function Button({ children, onClick, disabled, type }: any) {
    return (
      <button type={type ?? 'button'} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    );
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
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
      <input {...props} />
    ),
    Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => (
      <label {...props} />
    ),
    useToast: () => ({ toast: mockToast }),
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    Dialog,
    DialogContent,
    Button,
    Checkbox,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  };
});

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('lucide-react', () => ({
  MoreVertical: () => <span data-testid="more-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
  Lock: () => <span data-testid="lock-icon" />,
  Search: () => <span data-testid="search-icon" />,
}));

let latestAddExistingSubmit:
  | ((
      catalogItemId: string,
      listIds: string[],
      amount?: string,
    ) => Promise<string[] | void>)
  | undefined;

jest.mock(
  '../../groceries-list-detail/components/AddExistingItemDialog',
  () => {
    const actual = jest.requireActual(
      '../../groceries-list-detail/components/AddExistingItemDialog',
    ) as typeof import('../../groceries-list-detail/components/AddExistingItemDialog');

    return {
      AddExistingItemDialog: (
        props: React.ComponentProps<typeof actual.AddExistingItemDialog>,
      ) => {
        latestAddExistingSubmit = props.onAdd;
        return actual.AddExistingItemDialog(props);
      },
    };
  },
);

import type { CatalogItem, GroceryList, ListLine } from '@myorganizer/core';
import '@testing-library/jest-dom';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { TripBoardIndex } from '../components/TripBoardIndex';

const DATE = '2026-01-01T00:00:00.000Z';

function makeCatalogItem(
  id: string,
  name: string,
  category: CatalogItem['category'] = 'produce',
  overrides: Partial<CatalogItem> = {},
): CatalogItem {
  return {
    id,
    name,
    category,
    createdAt: DATE,
    updatedAt: DATE,
    ...overrides,
  };
}

function makeList(
  id: string,
  name: string,
  catalogItemIds: string[],
  lineOverrides: Partial<ListLine>[] = [],
): GroceryList {
  const lines: ListLine[] = catalogItemIds.map((catalogItemId, index) => ({
    id: `${id}-line-${index}`,
    catalogItemId,
    checked: false,
    createdAt: DATE,
    updatedAt: DATE,
    ...lineOverrides[index],
  }));
  return { id, name, lines, createdAt: DATE, updatedAt: DATE };
}

function renderTripBoard(
  props: Partial<{
    lists: GroceryList[];
    catalog: CatalogItem[];
    onRenameList: (id: string) => void;
    onDeleteList: (id: string) => void;
    onAddExistingItem: (
      catalogItemId: string,
      listIds: string[],
      amount?: string,
    ) => Promise<string[]>;
    isLoading?: boolean;
  }> & {
    lists: GroceryList[];
    catalog: CatalogItem[];
  },
) {
  const onAddExistingItem =
    props.onAddExistingItem ?? jest.fn().mockResolvedValue([]);
  return {
    onAddExistingItem,
    ...render(
      <TripBoardIndex
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
        onAddExistingItem={onAddExistingItem}
        {...props}
      />,
    ),
  };
}

describe('TripBoardIndex', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestAddExistingSubmit = undefined;
  });

  it('binds the search field to its label and results live region', () => {
    renderTripBoard({
      lists: [makeList('weekly', 'Weekly Shop', [])],
      catalog: [],
    });

    const search = screen.getByRole('textbox', {
      name: 'Search trips and staples',
    });
    expect(search).toHaveAttribute('id', 'trip-board-search');
    expect(search).toHaveAttribute('aria-describedby', 'trip-board-results');

    const results = document.getElementById('trip-board-results');
    expect(results).toHaveAttribute('aria-live', 'polite');
  });

  it('filters trips by list name and catalog line names case-insensitively', () => {
    const catalog = [
      makeCatalogItem('milk', 'Milk', 'dairy'),
      makeCatalogItem('bread', 'Bread', 'bakery'),
    ];
    const lists = [
      makeList('weekly', 'Weekly Shop', ['milk']),
      makeList('hardware', 'Hardware Run', ['bread']),
    ];

    renderTripBoard({ lists, catalog });
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search trips and staples' }),
      { target: { value: 'MILK' } },
    );

    expect(
      screen.getByRole('link', { name: 'Weekly Shop' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Hardware Run' }),
    ).not.toBeInTheDocument();
    const staples = within(
      screen
        .getByRole('heading', { name: 'Staples catalog (2)' })
        .closest('section') as HTMLElement,
    );
    expect(staples.getByText('Milk')).toBeInTheDocument();
    expect(staples.queryByText('Bread')).not.toBeInTheDocument();
    expect(
      screen.getByText('Showing 1 of 2 trips matching “MILK”'),
    ).toBeInTheDocument();
  });

  it('keeps a trip when any line resolves to a matching catalog item', () => {
    const catalog = [
      makeCatalogItem('apples', 'Green Apples'),
      makeCatalogItem('coffee', 'Coffee'),
    ];
    const lists = [
      makeList('fruit', 'Fruit Trip', ['apples']),
      makeList('cafe', 'Cafe Trip', ['coffee']),
    ];

    renderTripBoard({ lists, catalog });
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search trips and staples' }),
      { target: { value: 'apples' } },
    );

    expect(
      screen.getByRole('link', { name: 'Fruit Trip' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Cafe Trip' }),
    ).not.toBeInTheDocument();
  });

  it('uses singular trip in the results live region when only one list exists', () => {
    renderTripBoard({
      lists: [makeList('solo', 'Solo Trip', [])],
      catalog: [],
    });

    expect(screen.getByText('Showing 1 of 1 trip')).toBeInTheDocument();
  });

  it('filters staples by category and tracks aria-pressed on chips', () => {
    const catalog = [
      makeCatalogItem('milk', 'Milk', 'dairy'),
      makeCatalogItem('lettuce', 'Lettuce', 'produce'),
    ];

    renderTripBoard({ lists: [], catalog });

    expect(
      screen.getByRole('heading', { name: 'Staples catalog (2)' }),
    ).toBeInTheDocument();

    const dairy = screen.getByRole('button', {
      name: 'Filter staples by Dairy',
    });
    fireEvent.click(dairy);

    expect(dairy).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.queryByText('Lettuce')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show all staples' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows on N lists meta only when a staple appears on more than one list', () => {
    const catalog = [
      makeCatalogItem('solo', 'Solo Staple', 'produce'),
      makeCatalogItem('shared', 'Shared Staple', 'dairy'),
    ];
    const lists = [
      makeList('a', 'Trip A', ['solo', 'shared']),
      makeList('b', 'Trip B', ['shared']),
    ];

    renderTripBoard({ lists, catalog });

    const staples = within(
      screen
        .getByRole('heading', { name: 'Staples catalog (2)' })
        .closest('section') as HTMLElement,
    );

    const soloRow = staples
      .getByText('Solo Staple')
      .closest('li') as HTMLElement;
    expect(within(soloRow).getByText('Produce')).toBeInTheDocument();
    expect(within(soloRow).queryByText(/on \d+ lists/)).not.toBeInTheDocument();

    const sharedRow = staples
      .getByText('Shared Staple')
      .closest('li') as HTMLElement;
    expect(
      within(sharedRow).getByText(/Dairy · on 2 lists/),
    ).toBeInTheDocument();
  });

  it('shows staple meta, formatted price, and an em dash when unpriced', () => {
    const catalog = [
      makeCatalogItem('oil', 'Olive Oil', 'condiments', { price: 4 }),
      makeCatalogItem('salt', 'Sea Salt', 'condiments', {
        notes: 'coarse',
      }),
      makeCatalogItem('rice', 'Rice', 'other'),
    ];
    const lists = [makeList('a', 'Trip A', ['salt'])];

    renderTripBoard({ lists, catalog });

    const staples = within(
      screen
        .getByRole('heading', { name: 'Staples catalog (3)' })
        .closest('section') as HTMLElement,
    );

    const oilRow = staples.getByText('Olive Oil').closest('li') as HTMLElement;
    expect(within(oilRow).getByText('$4.00')).toBeInTheDocument();
    expect(within(oilRow).getByText('Condiments')).toBeInTheDocument();

    const saltRow = staples.getByText('Sea Salt').closest('li') as HTMLElement;
    expect(
      within(saltRow).getByText(/Condiments · has notes/),
    ).toBeInTheDocument();

    const riceRow = staples.getByText('Rice').closest('li') as HTMLElement;
    expect(within(riceRow).getByText('—')).toBeInTheDocument();
  });

  it('disables add when an item is on every trip or while loading', () => {
    const catalog = [makeCatalogItem('milk', 'Milk', 'dairy')];
    const lists = [
      makeList('a', 'Trip A', ['milk']),
      makeList('b', 'Trip B', ['milk']),
    ];

    const { rerender } = render(
      <TripBoardIndex
        lists={lists}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
        onAddExistingItem={jest.fn()}
        isLoading={false}
      />,
    );

    const onAllTrips = screen.getByRole('button', {
      name: 'Milk is on all trips',
    });
    expect(onAllTrips).toBeDisabled();
    expect(onAllTrips).toHaveTextContent('On all trips');

    rerender(
      <TripBoardIndex
        lists={[makeList('solo', 'Solo', [])]}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
        onAddExistingItem={jest.fn()}
        isLoading={true}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Add Milk to trip' }),
    ).toBeDisabled();
  });

  it('shows a status message when no staples match the current filters', () => {
    renderTripBoard({
      lists: [makeList('trip', 'Weekly Shop', [])],
      catalog: [makeCatalogItem('milk', 'Milk')],
    });

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search trips and staples' }),
      { target: { value: 'zzzz' } },
    );

    expect(screen.getByRole('status')).toHaveTextContent('No catalog matches');
    expect(
      screen.getByText('Showing 0 of 1 trip matching “zzzz”'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Weekly Shop' }),
    ).not.toBeInTheDocument();
  });

  it('opens AddExistingItemDialog with the clicked catalog item preselected', () => {
    const catalog = [makeCatalogItem('milk', 'Milk', 'dairy')];
    const lists = [makeList('weekly', 'Weekly Shop', [])];

    renderTripBoard({ lists, catalog });

    fireEvent.click(screen.getByRole('button', { name: 'Add Milk to trip' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Add From Catalog' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /Milk/i, checked: true }),
    ).toBeInTheDocument();
  });

  it('toasts none, all, and partial add results from onAddExistingItem', async () => {
    const catalog = [makeCatalogItem('milk', 'Milk')];
    const lists = [makeList('a', 'Trip A', []), makeList('b', 'Trip B', [])];
    const onAddExistingItem = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['a', 'b'])
      .mockResolvedValueOnce(['a']);

    renderTripBoard({ lists, catalog, onAddExistingItem });

    fireEvent.click(screen.getByRole('button', { name: 'Add Milk to trip' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add to Trip A' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add to Trip B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Lists' }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Already on every selected list.' }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Milk to trip' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add to Trip A' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add to Trip B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Lists' }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Added to lists',
          description: 'Added to 2 lists.',
        }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Milk to trip' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add to Trip A' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add to Trip B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Lists' }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Added to lists',
          description: 'Added to 1 of 2 lists (already on the rest).',
        }),
      );
    });
  });

  it('shows a destructive toast and rethrows when onAddExistingItem rejects', async () => {
    const catalog = [makeCatalogItem('milk', 'Milk')];
    const lists = [makeList('a', 'Trip A', [])];
    const error = new Error('save failed');
    const onAddExistingItem = jest.fn().mockRejectedValue(error);
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    renderTripBoard({ lists, catalog, onAddExistingItem });

    fireEvent.click(screen.getByRole('button', { name: 'Add Milk to trip' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add to Trip A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Lists' }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive',
        }),
      );
    });
    expect(onAddExistingItem).toHaveBeenCalled();
    await expect(latestAddExistingSubmit!('milk', ['a'])).rejects.toThrow(
      'save failed',
    );
    consoleError.mockRestore();
  });
});
