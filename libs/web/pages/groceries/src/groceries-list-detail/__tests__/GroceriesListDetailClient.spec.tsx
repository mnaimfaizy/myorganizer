/*
  Tests for GroceriesListDetailClient component.
  - Covers loading state, not-found state, and happy path (list found)
  - Tests vault state transitions and list lookup by ID
  - Mocks useGroceriesVault hook, Next.js router, Next.js Link, GroceryListView, and lucide-react
*/

/** Mocking rule: place jest.mock calls before any imports */

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: Record<string, unknown>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@myorganizer/core', () => ({}));

jest.mock('../../shared/hooks', () => ({
  useGroceriesVault: jest.fn(),
}));

jest.mock('../components', () => ({
  GroceryListView: ({ list }: Record<string, unknown>) => (
    <div data-testid="grocery-list-view">{(list as { name: string }).name}</div>
  ),
}));

jest.mock('lucide-react', () => ({
  ArrowLeft: ({ className }: Record<string, unknown>) => (
    <svg data-testid="arrow-left-icon" className={className as string} viewBox="0 0 24 24" />
  ),
}));

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { GroceryList } from '@myorganizer/core';
import { useGroceriesVault } from '../../shared/hooks';
import { GroceriesListDetailClient } from '../GroceriesListDetailClient';

const mockUseGroceriesVault = useGroceriesVault as jest.Mock;

