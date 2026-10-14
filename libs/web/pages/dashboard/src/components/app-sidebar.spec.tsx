/* eslint-disable import/first */
jest.mock('../hooks/useYouTubeNavVisible', () => ({
  useYouTubeNavVisible: jest.fn(),
}));

jest.mock('@myorganizer/auth', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@myorganizer/web-ui', () => ({
  ...jest.requireActual('@myorganizer/web-ui'),
  useSidebar: jest.fn(),
  Sidebar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar">{children}</div>
  ),
  // Stubs forward props; the capture-phase drawer close sits on the content.
  SidebarHeader: (props: React.ComponentProps<'div'>) => (
    <div data-testid="sidebar-header" {...props} />
  ),
  SidebarContent: (props: React.ComponentProps<'div'>) => (
    <div data-testid="sidebar-content" {...props} />
  ),
  SidebarRail: () => <div data-testid="sidebar-rail" />,
  AppLogo: () => <div data-testid="app-logo" />,
}));

jest.mock('./nav-main', () => ({
  NavMain: jest.fn(({ items }: { items: { title: string; url: string }[] }) => (
    <div data-testid="nav-main" data-items={items.length}>
      {items.map((item: { title: string; url: string }) => (
        <a
          key={item.title}
          href={item.url}
          data-testid={`nav-item-${item.title.toLowerCase()}`}
        >
          {item.title}
        </a>
      ))}
    </div>
  )),
}));

jest.mock('./nav-user', () => ({
  NavUser: jest.fn(({ user }) => (
    <button type="button" data-testid="nav-user">
      {user.name}
    </button>
  )),
}));

import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { getCurrentUser } from '@myorganizer/auth';
import { useSidebar } from '@myorganizer/web-ui';
import { useYouTubeNavVisible } from '../hooks/useYouTubeNavVisible';
import { AppSidebar } from './app-sidebar';
import { NavMain } from './nav-main';
import { NavUser } from './nav-user';

function stubSidebar(isMobile: boolean) {
  const sidebar = {
    state: 'expanded',
    open: true,
    isMobile,
    openMobile: false,
    setOpen: jest.fn(),
    setOpenMobile: jest.fn(),
    toggleSidebar: jest.fn(),
  };
  (useSidebar as jest.Mock).mockReturnValue(sidebar);
  return sidebar;
}

describe('AppSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useYouTubeNavVisible as jest.Mock).mockReturnValue(false);
    (getCurrentUser as jest.Mock).mockReturnValue({
      name: 'Test User',
      email: 'test@example.com',
    });
    stubSidebar(false);
  });

  describe('YouTube nav visibility', () => {
    it('should show YouTube when useYouTubeNavVisible returns true', () => {
      (useYouTubeNavVisible as jest.Mock).mockReturnValue(true);

      render(<AppSidebar />);

      const navMainCall = (NavMain as jest.Mock).mock.calls[0][0];
      expect(navMainCall.items).toHaveLength(8);
      const youtubeItem = navMainCall.items.find(
        (item: { title: string }) => item.title === 'YouTube',
      );
      expect(youtubeItem).toBeDefined();
    });

    it('should hide YouTube when useYouTubeNavVisible returns false', () => {
      (useYouTubeNavVisible as jest.Mock).mockReturnValue(false);

      render(<AppSidebar />);

      const navMainCall = (NavMain as jest.Mock).mock.calls[0][0];
      expect(navMainCall.items).toHaveLength(7);
      const youtubeItem = navMainCall.items.find(
        (item: { title: string }) => item.title === 'YouTube',
      );
      expect(youtubeItem).toBeUndefined();
    });
  });

  describe('permanent nav items', () => {
    it.each([true, false])(
      'should always show other nav items when youtubeNavVisible=%p',
      (youtubeNavVisible) => {
        (useYouTubeNavVisible as jest.Mock).mockReturnValue(youtubeNavVisible);

        render(<AppSidebar />);

        const navMainCall = (NavMain as jest.Mock).mock.calls[0][0];
        const items = navMainCall.items;

        const expectedItems = [
          'Home',
          'Tasks',
          'Groceries',
          'Addresses',
          'Mobile Numbers',
          'Subscriptions',
          'Vault',
        ];
        expectedItems.forEach((title) => {
          const item = items.find((i: { title: string }) => i.title === title);
          expect(item).toBeDefined();
          expect(item.title).toBe(title);
        });
      },
    );
  });

  describe('user data', () => {
    it('should pass correct user data to NavUser', () => {
      (getCurrentUser as jest.Mock).mockReturnValue({
        name: 'John Doe',
        email: 'john@example.com',
      });

      render(<AppSidebar />);

      const navUserCall = (NavUser as jest.Mock).mock.calls[0][0];
      expect(navUserCall.user.name).toBe('John Doe');
      expect(navUserCall.user.email).toBe('john@example.com');
      expect(navUserCall.user.avatar).toBe('');
    });

    it('should handle missing user data', () => {
      (getCurrentUser as jest.Mock).mockReturnValue(null);

      render(<AppSidebar />);

      const navUserCall = (NavUser as jest.Mock).mock.calls[0][0];
      expect(navUserCall.user.name).toBe('');
      expect(navUserCall.user.email).toBe('');
    });
  });

  describe('drawer closes after navigation on phone width', () => {
    it('should close the mobile drawer when a top-level nav link is chosen', () => {
      const sidebar = stubSidebar(true);

      render(<AppSidebar />);
      fireEvent.click(screen.getByRole('link', { name: 'Tasks' }));

      expect(sidebar.setOpenMobile).toHaveBeenCalledWith(false);
      expect(sidebar.setOpen).not.toHaveBeenCalled();
    });

    it('should close the mobile drawer for a link to the page already open', () => {
      // AppSidebar reads no pathname, so closing cannot depend on a route change.
      const sidebar = stubSidebar(true);

      render(<AppSidebar />);
      fireEvent.click(screen.getByRole('link', { name: 'Home' }));

      expect(sidebar.setOpenMobile).toHaveBeenCalledWith(false);
    });

    it('should leave the mobile drawer open when a non-link control is chosen', () => {
      const sidebar = stubSidebar(true);

      render(<AppSidebar />);
      fireEvent.click(screen.getByRole('button', { name: 'Test User' }));

      expect(sidebar.setOpenMobile).not.toHaveBeenCalled();
    });

    it('should not touch drawer state on desktop when a nav link is chosen', () => {
      const sidebar = stubSidebar(false);

      render(<AppSidebar />);
      fireEvent.click(screen.getByRole('link', { name: 'Tasks' }));

      expect(sidebar.setOpenMobile).not.toHaveBeenCalled();
      expect(sidebar.setOpen).not.toHaveBeenCalled();
    });
  });
});
