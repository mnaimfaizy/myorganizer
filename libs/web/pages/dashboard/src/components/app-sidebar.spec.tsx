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
  SidebarHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-header">{children}</div>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-content">{children}</div>
  ),
  SidebarRail: () => <div data-testid="sidebar-rail" />,
  AppLogo: () => <div data-testid="app-logo" />,
}));

jest.mock('./nav-main', () => ({
  NavMain: jest.fn(({ items }: { items: { title: string }[] }) => (
    <div data-testid="nav-main" data-items={items.length}>
      {items.map((item: { title: string }) => (
        <div
          key={item.title}
          data-testid={`nav-item-${item.title.toLowerCase()}`}
        >
          {item.title}
        </div>
      ))}
    </div>
  )),
}));

jest.mock('./nav-user', () => ({
  NavUser: jest.fn(({ user }) => <div data-testid="nav-user">{user.name}</div>),
}));

import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { getCurrentUser } from '@myorganizer/auth';
import { useSidebar } from '@myorganizer/web-ui';
import { useYouTubeNavVisible } from '../hooks/useYouTubeNavVisible';
import { AppSidebar } from './app-sidebar';
import { NavMain } from './nav-main';
import { NavUser } from './nav-user';

describe('AppSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useYouTubeNavVisible as jest.Mock).mockReturnValue(false);
    (getCurrentUser as jest.Mock).mockReturnValue({
      name: 'Test User',
      email: 'test@example.com',
    });
    (useSidebar as jest.Mock).mockReturnValue({
      state: 'expanded',
    });
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
});