describe('GroceriesListDetailClient', () => {
  /* ============================================
     Test Helpers
     ============================================ */

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

  const masterKeyBytes = new Uint8Array(32);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ============================================
     Loading State Tests
     ============================================ */

  describe('Loading State', () => {
    it('should render loading container with aria-busy and aria-label when vault.loading=true', () => {
      mockUseGroceriesVault.mockReturnValue({
        loading: true,
        lists: [],
        persistLists: jest.fn(),
      });

      render(
        <GroceriesListDetailClient
          listId="list-1"
          masterKeyBytes={masterKeyBytes}
        />,
      );

      const loadingContainer = screen.getByLabelText('Loading grocery list');
      expect(loadingContainer).toBeInTheDocument();
      expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
    });

    it('should not render GroceryListView during loading state', () => {
      mockUseGroceriesVault.mockReturnValue({
        loading: true,
        lists: [],
        persistLists: jest.fn(),
      });

      render(
        <GroceriesListDetailClient
          listId="list-1"
          masterKeyBytes={masterKeyBytes}
        />,
      );

      expect(
        screen.queryByTestId('grocery-list-view'),
      ).not.toBeInTheDocument();
    });

    it('should not render "List not found" message during loading state', () => {
      mockUseGroceriesVault.mockReturnValue({
        loading: true,
        lists: [],
        persistLists: jest.fn(),
      });

      render(
        <GroceriesListDetailClient
          listId="list-1"
          masterKeyBytes={masterKeyBytes}
        />,
      );

      expect(screen.queryByText('List not found')).not.toBeInTheDocument();
    });
  });

  /* ============================================
     Not Found State Tests
     ============================================ */

  describe('Not Found State', () => {
    it('should render "List not found" heading when list not found', () => {
      mockUseGroceriesVault.mockReturnValue({
        loading: false,
        lists: [],
        persistLists: jest.fn(),
      });

      render(
        <GroceriesListDetailClient
          listId="nonexistent-list"
          masterKeyBytes={masterKeyBytes}
        />,
      );

      expect(screen.getByText('List not found')).toBeInTheDocument();
    });

    it('should render explanatory message when list not found', () => {
      mockUseGroceriesVault.mockReturnValue({
        loading: false,
        lists: [],
        persistLists: jest.fn(),
      });

      render(
        <GroceriesListDetailClient
          listId="nonexistent-list"
          masterKeyBytes={masterKeyBytes}
        />,
      );

      expect(
        screen.getByText(
          "The grocery list you're looking for doesn't exist.",
        ),
      ).toBeInTheDocument();
    });

    it('should render back link with correct href when list not found', () => {
      mockUseGroceriesVault.mockReturnValue({
        loading: false,
        lists: [],
        persistLists: jest.fn(),
      });

      render(
        <GroceriesListDetailClient
          listId="nonexistent-list"
          masterKeyBytes={masterKeyBytes}
        />,
      );

      const backLink = screen.getByRole('link', {
        name: /back to groceries/i,
      });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/dashboard/groceries');
    });

    it('should not render GroceryListView when list not found', () => {
      mockUseGroceriesVault.mockReturnValue({
        loading: false,
        lists: [],
        persistLists: jest.fn(),
      });

      render(
        <GroceriesListDetailClient
          listId="nonexistent-list"
          masterKeyBytes={masterKeyBytes}
        />,
      );

      expect(
        screen.queryByTestId('grocery-list-view'),
      ).not.toBeInTheDocument();
    });
  });

  /* ============================================
     Happy Path Tests
     ============================================ */

  describe('Happy Path - List Found', () => {
    it('should render GroceryListView when list is found', () => {
      const list = makeGroceryList('list-1', 'Vegetables', 3);
      mockUseGroceriesVault.mockReturnValue({
        loading: false,
        lists: [list],
        persistLists: jest.fn(),
      });

      render(
        <GroceriesListDetailClient
          listId="list-1"
          masterKeyBytes={masterKeyBytes}
        />,
      );

      expect(screen.getByTestId('grocery-list-view')).toBeInTheDocument();
    });

    it('should pass correct list to GroceryListView component', () => {
      const list = makeGroceryList('list-1', 'Vegetables', 3);
      mockUseGroceriesVault.mockReturnValue({
        loading: false,
        lists: [list],
        persistLists: jest.fn(),
      });

      render(
        <GroceriesListDetailClient
          listId="list-1"
          masterKeyBytes={masterKeyBytes}
        />,
      );

      expect(screen.getByText('Vegetables')).toBeInTheDocument();
    });

    it('should not render "List not found" message when list is found', () => {
      const list = makeGroceryList('list-1', 'Vegetables', 3);
      mockUseGroceriesVault.mockReturnValue({
        loading: false,
        lists: [list],
        persistLists: jest.fn(),
      });

      render(
        <GroceriesListDetailClient
          listId="list-1"
          masterKeyBytes={masterKeyBytes}
        />,
      );

      expect(
        screen.queryByText('List not found'),
      ).not.toBeInTheDocument();
    });

    it('should render back link when list is found', () => {
      const list = makeGroceryList('list-1', 'Vegetables', 3);
      mockUseGroceriesVault.mockReturnValue({
        loading: false,
        lists: [list],
        persistLists: jest.fn(),
      });

      render(
        <GroceriesListDetailClient
          listId="list-1"
          masterKeyBytes={masterKeyBytes}
        />,
      );

      const backLink = screen.getByRole('link', {
        name: /back to groceries/i,
      });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/dashboard/groceries');
    });

    it('should find correct list by ID when multiple lists exist', () => {
      const list1 = makeGroceryList('list-1', 'Vegetables', 2);
      const list2 = makeGroceryList('list-2', 'Fruits', 3);
      const list3 = makeGroceryList('list-3', 'Dairy', 1);
      mockUseGroceriesVault.mockReturnValue({
        loading: false,
        lists: [list1, list2, list3],
        persistLists: jest.fn(),
      });

      render(
        <GroceriesListDetailClient
          listId="list-2"
          masterKeyBytes={masterKeyBytes}
        />,
      );

      expect(screen.getByText('Fruits')).toBeInTheDocument();
      expect(screen.queryByText('Vegetables')).not.toBeInTheDocument();
      expect(screen.queryByText('Dairy')).not.toBeInTheDocument();
    });
  });
});
