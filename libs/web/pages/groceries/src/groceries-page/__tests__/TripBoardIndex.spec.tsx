/** Mocking rule: place jest.mock calls before any imports. */
jest.mock('@myorganizer/web-ui', () => {
  const React = require('react') as typeof import('react');

  return {
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
      <input {...props} />
    ),
    Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => (
      <label {...props} />
    ),
  };
});

jest.mock('../components/GroceryListSelector', () => ({
  GroceryListSelector: ({
    lists,
    onRenameList,
    onDeleteList,
    isLoading,
  }: {
    lists: Array<{ id: string; name: string }>;
    onRenameList: (id: string) => void;
    onDeleteList: (id: string) => void;
    isLoading?: boolean;
  }) => (
    <section
      aria-label="Trip cards"
      data-loading={isLoading ? 'true' : 'false'}
    >
      {lists.map((list) => (
        <article key={list.id}>
          <h3>{list.name}</h3>
          <button type="button" onClick={() => onRenameList(list.id)}>
            Rename {list.name}
          </button>
          <button type="button" onClick={() => onDeleteList(list.id)}>
            Delete {list.name}
          </button>
        </article>
      ))}
    </section>
  ),
}));

import type { CatalogItem, GroceryList, ListLine } from '@myorganizer/core';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TripBoardIndex } from '../components/TripBoardIndex';

const DATE = '2026-01-01T00:00:00.000Z';

function makeCatalogItem(
  id: string,
  name: string,
  category: CatalogItem['category'] = 'produce',
  price?: number,
): CatalogItem {
  return {
    id,
    name,
    category,
    ...(price === undefined ? {} : { price }),
    createdAt: DATE,
    updatedAt: DATE,
  };
}

function makeList(
  id: string,
  name: string,
  catalogItemIds: string[],
): GroceryList {
  const lines: ListLine[] = catalogItemIds.map((catalogItemId, index) => ({
    id: `${id}-line-${index}`,
    catalogItemId,
    checked: false,
    createdAt: DATE,
    updatedAt: DATE,
  }));
  return { id, name, lines, createdAt: DATE, updatedAt: DATE };
}

describe('TripBoardIndex', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Staples catalog strip and existing trip cards', () => {
    const catalog = [makeCatalogItem('milk', 'Milk', 'dairy', 2.5)];
    const lists = [makeList('weekly', 'Weekly Shop', ['milk'])];

    render(
      <TripBoardIndex
        lists={lists}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Staples' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Milk' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Weekly Shop' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 1 trip')).toBeInTheDocument();
  });

  it('case-insensitively searches list names and catalog item names', () => {
    const catalog = [
      makeCatalogItem('milk', 'Milk', 'dairy'),
      makeCatalogItem('bread', 'Bread', 'bakery'),
    ];
    const lists = [
      makeList('weekly', 'Weekly Shop', ['milk']),
      makeList('hardware', 'Hardware Run', ['bread']),
    ];

    render(
      <TripBoardIndex
        lists={lists}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );
    const search = screen.getByRole('textbox', {
      name: 'Search trips and staples',
    });

    fireEvent.change(search, { target: { value: 'MILK' } });

    expect(screen.getByRole('heading', { name: 'Milk' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Bread' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Weekly Shop' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Hardware Run' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Showing 1 of 2 trips matching “MILK”'),
    ).toBeInTheDocument();
  });

  it('keeps a trip whose line references a matching catalog item', () => {
    const catalog = [
      makeCatalogItem('apples', 'Green Apples'),
      makeCatalogItem('coffee', 'Coffee'),
    ];
    const lists = [
      makeList('fruit', 'Fruit Trip', ['apples']),
      makeList('cafe', 'Cafe Trip', ['coffee']),
    ];

    render(
      <TripBoardIndex
        lists={lists}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search trips and staples' }),
      {
        target: { value: 'apples' },
      },
    );

    expect(
      screen.getByRole('heading', { name: 'Fruit Trip' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Cafe Trip' }),
    ).not.toBeInTheDocument();
  });

  it('browses staples by category and exposes the pressed state', () => {
    const catalog = [
      makeCatalogItem('milk', 'Milk', 'dairy'),
      makeCatalogItem('lettuce', 'Lettuce', 'produce'),
    ];

    render(
      <TripBoardIndex
        lists={[]}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );
    const dairy = screen.getByRole('button', {
      name: 'Filter staples by Dairy',
    });

    fireEvent.click(dairy);

    expect(dairy).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Milk' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Lettuce' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show all staples' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows known prices and omits the price for unpriced catalog items', () => {
    const catalog = [
      makeCatalogItem('oil', 'Olive Oil', 'condiments', 4),
      makeCatalogItem('salt', 'Salt', 'condiments'),
    ];

    render(
      <TripBoardIndex
        lists={[]}
        catalog={catalog}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );

    expect(
      within(
        screen
          .getByRole('heading', { name: 'Olive Oil' })
          .closest('article') as HTMLElement,
      ).getByText('$4.00'),
    ).toBeInTheDocument();
    expect(
      within(
        screen
          .getByRole('heading', { name: 'Salt' })
          .closest('article') as HTMLElement,
      ).queryByText(/\$/),
    ).not.toBeInTheDocument();
  });

  it('reports an empty staple result and the zero-trip search summary', () => {
    render(
      <TripBoardIndex
        lists={[makeList('trip', 'Weekly Shop', [])]}
        catalog={[makeCatalogItem('milk', 'Milk')]}
        onRenameList={jest.fn()}
        onDeleteList={jest.fn()}
      />,
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search trips and staples' }),
      {
        target: { value: 'zzzz' },
      },
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'No staples match the current filters.',
    );
    expect(
      screen.getByText('Showing 0 of 1 trip matching “zzzz”'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Weekly Shop' }),
    ).not.toBeInTheDocument();
  });

  it('passes rename and delete callbacks through to the trip-card selector', () => {
    const onRenameList = jest.fn();
    const onDeleteList = jest.fn();
    render(
      <TripBoardIndex
        lists={[makeList('trip', 'Weekly Shop', [])]}
        catalog={[]}
        onRenameList={onRenameList}
        onDeleteList={onDeleteList}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rename Weekly Shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Weekly Shop' }));

    expect(onRenameList).toHaveBeenCalledWith('trip');
    expect(onDeleteList).toHaveBeenCalledWith('trip');
  });
});
