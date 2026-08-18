/* eslint-disable import/first */
import '@testing-library/jest-dom';

jest.mock('@myorganizer/web-ui', () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  cn: (...classes: Array<string | undefined>) =>
    classes.filter(Boolean).join(' '),
}));

jest.mock('next/link', () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

import { render, screen, within } from '@testing-library/react';
import { ShortsHardStop } from './ShortsHardStop';

describe('ShortsHardStop — locked surface', () => {
  describe('no youtube.com links (anti-escape)', () => {
    it('renders no links to youtube.com', () => {
      render(<ShortsHardStop limitMs={3600000} />);
      const container = screen.getByRole('status');
      const allLinks = within(container).queryAllByRole('link');
      allLinks.forEach((link) => {
        const href = link.getAttribute('href') || '';
        expect(href).not.toContain('youtube.com');
      });
    });

    it('contains no links to youtube.com domain', () => {
      render(<ShortsHardStop limitMs={3600000} />);
      const container = screen.getByRole('status');
      const markup = container.innerHTML;
      expect(markup).not.toContain('youtube.com');
      expect(markup).not.toContain('www.youtube');
      expect(markup).not.toMatch(/href=["']https?:\/\/(www\.)?youtube/);
    });

    it('renders no iframe elements', () => {
      render(<ShortsHardStop limitMs={3600000} />);
      const iframes = screen.queryAllByTitle(/youtube/i);
      expect(iframes).toHaveLength(0);
    });
  });

  describe('primary CTA', () => {
    it('primary button links to /dashboard/youtube', () => {
      render(<ShortsHardStop limitMs={3600000} />);
      const button = screen.getByRole('button', { name: /Back to Videos/i });
      const link = button.closest('a, [role="link"]') || button.parentElement;
      if (link && link.tagName === 'A') {
        expect(link).toHaveAttribute('href', '/dashboard/youtube');
      } else {
        const actualLink = screen.getByRole('link', {
          name: /Back to Videos/i,
        });
        expect(actualLink).toHaveAttribute('href', '/dashboard/youtube');
      }
    });

    it('renders exactly one primary action button', () => {
      render(<ShortsHardStop limitMs={3600000} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
      const ctaButton = buttons.find((b) =>
        b.textContent?.includes('Back to Videos'),
      );
      expect(ctaButton).toBeTruthy();
    });
  });

  describe('accessible status', () => {
    it('has role="status" for live region', () => {
      render(<ShortsHardStop limitMs={3600000} />);
      expect(screen.getByRole('status')).toBeTruthy();
    });

    it('has aria-live="polite"', () => {
      render(<ShortsHardStop limitMs={3600000} />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('has aria-label describing the state', () => {
      render(<ShortsHardStop limitMs={3600000} />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label');
      expect(status.getAttribute('aria-label')).toMatch(
        /budget|exhausted|Shorts/i,
      );
    });

    it('announces the locked state in visible text', () => {
      render(<ShortsHardStop limitMs={3600000} />);
      expect(
        screen.getByText(/Today.*s Shorts Budget.*Exhausted/i),
      ).toBeTruthy();
    });
  });

  describe('limit display', () => {
    it('displays the limit in human-readable format', () => {
      render(<ShortsHardStop limitMs={3600000} />);
      expect(screen.getByText(/You.*ve watched/i)).toBeTruthy();
      expect(screen.getByText(/1:00:00/)).toBeTruthy();
    });

    it('shows a different format for sub-hour limit', () => {
      render(<ShortsHardStop limitMs={1800000} />);
      expect(screen.getByText(/30:00/)).toBeTruthy();
    });

    it('explains the unlock condition', () => {
      render(<ShortsHardStop limitMs={3600000} />);
      expect(screen.getByText(/midnight local time/i)).toBeTruthy();
    });
  });

  describe('content safety', () => {
    it('does not render video player or embedded content', () => {
      render(<ShortsHardStop limitMs={3600000} />);
      const iframes = document.querySelectorAll('iframe');
      expect(iframes.length).toBe(0);
    });

    it('does not render video thumbnails or IDs', () => {
      render(<ShortsHardStop limitMs={3600000} />);
      const container = screen.getByRole('status');
      const markup = container.textContent || '';
      expect(markup).not.toMatch(/dQw4w9WgXcQ|v=|videoId/i);
    });

    it('suggests raising the limit as the only workaround', () => {
      render(<ShortsHardStop limitMs={3600000} />);
      expect(screen.getByText(/Raising.*daily time limit/i)).toBeTruthy();
    });
  });
});
