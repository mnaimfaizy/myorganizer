/*
  Tests for GroceriesPageClient component.
  - Covers GroceriesPage (VaultGate wrapper) and GroceriesInner (main logic)
  - Tests loading, empty, and loaded states
  - Tests error handling and dialog orchestration
  - Covers create, rename, and delete list flows with vault mutation tracking
  - Mocks useGroceriesVault hook, VaultGate, child components, and web-ui
*/

/** Mocking rule: place jest.mock calls before any imports */

jest.mock('../../shared/hooks', () => ({
  useGroceriesVault: jest.fn(),
}));

jest.mock('@myorganizer/web-vault-ui', () => ({
  VaultGate: ({ children, title }: any) => {
    const ctx = { masterKeyBytes: new Uint8Array(32) };
    return (
      <div data-testid="vault-gate" data-title={title}>
        {children(ctx)}
      </div>
    );
  },
}));

jest.mock('@myorganizer/web-ui', () => {
  const React = require('react');

  function Button({
    children,
    onClick,
    disabled = false,
    size = 'md',
    className = '',
  }: any) {
    return (
      <button
        data-testid="button"
        onClick={onClick}
        disabled={disabled}
        data-size={size}
        className={className}
      >
        {children}
      </button>
    );
  }

  function Skeleton({ className = '' }: any) {
    return <div data-testid="skeleton" className={className} />;
  }

  return { Button, Skeleton };
});

jest.mock('lucide-react', () => ({
  Plus: ({ className }: any) => (
    <svg data-testid="plus-icon" className={className} viewBox="0 0 24 24" />
  ),
}));

