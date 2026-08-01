/*
  Tests for GroceryListView component.
  - This is the first test file for GroceryListView: covers the pre-existing
    trip lifecycle wiring (toggle/uncheck-all/remove-checked/delete-line) at
    a basic level, plus the NEW catalog-membership wiring: Add From Catalog
    (AddExistingItemDialog) and Delete From Catalog (DeleteCatalogItemDialog),
    including the affectedListCount computation and toast/close behavior.
  - Mocks the dialog/toolbar/row child components with lightweight testid
    stubs so this suite is a pure wiring test, not a re-test of those
    components' own internal behavior (already covered in their own specs).
  - Mocks @myorganizer/web-ui's useToast/ToastAction the same way sibling
    vault-adjacent specs in this repo do (see migrationRunner.spec.tsx).
*/

/** Mocking rule: place jest.mock calls before any imports */
const mockToast = jest.fn();

jest.mock('@myorganizer/web-ui', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastAction: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

jest.mock('../components/AddItemDialog', () => ({
  AddItemDialog: ({ isOpen, onClose, onAdd, isLoading }: any) =>
    isOpen ? (
      <div data-testid="add-item-dialog" data-loading={isLoading}>
        <button
          data-testid="add-item-submit"
          onClick={() => onAdd({ name: 'New Item', category: 'other' })}
        >
          Submit
        </button>
        <button data-testid="add-item-close" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

jest.mock('../components/AddExistingItemDialog', () => ({
  AddExistingItemDialog: ({
    isOpen,
    onClose,
    catalog,
    lists,
    defaultListId,
    onAdd,
    isLoading,
  }: any) =>
    isOpen ? (
      <div
        data-testid="add-existing-item-dialog"
        data-catalog-count={catalog.length}
        data-lists-count={lists.length}
        data-default-list-id={defaultListId}
        data-loading={isLoading}
      >
        <button
          data-testid="add-existing-submit"
          onClick={() => onAdd('cat-1', ['list-a', 'list-b'], '2L')}
        >
          Submit
        </button>
        <button data-testid="add-existing-close" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

jest.mock('../components/DeleteCatalogItemDialog', () => ({
  DeleteCatalogItemDialog: ({
    isOpen,
    catalogItem,
    affectedListCount,
    onClose,
    onConfirm,
    isLoading,
  }: any) =>
    isOpen ? (
      <div
        data-testid="delete-catalog-item-dialog"
        data-catalog-item-name={catalogItem?.name}
        data-catalog-item-id={catalogItem?.id}
        data-affected-list-count={affectedListCount}
        data-loading={isLoading}
      >
        <button data-testid="delete-catalog-confirm" onClick={onConfirm}>
          Confirm
        </button>
        <button data-testid="delete-catalog-close" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

jest.mock('../components/CatalogItemEditDialog', () => ({
  CatalogItemEditDialog: ({ item, isOpen, onClose, onSave, isLoading }: any) =>
    isOpen ? (
      <div data-testid="catalog-item-edit-dialog" data-loading={isLoading}>
        <button
          data-testid="catalog-item-edit-submit"
          onClick={() =>
            void onSave({
              id: item.id,
              name: 'Updated Milk',
              category: 'dairy',
              price: 4.5,
            }).catch(() => undefined)
          }
        >
          Save
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

jest.mock('../components/ListLineEditDialog', () => ({
  ListLineEditDialog: ({ line, isOpen, onClose, onSave, isLoading }: any) =>
    isOpen ? (
      <div data-testid="list-line-edit-dialog" data-loading={isLoading}>
        <button
          data-testid="list-line-edit-submit"
          onClick={() =>
            void onSave({ id: line.id, amount: '3 cartons' }).catch(
              () => undefined,
            )
          }
        >
          Save
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

jest.mock('../components/TripBoardLifecycleToolbar', () => ({
  TripBoardLifecycleToolbar: ({
    checkedCount,
    onUncheckAll,
    onRemoveChecked,
    onAddItem,
    onAddExisting,
    isLoading,
  }: any) => (
    <div data-testid="toolbar" data-checked-count={checkedCount}>
      <button data-testid="toolbar-add-item" onClick={onAddItem}>
        Add Item
      </button>
      <button data-testid="toolbar-add-existing" onClick={onAddExisting}>
        Add From Catalog
      </button>
      <button
        data-testid="toolbar-uncheck-all"
        onClick={onUncheckAll}
        disabled={isLoading}
      >
        Uncheck All
      </button>
      <button
        data-testid="toolbar-remove-checked"
        onClick={onRemoveChecked}
        disabled={isLoading}
      >
        Remove Checked
      </button>
    </div>
  ),
}));

jest.mock('../components/TripBoardLineRow', () => ({
  TripBoardLineRow: ({
    line,
    catalogItem,
    onToggleChecked,
    onDeleteLine,
    onDeleteFromCatalog,
    onEditListLine,
    onEditCatalogItem,
    isLoading,
  }: any) => (
    <div data-testid={`line-row-${line.id}`} data-loading={isLoading}>
      <span>{catalogItem?.name ?? 'Unknown item'}</span>
      <button
        data-testid={`toggle-${line.id}`}
        onClick={() => onToggleChecked(line.id)}
      >
        Toggle
      </button>
      <button
        data-testid={`delete-line-${line.id}`}
        onClick={() => onDeleteLine(line.id)}
      >
        Delete Line
      </button>
      <button
        data-testid={`edit-line-${line.id}`}
        onClick={() => onEditListLine(line.id)}
      >
        Edit Line
      </button>
      {catalogItem && (
        <>
          <button
            data-testid={`delete-from-catalog-${line.id}`}
            onClick={() => onDeleteFromCatalog(catalogItem.id)}
          >
            Delete From Catalog
          </button>
          <button
            data-testid={`edit-catalog-${line.id}`}
            onClick={() => onEditCatalogItem(catalogItem.id)}
          >
            Edit Catalog
          </button>
        </>
      )}
    </div>
  ),
}));

import type { CatalogItem, GroceryList, ListLine } from '@myorganizer/core';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GroceryListView } from '../components/GroceryListView';

describe('GroceryListView', () => {
  function makeCatalogItem(
    id: string,
    name: string,
    overrides: Partial<CatalogItem> = {},
  ): CatalogItem {
    return {
      id,
      name,
      category: 'other',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  function makeLine(
    id: string,
    catalogItemId: string,
    overrides: Partial<ListLine> = {},
  ): ListLine {
    return {
      id,
      catalogItemId,
      checked: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  function makeList(
    id: string,
    name: string,
    lines: ListLine[] = [],
  ): GroceryList {
    return {
      id,
      name,
      lines,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  }

  function makeBaseProps(overrides: Partial<Record<string, any>> = {}) {
    return {
      onClose: jest.fn(),
      onToggleChecked: jest.fn().mockResolvedValue(undefined),
      onUncheckAll: jest.fn().mockResolvedValue(undefined),
      onRemoveChecked: jest.fn().mockResolvedValue([]),
      onRestoreLines: jest.fn().mockResolvedValue(undefined),
      onDeleteLine: jest.fn().mockResolvedValue(undefined),
      onAddItem: jest.fn().mockResolvedValue(undefined),
      onAddItemToLists: jest.fn().mockResolvedValue(undefined),
      onAddExistingItem: jest.fn().mockResolvedValue(['list-a', 'list-b']),
      onDeleteFromCatalog: jest.fn().mockResolvedValue(undefined),
      onUpdateCatalogItem: jest.fn().mockResolvedValue(undefined),
      onUpdateListLine: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ============================================
     Basic trip lifecycle wiring (first test file for this component)
     ============================================ */

  it('toggles a line via TripBoardLineRow wiring', async () => {
    const catalogItem = makeCatalogItem('c1', 'Milk');
    const line = makeLine('ln1', 'c1');
    const list = makeList('list1', 'Weekly', [line]);
    const props = makeBaseProps();

    render(
      <GroceryListView
        list={list}
        catalog={[catalogItem]}
        allLists={[list]}
        {...props}
      />,
    );

    fireEvent.click(screen.getByTestId('toggle-ln1'));

    await waitFor(() => {
      expect(props.onToggleChecked).toHaveBeenCalledWith('list1', 'ln1');
    });
  });

  it('unchecks all lines via toolbar wiring', async () => {
    const catalogItem = makeCatalogItem('c1', 'Milk');
    const line = makeLine('ln1', 'c1', { checked: true });
    const list = makeList('list1', 'Weekly', [line]);
    const props = makeBaseProps();

    render(
      <GroceryListView
        list={list}
        catalog={[catalogItem]}
        allLists={[list]}
        {...props}
      />,
    );

    fireEvent.click(screen.getByTestId('toolbar-uncheck-all'));

    await waitFor(() => {
      expect(props.onUncheckAll).toHaveBeenCalledWith('list1');
    });
  });

  it('removes checked lines via toolbar wiring', async () => {
    const catalogItem = makeCatalogItem('c1', 'Milk');
    const line = makeLine('ln1', 'c1', { checked: true });
    const list = makeList('list1', 'Weekly', [line]);
    const props = makeBaseProps();

    render(
      <GroceryListView
        list={list}
        catalog={[catalogItem]}
        allLists={[list]}
        {...props}
      />,
    );

    fireEvent.click(screen.getByTestId('toolbar-remove-checked'));

    await waitFor(() => {
      expect(props.onRemoveChecked).toHaveBeenCalledWith('list1');
    });
  });

  it('deletes a line via TripBoardLineRow wiring', async () => {
    const catalogItem = makeCatalogItem('c1', 'Milk');
    const line = makeLine('ln1', 'c1');
    const list = makeList('list1', 'Weekly', [line]);
    const props = makeBaseProps();

    render(
      <GroceryListView
        list={list}
        catalog={[catalogItem]}
        allLists={[list]}
        {...props}
      />,
    );

    fireEvent.click(screen.getByTestId('delete-line-ln1'));

    await waitFor(() => {
      expect(props.onDeleteLine).toHaveBeenCalledWith('list1', 'ln1');
    });
  });

  /* ============================================
     NEW: Add From Catalog (AddExistingItemDialog) wiring
     ============================================ */

  it('opens AddExistingItemDialog from the toolbar and submits to onAddExistingItem, then toasts and closes', async () => {
    const list = makeList('list1', 'Weekly');
    const props = makeBaseProps();

    render(
      <GroceryListView list={list} catalog={[]} allLists={[list]} {...props} />,
    );

    expect(
      screen.queryByTestId('add-existing-item-dialog'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toolbar-add-existing'));

    expect(screen.getByTestId('add-existing-item-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-existing-submit'));

    await waitFor(() => {
      expect(props.onAddExistingItem).toHaveBeenCalledWith(
        'cat-1',
        ['list-a', 'list-b'],
        '2L',
      );
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId('add-existing-item-dialog'),
      ).not.toBeInTheDocument();
    });

    // Both requested lists received a line (onAddExistingItem resolved with
    // ['list-a', 'list-b'], matching the 2 requested list ids)
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Added to lists',
        description: 'Added to 2 lists.',
      }),
    );
  });

  it('shows the partial-add toast copy when only some of the requested lists actually received a line', async () => {
    const list = makeList('list1', 'Weekly');
    const props = makeBaseProps({
      onAddExistingItem: jest.fn().mockResolvedValue(['list-a']),
    });

    render(
      <GroceryListView list={list} catalog={[]} allLists={[list]} {...props} />,
    );

    fireEvent.click(screen.getByTestId('toolbar-add-existing'));
    fireEvent.click(screen.getByTestId('add-existing-submit'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Added to lists',
          description: 'Added to 1 of 2 lists (already on the rest).',
        }),
      );
    });
  });

  /* ============================================
     NEW: Delete From Catalog (DeleteCatalogItemDialog) wiring
     ============================================ */

  it('opens DeleteCatalogItemDialog with the correct catalogItem and affectedListCount, excluding the current list', async () => {
    const catalogItem = makeCatalogItem('c1', 'Milk');
    const currentLine = makeLine('ln-current', 'c1');
    const currentList = makeList('current', 'Current', [currentLine]);
    const otherList1 = makeList('other1', 'Other 1', [
      makeLine('ln-other1', 'c1'),
    ]);
    const otherList2 = makeList('other2', 'Other 2', [
      makeLine('ln-other2', 'c2'),
    ]);
    const props = makeBaseProps();

    render(
      <GroceryListView
        list={currentList}
        catalog={[catalogItem]}
        allLists={[currentList, otherList1, otherList2]}
        {...props}
      />,
    );

    fireEvent.click(screen.getByTestId('delete-from-catalog-ln-current'));

    const dialog = screen.getByTestId('delete-catalog-item-dialog');
    expect(dialog).toHaveAttribute('data-catalog-item-id', 'c1');
    expect(dialog).toHaveAttribute('data-catalog-item-name', 'Milk');
    // Only otherList1 references c1 among the OTHER lists (otherList2 does not,
    // and the current list itself is excluded from the count).
    expect(dialog).toHaveAttribute('data-affected-list-count', '1');
  });

  it('confirms delete-from-catalog: calls onDeleteFromCatalog, shows success toast naming the item, and closes the dialog', async () => {
    const catalogItem = makeCatalogItem('c1', 'Milk');
    const line = makeLine('ln1', 'c1');
    const list = makeList('list1', 'Weekly', [line]);
    const props = makeBaseProps();

    render(
      <GroceryListView
        list={list}
        catalog={[catalogItem]}
        allLists={[list]}
        {...props}
      />,
    );

    fireEvent.click(screen.getByTestId('delete-from-catalog-ln1'));
    fireEvent.click(screen.getByTestId('delete-catalog-confirm'));

    await waitFor(() => {
      expect(props.onDeleteFromCatalog).toHaveBeenCalledWith('c1');
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId('delete-catalog-item-dialog'),
      ).not.toBeInTheDocument();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Deleted "Milk" from Catalog',
      }),
    );
  });

  it('closes the delete-from-catalog dialog and shows an error toast even when onDeleteFromCatalog rejects', async () => {
    const catalogItem = makeCatalogItem('c1', 'Milk');
    const line = makeLine('ln1', 'c1');
    const list = makeList('list1', 'Weekly', [line]);
    const props = makeBaseProps({
      onDeleteFromCatalog: jest.fn().mockRejectedValue(new Error('boom')),
    });

    render(
      <GroceryListView
        list={list}
        catalog={[catalogItem]}
        allLists={[list]}
        {...props}
      />,
    );

    fireEvent.click(screen.getByTestId('delete-from-catalog-ln1'));
    fireEvent.click(screen.getByTestId('delete-catalog-confirm'));

    await waitFor(() => {
      expect(props.onDeleteFromCatalog).toHaveBeenCalledWith('c1');
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId('delete-catalog-item-dialog'),
      ).not.toBeInTheDocument();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        variant: 'destructive',
      }),
    );
  });

  it('keeps the catalog edit dialog open, shows an error toast, and clears loading when the update rejects', async () => {
    const catalogItem = makeCatalogItem('c1', 'Milk');
    const line = makeLine('ln1', 'c1');
    const list = makeList('list1', 'Weekly', [line]);
    const props = makeBaseProps({
      onUpdateCatalogItem: jest.fn().mockRejectedValue(new Error('boom')),
    });

    render(
      <GroceryListView
        list={list}
        catalog={[catalogItem]}
        allLists={[list]}
        {...props}
      />,
    );

    fireEvent.click(screen.getByTestId('edit-catalog-ln1'));
    fireEvent.click(screen.getByTestId('catalog-item-edit-submit'));

    await waitFor(() => {
      expect(props.onUpdateCatalogItem).toHaveBeenCalledWith({
        id: 'c1',
        name: 'Updated Milk',
        category: 'dairy',
        price: 4.5,
      });
      expect(screen.getByTestId('catalog-item-edit-dialog')).toHaveAttribute(
        'data-loading',
        'false',
      );
    });
    expect(screen.getByTestId('catalog-item-edit-dialog')).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Error', variant: 'destructive' }),
    );
  });

  it('keeps the list-line edit dialog open, shows an error toast, and clears loading when the update rejects', async () => {
    const catalogItem = makeCatalogItem('c1', 'Milk');
    const line = makeLine('ln1', 'c1');
    const list = makeList('list1', 'Weekly', [line]);
    const props = makeBaseProps({
      onUpdateListLine: jest.fn().mockRejectedValue(new Error('boom')),
    });

    render(
      <GroceryListView
        list={list}
        catalog={[catalogItem]}
        allLists={[list]}
        {...props}
      />,
    );

    fireEvent.click(screen.getByTestId('edit-line-ln1'));
    fireEvent.click(screen.getByTestId('list-line-edit-submit'));

    await waitFor(() => {
      expect(props.onUpdateListLine).toHaveBeenCalledWith('list1', {
        id: 'ln1',
        amount: '3 cartons',
      });
      expect(screen.getByTestId('list-line-edit-dialog')).toHaveAttribute(
        'data-loading',
        'false',
      );
    });
    expect(screen.getByTestId('list-line-edit-dialog')).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Error', variant: 'destructive' }),
    );
  });

  it('renders the empty-list state with no active or checked lines', () => {
    const list = makeList('list1', 'Weekly');

    render(
      <GroceryListView
        list={list}
        catalog={[]}
        allLists={[list]}
        {...makeBaseProps()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Weekly' })).toBeInTheDocument();
    expect(
      screen.getByText('0 active · 0 checked · $0.00 known'),
    ).toBeInTheDocument();
    expect(screen.getByText('No items yet')).toBeInTheDocument();
    expect(screen.getByText('Use Add Item to get started')).toBeInTheDocument();
    expect(screen.queryByTestId(/^line-row-/)).not.toBeInTheDocument();
  });
});
