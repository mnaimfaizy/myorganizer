import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import TermsOfServicePage from './TermsOfServicePage';

jest.mock('@myorganiser/web-ui', () => ({
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

describe('TermsOfServicePage', () => {
  afterEach(() => {
    delete process.env.OPERATOR_NAME;
    delete process.env.OPERATOR_CONTACT_EMAIL;
  });

  describe('Public rendering', () => {
    it('should render the "Terms of Service" heading', () => {
      render(<TermsOfServicePage />);
      expect(
        screen.getByRole('heading', {
          name: /Terms of Service/i,
          level: 1,
        }),
      ).toBeInTheDocument();
    });

    it('should render without throwing when no env vars are set', () => {
      expect(() => {
        render(<TermsOfServicePage />);
      }).not.toThrow();
    });
  });

  describe('Description of Service section', () => {
    it('should describe the Vault as end-to-end encrypted with ciphertext-only server storage', () => {
      const { container } = render(<TermsOfServicePage />);
      const text = container.textContent || '';
      expect(text).toMatch(/end-to-end encrypted Vault/i);
      expect(text).toMatch(/server stores only the encrypted version/i);
      expect(text).toMatch(/ciphertext/i);
      expect(text).toMatch(/never has access to the unencrypted contents/i);
    });

    it('should state the YouTube feature is available only to accounts the operator has enabled, uses YouTube API Services, and is read-only', () => {
      const { container } = render(<TermsOfServicePage />);
      const text = container.textContent || '';
      expect(text).toMatch(
        /optional YouTube feature, which is available only to accounts the operator has enabled/,
      );
      expect(text).toMatch(/It uses YouTube API Services and is read-only/);
      expect(text).not.toMatch(/personally know/);
    });

    it('should bind the User to the YouTube Terms of Service through a link', () => {
      const { container } = render(<TermsOfServicePage />);
      const link = screen.getByRole('link', {
        name: /YouTube Terms of Service/i,
      });
      expect(link).toHaveAttribute('href', 'https://www.youtube.com/t/terms');
      const text = container.textContent || '';
      expect(text).toMatch(/agree to be bound by the YouTube Terms of Service/);
    });
  });

  describe('Acceptable Use section', () => {
    it('should prohibit unlawful use', () => {
      const { container } = render(<TermsOfServicePage />);
      const text = container.textContent || '';
      expect(text).toMatch(/unlawful purpose or activity/i);
    });

    it('should prohibit security breach and bypass attempts', () => {
      const { container } = render(<TermsOfServicePage />);
      const text = container.textContent || '';
      expect(text).toMatch(/breach.*compromise.*security/i);
    });
  });

  describe('Limitation of Liability section', () => {
    it('should have Limitation of Liability heading', () => {
      render(<TermsOfServicePage />);
      expect(
        screen.getByRole('heading', {
          name: /Limitation of Liability/i,
          level: 2,
        }),
      ).toBeInTheDocument();
    });
  });

  describe('Operator & Contact section', () => {
    it('should render operator section when OPERATOR_NAME is set', () => {
      process.env.OPERATOR_NAME = 'Acme Ops';
      const { container } = render(<TermsOfServicePage />);
      const text = container.textContent || '';
      expect(text).toMatch(/Operator & Contact/i);
      expect(text).toMatch(/Acme Ops/);
    });

    it('should render contact email link when both OPERATOR_NAME and OPERATOR_CONTACT_EMAIL are set', () => {
      process.env.OPERATOR_NAME = 'Acme Ops';
      process.env.OPERATOR_CONTACT_EMAIL = 'legal@acme.test';
      render(<TermsOfServicePage />);
      const emailLink = screen.getByRole('link', {
        name: /legal@acme\.test/i,
      });
      expect(emailLink).toHaveAttribute('href', 'mailto:legal@acme.test');
    });

    it('should not render contact email link when only OPERATOR_NAME is set', () => {
      process.env.OPERATOR_NAME = 'Acme Ops';
      // Do not set OPERATOR_CONTACT_EMAIL
      const { container } = render(<TermsOfServicePage />);
      const text = container.textContent || '';
      expect(text).toMatch(/Acme Ops/);
      expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    });

    it('should render contact email when only OPERATOR_CONTACT_EMAIL is set (no OPERATOR_NAME)', () => {
      process.env.OPERATOR_CONTACT_EMAIL = 'legal@acme.test';
      render(<TermsOfServicePage />);
      const emailLink = screen.getByRole('link', { name: /legal@acme\.test/i });
      expect(emailLink).toHaveAttribute('href', 'mailto:legal@acme.test');
    });

    it('should not render Operator section when OPERATOR_NAME is not set', () => {
      const { container } = render(<TermsOfServicePage />);
      const text = container.textContent || '';
      expect(text).not.toMatch(/Operator & Contact/i);
      // Ensure no placeholder text like "Your Company" or "[operator name]"
      expect(text).not.toMatch(/\[operator name\]/i);
      expect(text).not.toMatch(/Your Company/i);
    });

    it('should not render Operator section when OPERATOR_NAME is empty string', () => {
      process.env.OPERATOR_NAME = '';
      const { container } = render(<TermsOfServicePage />);
      const text = container.textContent || '';
      expect(text).not.toMatch(/Operator & Contact/i);
    });

    it('should not render Operator section when OPERATOR_NAME is whitespace only', () => {
      process.env.OPERATOR_NAME = '   ';
      const { container } = render(<TermsOfServicePage />);
      const text = container.textContent || '';
      expect(text).not.toMatch(/Operator & Contact/i);
    });
  });

  describe('Cross-links', () => {
    it('should render Back to Home link to /', () => {
      render(<TermsOfServicePage />);
      const homeLink = screen.getByRole('link', { name: /Back to Home/i });
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('should render Privacy Policy link to /privacy', () => {
      render(<TermsOfServicePage />);
      const privacyLink = screen.getByRole('link', { name: /Privacy Policy/i });
      expect(privacyLink).toHaveAttribute('href', '/privacy');
    });
  });

  describe('Back control', () => {
    it('should place the Back link before the single h1', () => {
      render(<TermsOfServicePage />);
      const backLink = screen.getByRole('link', { name: 'Back' });
      const heading = screen.getByRole('heading', { level: 1 });

      expect(backLink).toHaveAttribute('href', '/');
      expect(
        backLink.compareDocumentPosition(heading) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });
  });
});
