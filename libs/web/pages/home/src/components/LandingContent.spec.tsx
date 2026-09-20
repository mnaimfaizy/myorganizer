import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import LandingContent from './LandingContent';

jest.mock('next/link', () => {
  return ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

jest.mock('next/image', () => {
  return ({ alt }: { alt: string }) => (
    <div data-testid="next-image">{alt}</div>
  );
});

jest.mock('lucide-react', () => ({
  CheckSquare: () => <div data-testid="icon-check-square" />,
  CloudUpload: () => <div data-testid="icon-cloud-upload" />,
  Lock: () => <div data-testid="icon-lock" />,
  MapPin: () => <div data-testid="icon-map-pin" />,
  RefreshCw: () => <div data-testid="icon-refresh-cw" />,
  ShieldCheck: () => <div data-testid="icon-shield-check" />,
  Smartphone: () => <div data-testid="icon-smartphone" />,
  Youtube: () => <div data-testid="icon-youtube" />,
}));

jest.mock('@myorganizer/web-ui', () => ({
  AppLogo: ({
    variant,
    height,
    ...props
  }: {
    variant?: string;
    height?: string | number;
    [key: string]: unknown;
  }) => (
    <div data-testid="app-logo" {...props}>
      {variant} {height}
    </div>
  ),
}));

jest.mock('./MobileMenu', () => {
  return function MockMobileMenu() {
    return <div data-testid="mobile-menu" />;
  };
});

jest.mock('./Reveal', () => {
  return function MockReveal({
    children,
    as: Component = 'div',
    ...props
  }: {
    children?: React.ReactNode;
    as?: React.ElementType;
    [key: string]: unknown;
  }) {
    return <Component {...props}>{children}</Component>;
  };
});

describe('LandingContent', () => {
  it('renders without throwing', () => {
    expect(() => {
      render(<LandingContent />);
    }).not.toThrow();
  });

  it('renders the footer with a link to Privacy Policy at /privacy', () => {
    render(<LandingContent />);

    const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  it('renders the footer with a link to Terms of Service at /terms', () => {
    render(<LandingContent />);

    const termsLink = screen.getByRole('link', { name: 'Terms of Service' });
    expect(termsLink).toHaveAttribute('href', '/terms');
  });

  it('renders footer links to Features, Security, Pricing, and Support with href="#"', () => {
    render(<LandingContent />);

    // Get all links and filter to those in the footer (those with href="#" for these labels)
    const allLinks = screen.getAllByRole('link');

    const featureLink = allLinks.find(
      (link) =>
        link.textContent === 'Features' && link.getAttribute('href') === '#',
    );
    const securityLink = allLinks.find(
      (link) =>
        link.textContent === 'Security' && link.getAttribute('href') === '#',
    );
    const pricingLink = allLinks.find(
      (link) =>
        link.textContent === 'Pricing' && link.getAttribute('href') === '#',
    );
    const supportLink = screen.getByRole('link', { name: 'Support' });

    expect(featureLink).toBeInTheDocument();
    expect(featureLink).toHaveAttribute('href', '#');
    expect(securityLink).toBeInTheDocument();
    expect(securityLink).toHaveAttribute('href', '#');
    expect(pricingLink).toBeInTheDocument();
    expect(pricingLink).toHaveAttribute('href', '#');
    expect(supportLink).toHaveAttribute('href', '#');
  });
});
