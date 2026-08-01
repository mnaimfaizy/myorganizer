/*
  Tests for GroceryListSelector component.
  - Mocks @myorganizer/web-ui dropdown compound for predictable behavior
  - Freezes system time for deterministic relative-time strings
*/
/** Mocking rule: place jest.mock calls before any imports */
jest.mock('@myorganizer/web-ui', () => {
  const React = require('react');

  const MenuContext = React.createContext<any>(null);

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
        <div data-testid="dropdown" data-open={isOpen ? 'true' : 'false'}>
          {children}
        </div>
      </MenuContext.Provider>
    );
  }

  function DropdownMenuTrigger({ onClick, children }: any) {
    const ctx = React.useContext(MenuContext);
    return (
      <button
        data-testid="dropdown-trigger"
        onClick={(e) => {
          onClick?.(e);
          ctx?.toggle?.();
        }}
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

  function DropdownMenuItem({ onClick, children, className }: any) {
    return (
      <button
        data-testid="dropdown-item"
        className={className}
        onClick={onClick}
      >
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

import type { CatalogItem, GroceryList, ListLine } from '@myorganizer/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { GroceryListSelector } from '../components/GroceryListSelector';

describe('GroceryListSelector', () => {
  const NOW_ISO = '2026-06-04T12:00:00.000Z';

  beforeAll(() => {
    jest.useFakeTimers();
    // @ts-expect-error - Jest global setSystemTime exists on modern Jest
    jest.setSystemTime(new Date(NOW_ISO));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  function makeCatalogItem(id: string, category = 'produce'): CatalogItem {
    return {
      id,
      name: `Item ${id}`,
      category: category as CatalogItem['category'],
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
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
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    };
  }

  function makeList({
    id,
    name,
    lines,
    updatedAt,
  }: {
    id: string;
    name: string;
    lines: ListLine[];
    updatedAt: string;
  }): GroceryList {
    return { id, name, lines, updatedAt, createdAt: updatedAt };
  }

  it('renders lists with name, item counts, timestamp and progress', async () => {
    const catalog = [makeCatalogItem('i1'), makeCatalogItem('i2')];
    const lists = [
      makeList({
        id: 'l1',
        name: 'Groceries A',
        lines: [makeLine('ln1', 'i1', true), makeLine('ln2', 'i2', false)],
        updatedAt: new Date(
          new Date(NOW_ISO).getTime() - 5 * 60000,
        ).toISOString(),
      }),
      makeList({
        id: 'l2',
        name: 'Groceries B',
        lines: [],
        updatedAt: new Date(
          new Date(NOW_ISO).getTime() - 2 * 3600000,
        ).toISOString(),
      }),
    ];

    render(
      <GroceryListSelector
        lists={lists}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    // Names and item counts
    expect(screen.getByText('Groceries A')).toBeTruthy();
    expect(screen.getByText('Groceries B')).toBeTruthy();
    expect(screen.getByText('1 / 2 items')).toBeTruthy();
    expect(screen.getByText('0 / 0 items')).toBeTruthy();

    // Relative times (5m ago, 2h ago)
    expect(screen.getByText(/5m ago/)).toBeTruthy();
    expect(screen.getByText(/2h ago/)).toBeTruthy();

    // Progress bar for first list should be 50% (1/2)
    const cardA = screen
      .getByText('Groceries A')
      .closest('[role="article"]') as HTMLElement;
    const progressInner = cardA.querySelector('div[style]') as HTMLElement;
    expect(progressInner).toBeTruthy();
    expect(progressInner.style.width).toBe('50%');

    // Clicking checkbox toggles internal selection (shows border-error shadow-md)
    const checkbox = cardA.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(cardA.className).toContain('border-error');
    expect(cardA.className).toContain('shadow-md');
  });

  it('shows selected styling when list checkbox is clicked', () => {
    const catalog = [makeCatalogItem('a')];
    const lists = [
      makeList({
        id: 'sel',
        name: 'Selected List',
        lines: [makeLine('ln-a', 'a', true)],
        updatedAt: NOW_ISO,
      }),
    ];

    render(
      <GroceryListSelector
        lists={lists}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    const card = screen
      .getByText('Selected List')
      .closest('[role="article"]') as HTMLElement;

    // Click checkbox to trigger internal selection
    const checkbox = card.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    fireEvent.click(checkbox);

    expect(card.className).toContain('border-error');
    expect(card.className).toContain('shadow-md');

    // Progress 100% for single checked item
    const inner = card.querySelector('div[style]') as HTMLElement;
    expect(inner.style.width).toBe('100%');
  });

  it('handles empty lists array and shows count 0', () => {
    render(
      <GroceryListSelector
        lists={[]}
        catalog={[]}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    const header = screen.getByText('Active Lists');
    // The count is rendered in a span next to header
    expect(header).toBeTruthy();
    const countSpan = header.parentElement?.querySelector('span');
    expect(countSpan).toBeTruthy();
    expect(countSpan?.textContent).toBe('0');
  });

  it('shows 0% progress for lists with no items and 100%/0% for single item cases', () => {
    const catalog = [makeCatalogItem('x'), makeCatalogItem('y')];
    const lists = [
      makeList({ id: 'n', name: 'No Items', lines: [], updatedAt: NOW_ISO }),
      makeList({
        id: 's1',
        name: 'SingleChecked',
        lines: [makeLine('ln-x', 'x', true)],
        updatedAt: NOW_ISO,
      }),
      makeList({
        id: 's2',
        name: 'SingleUnchecked',
        lines: [makeLine('ln-y', 'y', false)],
        updatedAt: NOW_ISO,
      }),
    ];

    render(
      <GroceryListSelector
        lists={lists}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    const noItemsCard = screen
      .getByText('No Items')
      .closest('[role="article"]') as HTMLElement;
    expect(noItemsCard.querySelector('div[style]')!.style.width).toBe('0%');

    const s1 = screen
      .getByText('SingleChecked')
      .closest('[role="article"]') as HTMLElement;
    expect(s1.querySelector('div[style]')!.style.width).toBe('100%');

    const s2 = screen
      .getByText('SingleUnchecked')
      .closest('[role="article"]') as HTMLElement;
    expect(s2.querySelector('div[style]')!.style.width).toBe('0%');
  });

  it('rename and delete menu items call handlers and do not propagate select click', async () => {
    const onRename = jest.fn();
    const onDelete = jest.fn();

    const catalog = [makeCatalogItem('a')];
    const lists = [
      makeList({
        id: 'm1',
        name: 'MenuList',
        lines: [makeLine('ln-a', 'a')],
        updatedAt: NOW_ISO,
      }),
    ];

    render(
      <GroceryListSelector
        lists={lists}
        catalog={catalog}
        onRenameList={onRename}
        onDeleteList={onDelete}
      />,
    );

    const card = screen
      .getByText('MenuList')
      .closest('[role="article"]') as HTMLElement;
    const dropdown = within(card).getByTestId('dropdown');
    const trigger = within(card).getByTestId('dropdown-trigger');

    // Toggle open
    fireEvent.click(trigger);
    expect(dropdown.dataset.open).toBe('true');

    // Click Rename
    const rename = within(card).getByText('Rename');
    fireEvent.click(rename);
    expect(onRename).toHaveBeenCalledWith('m1');
    // menu should close
    expect(dropdown.dataset.open).toBe('false');

    // Re-open and Delete
    fireEvent.click(trigger);
    expect(dropdown.dataset.open).toBe('true');
    const del = within(card).getByText('Delete');
    fireEvent.click(del);
    expect(onDelete).toHaveBeenCalledWith('m1');
    expect(dropdown.dataset.open).toBe('false');
  });

  it('renders many lists and handles very long names without crashing', () => {
    const catalog = [makeCatalogItem('a')];
    const many = Array.from({ length: 12 }).map((_, i) =>
      makeList({
        id: `L${i}`,
        name: `List ${i}`,
        lines: [makeLine(`ln-${i}`, 'a')],
        updatedAt: NOW_ISO,
      }),
    );

    // Add very long name
    const longName = 'L'.repeat(120);
    many.push(
      makeList({ id: 'long', name: longName, lines: [], updatedAt: NOW_ISO }),
    );

    render(
      <GroceryListSelector
        lists={many}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    // All names are present (including long name prefix)
    expect(screen.getByText('List 0')).toBeTruthy();
    expect(screen.getByText(new RegExp(longName.slice(0, 10)))).toBeTruthy();
  });

  it('formats relative times: Just now, Xm ago, Xh ago, Xd ago, date for older', () => {
    const now = new Date(NOW_ISO).getTime();
    const lists = [
      makeList({
        id: 'jn',
        name: 'JustNow',
        lines: [],
        updatedAt: new Date(now - 30 * 1000).toISOString(),
      }),
      makeList({
        id: 'm5',
        name: 'FiveMin',
        lines: [],
        updatedAt: new Date(now - 5 * 60000).toISOString(),
      }),
      makeList({
        id: 'h2',
        name: 'TwoHour',
        lines: [],
        updatedAt: new Date(now - 2 * 3600000).toISOString(),
      }),
      makeList({
        id: 'd3',
        name: 'ThreeDay',
        lines: [],
        updatedAt: new Date(now - 3 * 86400000).toISOString(),
      }),
      makeList({
        id: 'old',
        name: 'Old',
        lines: [],
        updatedAt: new Date('2020-01-01T00:00:00.000Z').toISOString(),
      }),
    ];

    render(
      <GroceryListSelector
        lists={lists}
        catalog={[]}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    expect(screen.getByText(/Just now/)).toBeTruthy();
    expect(screen.getByText(/5m ago/)).toBeTruthy();
    expect(screen.getByText(/2h ago/)).toBeTruthy();
    expect(screen.getByText(/3d ago/)).toBeTruthy();

    const oldDate = new Date('2020-01-01T00:00:00.000Z').toLocaleDateString();
    expect(screen.getByText(new RegExp(oldDate))).toBeTruthy();
  });
});
