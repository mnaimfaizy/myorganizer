import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { YouTubeUnavailableNotice } from './YouTubeUnavailableNotice';

jest.mock('@myorganizer/web-ui', () => ({
  Button: ({ children, asChild, onClick, ...props }: any) => {
    if (asChild) return children;
    return (
      <button onClick={onClick} {...props}>
        {children}
      </button>
    );
  },
}));

jest.mock('next/link', () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

describe('YouTubeUnavailableNotice', () => {
  describe('default (no onBack)', () => {
    it('renders heading and body', () => {
      render(<YouTubeUnavailableNotice />);

      expect(
        screen.getByRole('heading', {
          name: 'YouTube is not available right now',
          level: 2,
        }),
      ).toBeInTheDocument();
      expect(screen.getByText('Please try again later.')).toBeInTheDocument();
    });

    it('renders Back to Dashboard as a link to /dashboard', () => {
      render(<YouTubeUnavailableNotice />);

      const backLink = screen.getByRole('link', { name: 'Back to Dashboard' });
      expect(backLink).toHaveAttribute('href', '/dashboard');
    });
  });

  describe('with onBack', () => {
    it('renders Back to Dashboard as a button', () => {
      const onBack = jest.fn();
      render(<YouTubeUnavailableNotice onBack={onBack} />);

      const backButton = screen.getByRole('button', {
        name: 'Back to Dashboard',
      });
      expect(backButton).toBeInTheDocument();
      expect(backButton).toHaveAttribute('type', 'button');
    });

    it('calls onBack once when Back to Dashboard is clicked', () => {
      const onBack = jest.fn();
      render(<YouTubeUnavailableNotice onBack={onBack} />);

      fireEvent.click(
        screen.getByRole('button', { name: 'Back to Dashboard' }),
      );
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('does not render a /dashboard link', () => {
      const onBack = jest.fn();
      render(<YouTubeUnavailableNotice onBack={onBack} />);

      expect(
        screen.queryByRole('link', { name: 'Back to Dashboard' }),
      ).not.toBeInTheDocument();
    });
  });
});