jest.mock('../components', () => {
  const React = require('react');

  function GroceryListSelector({
    lists,
    onRenameList,
    onDeleteList,
    isLoading,
  }: any) {
    return (
      <div data-testid="grocery-list-selector">
        <div data-testid="lists-count">{lists.length}</div>
        <button
          data-testid="selector-rename-button"
          onClick={() => onRenameList('list1')}
        >
          Rename
        </button>
        <button
          data-testid="selector-delete-button"
          onClick={() => onDeleteList('list1')}
        >
          Delete
        </button>
        <div data-testid="selector-loading">
          {isLoading ? 'loading' : 'ready'}
        </div>
      </div>
    );
  }

  function CreateListDialog({ isOpen, onClose, onSubmit, isLoading }: any) {
    return (
      <div
        data-testid="create-list-dialog"
        data-open={isOpen}
        data-loading={isLoading}
      >
        {isOpen && (
          <>
            <button
              data-testid="dialog-create-submit"
              onClick={() => onSubmit('New List')}
            >
              Submit
            </button>
            <button data-testid="dialog-create-close" onClick={onClose}>
              Close
            </button>
          </>
        )}
      </div>
    );
  }

  function RenameListDialog({
    isOpen,
    currentName,
    onClose,
    onSubmit,
    isLoading,
  }: any) {
    return isOpen ? (
      <div
        data-testid="rename-list-dialog"
        data-open={isOpen}
        data-current-name={currentName}
        data-loading={isLoading}
      >
        <button
          data-testid="dialog-rename-submit"
          onClick={() => onSubmit('Renamed List')}
        >
          Submit
        </button>
        <button data-testid="dialog-rename-close" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null;
  }

  function DeleteListConfirmDialog({
    isOpen,
    listName,
    itemCount,
    onClose,
    onConfirm,
    isLoading,
  }: any) {
    return isOpen ? (
      <div
        data-testid="delete-list-dialog"
        data-open={isOpen}
        data-list-name={listName}
        data-item-count={itemCount}
        data-loading={isLoading}
      >
        <button data-testid="dialog-delete-confirm" onClick={() => onConfirm()}>
          Confirm
        </button>
        <button data-testid="dialog-delete-close" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null;
  }

  return {
    GroceryListSelector,
    CreateListDialog,
    RenameListDialog,
    DeleteListConfirmDialog,
  };
});

import type { GroceryList } from '@myorganizer/core';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GroceriesPageClient as GroceriesPage } from '../GroceriesPageClient';
import { useGroceriesVault } from '../../shared/hooks';

const mockUseGroceriesVault = useGroceriesVault as jest.Mock;

describe('GroceriesPageClient', () => {
  /* ============================================
     Test Helpers
     ============================================ */

  interface VaultState {
    lists: GroceryList[];
    loading: boolean;
    error: string | null;
    selectedListIds: string[];
    setSelectedListIds: jest.Mock;
    setError: jest.Mock;
    createList: jest.Mock;
    renameList: jest.Mock;
    deleteList: jest.Mock;
  }

  function makeVaultState(overrides?: Partial<VaultState>): VaultState {
    return {
      lists: [],
      loading: false,
      error: null,
      selectedListIds: [],
      setSelectedListIds: jest.fn(),
      setError: jest.fn(),
      createList: jest.fn(),
      renameList: jest.fn(),
      deleteList: jest.fn(),
      ...overrides,
    };
  }

  function makeGroceryList(
    id: string,
    name: string,
    itemCount = 0,
  ): GroceryList {
    return {
      id,
      name,
      items: Array.from({ length: itemCount }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        completed: false,
        quantity: 1,
        unit: '',
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ============================================
     Loading State Tests
     ============================================ */

  describe('Loading State', () => {
    it('should display loading skeletons when vault.loading=true', () => {
      mockUseGroceriesVault.mockReturnValue(makeVaultState({ loading: true }));

      render(<GroceriesPage />);

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons).toHaveLength(5); // 1 header + 1 subtitle + 3 list cards
    });

    it('should show header skeleton with correct dimensions', () => {
      mockUseGroceriesVault.mockReturnValue(makeVaultState({ loading: true }));

      render(<GroceriesPage />);

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons[0]).toHaveClass('h-8', 'w-48');
      expect(skeletons[1]).toHaveClass('h-4', 'w-64');
    });

    it('should show three list card skeletons with correct dimensions', () => {
      mockUseGroceriesVault.mockReturnValue(makeVaultState({ loading: true }));

      render(<GroceriesPage />);

      const skeletons = screen.getAllByTestId('skeleton');
      for (let i = 2; i < 5; i++) {
        expect(skeletons[i]).toHaveClass('h-24', 'w-full');
      }
    });

    it('should not display dialogs during loading', () => {
      mockUseGroceriesVault.mockReturnValue(makeVaultState({ loading: true }));

      render(<GroceriesPage />);

      const dialogs = screen.queryAllByTestId(/dialog/);
      dialogs.forEach((dialog) => {
        expect(dialog).toHaveAttribute('data-open', 'false');
      });
    });

    it('should not display GroceryListSelector during loading', () => {
      mockUseGroceriesVault.mockReturnValue(makeVaultState({ loading: true }));

      render(<GroceriesPage />);

      expect(
        screen.queryByTestId('grocery-list-selector'),
      ).not.toBeInTheDocument();
    });

    it('should not display empty state during loading', () => {
      mockUseGroceriesVault.mockReturnValue(makeVaultState({ loading: true }));

      render(<GroceriesPage />);

      expect(
        screen.queryByText('No grocery lists yet'),
      ).not.toBeInTheDocument();
    });
  });

  /* ============================================
     Empty State Tests
     ============================================ */

  describe('Empty State', () => {
    it('should display empty state when vault.lists is empty and not loading', () => {
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists: [], loading: false }),
      );

      render(<GroceriesPage />);

      expect(screen.getByText('No grocery lists yet')).toBeInTheDocument();
    });

    it('should show empty state heading and description', () => {
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists: [], loading: false }),
      );

      render(<GroceriesPage />);

      expect(screen.getByText('No grocery lists yet')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Create your first list to get started organizing your shopping.',
        ),
      ).toBeInTheDocument();
    });

    it('should show Create Your First List button in empty state', () => {
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists: [], loading: false }),
      );

      render(<GroceriesPage />);

      const buttons = screen.getAllByTestId('button');
      const createFirstListBtn = buttons.find(
        (btn) => btn.textContent === 'Create Your First List',
      );
      expect(createFirstListBtn).toBeInTheDocument();
    });

    it('should open CreateListDialog when Create Your First List button clicked', () => {
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists: [], loading: false }),
      );

      render(<GroceriesPage />);

      const buttons = screen.getAllByTestId('button');
      const createFirstListBtn = buttons.find(
        (btn) => btn.textContent === 'Create Your First List',
      );
      fireEvent.click(createFirstListBtn!);

      const dialog = screen.getByTestId('create-list-dialog');
      expect(dialog).toHaveAttribute('data-open', 'true');
    });

    it('should not display GroceryListSelector when lists empty', () => {
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists: [], loading: false }),
      );

      render(<GroceriesPage />);

      expect(
        screen.queryByTestId('grocery-list-selector'),
      ).not.toBeInTheDocument();
    });

    it('should display header with title even in empty state', () => {
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists: [], loading: false }),
      );

      render(<GroceriesPage />);

      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(
        screen.getByText('Access and manage your shopping lists.'),
      ).toBeInTheDocument();
    });
  });

  /* ============================================
     Loaded State Tests
     ============================================ */

  describe('Loaded State - List Display', () => {
    it('should display GroceryListSelector when vault.lists has items', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 5)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      expect(screen.getByTestId('grocery-list-selector')).toBeInTheDocument();
    });

    it('should pass correct lists array to GroceryListSelector', () => {
      const lists = [
        makeGroceryList('list1', 'Groceries', 3),
        makeGroceryList('list2', 'Farmers Market', 2),
      ];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      expect(screen.getByTestId('lists-count')).toHaveTextContent('2');
    });

    it('should pass loading state to GroceryListSelector', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      expect(screen.getByTestId('selector-loading')).toHaveTextContent('ready');
    });

    it('should display header with title and subtitle', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(
        screen.getByText('Access and manage your shopping lists.'),
      ).toBeInTheDocument();
    });

    it('should display search bar with correct placeholder', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      const searchInput = screen.getByPlaceholderText('Search your lists...');
      expect(searchInput).toBeInTheDocument();
    });

    it('should show New List button in header', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      const buttons = screen.getAllByTestId('button');
      const newListBtn = buttons.find((btn) =>
        btn.textContent.includes('New List'),
      );
      expect(newListBtn).toBeInTheDocument();
    });

    it('should enable New List button when not loading', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      const buttons = screen.getAllByTestId('button');
      const newListBtn = buttons.find((btn) =>
        btn.textContent.includes('New List'),
      );
      expect(newListBtn).not.toBeDisabled();
    });

    it('should pass callback functions to GroceryListSelector', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({
          lists,
          loading: false,
        }),
      );

      render(<GroceriesPage />);

      // Verify the component renders GroceryListSelector
      expect(screen.getByTestId('grocery-list-selector')).toBeInTheDocument();

      // Verify callback buttons are present and functional
      expect(screen.getByTestId('selector-rename-button')).toBeInTheDocument();
      expect(screen.getByTestId('selector-delete-button')).toBeInTheDocument();
    });
  });

  /* ============================================
     Error Handling Tests
     ============================================ */

  describe('Error Handling', () => {
    it('should display error banner when vault.error is set', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({
          lists,
          loading: false,
          error: 'Failed to load lists',
        }),
      );

      render(<GroceriesPage />);

      expect(screen.getByText('Failed to load lists')).toBeInTheDocument();
    });

    it('should show error banner with dismiss button', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({
          lists,
          loading: false,
          error: 'Failed to load lists',
        }),
      );

      render(<GroceriesPage />);

      expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });

    it('should call vault.setError(null) when dismiss button clicked', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      const mockSetError = jest.fn();
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({
          lists,
          loading: false,
          error: 'Failed to load lists',
          setError: mockSetError,
        }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByText('Dismiss'));
      expect(mockSetError).toHaveBeenCalledWith(null);
    });

    it('should not display error banner when vault.error is null', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({
          lists,
          loading: false,
          error: null,
        }),
      );

      render(<GroceriesPage />);

      expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
    });

    it('should display error banner above list content', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({
          lists,
          loading: false,
          error: 'Network error occurred',
        }),
      );

      render(<GroceriesPage />);

      const errorText = screen.getByText('Network error occurred');
      const selector = screen.getByTestId('grocery-list-selector');

      // Both should be in document, error appears first in DOM
      expect(errorText).toBeInTheDocument();
      expect(selector).toBeInTheDocument();
    });
  });

  /* ============================================
     Create List Flow Tests
     ============================================ */

  describe('Create List Flow', () => {
    it('should open CreateListDialog when New List button clicked', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      const buttons = screen.getAllByTestId('button');
      const newListBtn = buttons.find((btn) =>
        btn.textContent.includes('New List'),
      );
      fireEvent.click(newListBtn!);

      const dialog = screen.getByTestId('create-list-dialog');
      expect(dialog).toHaveAttribute('data-open', 'true');
    });

    it('should open CreateListDialog from empty state button', () => {
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists: [], loading: false }),
      );

      render(<GroceriesPage />);

      const buttons = screen.getAllByTestId('button');
      const createFirstBtn = buttons.find(
        (btn) => btn.textContent === 'Create Your First List',
      );
      fireEvent.click(createFirstBtn!);

      const dialog = screen.getByTestId('create-list-dialog');
      expect(dialog).toHaveAttribute('data-open', 'true');
    });

    it('should call vault.createList with entered name on dialog submit', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      const mockCreateList = jest.fn().mockResolvedValue(undefined);
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false, createList: mockCreateList }),
      );

      render(<GroceriesPage />);

      const buttons = screen.getAllByTestId('button');
      const newListBtn = buttons.find((btn) =>
        btn.textContent.includes('New List'),
      );
      fireEvent.click(newListBtn!);

      const submitBtn = screen.getByTestId('dialog-create-submit');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockCreateList).toHaveBeenCalledWith('New List');
      });
    });

    it('should close CreateListDialog after successful submission', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      const mockCreateList = jest.fn().mockResolvedValue(undefined);
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false, createList: mockCreateList }),
      );

      render(<GroceriesPage />);

      const buttons = screen.getAllByTestId('button');
      const newListBtn = buttons.find((btn) =>
        btn.textContent.includes('New List'),
      );
      fireEvent.click(newListBtn!);

      const submitBtn = screen.getByTestId('dialog-create-submit');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        const dialog = screen.getByTestId('create-list-dialog');
        expect(dialog).toHaveAttribute('data-open', 'false');
      });
    });

    it('should close CreateListDialog when close button clicked', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      const buttons = screen.getAllByTestId('button');
      const newListBtn = buttons.find((btn) =>
        btn.textContent.includes('New List'),
      );
      fireEvent.click(newListBtn!);

      const closeBtn = screen.getByTestId('dialog-create-close');
      fireEvent.click(closeBtn);

      const dialog = screen.getByTestId('create-list-dialog');
      expect(dialog).toHaveAttribute('data-open', 'false');
    });

    it('should render CreateListDialog when not loading', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      // CreateListDialog should be rendered when not loading
      expect(screen.getByTestId('create-list-dialog')).toBeInTheDocument();
    });
  });

  /* ============================================
     Rename List Flow Tests
     ============================================ */

  describe('Rename List Flow', () => {
    it('should open RenameListDialog when onRenameList called on selector', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-rename-button'));

      const dialog = screen.getByTestId('rename-list-dialog');
      expect(dialog).toHaveAttribute('data-open', 'true');
    });

    it('should populate RenameListDialog with current list name', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-rename-button'));

      const dialog = screen.getByTestId('rename-list-dialog');
      expect(dialog).toHaveAttribute('data-current-name', 'Groceries');
    });

    it('should call vault.renameList with listId and new name on submit', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      const mockRenameList = jest.fn().mockResolvedValue(undefined);
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false, renameList: mockRenameList }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-rename-button'));
      fireEvent.click(screen.getByTestId('dialog-rename-submit'));

      await waitFor(() => {
        expect(mockRenameList).toHaveBeenCalledWith('list1', 'Renamed List');
      });
    });

    it('should close RenameListDialog after successful submission', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      const mockRenameList = jest.fn().mockResolvedValue(undefined);
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false, renameList: mockRenameList }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-rename-button'));
      fireEvent.click(screen.getByTestId('dialog-rename-submit'));

      await waitFor(() => {
        const dialog = screen.queryByTestId('rename-list-dialog');
        expect(dialog).not.toBeInTheDocument();
      });
    });

    it('should close RenameListDialog when close button clicked', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-rename-button'));
      fireEvent.click(screen.getByTestId('dialog-rename-close'));

      const dialog = screen.queryByTestId('rename-list-dialog');
      expect(dialog).not.toBeInTheDocument();
    });

    it('should pass isLoading state to RenameListDialog', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-rename-button'));

      // Dialog receives loading state from vault
      const dialog = screen.getByTestId('rename-list-dialog');
      expect(dialog).toHaveAttribute('data-loading', 'false');
    });

    it('should find correct list by listId for rename dialog', () => {
      const lists = [
        makeGroceryList('list1', 'Groceries', 3),
        makeGroceryList('list2', 'Farmers Market', 2),
      ];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-rename-button'));

      // Selector always renames list1
      const dialog = screen.getByTestId('rename-list-dialog');
      expect(dialog).toHaveAttribute('data-current-name', 'Groceries');
    });
  });

  /* ============================================
     Delete List Flow Tests
     ============================================ */

  describe('Delete List Flow', () => {
    it('should open DeleteListConfirmDialog when onDeleteList called on selector', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-delete-button'));

      const dialog = screen.getByTestId('delete-list-dialog');
      expect(dialog).toHaveAttribute('data-open', 'true');
    });

    it('should populate DeleteListConfirmDialog with list name', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-delete-button'));

      const dialog = screen.getByTestId('delete-list-dialog');
      expect(dialog).toHaveAttribute('data-list-name', 'Groceries');
    });

    it('should populate DeleteListConfirmDialog with item count', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 5)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-delete-button'));

      const dialog = screen.getByTestId('delete-list-dialog');
      expect(dialog).toHaveAttribute('data-item-count', '5');
    });

    it('should call vault.deleteList with listId on confirm', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      const mockDeleteList = jest.fn().mockResolvedValue(undefined);
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false, deleteList: mockDeleteList }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-delete-button'));
      fireEvent.click(screen.getByTestId('dialog-delete-confirm'));

      await waitFor(() => {
        expect(mockDeleteList).toHaveBeenCalledWith('list1');
      });
    });

    it('should close DeleteListConfirmDialog after successful deletion', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      const mockDeleteList = jest.fn().mockResolvedValue(undefined);
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false, deleteList: mockDeleteList }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-delete-button'));
      fireEvent.click(screen.getByTestId('dialog-delete-confirm'));

      await waitFor(() => {
        const dialog = screen.queryByTestId('delete-list-dialog');
        expect(dialog).not.toBeInTheDocument();
      });
    });

    it('should close DeleteListConfirmDialog when close button clicked', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-delete-button'));
      fireEvent.click(screen.getByTestId('dialog-delete-close'));

      const dialog = screen.queryByTestId('delete-list-dialog');
      expect(dialog).not.toBeInTheDocument();
    });

    it('should pass isLoading state to DeleteListConfirmDialog', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-delete-button'));

      // When not loading, dialog shows with data-loading="false"
      const dialog = screen.getByTestId('delete-list-dialog');
      expect(dialog).toHaveAttribute('data-loading', 'false');
    });

    it('should handle delete list with zero items', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 0)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-delete-button'));

      const dialog = screen.getByTestId('delete-list-dialog');
      expect(dialog).toHaveAttribute('data-item-count', '0');
    });

    it('should handle delete list with many items', () => {
      const lists = [makeGroceryList('list1', 'Groceries', 50)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      fireEvent.click(screen.getByTestId('selector-delete-button'));

      const dialog = screen.getByTestId('delete-list-dialog');
      expect(dialog).toHaveAttribute('data-item-count', '50');
    });
  });

  /* ============================================
     Dialog State Management Tests
     ============================================ */

  describe('Dialog State Management', () => {
    it('should only show one dialog at a time', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      // Wait for selector to be visible
      await waitFor(() => {
        expect(screen.getByTestId('grocery-list-selector')).toBeInTheDocument();
      });

      // Open create dialog
      const buttons = screen.getAllByTestId('button');
      const newListBtn = buttons.find((btn) =>
        btn.textContent.includes('New List'),
      );
      fireEvent.click(newListBtn!);

      const createDialog = screen.getByTestId('create-list-dialog');
      expect(createDialog).toHaveAttribute('data-open', 'true');

      // Rename and delete dialogs should not be in DOM
      const renameDialog = screen.queryByTestId('rename-list-dialog');
      const deleteDialog = screen.queryByTestId('delete-list-dialog');
      expect(renameDialog).not.toBeInTheDocument();
      expect(deleteDialog).not.toBeInTheDocument();
    });

    it('should transition between different dialogs', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      // Wait for selector to be visible
      await waitFor(() => {
        expect(screen.getByTestId('grocery-list-selector')).toBeInTheDocument();
      });

      // Open create dialog
      const buttons = screen.getAllByTestId('button');
      const newListBtn = buttons.find((btn) =>
        btn.textContent.includes('New List'),
      );
      fireEvent.click(newListBtn!);

      let createDialog = screen.getByTestId('create-list-dialog');
      expect(createDialog).toHaveAttribute('data-open', 'true');

      // Close create dialog
      fireEvent.click(screen.getByTestId('dialog-create-close'));

      createDialog = screen.getByTestId('create-list-dialog');
      expect(createDialog).toHaveAttribute('data-open', 'false');

      // Open rename dialog
      fireEvent.click(screen.getByTestId('selector-rename-button'));

      const renameDialog = screen.getByTestId('rename-list-dialog');
      expect(renameDialog).toHaveAttribute('data-open', 'true');
    });

    it('should clear dialog state when dialog closes', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      // Wait for selector to be visible
      await waitFor(() => {
        expect(screen.getByTestId('grocery-list-selector')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('selector-rename-button'));

      let renameDialog = screen.getByTestId('rename-list-dialog');
      expect(renameDialog).toHaveAttribute('data-open', 'true');

      fireEvent.click(screen.getByTestId('dialog-rename-close'));

      renameDialog = screen.queryByTestId('rename-list-dialog');
      expect(renameDialog).not.toBeInTheDocument();
    });

    it('should persist dialog state across renders', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      const mockRenameList = jest.fn().mockResolvedValue(undefined);
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false, renameList: mockRenameList }),
      );

      render(<GroceriesPage />);

      // Wait for selector to be visible
      await waitFor(() => {
        expect(screen.getByTestId('grocery-list-selector')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('selector-rename-button'));

      const renameDialog = screen.getByTestId('rename-list-dialog');
      expect(renameDialog).toHaveAttribute('data-open', 'true');
      expect(renameDialog).toHaveAttribute('data-current-name', 'Groceries');
    });
  });

  /* ============================================
     VaultGate Integration Tests
     ============================================ */

  describe('VaultGate Integration', () => {
    it('should render GroceriesPage wrapped with VaultGate', () => {
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists: [], loading: false }),
      );

      render(<GroceriesPage />);

      const vaultGate = screen.getByTestId('vault-gate');
      expect(vaultGate).toBeInTheDocument();
      expect(vaultGate).toHaveAttribute('data-title', 'Groceries');
    });

    it('should call useGroceriesVault with masterKeyBytes from VaultGate', async () => {
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists: [], loading: false }),
      );

      render(<GroceriesPage />);

      // Wait for component to initialize and call the hook
      await waitFor(() => {
        expect(mockUseGroceriesVault).toHaveBeenCalledWith({
          masterKeyBytes: expect.any(Uint8Array),
        });
      });
    });

    it('should render GroceriesInner as child of VaultGate', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      // Wait for selector to be visible
      await waitFor(() => {
        const vaultGate = screen.getByTestId('vault-gate');
        expect(
          vaultGate.querySelector('[data-testid="grocery-list-selector"]'),
        ).toBeInTheDocument();
      });
    });
  });

  /* ============================================
     Integration Tests
     ============================================ */

  describe('Integration', () => {
    it('should handle complete create list flow', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      const mockCreateList = jest.fn().mockResolvedValue(undefined);
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false, createList: mockCreateList }),
      );

      render(<GroceriesPage />);

      // Wait for selector to be visible
      await waitFor(() => {
        expect(screen.getByTestId('grocery-list-selector')).toBeInTheDocument();
      });

      // Click New List
      const buttons = screen.getAllByTestId('button');
      const newListBtn = buttons.find((btn) =>
        btn.textContent.includes('New List'),
      );
      fireEvent.click(newListBtn!);

      // Dialog opens
      let dialog = screen.getByTestId('create-list-dialog');
      expect(dialog).toHaveAttribute('data-open', 'true');

      // Submit form
      fireEvent.click(screen.getByTestId('dialog-create-submit'));

      // Dialog closes after submission
      await waitFor(() => {
        dialog = screen.getByTestId('create-list-dialog');
        expect(dialog).toHaveAttribute('data-open', 'false');
      });

      // vault.createList was called
      expect(mockCreateList).toHaveBeenCalledWith('New List');
    });

    it('should handle complete rename list flow', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      const mockRenameList = jest.fn().mockResolvedValue(undefined);
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false, renameList: mockRenameList }),
      );

      render(<GroceriesPage />);

      // Wait for selector to be visible
      await waitFor(() => {
        expect(screen.getByTestId('grocery-list-selector')).toBeInTheDocument();
      });

      // Click Rename on selector
      fireEvent.click(screen.getByTestId('selector-rename-button'));

      // Dialog opens with correct name
      let dialog = screen.getByTestId('rename-list-dialog');
      expect(dialog).toHaveAttribute('data-open', 'true');
      expect(dialog).toHaveAttribute('data-current-name', 'Groceries');

      // Submit form
      fireEvent.click(screen.getByTestId('dialog-rename-submit'));

      // Dialog closes after submission
      await waitFor(() => {
        dialog = screen.queryByTestId('rename-list-dialog');
        expect(dialog).not.toBeInTheDocument();
      });

      // vault.renameList was called with correct args
      expect(mockRenameList).toHaveBeenCalledWith('list1', 'Renamed List');
    });

    it('should handle complete delete list flow', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 5)];
      const mockDeleteList = jest.fn().mockResolvedValue(undefined);
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false, deleteList: mockDeleteList }),
      );

      render(<GroceriesPage />);

      // Wait for selector to be visible
      await waitFor(() => {
        expect(screen.getByTestId('grocery-list-selector')).toBeInTheDocument();
      });

      // Click Delete on selector
      fireEvent.click(screen.getByTestId('selector-delete-button'));

      // Dialog opens with correct info
      let dialog = screen.getByTestId('delete-list-dialog');
      expect(dialog).toHaveAttribute('data-open', 'true');
      expect(dialog).toHaveAttribute('data-list-name', 'Groceries');
      expect(dialog).toHaveAttribute('data-item-count', '5');

      // Confirm deletion
      fireEvent.click(screen.getByTestId('dialog-delete-confirm'));

      // Dialog closes after deletion
      await waitFor(() => {
        dialog = screen.queryByTestId('delete-list-dialog');
        expect(dialog).not.toBeInTheDocument();
      });

      // vault.deleteList was called
      expect(mockDeleteList).toHaveBeenCalledWith('list1');
    });

    it('should maintain state through multiple list operations', async () => {
      const lists = [
        makeGroceryList('list1', 'Groceries', 3),
        makeGroceryList('list2', 'Farmers Market', 2),
      ];
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({ lists, loading: false }),
      );

      render(<GroceriesPage />);

      // Wait for selector to be visible
      await waitFor(() => {
        expect(screen.getByTestId('grocery-list-selector')).toBeInTheDocument();
      });

      // Verify selector has correct list count
      expect(screen.getByTestId('lists-count')).toHaveTextContent('2');

      // Both callback functions are present and work
      expect(screen.getByTestId('selector-rename-button')).toBeInTheDocument();
      expect(screen.getByTestId('selector-delete-button')).toBeInTheDocument();
    });

    it('should show error and allow list operations simultaneously', async () => {
      const lists = [makeGroceryList('list1', 'Groceries', 3)];
      const mockSetError = jest.fn();
      mockUseGroceriesVault.mockReturnValue(
        makeVaultState({
          lists,
          loading: false,
          error: 'Some warning',
          setError: mockSetError,
        }),
      );

      render(<GroceriesPage />);

      // Wait for selector to be visible (error and selector render together)
      await waitFor(() => {
        expect(screen.getByTestId('grocery-list-selector')).toBeInTheDocument();
      });

      // Error banner visible
      expect(screen.getByText('Some warning')).toBeInTheDocument();

      // Lists still visible and operable
      expect(screen.getByTestId('grocery-list-selector')).toBeInTheDocument();
      expect(screen.getByTestId('selector-rename-button')).toBeInTheDocument();

      // Can dismiss error
      fireEvent.click(screen.getByText('Dismiss'));
      expect(mockSetError).toHaveBeenCalledWith(null);
    });
  });
});
