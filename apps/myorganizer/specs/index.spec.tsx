import React from 'react';
import { render } from '@testing-library/react';
import Page from '../src/app/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock('@myorganizer/auth', () => ({
  getAccessToken: () => null,
  getCurrentUser: () => null,
  refresh: jest.fn(),
  clearAuthSession: jest.fn(),
}));

describe('Page', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Page />);
    expect(baseElement).toBeTruthy();
  });
});
