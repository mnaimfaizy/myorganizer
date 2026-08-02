/** Mocking rule: place jest.mock calls before any imports. */
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

  function DropdownMenuItem({ onClick, children }: any) {
    return (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    );
  }

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
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
}));

import type { CatalogItem, GroceryList, ListLine } from '@myorganizer/core';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TripBoardTripCard } from '../components/TripBoardTripCard';

const DATE = '2026-01-01T00:00:00.000Z';

function makeCatalogItem(
  id: string,
  name: string,
  price?: number,
): CatalogItem {
  return {
    id,
    name,
    category: 'produce',
    ...(price === undefined ? {} : { price }),
    createdAt: DATE,
    updatedAt: DATE,
  };
}

function makeLine(
  id: string,
  catalogItemId: string,
  checked = false,
): ListLine {
  return {
    id,
    catalogItemId,
    checked,
    createdAt: DATE,
    updatedAt: DATE,
  };
}

function makeList(name: string, lines: ListLine[]): GroceryList {
  return {
    id: 'trip-1',
    name,
    lines,
    createdAt: DATE,
    updatedAt: DATE,
  };
}

describe('TripBoardTripCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the trip name as a detail link inside an h3', () => {
    render(
      <TripBoardTripCard
        list={makeList('Weekly Shop', [])}
        catalog={[]}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    const heading = screen.getByRole('heading', {
      level: 3,
      name: 'Weekly Shop',
    });
    const link = within(heading).getByRole('link', { name: 'Weekly Shop' });
    expect(link).toHaveAttribute('href', '/dashboard/groceries/trip-1');
  });

  it('shows known spend and an unpriced subline', () => {
    const catalog = [
      makeCatalogItem('a', 'Apples', 2),
      makeCatalogItem('b', 'Bananas'),
    ];
    const list = makeList('Produce Run', [
      makeLine('l1', 'a'),
      makeLine('l2', 'b'),
    ]);

    render(
      <TripBoardTripCard
        list={list}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    expect(screen.getByText('$2.00')).toBeInTheDocument();
    expect(screen.getByText('1 unpriced')).toBeInTheDocument();
  });

  it('shows all priced when every line has a catalog price', () => {
    const catalog = [makeCatalogItem('a', 'Apples', 2)];
    const list = makeList('Produce Run', [makeLine('l1', 'a', true)]);

    render(
      <TripBoardTripCard
        list={list}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    expect(screen.getByText('all priced')).toBeInTheDocument();
    expect(screen.getByText('1/1 checked · 0 open')).toBeInTheDocument();
  });

  it('previews active and checked lines with overflow hints', () => {
    const catalog = Array.from({ length: 8 }, (_, i) =>
      makeCatalogItem(`c${i}`, `Item ${i + 1}`),
    );
    const lines = catalog.map((item, i) => makeLine(`l${i}`, item.id, i >= 5));
    const list = makeList('Big Trip', lines);

    render(
      <TripBoardTripCard
        list={list}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    expect(screen.getByText('Active (5)')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.queryByText(/\+\d+ more open/)).not.toBeInTheDocument();

    expect(screen.getByText('Checked (3)')).toBeInTheDocument();
    expect(screen.getByText('Item 6')).toBeInTheDocument();
    expect(screen.getByText('Item 7')).toBeInTheDocument();
    expect(screen.getByText('Item 8')).toBeInTheDocument();
  });

  it('shows +N more open when more than five active lines exist', () => {
    const catalog = Array.from({ length: 7 }, (_, i) =>
      makeCatalogItem(`c${i}`, `Open ${i + 1}`),
    );
    const lines = catalog.map((item, i) => makeLine(`l${i}`, item.id, false));
    const list = makeList('Busy Trip', lines);

    render(
      <TripBoardTripCard
        list={list}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    expect(screen.getByText('+2 more open')).toBeInTheDocument();
  });

  it('shows only the first three checked line names when more than three are checked', () => {
    const catalog = Array.from({ length: 5 }, (_, i) =>
      makeCatalogItem(`c${i}`, `Checked ${i + 1}`),
    );
    const lines = catalog.map((item, i) => makeLine(`l${i}`, item.id, true));
    const list = makeList('Checked Trip', lines);

    render(
      <TripBoardTripCard
        list={list}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    expect(screen.getByText('Checked (5)')).toBeInTheDocument();
    expect(screen.getByText('Checked 1')).toBeInTheDocument();
    expect(screen.getByText('Checked 2')).toBeInTheDocument();
    expect(screen.getByText('Checked 3')).toBeInTheDocument();
    expect(screen.queryByText('Checked 4')).not.toBeInTheDocument();
    expect(screen.queryByText('Checked 5')).not.toBeInTheDocument();
  });

  it('invokes rename and delete callbacks from the trip menu', () => {
    const onRenameList = jest.fn();
    const onDeleteList = jest.fn();
    const list = makeList('Weekly Shop', []);

    render(
      <TripBoardTripCard
        list={list}
        catalog={[]}
        onRenameList={onRenameList}
        onDeleteList={onDeleteList}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Trip actions for Weekly Shop' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rename trip' }));
    expect(onRenameList).toHaveBeenCalledWith('trip-1');

    fireEvent.click(
      screen.getByRole('button', { name: 'Trip actions for Weekly Shop' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete trip' }));
    expect(onDeleteList).toHaveBeenCalledWith('trip-1');
  });

  it('links to the detail route from the footer', () => {
    render(
      <TripBoardTripCard
        list={makeList('Weekly Shop', [])}
        catalog={[]}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Open trip board →' }),
    ).toHaveAttribute('href', '/dashboard/groceries/trip-1');
  });
});
