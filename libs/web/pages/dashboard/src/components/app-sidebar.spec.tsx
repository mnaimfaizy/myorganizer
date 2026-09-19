/* eslint-disable import/first */
jest.mock('@myorganizer/web/pages/youtube', () => ({
  useYouTubeAvailability: jest.fn(),
}));

jest.mock('@myorganizer/auth', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@myorganizer/web-ui', () => ({
  ...jest.requireActual('@myorganizer/web-ui'),
  useSidebar: jest.fn(),
}));

jest.mock('./nav-main', () => ({
  NavMain: jest.fn(({ items }) => (
    <div data-testid="nav-main" data-items={items.length}>
      {items.map((item) => (
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
import { AppSidebar } from './app-sidebar';
import { useYouTubeAvailability } from '@myorganizer/web/pages/youtube';
import { getCurrentUser, useSidebar } from '@myorganizer/web-ui';
import { NavMain } from './nav-main';
import { NavUser } from './nav-user';

describe('AppSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useYouTubeAvailability as jest.Mock).mockReturnValue({
      available: false,
      loading: false,
      error: null,
    });
    (getCurrentUser as jest.Mock).mockReturnValue({
      name: 'Test User',
      email: 'test@example.com',
    });
    (useSidebar as jest.Mock).mockReturnValue({
      state: 'expanded',
    });
  });

  describe('YouTube availability', () => {
    it('should show YouTube when available', () => {
      (useYouTubeAvailability as jest.Mock).mockReturnValue({
        available: true,
        loading: false,
        error: null,
      });

      render(<AppSidebar />);

      const navMainCall = (NavMain as jest.Mock).mock.calls[0][0];
      expect(navMainCall.items).toHaveLength(8);
      const youtubeItem = navMainCall.items.find(
        (item: any) => item.title === 'YouTube',
      );
      expect(youtubeItem).toBeDefined();
    });

    it('should hide YouTube when unavailable', () => {
      (useYouTubeAvailability as jest.Mock).mockReturnValue({
        available: false,
        loading: false,
        error: null,
      });

      render(<AppSidebar />);

      const navMainCall = (NavMain as jest.Mock).mock.calls[0][0];
      expect(navMainCall.items).toHaveLength(7);
      const youtubeItem = navMainCall.items.find(
        (item: any) => item.title === 'YouTube',
      );
      expect(youtubeItem).toBeUndefined();
    });

    it('should hide YouTube while loading', () => {
      (useYouTubeAvailability as jest.Mock).mockReturnValue({
        available: null,
        loading: true,
        error: null,
      });

      render(<AppSidebar />);

      const navMainCall = (NavMain as jest.Mock).mock.calls[0][0];
      expect(navMainCall.items).toHaveLength(7);
      const youtubeItem = navMainCall.items.find(
        (item: any) => item.title === 'YouTube',
      );
      expect(youtubeItem).toBeUndefined();
    });

    it('should hide YouTube on error', () => {
      (useYouTubeAvailability as jest.Mock).mockReturnValue({
        available: null,
        loading: false,
        error: new Error('Network error'),
      });

      render(<AppSidebar />);

      const navMainCall = (NavMain as jest.Mock).mock.calls[0][0];
      expect(navMainCall.items).toHaveLength(7);
      const youtubeItem = navMainCall.items.find(
        (item: any) => item.title === 'YouTube',
      );
      expect(youtubeItem).toBeUndefined();
    });

    it('should hide YouTube when available is null and not loading', () => {
      (useYouTubeAvailability as jest.Mock).mockReturnValue({
        available: null,
        loading: false,
        error: null,
      });

      render(<AppSidebar />);

      const navMainCall = (NavMain as jest.Mock).mock.calls[0][0];
      expect(navMainCall.items).toHaveLength(7);
      const youtubeItem = navMainCall.items.find(
        (item: any) => item.title === 'YouTube',
      );
      expect(youtubeItem).toBeUndefined();
    });
  });

  describe('permanent nav items', () => {
    const states = [
      { available: true, loading: false, error: null },
      { available: false, loading: false, error: null },
      { available: null, loading: true, error: null },
    ];

    it.each(states)(
      'should always show other nav items - state: available=%p',
      (state) => {
        (useYouTubeAvailability as jest.Mock).mockReturnValue(state);

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
          const item = items.find((i: any) => i.title === title);
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
