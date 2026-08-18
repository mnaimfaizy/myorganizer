import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { YouTubeConnectPrompt } from './YouTubeConnectPrompt';

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

describe('YouTubeConnectPrompt', () => {
  describe('static content', () => {
    it('should render the main heading', () => {
      render(<YouTubeConnectPrompt />);
      expect(
        screen.getByRole('heading', {
          name: /Connect Your YouTube Account/i,
          level: 2,
        }),
      ).toBeInTheDocument();
    });

    it('should render read-only access sentence', () => {
      render(<YouTubeConnectPrompt />);
      expect(
        screen.getByText(
          /Link your YouTube account to view and manage videos from your Enabled Channels.*read-only access/i,
        ),
      ).toBeInTheDocument();
    });

    it('should render metadata and Watched sentence', () => {
      render(<YouTubeConnectPrompt />);
      expect(
        screen.getByText(/Metadata only — never video files/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Watched is yes\/no, not analytics/),
      ).toBeInTheDocument();
    });

    it('should render the privacy data link', () => {
      render(<YouTubeConnectPrompt />);
      const privacyLink = screen.getByRole('link', {
        name: /How we store your YouTube data/i,
      });
      expect(privacyLink).toHaveAttribute('href', '/youtube/data-privacy');
    });
  });

  describe('onConnect provided — Connect button rendered', () => {
    it('should render "Connect YouTube" button when onConnect is provided', () => {
      const mockOnConnect = jest.fn();
      render(<YouTubeConnectPrompt onConnect={mockOnConnect} />);
      expect(
        screen.getByRole('button', { name: /Connect YouTube/i }),
      ).toBeInTheDocument();
    });

    it('should call onConnect when button is clicked', () => {
      const mockOnConnect = jest.fn();
      render(<YouTubeConnectPrompt onConnect={mockOnConnect} />);
      fireEvent.click(screen.getByRole('button', { name: /Connect YouTube/i }));
      expect(mockOnConnect).toHaveBeenCalledTimes(1);
    });

    it('should NOT render back link when onConnect is provided', () => {
      const mockOnConnect = jest.fn();
      render(<YouTubeConnectPrompt onConnect={mockOnConnect} />);
      expect(
        screen.queryByRole('link', { name: /Back to Videos/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('onConnect NOT provided — Back link rendered', () => {
    it('should render "Back to Videos" link when onConnect is not provided', () => {
      render(<YouTubeConnectPrompt />);
      expect(
        screen.getByRole('link', { name: /Back to Videos/i }),
      ).toBeInTheDocument();
    });

    it('should render back link with default fallbackHref when not provided', () => {
      render(<YouTubeConnectPrompt />);
      const backLink = screen.getByRole('link', { name: /Back to Videos/i });
      expect(backLink).toHaveAttribute('href', '/dashboard/youtube');
    });

    it('should render back link with custom fallbackHref', () => {
      render(<YouTubeConnectPrompt fallbackHref="/custom/path" />);
      const backLink = screen.getByRole('link', { name: /Back to Videos/i });
      expect(backLink).toHaveAttribute('href', '/custom/path');
    });

    it('should NOT render Connect button when onConnect is not provided', () => {
      render(<YouTubeConnectPrompt />);
      expect(
        screen.queryByRole('button', { name: /Connect YouTube/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('statusMessage', () => {
    it('should render statusMessage when provided', () => {
      render(<YouTubeConnectPrompt statusMessage="Account revoked" />);
      expect(screen.getByText('Account revoked')).toBeInTheDocument();
    });

    it('should not render statusMessage when not provided', () => {
      const { container } = render(<YouTubeConnectPrompt />);
      // No text that would only appear in statusMessage rendering
      const yellowText = container.querySelector('.text-yellow-600');
      expect(yellowText).not.toBeInTheDocument();
    });

    it('should render statusMessage with onConnect present', () => {
      const mockOnConnect = jest.fn();
      render(
        <YouTubeConnectPrompt
          onConnect={mockOnConnect}
          statusMessage="Token expired"
        />,
      );
      expect(screen.getByText('Token expired')).toBeInTheDocument();
    });

    it('should render complex ReactNode as statusMessage', () => {
      const statusNode = <span data-testid="custom-status">Custom Status</span>;
      render(<YouTubeConnectPrompt statusMessage={statusNode} />);
      expect(screen.getByTestId('custom-status')).toBeInTheDocument();
    });
  });

  describe('integration: props combinations', () => {
    it('should render all elements with onConnect and statusMessage', () => {
      const mockOnConnect = jest.fn();
      render(
        <YouTubeConnectPrompt
          onConnect={mockOnConnect}
          statusMessage="Revoked"
        />,
      );
      expect(
        screen.getByRole('heading', { name: /Connect Your YouTube Account/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Connect YouTube/i }),
      ).toBeInTheDocument();
      expect(screen.getByText('Revoked')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /How we store your YouTube data/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /Back to Videos/i }),
      ).not.toBeInTheDocument();
    });

    it('should render all elements with no onConnect and custom fallbackHref', () => {
      render(<YouTubeConnectPrompt fallbackHref="/custom" />);
      expect(
        screen.getByRole('heading', { name: /Connect Your YouTube Account/i }),
      ).toBeInTheDocument();
      const backLink = screen.getByRole('link', { name: /Back to Videos/i });
      expect(backLink).toHaveAttribute('href', '/custom');
      expect(
        screen.getByRole('link', { name: /How we store your YouTube data/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Connect YouTube/i }),
      ).not.toBeInTheDocument();
    });
  });
});
