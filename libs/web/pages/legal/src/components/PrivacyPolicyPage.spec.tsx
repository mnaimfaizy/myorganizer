import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import PrivacyPolicyPage from './PrivacyPolicyPage';

jest.mock('@myorganizer/web-ui', () => ({
  Button: ({ children, asChild, ...props }: any) => {
    if (asChild) return children;
    return <button {...props}>{children}</button>;
  },
  Card: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

jest.mock('next/link', () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

describe('PrivacyPolicyPage', () => {
  afterEach(() => {
    delete process.env.OPERATOR_NAME;
    delete process.env.OPERATOR_CONTACT_EMAIL;
  });

  describe('Public rendering', () => {
    it('should render the "Privacy Policy" heading', () => {
      render(<PrivacyPolicyPage />);
      expect(
        screen.getByRole('heading', {
          name: /Privacy Policy/i,
          level: 1,
        }),
      ).toBeInTheDocument();
    });

    it('should render without throwing when no env vars are set', () => {
      expect(() => {
        render(<PrivacyPolicyPage />);
      }).not.toThrow();
    });
  });

  describe('YouTube Integration disclosure', () => {
    it('should disclose the youtube.readonly scope', () => {
      const { container } = render(<PrivacyPolicyPage />);
      const text = container.textContent || '';
      expect(text).toMatch(/youtube\.readonly/);
    });

    it('should describe youtube.readonly as read-only access', () => {
      const { container } = render(<PrivacyPolicyPage />);
      const text = container.textContent || '';
      expect(text).toMatch(/read-only access/i);
    });

    it('should disclose that OAuth tokens are encrypted at rest', () => {
      const { container } = render(<PrivacyPolicyPage />);
      const text = container.textContent || '';
      expect(text).toMatch(/YouTube OAuth tokens are encrypted at rest/i);
    });

    it('should disclose stored metadata categories', () => {
      const { container } = render(<PrivacyPolicyPage />);
      const text = container.textContent || '';
      expect(text).toMatch(/video ID/i);
      expect(text).toMatch(/title/i);
      expect(text).toMatch(/thumbnail/i);
      expect(text).toMatch(/publish date/i);
      expect(text).toMatch(/duration/i);
    });

    it('should disclose that video files are never stored', () => {
      const { container } = render(<PrivacyPolicyPage />);
      const text = container.textContent || '';
      expect(text).toMatch(/never store the video files themselves/i);
    });

    it('should describe revocation via dashboard YouTube page', () => {
      const { container } = render(<PrivacyPolicyPage />);
      const text = container.textContent || '';
      expect(text).toMatch(/disconnecting YouTube from the YouTube page/i);
    });

    it('should describe revocation via Google Account access settings', () => {
      const { container } = render(<PrivacyPolicyPage />);
      const text = container.textContent || '';
      expect(text).toMatch(/revoking MyOrganizer's access.*Google Account/i);
    });

    it('should describe the effect of revocation', () => {
      const { container } = render(<PrivacyPolicyPage />);
      const text = container.textContent || '';
      expect(text).toMatch(/stops syncing your YouTube data/i);
    });

    it('should render link to YouTube Data Privacy page', () => {
      render(<PrivacyPolicyPage />);
      const link = screen.getByRole('link', {
        name: /YouTube Data Privacy page/i,
      });
      expect(link).toHaveAttribute('href', '/youtube/data-privacy');
    });
  });

  describe('Operator & Contact section', () => {
    it('should render operator section when OPERATOR_NAME is set', () => {
      process.env.OPERATOR_NAME = 'Acme Ops';
      const { container } = render(<PrivacyPolicyPage />);
      const text = container.textContent || '';
      expect(text).toMatch(/Operator & Contact/i);
      expect(text).toMatch(/Acme Ops/);
    });

    it('should render contact email link when both OPERATOR_NAME and OPERATOR_CONTACT_EMAIL are set', () => {
      process.env.OPERATOR_NAME = 'Acme Ops';
      process.env.OPERATOR_CONTACT_EMAIL = 'privacy@acme.test';
      render(<PrivacyPolicyPage />);
      const emailLink = screen.getByRole('link', {
        name: /privacy@acme\.test/i,
      });
      expect(emailLink).toHaveAttribute('href', 'mailto:privacy@acme.test');
    });

    it('should not render contact email link when only OPERATOR_NAME is set', () => {
      process.env.OPERATOR_NAME = 'Acme Ops';
      // Do not set OPERATOR_CONTACT_EMAIL
      const { container } = render(<PrivacyPolicyPage />);
      const text = container.textContent || '';
      expect(text).toMatch(/Acme Ops/);
      expect(text).not.toMatch(/mailto:/);
    });

    it('should render contact email when only OPERATOR_CONTACT_EMAIL is set (no OPERATOR_NAME)', () => {
      process.env.OPERATOR_CONTACT_EMAIL = 'privacy@acme.test';
      render(<PrivacyPolicyPage />);
      const emailLink = screen.getByRole('link', {
        name: /privacy@acme\.test/i,
      });
      expect(emailLink).toHaveAttribute('href', 'mailto:privacy@acme.test');
    });

    it('should not render Operator section when OPERATOR_NAME is not set', () => {
      const { container } = render(<PrivacyPolicyPage />);
      const text = container.textContent || '';
      expect(text).not.toMatch(/Operator & Contact/i);
      // Ensure no placeholder text like "Your Company" or "[operator name]"
      expect(text).not.toMatch(/\[operator name\]/i);
      expect(text).not.toMatch(/Your Company/i);
    });

    it('should not render Operator section when OPERATOR_NAME is empty string', () => {
      process.env.OPERATOR_NAME = '';
      const { container } = render(<PrivacyPolicyPage />);
      const text = container.textContent || '';
      expect(text).not.toMatch(/Operator & Contact/i);
    });
  });

  describe('Cross-links', () => {
    it('should render Back to Home link', () => {
      render(<PrivacyPolicyPage />);
      const homeLink = screen.getByRole('link', { name: /Back to Home/i });
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('should render Terms of Service link', () => {
      render(<PrivacyPolicyPage />);
      const termsLink = screen.getByRole('link', { name: /Terms of Service/i });
      expect(termsLink).toHaveAttribute('href', '/terms');
    });
  });
});
