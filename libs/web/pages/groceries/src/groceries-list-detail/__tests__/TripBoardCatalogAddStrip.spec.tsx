/** Mocking rule: place jest.mock calls before any imports. */
jest.mock('@myorganizer/web-ui', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

import type { CatalogItem, GroceryList, ListLine } from '@myorganizer/core';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { TripBoardCatalogAddStrip } from '../components/TripBoardCatalogAddStrip';

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

describe('TripBoardCatalogAddStrip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds a catalog item to the current list when its chip is clicked', () => {
    const onAdd = jest.fn();
    const currentList = makeList('current', 'Weekly', []);
    const catalog = [makeCatalogItem('tomatoes', 'Tomatoes')];

    render(
      <TripBoardCatalogAddStrip
        catalog={catalog}
        lists={[currentList]}
        currentListId="current"
        onAdd={onAdd}
        onOpenMultiListDialog={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Add Tomatoes to list' }),
    );

    expect(onAdd).toHaveBeenCalledWith('tomatoes');
  });

  it('disables the chip when the catalog item is already on the current list', () => {
    const onAdd = jest.fn();
    const currentList = makeList('current', 'Weekly', ['tomatoes']);
    const catalog = [makeCatalogItem('tomatoes', 'Tomatoes')];

    render(
      <TripBoardCatalogAddStrip
        catalog={catalog}
        lists={[currentList]}
        currentListId="current"
        onAdd={onAdd}
        onOpenMultiListDialog={jest.fn()}
      />,
    );

    const chip = screen.getByRole('button', {
      name: 'Tomatoes already on list',
    });
    expect(chip).toBeDisabled();
    fireEvent.click(chip);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('opens the multi-list dialog from Add to multiple lists…', () => {
    const onOpenMultiListDialog = jest.fn();
    const currentList = makeList('current', 'Weekly', []);

    render(
      <TripBoardCatalogAddStrip
        catalog={[makeCatalogItem('tomatoes', 'Tomatoes')]}
        lists={[currentList]}
        currentListId="current"
        onAdd={jest.fn()}
        onOpenMultiListDialog={onOpenMultiListDialog}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Add to multiple lists…' }),
    );

    expect(onOpenMultiListDialog).toHaveBeenCalled();
  });
});
