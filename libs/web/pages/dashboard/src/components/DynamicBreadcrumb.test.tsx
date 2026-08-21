/* eslint-disable import/first */
jest.mock('next/navigation');

import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { DynamicBreadcrumb } from './DynamicBreadcrumb';

describe('DynamicBreadcrumb', () => {
  beforeEach(() => {
    (usePathname as jest.Mock).mockClear();
  });

  describe('root dashboard route', () => {
    it('renders a single Dashboard breadcrumb item as current page', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard');
      render(<DynamicBreadcrumb />);

      // Should have exactly one breadcrumb item showing Dashboard
      const navElement = screen.getByRole('navigation', { name: 'breadcrumb' });
      expect(navElement).toBeInTheDocument();

      // Dashboard should be rendered as BreadcrumbPage (span with aria-current="page")
      const currentPage = screen.getByRole('link', {
        name: 'Dashboard',
        current: 'page',
      });
      expect(currentPage).toBeInTheDocument();

      // Should not render any separators for single item
      const separators = navElement.querySelectorAll('[role="presentation"]');
      expect(separators).toHaveLength(0);
    });

    it('applies hidden md:block class to Dashboard item when it is the only item (index 0)', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard');
      render(<DynamicBreadcrumb />);

      const navElement = screen.getByRole('navigation', { name: 'breadcrumb' });
      const items = navElement.querySelectorAll('li');

      // Single item at index 0 always has "hidden md:block" per component logic
      expect(items[0]).toHaveClass('hidden', 'md:block');
    });
  });

  describe('single-level routes', () => {
    it('renders Dashboard > Tasks breadcrumb for /dashboard/tasks', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/tasks');
      render(<DynamicBreadcrumb />);

      const navElement = screen.getByRole('navigation', { name: 'breadcrumb' });

      // Should have Dashboard as link and Tasks as current page
      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
      expect(dashboardLink).toBeInTheDocument();
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');

      const tasksPage = screen.getByRole('link', {
        name: 'Tasks',
        current: 'page',
      });
      expect(tasksPage).toBeInTheDocument();

      // Should have one separator
      const separators = navElement.querySelectorAll('[role="presentation"]');
      expect(separators).toHaveLength(1);
      expect(separators[0]).toHaveClass('hidden md:block');
    });

    it('renders Dashboard > Groceries breadcrumb for /dashboard/groceries', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/groceries');
      render(<DynamicBreadcrumb />);

      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');

      const groceriesPage = screen.getByRole('link', {
        name: 'Groceries',
        current: 'page',
      });
      expect(groceriesPage).toBeInTheDocument();
    });

    it('renders Dashboard > Addresses breadcrumb for /dashboard/addresses', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/addresses');
      render(<DynamicBreadcrumb />);

      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');

      const addressesPage = screen.getByRole('link', {
        name: 'Addresses',
        current: 'page',
      });
      expect(addressesPage).toBeInTheDocument();
    });

    it('renders Dashboard > Mobile Numbers breadcrumb for /dashboard/mobile-numbers', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/mobile-numbers');
      render(<DynamicBreadcrumb />);

      const mobileNumbersPage = screen.getByRole('link', {
        name: 'Mobile Numbers',
        current: 'page',
      });
      expect(mobileNumbersPage).toBeInTheDocument();
    });

    it('renders Dashboard > Subscriptions breadcrumb for /dashboard/subscriptions', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/subscriptions');
      render(<DynamicBreadcrumb />);

      const subscriptionsPage = screen.getByRole('link', {
        name: 'Subscriptions',
        current: 'page',
      });
      expect(subscriptionsPage).toBeInTheDocument();
    });

    it('renders Dashboard > YouTube breadcrumb for /dashboard/youtube', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/youtube');
      render(<DynamicBreadcrumb />);

      const youtubeLink = screen.getByRole('link', {
        name: 'YouTube',
        current: 'page',
      });
      expect(youtubeLink).toBeInTheDocument();
    });

    it('renders Dashboard > Vault Export/Import breadcrumb for /dashboard/vault-export', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/vault-export');
      render(<DynamicBreadcrumb />);

      const vaultExportPage = screen.getByRole('link', {
        name: 'Vault Export/Import',
        current: 'page',
      });
      expect(vaultExportPage).toBeInTheDocument();
    });

    it('hides the first Dashboard item on mobile for two-item breadcrumbs', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/tasks');
      render(<DynamicBreadcrumb />);

      const navElement = screen.getByRole('navigation', { name: 'breadcrumb' });
      const items = navElement.querySelectorAll('li');

      // First item (Dashboard) should have "hidden md:block" class
      expect(items[0]).toHaveClass('hidden', 'md:block');
    });
  });

  describe('nested routes', () => {
    it('renders Dashboard > Account > Vault Settings breadcrumb for /dashboard/account/vault', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/account/vault');
      render(<DynamicBreadcrumb />);

      const navElement = screen.getByRole('navigation', { name: 'breadcrumb' });

      // Dashboard as link
      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
      expect(dashboardLink).toBeInTheDocument();
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');

      // Account as link
      const accountLink = screen.getByRole('link', { name: 'Account' });
      expect(accountLink).toBeInTheDocument();
      expect(accountLink).toHaveAttribute('href', '/dashboard/account');

      // Vault Settings as current page
      const vaultSettingsPage = screen.getByRole('link', {
        name: 'Vault Settings',
        current: 'page',
      });
      expect(vaultSettingsPage).toBeInTheDocument();

      // Should have two separators
      const separators = navElement.querySelectorAll('[role="presentation"]');
      expect(separators).toHaveLength(2);
      separators.forEach((separator) => {
        expect(separator).toHaveClass('hidden md:block');
      });
    });

    it('hides the first Dashboard item on mobile for three-item breadcrumbs', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/account/vault');
      render(<DynamicBreadcrumb />);

      const navElement = screen.getByRole('navigation', { name: 'breadcrumb' });
      const allItems = navElement.querySelectorAll('li');

      // First li element (Dashboard BreadcrumbItem) should have "hidden md:block" class
      expect(allItems[0]).toHaveClass('hidden', 'md:block');

      // Second li element is a separator (has "hidden md:block"), third is Account item
      // Account breadcrumb item (non-separator li) should not have "hidden md:block"
      const breadcrumbItems = navElement.querySelectorAll(
        'li:not([role="presentation"])',
      );
      expect(breadcrumbItems[1]).not.toHaveClass('hidden md:block');
    });
  });

  describe('unknown routes', () => {
    it('falls back to Dashboard breadcrumb for unknown route', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/unknown-path');
      render(<DynamicBreadcrumb />);

      // Should render only Dashboard as current page
      const currentPage = screen.getByRole('link', {
        name: 'Dashboard',
        current: 'page',
      });
      expect(currentPage).toBeInTheDocument();

      // Should not render any separators
      const navElement = screen.getByRole('navigation', { name: 'breadcrumb' });
      const separators = navElement.querySelectorAll('[role="presentation"]');
      expect(separators).toHaveLength(0);
    });

    it('falls back to Dashboard breadcrumb for route with trailing slash', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/tasks/');
      render(<DynamicBreadcrumb />);

      // Should render only Dashboard as current page (no exact match)
      const currentPage = screen.getByRole('link', {
        name: 'Dashboard',
        current: 'page',
      });
      expect(currentPage).toBeInTheDocument();
    });

    it('falls back to Dashboard breadcrumb for completely unrelated route', () => {
      (usePathname as jest.Mock).mockReturnValue('/some/other/path');
      render(<DynamicBreadcrumb />);

      // Should render only Dashboard as current page
      const currentPage = screen.getByRole('link', {
        name: 'Dashboard',
        current: 'page',
      });
      expect(currentPage).toBeInTheDocument();
    });
  });

  describe('aria attributes', () => {
    it('sets aria-current="page" on the current breadcrumb item', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/tasks');
      render(<DynamicBreadcrumb />);

      const tasksPage = screen.getByRole('link', {
        name: 'Tasks',
        current: 'page',
      });
      expect(tasksPage).toHaveAttribute('aria-current', 'page');
    });

    it('sets aria-disabled="true" on the current breadcrumb item', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/tasks');
      render(<DynamicBreadcrumb />);

      const tasksPage = screen.getByRole('link', {
        name: 'Tasks',
        current: 'page',
      });
      expect(tasksPage).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not set aria-current on non-current breadcrumb items', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/tasks');
      render(<DynamicBreadcrumb />);

      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
      expect(dashboardLink).not.toHaveAttribute('aria-current');
      expect(dashboardLink).not.toHaveAttribute('aria-disabled');
    });

    it('marks separator elements as presentation-only', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/tasks');
      render(<DynamicBreadcrumb />);

      const navElement = screen.getByRole('navigation', { name: 'breadcrumb' });
      const separators = navElement.querySelectorAll('[role="presentation"]');

      separators.forEach((separator) => {
        expect(separator).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('responsive design', () => {
    it('hides all separators on mobile', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/tasks');
      render(<DynamicBreadcrumb />);

      const navElement = screen.getByRole('navigation', { name: 'breadcrumb' });
      const separators = navElement.querySelectorAll('[role="presentation"]');

      separators.forEach((separator) => {
        expect(separator).toHaveClass('hidden md:block');
      });
    });

    it('hides multiple separators on mobile for nested routes', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/account/vault');
      render(<DynamicBreadcrumb />);

      const navElement = screen.getByRole('navigation', { name: 'breadcrumb' });
      const separators = navElement.querySelectorAll('[role="presentation"]');

      expect(separators.length).toBeGreaterThan(0);
      separators.forEach((separator) => {
        expect(separator).toHaveClass('hidden md:block');
      });
    });
  });

  describe('breadcrumb structure', () => {
    it('renders Breadcrumb as a nav element with aria-label', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard');
      render(<DynamicBreadcrumb />);

      const navElement = screen.getByRole('navigation', { name: 'breadcrumb' });
      expect(navElement.tagName).toBe('NAV');
    });

    it('renders BreadcrumbList as an ordered list', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/tasks');
      render(<DynamicBreadcrumb />);

      const navElement = screen.getByRole('navigation', { name: 'breadcrumb' });
      const listElement = navElement.querySelector('ol');
      expect(listElement).toBeInTheDocument();
    });

    it('renders all breadcrumb items as list items', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/account/vault');
      render(<DynamicBreadcrumb />);

      const navElement = screen.getByRole('navigation', { name: 'breadcrumb' });
      const listItems = navElement.querySelectorAll('li');

      // 3 items + 2 separators = 5 list items total
      expect(listItems.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('link navigation', () => {
    it('provides correct href for Dashboard link in single-level routes', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/tasks');
      render(<DynamicBreadcrumb />);

      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });

    it('provides correct href for intermediate breadcrumb links in nested routes', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/account/vault');
      render(<DynamicBreadcrumb />);

      const accountLink = screen.getByRole('link', { name: 'Account' });
      expect(accountLink).toHaveAttribute('href', '/dashboard/account');
    });

    it('does not provide href for the current page breadcrumb', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/tasks');
      render(<DynamicBreadcrumb />);

      const tasksPage = screen.getByRole('link', {
        name: 'Tasks',
        current: 'page',
      });
      expect(tasksPage).not.toHaveAttribute('href');
    });
  });
});
